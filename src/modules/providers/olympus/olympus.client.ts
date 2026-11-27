import { load } from 'cheerio';

export const OLYMPUS_FETCH = Symbol('OLYMPUS_FETCH');
export const DISCOVERY_ORIGIN = 'https://olympus.pages.dev';
export const CANONICAL_ORIGINS = ['https://olympusxyz.com'] as const;
/**
 * Dominios conocidos de la familia. Se aceptan como destino anunciado, pero
 * solo para resolver a un origen canónico: el anuncio de olympus.pages.dev
 * apunta a olympusbiblioteca.com, que a su vez redirige al canónico.
 */
export const CANDIDATE_HOSTS = ['olympusxyz.com', 'olympusbiblioteca.com'] as const;
export const IMAGE_ORIGIN = 'https://media.imagesolymp.xyz';

const REQUEST_TIMEOUT_MS = 5_000;
const ORIGIN_TTL_MS = 60 * 60_000;
const ORIGIN_MAX_AGE_MS = 24 * ORIGIN_TTL_MS;
const RETRY_DELAY_MS = 30_000;
const WARM_TTL_MS = 5 * 60_000;
const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8',
  'Accept-Language': 'es-ES,es;q=0.9',
};

export type OlympusErrorCode =
  | 'NOT_FOUND'
  | 'UPSTREAM_TIMEOUT'
  | 'REQUEST_ABORTED'
  | 'UPSTREAM_RATE_LIMIT'
  | 'UPSTREAM_UNAVAILABLE'
  | 'UPSTREAM_INVALID_RESPONSE';

const MESSAGES: Record<OlympusErrorCode, string> = {
  NOT_FOUND: 'Contenido no encontrado',
  UPSTREAM_TIMEOUT: 'La fuente tardó demasiado en responder',
  REQUEST_ABORTED: 'Solicitud cancelada',
  UPSTREAM_RATE_LIMIT: 'La fuente limita las solicitudes',
  UPSTREAM_UNAVAILABLE: 'La fuente no está disponible',
  UPSTREAM_INVALID_RESPONSE: 'La fuente devolvió una respuesta inválida',
};

/** Errores públicos estables; no transportan contenido ni mensajes del upstream. */
export class OlympusError extends Error {
  constructor(
    readonly code: OlympusErrorCode,
    readonly allowStaleOrigin = false,
  ) {
    super(MESSAGES[code]);
    this.name = 'OlympusError';
  }
}

/** Deja de esperar al cancelar, sin cancelar una tarea compartida. */
export function waitFor<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise;
  if (signal.aborted) {
    void promise.catch(() => undefined);
    return Promise.reject(signal.reason);
  }
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(signal.reason);
    signal.addEventListener('abort', onAbort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener('abort', onAbort);
        resolve(value);
      },
      (error: unknown) => {
        signal.removeEventListener('abort', onAbort);
        reject(error);
      },
    );
  });
}

export function safeUrl(value: string, base?: string): URL | undefined {
  try {
    const url = base ? new URL(value, base) : new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password) return undefined;
    return url;
  } catch {
    return undefined;
  }
}

interface HttpResult {
  status: number;
  location: string | null;
  body: string;
  url: string;
}

/**
 * Todas las peticiones salen por el fetch inyectado. Los refrescos de origen
 * tienen vida propia: cancelar una operación no interrumpe a otros lectores.
 */
export class OlympusClient {
  private origin?: { value: string; validatedAt: number };
  private originFlight?: Promise<string>;
  private retryOriginAfter = 0;
  private originFailure?: OlympusError;
  private warmedAt?: number;
  private warmFlight?: Promise<void>;
  private cookies = new Map<string, string>();

  constructor(private readonly fetchFn: typeof fetch = globalThis.fetch) {}

  async getOrigin(signal?: AbortSignal): Promise<string> {
    if (signal?.aborted) throw signal.reason;
    const now = Date.now();
    if (this.origin && now - this.origin.validatedAt < ORIGIN_TTL_MS) {
      return this.origin.value;
    }
    if (now < this.retryOriginAfter && this.originFailure) {
      if (this.origin && now - this.origin.validatedAt < ORIGIN_MAX_AGE_MS) {
        return this.origin.value;
      }
      throw this.originFailure;
    }

    if (!this.originFlight) {
      const flight = this.refreshOrigin();
      this.originFlight = flight;
      void flight.finally(() => {
        if (this.originFlight === flight) this.originFlight = undefined;
      }).catch(() => undefined);
    }
    return waitFor(this.originFlight, signal);
  }

