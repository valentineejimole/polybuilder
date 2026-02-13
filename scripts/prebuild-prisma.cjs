const { execSync } = require("node:child_process");

function run(cmd) {
  try {
    execSync(cmd, { stdio: "inherit" });
  } catch (error) {
    const status = typeof error?.status === "number" ? error.status : "unknown";
    const signal = error?.signal || "none";
    console.error(`[prebuild-prisma] Command failed: ${cmd} (status=${status}, signal=${signal})`);
    if (error?.stdout) {
      console.error(`[prebuild-prisma] stdout: ${String(error.stdout)}`);
    }
    if (error?.stderr) {
      console.error(`[prebuild-prisma] stderr: ${String(error.stderr)}`);
    }
    throw error;
  }
}

run("node scripts/prisma-sanity-check.cjs");

const databaseUrl = process.env.DATABASE_URL || "";
const shouldRunMigrate =
  process.env.VERCEL === "1" ||
  process.env.CI === "true" ||
  databaseUrl.startsWith("postgres://") ||
  databaseUrl.startsWith("postgresql://");

run("npx prisma generate");

if (shouldRunMigrate) {
  run("npx prisma migrate deploy");
} else {
  console.log(
    "[prebuild-prisma] Skipping prisma migrate deploy (local non-Postgres DATABASE_URL and not VERCEL/CI).",
  );
}
