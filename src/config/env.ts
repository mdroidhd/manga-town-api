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