  private async refreshOrigin(): Promise<string> {
    try {
      const response = await this.request(DISCOVERY_ORIGIN + '/');
      this.assertStatus(response.status);
      const $ = load(response.body);
      const advertised = $('meta[property="og:url"]').first().attr('content');
      const url = advertised ? safeUrl(advertised) : undefined;
      const resolved = url ? await this.resolveOrigin(url) : undefined;
      if (!resolved) {
        // No volver a servir el origen anterior si el anuncio ya no es válido.
        this.origin = undefined;
        this.retryOriginAfter = 0;
        this.originFailure = undefined;
        throw new OlympusError('UPSTREAM_INVALID_RESPONSE');
      }
      this.origin = { value: resolved, validatedAt: Date.now() };
      this.retryOriginAfter = 0;
      this.originFailure = undefined;
      return resolved;
    } catch (error: unknown) {
      if (error instanceof OlympusError && error.allowStaleOrigin) {
        this.retryOriginAfter = Date.now() + RETRY_DELAY_MS;
        this.originFailure = error;
        if (this.origin && Date.now() - this.origin.validatedAt < ORIGIN_MAX_AGE_MS) {
          return this.origin.value;
        }
      }
      throw error;
    }
  }

  async getJsonText(
    origin: string,
    path: string,
    signal?: AbortSignal,
    notFound = false,
  ): Promise<string> {
    const url = safeUrl(path, origin);
    if (!url || url.origin !== origin || !this.isCanonical(origin)) {
      throw new OlympusError('UPSTREAM_INVALID_RESPONSE');
    }
    const response = await this.request(url.toString(), signal);
    this.assertStatus(response.status, notFound);
    return response.body;
  }

  async getReaderHtml(
    origin: string,
    slug: string,
    chapter: string,
    signal?: AbortSignal,
  ): Promise<{ html: string; url: string }> {
    if (!this.isCanonical(origin)) throw new OlympusError('UPSTREAM_INVALID_RESPONSE');
    const encoded = encodeURIComponent(slug);
    const readerPrefix = `/series/comic-${encoded}/capitulo/`;
    const original = new URL(`/capitulo/${chapter}/comic-${encoded}`, origin).toString();
    await this.warmUp(origin, signal);
    for (let attempt = 0; attempt < 2; attempt++) {
      let url = original;
      let retry = false;
      for (let hop = 0; hop < 4; hop++) {
        const response = await this.request(url, signal);
        if (response.status === 200) {
          const $ = load(response.body);
          const placeholder = /zonaolympus\.milkchoco\.online/i.test(response.body) ||
            $('img').toArray().some((img) => {
              const src = $(img).attr('src');
              const image = src ? safeUrl(src, url) : undefined;
              return image ? /^\/cp\/cp-[^/]+\.jpg$/i.test(image.pathname) : false;
            });
          if (!placeholder) return { html: response.body, url };
          retry = true;
          break;
        }
        if (![301, 302, 303, 307, 308].includes(response.status)) {
          this.assertStatus(response.status, true);
          throw new OlympusError('UPSTREAM_INVALID_RESPONSE');
        }
        const next = response.location ? safeUrl(response.location, url) : undefined;
        if (!next || next.hash) throw new OlympusError('UPSTREAM_INVALID_RESPONSE');
        if (next.origin !== origin) { retry = true; break; }
        if (!next.pathname.startsWith(readerPrefix) && !next.pathname.startsWith('/capitulo/')) {
          throw new OlympusError('UPSTREAM_INVALID_RESPONSE');
        }
        url = next.toString();
      }
      if (!retry || attempt === 1) throw new OlympusError('UPSTREAM_INVALID_RESPONSE');
      await this.warmUp(origin, signal, true);
    }
    throw new OlympusError('UPSTREAM_INVALID_RESPONSE');
  }

