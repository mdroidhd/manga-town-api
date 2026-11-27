import { z } from 'zod';

/**
 * Configuración validada al arrancar. Si falta algo o tiene el tipo
 * equivocado, el proceso no levanta en vez de fallar en la primera petición.
 */
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  API_PREFIX: z.string().default('v1'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  CORS_ORIGINS: z
    .string()
    .default('*')
    .transform((value) => value.split(',').map((origin) => origin.trim())),
  SWAGGER_ENABLED: z
    .string()
    .default('true')
    .transform((value) => value !== 'false'),
  REDIS_URL: z.string().url().optional(),
  CACHE_PREFIX: z.string().default('mangatown:'),
  CACHE_TTL_SEARCH: z.coerce.number().int().positive().default(600),
  CACHE_TTL_LATEST: z.coerce.number().int().positive().default(120),
  CACHE_TTL_SERIES: z.coerce.number().int().positive().default(3600),
  CACHE_TTL_CHAPTERS: z.coerce.number().int().positive().default(1800),
  CACHE_EPOCH_CHECK_MS: z.coerce.number().int().positive().default(5000),
  CACHE_PURGE_TOKEN: z.string().optional(),
  DATABASE_URL: z.string().url().optional(),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(raw: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(raw);
  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('; ');
    throw new Error(`Configuración inválida: ${detail}`);
  }
  return parsed.data;
}
