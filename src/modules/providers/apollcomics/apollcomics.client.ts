export const APOLLCOMICS_FETCH = Symbol('APOLLCOMICS_FETCH');
export const SITE_ORIGIN = 'https://apollcomics.es';
export const IMAGE_ORIGIN = 'https://cdn1.apollcomics.com';

const REQUEST_TIMEOUT_MS = 5_000;

const messages = {
  NOT_FOUND: 'Contenido no encontrado',
  UPSTREAM_TIMEOUT: 'La fuente tardó demasiado en responder',
  REQUEST_ABORTED: 'Solicitud cancelada',
  UPSTREAM_RATE_LIMIT: 'La fuente limita las solicitudes',
  UPSTREAM_UNAVAILABLE: 'La fuente no está disponible',
  UPSTREAM_INVALID_RESPONSE: 'La fuente devolvió una respuesta inválida',
};

export class ApollComicsError extends Error {
  constructor(readonly code: keyof typeof messages) {
    super(messages[code]);
    this.name = 'ApollComicsError';
  }
}

export class ApollComicsClient {
  constructor(private readonly fetchFn: typeof fetch = globalThis.fetch) {}

  async getHtml(url: URL, signal?: AbortSignal, notFound = false): Promise<string> {
    if (url.protocol !== 'https:' || url.origin !== SITE_ORIGIN || url.username || url.password) {
      throw new ApollComicsError('UPSTREAM_INVALID_RESPONSE');
    }
    if (signal?.aborted) throw new ApollComicsError('REQUEST_ABORTED');

    const controller = new AbortController();
    const onAbort = () => controller.abort(new ApollComicsError('REQUEST_ABORTED'));
    signal?.addEventListener('abort', onAbort, { once: true });
    const timer = setTimeout(
      () => controller.abort(new ApollComicsError('UPSTREAM_TIMEOUT')),
      REQUEST_TIMEOUT_MS,
    );
    try {
      const aborted = new Promise<never>((_, reject) => {
        controller.signal.addEventListener('abort', () => reject(controller.signal.reason), {
          once: true,
        });
      });
      return await Promise.race([aborted, this.request(url, controller.signal, notFound)]);
    } catch (error: unknown) {
      if (error instanceof ApollComicsError) throw error;
      throw new ApollComicsError('UPSTREAM_UNAVAILABLE');
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    }
  }

  private async request(url: URL, signal: AbortSignal, notFound: boolean): Promise<string> {
    const response = await this.fetchFn(url.toString(), {
      method: 'GET',
      redirect: 'manual',
      signal,
    });
    signal.throwIfAborted();
    const { status } = response;
    if (status === 200) return response.text();
    void response.body?.cancel().catch(() => undefined);
    if (status === 404 && notFound) throw new ApollComicsError('NOT_FOUND');
    if (status === 429) throw new ApollComicsError('UPSTREAM_RATE_LIMIT');
    if (status >= 300 && status < 400) throw new ApollComicsError('UPSTREAM_INVALID_RESPONSE');
    throw new ApollComicsError('UPSTREAM_UNAVAILABLE');
  }
}
