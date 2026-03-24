import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  MC_HOST: z.string().min(1),
  MC_PORT: z.coerce.number().int().positive().default(25565),
  MC_USERNAME: z.string().min(1),
  MC_PASSWORD: z.string().optional().default(''),
  MC_VERSION: z.string().optional().default(''),
  PRICE_KEYWORDS: z.string().default('price,sell,buy,shop,auction,market'),
  CHAT_COMMAND_PREFIX: z.string().default('!'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment configuration:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = {
  ...parsed.data,
  PRICE_KEYWORDS: parsed.data.PRICE_KEYWORDS
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean),
};
