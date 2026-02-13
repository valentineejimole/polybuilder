const { execSync } = require("node:child_process");

function run(cmd) {
  execSync(cmd, { stdio: "inherit" });
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
