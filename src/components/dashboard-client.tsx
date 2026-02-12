"use client";

import { useEffect, useMemo, useState } from "react";

type Side = "" | "BUY" | "SELL";
type SortField = "matchTime" | "sizeUsdc" | "walletAddress";

interface TradeRow {
  id: string;
  builderApiKey: string | null;
  walletAddress: string;
  transactionHash: string | null;
  matchTime: string | null;
  market: string | null;
  assetId: string | null;
  side: string | null;
  sizeUsdc: string;
  rawJson: unknown;
}

interface TradesResponse {
  ok: boolean;
  items: TradeRow[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  summary: {
    totalTrades: number;
    builderVolumeUsdc: string;
    avgTradeSizeUsdc: string;
    volumeTodayUsdc: string;
    volume7dUsdc: string;
    volume30dUsdc: string;
    tradesToday: number;
    uniqueWallets: number;
  };
  syncState: {
    lastSyncedMatchTime: string | null;
    lastSyncedCursor: string | null;
    lastRunAt: string | null;
  };
}

function toUtc(value: string | null) {
  if (!value) return "-";
  return new Date(value).toISOString().replace("T", " ").replace(".000Z", " UTC");
}

function truncate(value: string | null, head = 8, tail = 6) {
  if (!value) return "-";
  if (value.length <= head + tail + 3) return value;
  return `${value.slice(0, head)}...${value.slice(-tail)}`;
}

function PolygonLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-cyan-300 hover:text-cyan-200">
      {children}
    </a>
  );
}

