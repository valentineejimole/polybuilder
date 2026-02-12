import "server-only";
import { randomUUID } from "node:crypto";
import { BuilderConfig } from "@polymarket/builder-signing-sdk";
import { Chain, ClobClient, type BuilderTrade, type TradeParams } from "@polymarket/clob-client";
import { getEnv } from "@/lib/env";

const RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 504]);
const MAX_RETRIES = 4;

export class BuilderAuthError extends Error {
  status?: number;
  correlationId: string;
  clockSkewSeconds?: number;

  constructor(message: string, correlationId: string, status?: number, clockSkewSeconds?: number) {
    super(message);
    this.name = "BuilderAuthError";
    this.status = status;
    this.correlationId = correlationId;
    this.clockSkewSeconds = clockSkewSeconds;
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseStatus(error: unknown): number | undefined {
  if (!error || typeof error !== "object") return undefined;
  const maybeStatus = (error as { status?: unknown }).status;
  if (typeof maybeStatus === "number") return maybeStatus;
  const msg = (error as { message?: unknown }).message;
  if (typeof msg === "string") {
    const match = msg.match(/\b(4\d\d|5\d\d)\b/);
    if (match) return Number(match[1]);
  }
  return undefined;
}

function parseMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return "Unknown builder request error";
}

function parseResponseData(error: unknown): string | undefined {
  if (!error || typeof error !== "object") return undefined;
  const maybeResponse = (error as { response?: unknown }).response;
  if (!maybeResponse || typeof maybeResponse !== "object") return undefined;
  const maybeData = (maybeResponse as { data?: unknown }).data;
  if (maybeData === undefined) return undefined;
  if (typeof maybeData === "string") return maybeData;
  try {
    return JSON.stringify(maybeData);
  } catch {
    return undefined;
  }
}

export function getSafeClobErrorLog(error: unknown): {
  status?: number;
  message: string;
  data?: string;
} {
  return {
    status: parseStatus(error),
    message: parseMessage(error),
    data: parseResponseData(error),
  };
}

function buildClient() {
  const env = getEnv();
  const builderConfig = new BuilderConfig({
    localBuilderCreds: {
      key: env.POLY_BUILDER_API_KEY,
      secret: env.POLY_BUILDER_SECRET,
      passphrase: env.POLY_BUILDER_PASSPHRASE,
    },
  });

  return new ClobClient(
    env.CLOB_HOST,
    Chain.POLYGON,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    true,
    builderConfig,
    undefined,
    true,
  );
}

export async function getClockSkewSeconds(): Promise<number | undefined> {
  try {
    const client = buildClient();
    const serverEpoch = await client.getServerTime();
    return Math.abs(serverEpoch - Math.floor(Date.now() / 1000));
  } catch {
    return undefined;
  }
}

async function withRetry<T>(fn: () => Promise<T>) {
  let lastError: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const status = parseStatus(error);
      if (attempt >= MAX_RETRIES || (status !== undefined && !RETRYABLE_STATUS.has(status))) {
        break;
      }
      await sleep(Math.min(400 * 2 ** attempt + Math.floor(Math.random() * 200), 6_000));
    }
  }
  throw lastError;
}

export async function getBuilderTradesPage(
  params?: TradeParams,
  nextCursor?: string,
): Promise<{ trades: BuilderTrade[]; nextCursor: string; count: number; limit: number }> {
  const correlationId = randomUUID();
  const client = buildClient();

  try {
    const page = await withRetry(() => client.getBuilderTrades(params, nextCursor));
    return {
      trades: page.trades ?? [],
      nextCursor: page.next_cursor ?? "",
      count: page.count ?? 0,
      limit: page.limit ?? 0,
    };
  } catch (error) {
    const status = parseStatus(error);
    const message = parseMessage(error);
    const skew = await getClockSkewSeconds();

    if (status === 401 || /invalid api key/i.test(message) || /builder key auth failed/i.test(message)) {
      throw new BuilderAuthError(
        `Builder auth failed: check POLY_BUILDER_* env vars and restart server (status ${status ?? "unknown"}, correlationId ${correlationId}${skew !== undefined ? `, clockSkewSeconds ${skew}` : ""})`,
        correlationId,
        status,
        skew,
      );
    }

    throw new Error(
      `Builder CLOB request failed${status ? ` ${status}` : ""}: ${message} (correlationId ${correlationId}${skew !== undefined ? `, clockSkewSeconds ${skew}` : ""})`,
    );
  }
}

export async function checkBuilderConnection(): Promise<{
  connected: boolean;
  mode: "builder";
  host: string;
  error?: string;
  correlationId?: string;
}> {
  const env = getEnv();
  const correlationId = randomUUID();

  try {
    await withRetry(() => buildClient().getBuilderTrades());
    return { connected: true, mode: "builder", host: env.CLOB_HOST };
  } catch (error) {
    const status = parseStatus(error);
    const skew = await getClockSkewSeconds();
    const details =
      status === 401
        ? `Builder auth failed: check POLY_BUILDER_* env vars and restart server (status 401, correlationId ${correlationId}${skew !== undefined ? `, clockSkewSeconds ${skew}` : ""})`
        : `Builder connection failed${status ? ` ${status}` : ""}: ${parseMessage(error)} (correlationId ${correlationId}${skew !== undefined ? `, clockSkewSeconds ${skew}` : ""})`;
    return {
      connected: false,
      mode: "builder",
      host: env.CLOB_HOST,
      error: details,
      correlationId,
    };
  }
}
