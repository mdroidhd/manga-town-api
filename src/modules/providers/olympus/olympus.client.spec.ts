import { OlympusClient, OlympusError } from './olympus.client';

const origin = 'https://olympusxyz.com';

function landing(advertised = origin): Response {
  return new Response(`<meta property="og:url" content="${advertised}/">`);
}

function stubFetch(): jest.MockedFunction<typeof fetch> {
  return jest.fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>();
}

describe('OlympusClient', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-11-26T00:00:00Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('reutiliza origen ante fallos temporales, respeta el cooldown y no confía en un anuncio nuevo no permitido', async () => {
    const fetchFn = stubFetch()
      .mockResolvedValueOnce(landing())
      .mockRejectedValueOnce(new Error('red'))
      .mockResolvedValueOnce(landing('https://attacker.invalid'))
      .mockResolvedValueOnce(new Response(null, { status: 503 }));
    const client = new OlympusClient(fetchFn);

    await expect(client.getOrigin()).resolves.toBe(origin);
    jest.advanceTimersByTime(60 * 60_000);
    await expect(client.getOrigin()).resolves.toBe(origin);
    await expect(client.getOrigin()).resolves.toBe(origin);
    expect(fetchFn).toHaveBeenCalledTimes(2);

    jest.advanceTimersByTime(30_000);
    await expect(client.getOrigin()).rejects.toMatchObject({ code: 'UPSTREAM_INVALID_RESPONSE' });
    await expect(client.getOrigin()).rejects.toMatchObject({ code: 'UPSTREAM_UNAVAILABLE' });
    expect(fetchFn).toHaveBeenCalledTimes(4);
  });

  it('resuelve un anuncio de la familia que redirige al canónico', async () => {
    const redirected = {
      status: 200,
      url: `${origin}/`,
      headers: new Headers(),
      body: null,
      text: async () => '',
    } as unknown as Response;
    const fetchFn = stubFetch()
      .mockResolvedValueOnce(landing('https://olympusbiblioteca.com'))
      .mockResolvedValueOnce(redirected);
    const client = new OlympusClient(fetchFn);

    await expect(client.getOrigin()).resolves.toBe(origin);
    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(String(fetchFn.mock.calls[1]?.[0])).toBe('https://olympusbiblioteca.com/');
  });

  it('no reutiliza origen de 24 horas aunque la fuente falle', async () => {
    const fetchFn = stubFetch()
      .mockResolvedValueOnce(landing())
      .mockResolvedValueOnce(new Response(null, { status: 429 }));
    const client = new OlympusClient(fetchFn);
    await client.getOrigin();
    jest.advanceTimersByTime(24 * 60 * 60_000);
    await expect(client.getOrigin()).rejects.toMatchObject({ code: 'UPSTREAM_RATE_LIMIT' });
    await expect(client.getOrigin()).rejects.toMatchObject({ code: 'UPSTREAM_RATE_LIMIT' });
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('comparte descubrimiento y una cancelación no interrumpe a los demás', async () => {
    let finish: (response: Response) => void = () => undefined;
    const fetchFn = stubFetch().mockImplementationOnce(
      () => new Promise<Response>((resolve) => (finish = resolve)),
    );
    const client = new OlympusClient(fetchFn);
    const controller = new AbortController();
    const first = client.getOrigin(controller.signal);
    const second = client.getOrigin();
    controller.abort(new OlympusError('REQUEST_ABORTED'));
    await expect(first).rejects.toMatchObject({ code: 'REQUEST_ABORTED' });
    expect(fetchFn).toHaveBeenCalledTimes(1);
    const requestSignal = fetchFn.mock.calls[0]?.[1]?.signal;
    expect(requestSignal?.aborted).toBe(false);
    finish(landing());
    await expect(second).resolves.toBe(origin);
  });

  it('limita la petición aunque fetch no responda', async () => {
    const fetchFn = stubFetch().mockImplementation(() => new Promise<Response>(() => undefined));
    const client = new OlympusClient(fetchFn);
    const result = client.getOrigin();
    const assertion = expect(result).rejects.toMatchObject({ code: 'UPSTREAM_TIMEOUT' });
    await jest.advanceTimersByTimeAsync(5_000);
    await assertion;
  });

  it('incluye la lectura del cuerpo en el plazo', async () => {
    const response = landing();
    jest.spyOn(response, 'text').mockImplementation(() => new Promise<string>(() => undefined));
    const client = new OlympusClient(stubFetch().mockResolvedValueOnce(response));
    const result = client.getOrigin();
    const assertion = expect(result).rejects.toMatchObject({ code: 'UPSTREAM_TIMEOUT' });
    await jest.advanceTimersByTimeAsync(5_000);
    await assertion;
  });

  it('rechaza redirecciones externas y no hace la segunda petición', async () => {
    const fetchFn = stubFetch().mockResolvedValueOnce(
      new Response(null, {
        status: 301,
        headers: { location: 'https://attacker.invalid/series/comic-foo/capitulo/1' },
      }),
    );
    const client = new OlympusClient(fetchFn);
    await expect(client.getReaderHtml(origin, 'foo', '1')).rejects.toMatchObject({
      code: 'UPSTREAM_INVALID_RESPONSE',
    });
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(fetchFn.mock.calls[0]?.[1]).toMatchObject({ redirect: 'manual' });
  });

  it('sigue redirecciones del mismo origen y corta en bucles', async () => {
    const fetchFn = stubFetch().mockImplementation(
      async () =>
        new Response(null, {
          status: 302,
          headers: { location: '/series/comic-foo/capitulo/1' },
        }),
    );
    const client = new OlympusClient(fetchFn);
    await expect(client.getReaderHtml(origin, 'foo', '1')).rejects.toMatchObject({
      code: 'UPSTREAM_INVALID_RESPONSE',
    });
    expect(fetchFn).toHaveBeenCalledTimes(4);
  });

  it('acepta la cadena 301 y 302 hasta el HTML final', async () => {
    const fetchFn = stubFetch()
      .mockResolvedValueOnce(
        new Response(null, { status: 301, headers: { location: '/series/comic-foo/capitulo/7' } }),
      )
      .mockResolvedValueOnce(
        new Response(null, {
          status: 302,
          headers: { location: '/series/comic-foo/capitulo/7' },
        }),
      )
      .mockResolvedValueOnce(new Response('<main class="strip"></main>', { status: 200 }));
    const client = new OlympusClient(fetchFn);
    await expect(client.getReaderHtml(origin, 'foo', '1')).resolves.toMatchObject({
      url: `${origin}/series/comic-foo/capitulo/7`,
    });
    expect(fetchFn).toHaveBeenCalledTimes(3);
  });
});