  private async warmUp(origin: string, signal?: AbortSignal, force = false): Promise<void> {
    if (signal?.aborted) throw signal.reason;
    if (!force && this.warmedAt !== undefined && Date.now() - this.warmedAt <= WARM_TTL_MS) return;
    if (!this.warmFlight) {
      const flight = (async () => {
        const response = await this.request(origin + '/');
        this.assertStatus(response.status);
        this.warmedAt = Date.now();
      })();
      this.warmFlight = flight;
      void flight.finally(() => { if (this.warmFlight === flight) this.warmFlight = undefined; }).catch(() => undefined);
    }
    await waitFor(this.warmFlight, signal);
  }

  /**
   * Acepta el origen anunciado si es canónico, o si pertenece a la familia
   * conocida y termina redirigiendo a un canónico.
   */
  private async resolveOrigin(url: URL): Promise<string | undefined> {
    if (this.isCanonical(url.origin)) return url.origin;
    if (!CANDIDATE_HOSTS.includes(url.hostname as (typeof CANDIDATE_HOSTS)[number])) {
      return undefined;
    }
    const response = await this.request(url.toString(), undefined, 'follow');
    if (response.status !== 200) return undefined;
    const final = safeUrl(response.url);
    return final && this.isCanonical(final.origin) ? final.origin : undefined;
  }

  private isCanonical(origin: string): boolean {
    return CANONICAL_ORIGINS.includes(origin as (typeof CANONICAL_ORIGINS)[number]);
  }

  private assertStatus(status: number, notFound = false): void {
    if (status === 200) return;
    if (status === 404 && notFound) throw new OlympusError('NOT_FOUND');
    if (status === 429) throw new OlympusError('UPSTREAM_RATE_LIMIT', true);
    if (status >= 500 && status <= 599) throw new OlympusError('UPSTREAM_UNAVAILABLE', true);
    if (status >= 300 && status <= 399) throw new OlympusError('UPSTREAM_INVALID_RESPONSE');
    throw new OlympusError('UPSTREAM_UNAVAILABLE');
  }

  private async request(
    url: string,
    signal?: AbortSignal,
    redirect: 'manual' | 'follow' = 'manual',
  ): Promise<HttpResult> {
    if (signal?.aborted) throw signal.reason;
    const controller = new AbortController();
    const onAbort = () => controller.abort(signal?.reason);
    signal?.addEventListener('abort', onAbort, { once: true });
    const timer = setTimeout(
      () => controller.abort(new OlympusError('UPSTREAM_TIMEOUT', true)),
      REQUEST_TIMEOUT_MS,
    );
    try {
      const response = await waitFor(
        this.fetchFn(url, { method: 'GET', redirect, signal: controller.signal, headers: {
          ...BROWSER_HEADERS,
          ...(this.isCanonical(new URL(url).origin) && this.cookies.size ? { Cookie: [...this.cookies].map(([name, value]) => `${name}=${value}`).join('; ') } : {}),
        } }),
        controller.signal,
      );
      if (this.isCanonical(new URL(url).origin) && redirect === 'manual') {
        const headers = response.headers as Headers & { getSetCookie?: () => string[] };
        const setCookies = headers.getSetCookie?.() ?? (headers.get('set-cookie') ? [headers.get('set-cookie')!] : []);
        for (const cookie of setCookies) {
          const parts = cookie.split(';').map((part) => part.trim());
          const domain = parts.find((part) => /^domain=/i.test(part))?.slice(7).replace(/^\./, '').toLowerCase();
          const path = parts.find((part) => /^path=/i.test(part))?.slice(5);
          if ((domain && domain !== new URL(url).hostname) || (path && path !== '/')) continue;
          const pair = parts[0] ?? '';
          const eq = pair.indexOf('=');
          if (eq <= 0) continue;
          const name = pair.slice(0, eq);
          if (parts.some((part) => /^max-age=0$/i.test(part))) this.cookies.delete(name);
          else this.cookies.set(name, pair.slice(eq + 1));
        }
      }
      // Solo se consume el cuerpo de respuestas que lo necesitan; el plazo
      // sigue activo hasta haber terminado de leerlo.
      const body =
        response.status === 200
          ? await waitFor(response.text(), controller.signal)
          : '';
      if (response.status !== 200 && response.body) {
        void response.body.cancel().catch(() => undefined);
      }
      return {
        status: response.status,
        location: response.headers.get('location'),
        body,
        url: response.url,
      };
    } catch (error: unknown) {
      if (error instanceof OlympusError) throw error;
      throw new OlympusError('UPSTREAM_UNAVAILABLE', true);
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    }
  }
}
