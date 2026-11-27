export const AEDEX_FETCH = Symbol('AEDEX_FETCH');
export const AEDEX_ORIGIN = 'https://aedexnox.com';

const messages = {
  NOT_FOUND: 'Contenido no encontrado',
  REQUEST_ABORTED: 'Solicitud cancelada',
  UPSTREAM_TIMEOUT: 'La fuente tardó demasiado en responder',
  UPSTREAM_RATE_LIMIT: 'La fuente limita las solicitudes',
  UPSTREAM_UNAVAILABLE: 'La fuente no está disponible',
  UPSTREAM_INVALID_RESPONSE: 'La fuente devolvió una respuesta inválida',
};
export class AedexError extends Error {
  constructor(readonly code: keyof typeof messages) { super(messages[code]); }
}
export class AedexClient {
  constructor(private readonly fetchFn: typeof fetch = globalThis.fetch) {}
  async get(path: string, params: Record<string, string> = {}, signal?: AbortSignal): Promise<unknown> {
    if (signal?.aborted) throw new AedexError('REQUEST_ABORTED');
    const url = new URL(path, AEDEX_ORIGIN);
    if (url.origin !== AEDEX_ORIGIN || !url.pathname.startsWith('/api/backend/mangas')) throw new AedexError('UPSTREAM_INVALID_RESPONSE');
    Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
    const controller = new AbortController();
    const abort = () => controller.abort(new AedexError('REQUEST_ABORTED'));
    signal?.addEventListener('abort', abort, { once: true });
    const timer = setTimeout(() => controller.abort(new AedexError('UPSTREAM_TIMEOUT')), 5000);
    try {
      const aborted = new Promise<never>((_, reject) => controller.signal.addEventListener('abort', () => reject(controller.signal.reason), { once: true }));
      return await Promise.race([aborted, this.request(url, controller.signal)]);
    } catch (error: unknown) {
      if (error instanceof AedexError) throw error;
      throw new AedexError('UPSTREAM_UNAVAILABLE');
    } finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); }
  }
  private async request(url: URL, signal: AbortSignal): Promise<unknown> {
    const res = await this.fetchFn(url.toString(), { headers: { System: 'aedex', 'X-FK-Sistema': '1', Accept: 'application/json' }, redirect: 'manual', signal });
    if (res.status === 404) throw new AedexError('NOT_FOUND');
    if (res.status === 429) throw new AedexError('UPSTREAM_RATE_LIMIT');
    if (res.status >= 300 && res.status < 400) throw new AedexError('UPSTREAM_INVALID_RESPONSE');
    if (!res.ok) throw new AedexError('UPSTREAM_UNAVAILABLE');
    try { return await res.json() as unknown; } catch { throw new AedexError('UPSTREAM_INVALID_RESPONSE'); }
  }
}
