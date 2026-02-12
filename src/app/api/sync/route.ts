import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { BuilderAuthError, getBuilderTradesPage, getSafeClobErrorLog } from "@/lib/clob";
import { normalizeBuilderTradeId, parseBuilderDate, resolveBuilderWallet } from "@/lib/trade-mapper";

const MAX_PAGES_PER_SYNC = 200;

export async function POST() {
  try {
    const syncState = await prisma.syncState.upsert({
      where: { id: 1 },
      update: {},
      create: { id: 1 },
    });

    let cursor = "";
    let lastProcessedCursor = "";
    let pageCount = 0;
    let totalFetched = 0;
    let totalUpserted = 0;
    let newestSeenMatchTime = syncState.lastSyncedMatchTime ?? null;
    const seenCursors = new Set<string>();

    while (pageCount < MAX_PAGES_PER_SYNC) {
      pageCount += 1;
      const page = await getBuilderTradesPage(undefined, cursor || undefined);

      if (page.trades.length === 0) {
        break;
      }

      totalFetched += page.trades.length;

      for (const trade of page.trades) {
        const tradeId = normalizeBuilderTradeId(trade);
        if (!tradeId) continue;
        const sizeUsdc = Number.isFinite(Number(trade.sizeUsdc)) ? trade.sizeUsdc : "0";

        const matchTime = parseBuilderDate(trade.matchTime);
        if (matchTime && (!newestSeenMatchTime || matchTime > newestSeenMatchTime)) {
          newestSeenMatchTime = matchTime;
        }

        const safeRawJson = JSON.parse(JSON.stringify(trade));
        await prisma.trade.upsert({
          where: { id: tradeId },
          update: {
            builderApiKey: trade.builder ?? null,
            walletAddress: resolveBuilderWallet(trade),
            market: trade.market ?? null,
            assetId: trade.assetId ?? null,
            side: trade.side ?? null,
            sizeUsdc,
            matchTime,
            transactionHash: trade.transactionHash ?? null,
            rawJson: safeRawJson,
          },
          create: {
            id: tradeId,
            builderApiKey: trade.builder ?? null,
            walletAddress: resolveBuilderWallet(trade),
            market: trade.market ?? null,
            assetId: trade.assetId ?? null,
            side: trade.side ?? null,
            sizeUsdc,
            matchTime,
            transactionHash: trade.transactionHash ?? null,
            rawJson: safeRawJson,
          },
        });
        totalUpserted += 1;
      }

      const nextCursor = page.nextCursor ?? "";
      if (!nextCursor || nextCursor === cursor || seenCursors.has(nextCursor)) {
        break;
      }

      seenCursors.add(nextCursor);
      lastProcessedCursor = nextCursor;
      cursor = nextCursor;
    }

    const updatedState = await prisma.syncState.upsert({
      where: { id: 1 },
      update: {
        lastSyncedMatchTime: newestSeenMatchTime ?? syncState.lastSyncedMatchTime,
        lastSyncedCursor: lastProcessedCursor || null,
        lastRunAt: new Date(),
      },
      create: {
        id: 1,
        lastSyncedMatchTime: newestSeenMatchTime ?? null,
        lastSyncedCursor: lastProcessedCursor || null,
        lastRunAt: new Date(),
      },
    });

    return NextResponse.json({
      ok: true,
      message: totalFetched === 0 ? "Sync completed: 0 builder trades returned." : "Sync completed.",
      fetched: totalFetched,
      upserted: totalUpserted,
      lastSyncedMatchTime: updatedState.lastSyncedMatchTime?.toISOString() ?? null,
      lastSyncedCursor: updatedState.lastSyncedCursor ?? null,
      lastRunAt: updatedState.lastRunAt?.toISOString() ?? null,
    });
  } catch (error) {
    if (error instanceof BuilderAuthError) {
      return NextResponse.json(
        {
          ok: false,
          error: error.message,
          status: error.status ?? 401,
          correlationId: error.correlationId,
        },
        { status: 401 },
      );
    }

    const correlationId = crypto.randomUUID();
    const safe = getSafeClobErrorLog(error);
    console.error(
      `[sync:${correlationId}] status=${safe.status ?? "unknown"} message=${safe.message}${safe.data ? ` data=${safe.data}` : ""}`,
    );
    const details = error instanceof Error ? error.message : "Unknown sync error";
    return NextResponse.json(
      {
        ok: false,
        error: `${details} (correlationId ${correlationId})`,
        correlationId,
      },
      { status: 500 },
    );
  }
}

export async function GET() {
  try {
    const syncState = await prisma.syncState.findUnique({ where: { id: 1 } });
    return NextResponse.json({
      ok: true,
      lastSyncedMatchTime: syncState?.lastSyncedMatchTime?.toISOString() ?? null,
      lastSyncedCursor: syncState?.lastSyncedCursor ?? null,
      lastRunAt: syncState?.lastRunAt?.toISOString() ?? null,
    });
  } catch (error) {
    const correlationId = crypto.randomUUID();
    const safe = getSafeClobErrorLog(error);
    console.error(
      `[sync-get:${correlationId}] status=${safe.status ?? "unknown"} message=${safe.message}${safe.data ? ` data=${safe.data}` : ""}`,
    );
    return NextResponse.json(
      {
        ok: false,
        error: `Failed to read sync state (correlationId ${correlationId})`,
        correlationId,
      },
      { status: 500 },
    );
  }
}