export function DashboardClient() {
  const [filters, setFilters] = useState({
    startDate: "",
    endDate: "",
    wallet: "",
    marketAsset: "",
    side: "" as Side,
  });
  const [appliedFilters, setAppliedFilters] = useState(filters);
  const [sortBy, setSortBy] = useState<SortField>("matchTime");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<TradesResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [rawModalTrade, setRawModalTrade] = useState<TradeRow | null>(null);

  const queryString = useMemo(() => {
    const params = new URLSearchParams({
      page: String(page),
      pageSize: "25",
      sortBy,
      sortDir,
    });
    if (appliedFilters.startDate) params.set("startDate", appliedFilters.startDate);
    if (appliedFilters.endDate) params.set("endDate", appliedFilters.endDate);
    if (appliedFilters.wallet) params.set("wallet", appliedFilters.wallet);
    if (appliedFilters.marketAsset) params.set("marketAsset", appliedFilters.marketAsset);
    if (appliedFilters.side) params.set("side", appliedFilters.side);
    return params.toString();
  }, [appliedFilters, page, sortBy, sortDir]);

  async function loadTrades() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/trades?${queryString}`, { cache: "no-store" });
      const payload = (await response.json()) as TradesResponse & { error?: string };
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? "Failed to fetch trades");
      }
      setData(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch trades");
    } finally {
      setLoading(false);
    }
  }

  async function syncNow() {
    setSyncing(true);
    setError(null);
    try {
      const response = await fetch("/api/sync", { method: "POST" });
      const payload = (await response.json()) as { ok: boolean; error?: string; message?: string };
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? "Sync failed");
      }
      await loadTrades();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  function exportCsv() {
    const params = new URLSearchParams({
      sortBy,
      sortDir,
      format: "csv",
    });
    if (appliedFilters.startDate) params.set("startDate", appliedFilters.startDate);
    if (appliedFilters.endDate) params.set("endDate", appliedFilters.endDate);
    if (appliedFilters.wallet) params.set("wallet", appliedFilters.wallet);
    if (appliedFilters.marketAsset) params.set("marketAsset", appliedFilters.marketAsset);
    if (appliedFilters.side) params.set("side", appliedFilters.side);
    window.location.href = `/api/trades?${params.toString()}`;
  }

  async function copyAllTxHashes() {
    setError(null);
    try {
      const params = new URLSearchParams({
        format: "txhashes",
        sortBy,
        sortDir,
      });
      if (appliedFilters.startDate) params.set("startDate", appliedFilters.startDate);
      if (appliedFilters.endDate) params.set("endDate", appliedFilters.endDate);
      if (appliedFilters.wallet) params.set("wallet", appliedFilters.wallet);
      if (appliedFilters.marketAsset) params.set("marketAsset", appliedFilters.marketAsset);
      if (appliedFilters.side) params.set("side", appliedFilters.side);
      const response = await fetch(`/api/trades?${params.toString()}`, { cache: "no-store" });
      const payload = (await response.json()) as { ok: boolean; hashes: string[]; error?: string };
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? "Failed to fetch tx hashes");
      }
      await navigator.clipboard.writeText(payload.hashes.join("\n"));
      setCopiedKey("all-tx");
      setTimeout(() => setCopiedKey(null), 1400);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to copy tx hashes");
    }
  }

  async function copyText(key: string, value: string | null) {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 1400);
    } catch {
      setError("Clipboard copy failed.");
    }
  }

  function applyFilters() {
    setPage(1);
    setAppliedFilters(filters);
  }

  function onSort(nextSort: SortField) {
    if (nextSort === sortBy) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(nextSort);
      setSortDir("desc");
    }
  }

  useEffect(() => {
    void loadTrades();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryString]);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-lg border border-slate-700 bg-slate-900 p-4">
          <p className="text-xs uppercase tracking-wider text-slate-400">Total Trades (Range)</p>
          <p className="mt-2 text-2xl font-semibold">{data?.summary.totalTrades ?? 0}</p>
        </div>
        <div className="rounded-lg border border-slate-700 bg-slate-900 p-4">
          <p className="text-xs uppercase tracking-wider text-slate-400">Builder Volume (USDC)</p>
          <p className="mt-2 text-2xl font-semibold">{data?.summary.builderVolumeUsdc ?? "0"}</p>
        </div>
        <div className="rounded-lg border border-slate-700 bg-slate-900 p-4">
          <p className="text-xs uppercase tracking-wider text-slate-400">Avg Trade Size (USDC)</p>
          <p className="mt-2 text-2xl font-semibold">{data?.summary.avgTradeSizeUsdc ?? "0"}</p>
        </div>
        <div className="rounded-lg border border-slate-700 bg-slate-900 p-4">
          <p className="text-xs uppercase tracking-wider text-slate-400">Unique Wallets (Range)</p>
          <p className="mt-2 text-2xl font-semibold">{data?.summary.uniqueWallets ?? 0}</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-slate-700 bg-slate-900 p-4">
          <p className="text-xs uppercase tracking-wider text-slate-400">Volume Today (UTC)</p>
          <p className="mt-2 text-xl font-semibold">{data?.summary.volumeTodayUsdc ?? "0"}</p>
        </div>
        <div className="rounded-lg border border-slate-700 bg-slate-900 p-4">
          <p className="text-xs uppercase tracking-wider text-slate-400">Volume 7d</p>
          <p className="mt-2 text-xl font-semibold">{data?.summary.volume7dUsdc ?? "0"}</p>
        </div>
        <div className="rounded-lg border border-slate-700 bg-slate-900 p-4">
          <p className="text-xs uppercase tracking-wider text-slate-400">Volume 30d / Trades Today</p>
          <p className="mt-2 text-xl font-semibold">
            {data?.summary.volume30dUsdc ?? "0"} / {data?.summary.tradesToday ?? 0}
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-slate-700 bg-slate-900 p-4">
        <div className="grid gap-3 md:grid-cols-6">
          <input
            type="date"
            className="rounded border border-slate-600 bg-slate-950 px-2 py-2 text-sm"
            value={filters.startDate}
            onChange={(event) => setFilters((prev) => ({ ...prev, startDate: event.target.value }))}
          />
          <input
            type="date"
            className="rounded border border-slate-600 bg-slate-950 px-2 py-2 text-sm"
            value={filters.endDate}
            onChange={(event) => setFilters((prev) => ({ ...prev, endDate: event.target.value }))}
          />
          <input
            type="text"
            placeholder="Wallet address"
            className="rounded border border-slate-600 bg-slate-950 px-2 py-2 text-sm"
            value={filters.wallet}
            onChange={(event) => setFilters((prev) => ({ ...prev, wallet: event.target.value }))}
          />
          <input
            type="text"
            placeholder="Market or asset id"
            className="rounded border border-slate-600 bg-slate-950 px-2 py-2 text-sm"
            value={filters.marketAsset}
            onChange={(event) =>
              setFilters((prev) => ({ ...prev, marketAsset: event.target.value }))
            }
          />
          <select
            className="rounded border border-slate-600 bg-slate-950 px-2 py-2 text-sm"
            value={filters.side}
            onChange={(event) => setFilters((prev) => ({ ...prev, side: event.target.value as Side }))}
          >
            <option value="">All Sides</option>
            <option value="BUY">BUY</option>
            <option value="SELL">SELL</option>
          </select>
          <button
            onClick={applyFilters}
            className="rounded bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-500"
          >
            Apply Filters
          </button>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            onClick={syncNow}
            disabled={syncing}
            className="rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-60"
          >
            {syncing ? "Syncing..." : "Sync Now"}
          </button>
          <button
            onClick={exportCsv}
            className="rounded bg-slate-700 px-3 py-2 text-sm font-medium text-white hover:bg-slate-600"
          >
            Export CSV
          </button>
          <button
            onClick={copyAllTxHashes}
            className="relative rounded bg-slate-700 px-3 py-2 text-sm font-medium text-white hover:bg-slate-600"
          >
            Copy All Tx Hashes
            {copiedKey === "all-tx" ? (
              <span className="absolute -top-7 left-1/2 -translate-x-1/2 rounded bg-emerald-600 px-2 py-1 text-xs text-white">
                Copied
              </span>
            ) : null}
          </button>
          <button
            onClick={loadTrades}
            className="rounded bg-slate-700 px-3 py-2 text-sm font-medium text-white hover:bg-slate-600"
          >
            Refresh
          </button>
        </div>
        <p className="mt-3 text-xs text-slate-400">
          Last sync: {data?.syncState.lastRunAt ? toUtc(data.syncState.lastRunAt) : "never"}
        </p>
      </div>

      {error ? (
        <div className="rounded border border-red-600 bg-red-950/50 p-3 text-sm text-red-200">{error}</div>
      ) : null}

      <div className="max-h-[68vh] overflow-auto rounded-lg border border-slate-700">
        <table className="min-w-full table-fixed text-sm">
          <thead className="sticky top-0 z-20 bg-slate-900/95 backdrop-blur">
            <tr className="text-left text-slate-200">
              <th className="w-44 px-4 py-3 font-medium">Trade ID</th>
              <th
                className="w-44 cursor-pointer px-4 py-3 font-medium"
                onClick={() => onSort("matchTime")}
              >
                Match Time (UTC) {sortBy === "matchTime" ? (sortDir === "asc" ? "^" : "v") : ""}
              </th>
              <th
                className="w-52 cursor-pointer px-4 py-3 font-medium"
                onClick={() => onSort("walletAddress")}
              >
                Wallet {sortBy === "walletAddress" ? (sortDir === "asc" ? "^" : "v") : ""}
              </th>
              <th className="w-44 px-4 py-3 font-medium">Market</th>
              <th className="w-40 px-4 py-3 font-medium">Asset</th>
              <th className="w-20 px-4 py-3 font-medium">Side</th>
              <th className="w-32 cursor-pointer px-4 py-3 font-medium" onClick={() => onSort("sizeUsdc")}>
                Size USDC {sortBy === "sizeUsdc" ? (sortDir === "asc" ? "^" : "v") : ""}
              </th>
              <th className="w-52 px-4 py-3 font-medium">Tx Hash</th>
              <th className="w-28 px-4 py-3 font-medium">Raw</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="px-4 py-10 text-center text-slate-400" colSpan={9}>
                  Loading trades...
                </td>
              </tr>
            ) : data?.items.length ? (
              data.items.map((trade) => (
                <tr key={trade.id} className="border-t border-slate-800 bg-slate-950/70 hover:bg-slate-900/90">
                  <td className="px-4 py-3 font-mono text-xs align-top">{trade.id}</td>
                  <td className="px-4 py-3 align-top">{toUtc(trade.matchTime)}</td>
                  <td className="px-4 py-3 align-top">
                    <div className="flex items-center gap-2">
                      <PolygonLink href={`https://polygonscan.com/address/${trade.walletAddress}`}>
                        <span className="font-mono">{truncate(trade.walletAddress, 10, 8)}</span>
                      </PolygonLink>
                      <button
                        onClick={() => void copyText(`wallet-${trade.id}`, trade.walletAddress)}
                        className="relative rounded bg-slate-700 px-2 py-1 text-xs hover:bg-slate-600"
                      >
                        Copy
                        {copiedKey === `wallet-${trade.id}` ? (
                          <span className="absolute -top-7 left-1/2 -translate-x-1/2 rounded bg-emerald-600 px-2 py-1 text-[10px] text-white">
                            Copied
                          </span>
                        ) : null}
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs align-top">{truncate(trade.market, 12, 8)}</td>
                  <td className="px-4 py-3 font-mono text-xs align-top">{truncate(trade.assetId, 12, 8)}</td>
                  <td className="px-4 py-3 align-top">{trade.side ?? "-"}</td>
                  <td className="px-4 py-3 align-top">{trade.sizeUsdc}</td>
                  <td className="px-4 py-3 align-top">
                    {trade.transactionHash ? (
                      <div className="flex items-center gap-2">
                        <PolygonLink href={`https://polygonscan.com/tx/${trade.transactionHash}`}>
                          <span className="font-mono">{truncate(trade.transactionHash, 10, 8)}</span>
                        </PolygonLink>
                        <button
                          onClick={() => void copyText(`tx-${trade.id}`, trade.transactionHash)}
                          className="relative rounded bg-slate-700 px-2 py-1 text-xs hover:bg-slate-600"
                        >
                          Copy
                          {copiedKey === `tx-${trade.id}` ? (
                            <span className="absolute -top-7 left-1/2 -translate-x-1/2 rounded bg-emerald-600 px-2 py-1 text-[10px] text-white">
                              Copied
                            </span>
                          ) : null}
                        </button>
                      </div>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="px-4 py-3 align-top">
                    <button
                      onClick={() => setRawModalTrade(trade)}
                      className="rounded bg-slate-700 px-2 py-1 text-xs hover:bg-slate-600"
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="px-3 py-8 text-center text-slate-400" colSpan={9}>
                  No builder trades found for current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-400">
          Page {data?.page ?? page} of {data?.totalPages ?? 1}
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
            disabled={(data?.page ?? page) <= 1}
            className="rounded bg-slate-700 px-3 py-2 text-sm disabled:opacity-50"
          >
            Previous
          </button>
          <button
            onClick={() =>
              setPage((prev) => Math.min(prev + 1, data?.totalPages ? data.totalPages : prev + 1))
            }
            disabled={(data?.page ?? page) >= (data?.totalPages ?? 1)}
            className="rounded bg-slate-700 px-3 py-2 text-sm disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>

      {rawModalTrade ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-3xl rounded-lg border border-slate-700 bg-slate-900 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-100">Raw JSON - Trade {rawModalTrade.id}</h3>
              <button
                onClick={() => setRawModalTrade(null)}
                className="rounded bg-slate-700 px-3 py-1 text-xs hover:bg-slate-600"
              >
                Close
              </button>
            </div>
            <pre className="max-h-[70vh] overflow-auto rounded bg-black p-3 text-xs text-slate-200">
              {JSON.stringify(rawModalTrade.rawJson, null, 2)}
            </pre>
          </div>
        </div>
      ) : null}
    </div>
  );
}
