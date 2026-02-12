import "server-only";
import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  CLOB_HOST: z.string().url().default("https://clob.polymarket.com"),
  POLY_BUILDER_API_KEY: z.string().min(1),
  POLY_BUILDER_SECRET: z.string().min(1),
  POLY_BUILDER_PASSPHRASE: z.string().min(1),
  POLY_BUILDER_ADDRESS: z.string().optional(),
  TIMEZONE: z.string().default("UTC"),
});

type Env = z.infer<typeof envSchema>;

let cachedEnv: Env | null = null;

export function getEnv(): Env {
  if (cachedEnv) return cachedEnv;

  cachedEnv = envSchema.parse({
    DATABASE_URL: process.env.DATABASE_URL,
    CLOB_HOST: process.env.CLOB_HOST,
    POLY_BUILDER_API_KEY: process.env.POLY_BUILDER_API_KEY,
    POLY_BUILDER_SECRET: process.env.POLY_BUILDER_SECRET,
    POLY_BUILDER_PASSPHRASE: process.env.POLY_BUILDER_PASSPHRASE,
    POLY_BUILDER_ADDRESS: process.env.POLY_BUILDER_ADDRESS,
    TIMEZONE: process.env.TIMEZONE,
  });

  return cachedEnv;
}
