import { DashboardClient } from "@/components/dashboard-client";

export default function DashboardPage() {
  return (
    <main className="mx-auto w-full max-w-[1400px] px-4 py-8">
      <h1 className="text-2xl font-semibold text-slate-100">Builder-Routed Trades Dashboard</h1>
      <p className="mt-2 text-sm text-slate-400">
        Builder-attributed trades synced via authenticated Polymarket Builder Methods.
      </p>
      <p className="mt-1 text-xs text-slate-500">
        Builder volume is computed as SUM(sizeUsdc) over the filtered trade set.
      </p>
      <div className="mt-6">
        <DashboardClient />
      </div>
    </main>
  );
}
