import type { BuilderTrade } from "@polymarket/clob-client";

export function parseBuilderDate(value?: string | null): Date | null {
  if (!value) return null;
  const raw = value.trim();
  if (/^\d+$/.test(raw)) {
    const asNumber = Number(raw);
    if (Number.isFinite(asNumber)) {
      const milliseconds = raw.length <= 10 ? asNumber * 1000 : asNumber;
      const epochDate = new Date(milliseconds);
      if (!Number.isNaN(epochDate.getTime())) return epochDate;
    }
  }
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function normalizeBuilderTradeId(trade: BuilderTrade): string {
  return String(trade.id ?? "").trim();
}

export function resolveBuilderWallet(trade: BuilderTrade): string {
  return (
    trade.maker?.trim() ||
    trade.owner?.trim() ||
    trade.builder?.trim() ||
    "unknown"
  );
}
