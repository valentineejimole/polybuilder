import { checkBuilderConnection } from "@/lib/clob";
import { getEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const env = getEnv();
  const status = await checkBuilderConnection();

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-semibold text-slate-100">Settings</h1>
      <div className="mt-6 rounded-lg border border-slate-700 bg-slate-900 p-5">
        <p className="text-sm font-medium text-slate-300">Builder Address</p>
        <p className="mt-2 rounded bg-slate-950 p-2 font-mono text-xs text-slate-200">
          {env.POLY_BUILDER_ADDRESS || "Not set"}
        </p>
      </div>
      <div className="mt-4 rounded-lg border border-slate-700 bg-slate-900 p-5">
        <p className="text-sm font-medium text-slate-300">Builder Connectivity</p>
        <p className="mt-2 text-sm text-slate-200">
          Connected: {status.connected ? "yes" : "no"}
          {` (${status.mode} @ ${status.host})`}
        </p>
        {!status.connected && status.error ? (
          <p className="mt-2 text-xs text-red-300">{status.error}</p>
        ) : null}
      </div>
    </main>
  );
}
