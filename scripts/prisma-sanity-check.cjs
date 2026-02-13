const fs = require("node:fs");
const path = require("node:path");

function fail(message) {
  console.error(`[prisma-sanity] ${message}`);
  process.exit(1);
}

const schemaPath = path.join(process.cwd(), "prisma", "schema.prisma");
if (!fs.existsSync(schemaPath)) {
  fail("Missing prisma/schema.prisma");
}

const schema = fs.readFileSync(schemaPath, "utf8");

if (/provider\s*=\s*"sqlite"/i.test(schema)) {
  fail('Invalid datasource provider: found "sqlite". Use provider = "postgresql".');
}

if (/env\("DATABASE_UR"\)/.test(schema)) {
  fail('Detected typo env("DATABASE_UR"). Use env("DATABASE_URL").');
}

if (!/provider\s*=\s*"postgresql"/i.test(schema)) {
  fail('Datasource provider must be "postgresql".');
}

if (!/url\s*=\s*env\("DATABASE_URL"\)/.test(schema)) {
  fail('Datasource URL must be url = env("DATABASE_URL").');
}

const isVercel = process.env.VERCEL === "1";
const isCI = process.env.CI === "true";

if (isVercel || isCI) {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl || databaseUrl.trim().length === 0) {
    fail("DATABASE_URL is missing. Set DATABASE_URL in Vercel Environment Variables.");
  }
  if (!/^postgres(ql)?:\/\//i.test(databaseUrl)) {
    fail("DATABASE_URL must start with postgresql:// or postgres:// on Vercel/CI.");
  }
}

console.log("[prisma-sanity] OK");
