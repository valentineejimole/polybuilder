import crypto from "node:crypto";
import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const SORT_FIELDS = new Set([
  "id",
  "matchTime",
  "walletAddress",
  "market",
  "assetId",
  "side",
  "sizeUsdc",
  "transactionHash",
]);

function parseDate(value: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function csvEscape(value: string | null | undefined) {
  const text = value ?? "";
  if (text.includes(",") || text.includes('"') || text.includes("\n")) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function toIso(value: Date | null) {
  return value ? value.toISOString() : "";
}

function utcDayStart(reference = new Date()) {
  return new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth(), reference.getUTCDate()));
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const page = Math.max(Number(searchParams.get("page") ?? "1"), 1);
    const pageSize = Math.min(Math.max(Number(searchParams.get("pageSize") ?? "25"), 1), 200);
    const sortByRaw = searchParams.get("sortBy") ?? "matchTime";
    const sortBy = SORT_FIELDS.has(sortByRaw) ? sortByRaw : "matchTime";
    const sortDir = searchParams.get("sortDir") === "asc" ? "asc" : "desc";
    const wallet = (searchParams.get("wallet") ?? "").trim();
    const marketAsset = (searchParams.get("marketAsset") ?? "").trim();
    const side = (searchParams.get("side") ?? "").trim();
    const startDate = parseDate(searchParams.get("startDate"));
    const endDate = parseDate(searchParams.get("endDate"));
    const format = searchParams.get("format");

    const baseWhere: Prisma.TradeWhereInput = {
      ...(wallet ? { walletAddress: { contains: wallet } } : {}),
      ...(side ? { side } : {}),
      ...(marketAsset
        ? {
            OR: [{ market: { contains: marketAsset } }, { assetId: { contains: marketAsset } }],
          }
        : {}),
    };

    const where: Prisma.TradeWhereInput = {
      ...baseWhere,
      ...(startDate || endDate
        ? {
            matchTime: {
              ...(startDate ? { gte: startDate } : {}),
              ...(endDate ? { lte: endDate } : {}),
            },
          }
        : {}),
    };

    const todayStart = utcDayStart();
    const sevenDayStart = new Date(todayStart.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDayStart = new Date(todayStart.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [total, volumeAggregate, todayAgg, sevenDayAgg, thirtyDayAgg, tradesToday] = await Promise.all([
      prisma.trade.count({ where }),
      prisma.trade.aggregate({ where, _sum: { sizeUsdc: true } }),
      prisma.trade.aggregate({
        where: { ...baseWhere, matchTime: { gte: todayStart } },
        _sum: { sizeUsdc: true },
      }),
      prisma.trade.aggregate({
        where: { ...baseWhere, matchTime: { gte: sevenDayStart } },
        _sum: { sizeUsdc: true },
      }),
      prisma.trade.aggregate({
        where: { ...baseWhere, matchTime: { gte: thirtyDayStart } },
        _sum: { sizeUsdc: true },
      }),
      prisma.trade.count({
        where: { ...baseWhere, matchTime: { gte: todayStart } },
      }),
    ]);
    const totalVolumeUsdc = volumeAggregate._sum.sizeUsdc?.toString() ?? "0";
    const avgTradeSizeUsdc = total > 0 ? (Number(totalVolumeUsdc) / total).toFixed(6) : "0";
    const volumeTodayUsdc = todayAgg._sum.sizeUsdc?.toString() ?? "0";
    const volume7dUsdc = sevenDayAgg._sum.sizeUsdc?.toString() ?? "0";
    const volume30dUsdc = thirtyDayAgg._sum.sizeUsdc?.toString() ?? "0";

    if (format === "txhashes") {
      const rows = await prisma.trade.findMany({
        where,
        select: { transactionHash: true },
        orderBy: { matchTime: "desc" },
      });
      return NextResponse.json({
        ok: true,
        hashes: rows
          .map((row) => row.transactionHash)
          .filter((value): value is string => Boolean(value && value.trim())),
      });
    }

    if (format === "csv") {
      const rows = await prisma.trade.findMany({
        where,
        orderBy: { [sortBy]: sortDir },
      });

      const header = [
        "trade_id",
        "builder_api_key",
        "wallet_full",
        "market",
        "asset_id",
        "side",
        "size_usdc",
        "match_time_utc",
        "transaction_hash_full",
        "computed_volume_usdc_total",
      ];

      const lines = rows.map((trade) =>
        [
          trade.id,
          trade.builderApiKey ?? "",
          trade.walletAddress,
          trade.market ?? "",
          trade.assetId ?? "",
          trade.side ?? "",
          trade.sizeUsdc.toString(),
          toIso(trade.matchTime),
          trade.transactionHash ?? "",
          totalVolumeUsdc,
        ]
          .map(csvEscape)
          .join(","),
      );

      const csv = [header.join(","), ...lines].join("\n");
      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="builder-trades.csv"`,
        },
      });
    }

    const [items, uniqueWallets, syncState] = await Promise.all([
      prisma.trade.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { [sortBy]: sortDir },
      }),
      prisma.trade.findMany({
        where,
        distinct: ["walletAddress"],
        select: { walletAddress: true },
      }),
      prisma.syncState.findUnique({ where: { id: 1 } }),
    ]);

    return NextResponse.json({
      ok: true,
      page,
      pageSize,
      total,
      totalPages: Math.max(Math.ceil(total / pageSize), 1),
      summary: {
        totalTrades: total,
        builderVolumeUsdc: totalVolumeUsdc,
        avgTradeSizeUsdc,
        volumeTodayUsdc,
        volume7dUsdc,
        volume30dUsdc,
        tradesToday,
        uniqueWallets: uniqueWallets.length,
      },
      syncState: {
        lastSyncedMatchTime: syncState?.lastSyncedMatchTime?.toISOString() ?? null,
        lastSyncedCursor: syncState?.lastSyncedCursor ?? null,
        lastRunAt: syncState?.lastRunAt?.toISOString() ?? null,
      },
      items: items.map((trade) => ({
        id: trade.id,
        builderApiKey: trade.builderApiKey,
        walletAddress: trade.walletAddress,
        transactionHash: trade.transactionHash,
        matchTime: trade.matchTime?.toISOString() ?? null,
        market: trade.market,
        assetId: trade.assetId,
        side: trade.side,
        sizeUsdc: trade.sizeUsdc.toString(),
        rawJson: trade.rawJson,
      })),
    });
  } catch (error) {
    const correlationId = crypto.randomUUID();
    console.error(`[trades:${correlationId}]`, error);
    return NextResponse.json(
      {
        ok: false,
        error: `Failed to fetch trades (correlationId ${correlationId})`,
        correlationId,
      },
      { status: 500 },
    );
  }
}
