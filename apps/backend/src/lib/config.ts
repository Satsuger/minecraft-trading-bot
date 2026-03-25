import "dotenv/config";
import { z } from "zod";

const booleanString = z
  .string()
  .optional()
  .default("false")
  .transform((value, ctx) => {
    const normalized = value.trim().toLowerCase();

    if (["1", "true", "yes", "on"].includes(normalized)) {
      return true;
    }

    if (["0", "false", "no", "off", ""].includes(normalized)) {
      return false;
    }

    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Expected a boolean value like true/false",
    });

    return z.NEVER;
  });

const envSchema = z.object({
  MC_HOST: z.string().min(1),
  MC_PORT: z.coerce.number().int().positive().default(25565),
  MC_USERNAME: z.string().min(1),
  MC_PASSWORD: z.string().optional().default(""),
  MC_VERSION: z.string().optional().default(""),
  PRICE_KEYWORDS: z.string().default("price,sell,buy,shop,auction,market"),
  CHAT_COMMAND_PREFIX: z.string().default("!"),
  PRISMARINE_VIEWER_ENABLED: booleanString.default("true"),
  PRISMARINE_VIEWER_PORT: z.coerce.number().int().positive().default(3000),
  PRISMARINE_VIEWER_FIRST_PERSON: booleanString,
  PRISMARINE_VIEWER_VIEW_DISTANCE: z.coerce.number().int().positive().default(6),
  PRISMARINE_VIEWER_PREFIX: z.string().optional().default(""),
  DATABASE_ENABLED: booleanString.default("true"),
  DATABASE_URL: z.string().optional().default(""),
  DB_HOST: z.string().default("127.0.0.1"),
  DB_PORT: z.coerce.number().int().positive().default(5432),
  DB_NAME: z.string().default("torgash"),
  DB_USER: z.string().default("minecraft"),
  DB_PASSWORD: z.string().default("minecraft"),
  DB_SSL: booleanString.default("false"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment configuration:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = {
  ...parsed.data,
  DATABASE_URL:
    parsed.data.DATABASE_URL.trim() ||
    buildDatabaseUrl({
      host: parsed.data.DB_HOST,
      port: parsed.data.DB_PORT,
      database: parsed.data.DB_NAME,
      user: parsed.data.DB_USER,
      password: parsed.data.DB_PASSWORD,
    }),
  PRICE_KEYWORDS: parsed.data.PRICE_KEYWORDS
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean),
};

function buildDatabaseUrl({
  host,
  port,
  database,
  user,
  password,
}: {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
}): string {
  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}`;
}
