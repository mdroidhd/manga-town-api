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

  it('reintenta un redirect externo con sesión y nunca consulta el mirror', async () => {
    const fetchFn = stubFetch().mockResolvedValueOnce(new Response('home', { headers: { 'set-cookie': 'session=abc; Path=/' } }))
      .mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: 'https://mirror.invalid/a' } }))
      .mockResolvedValueOnce(new Response('home'))
      .mockResolvedValueOnce(new Response('<main>real</main>'));
    const client = new OlympusClient(fetchFn);
    await expect(client.getReaderHtml(origin, 'foo', '1')).resolves.toMatchObject({ html: '<main>real</main>' });
    expect(fetchFn.mock.calls.map(([url]) => String(url))).toEqual([`${origin}/`, `${origin}/capitulo/1/comic-foo`, `${origin}/`, `${origin}/capitulo/1/comic-foo`]);
    expect(fetchFn.mock.calls[1]?.[1]?.headers).toMatchObject({ Cookie: 'session=abc', 'Accept-Language': 'es-ES,es;q=0.9' });
  });

  it('reintenta un placeholder', async () => {
    const fetchFn = stubFetch().mockResolvedValueOnce(new Response('home'))
      .mockResolvedValueOnce(new Response('<img src="/cp/cp-1.jpg">'))
      .mockResolvedValueOnce(new Response('home'))
      .mockResolvedValueOnce(new Response('<main>real</main>'));
    await expect(new OlympusClient(fetchFn).getReaderHtml(origin, 'foo', '1')).resolves.toMatchObject({ html: '<main>real</main>' });
  });

  it('devuelve error estable tras dos redirects externos', async () => {
    const fetchFn = stubFetch().mockImplementation(async (input) => String(input) === `${origin}/`
      ? new Response('home') : new Response(null, { status: 302, headers: { location: 'https://mirror.invalid/a' } }));
    await expect(new OlympusClient(fetchFn).getReaderHtml(origin, 'foo', '1')).rejects.toMatchObject({ code: 'UPSTREAM_INVALID_RESPONSE' });
    expect(fetchFn).toHaveBeenCalledTimes(4);
  });

  it('reutiliza la sesión y la renueva después de cinco minutos', async () => {
    const fetchFn = stubFetch().mockResolvedValue(new Response('home'));
    fetchFn.mockImplementation(async () => new Response('ok'));
    const client = new OlympusClient(fetchFn);
    await client.getReaderHtml(origin, 'foo', '1');
    await client.getReaderHtml(origin, 'foo', '2');
    expect(fetchFn).toHaveBeenCalledTimes(3);
    jest.advanceTimersByTime(5 * 60_000 + 1);
    await client.getReaderHtml(origin, 'foo', '3');
    expect(fetchFn).toHaveBeenCalledTimes(5);
  });

  it('sigue redirecciones del mismo origen y corta en bucles', async () => {
    const fetchFn = stubFetch().mockImplementation(async (input) => String(input) === `${origin}/` ? new Response('home') :
      new Response(null, { status: 302, headers: { location: '/series/comic-foo/capitulo/1' } }));
    await expect(new OlympusClient(fetchFn).getReaderHtml(origin, 'foo', '1')).rejects.toMatchObject({ code: 'UPSTREAM_INVALID_RESPONSE' });
    expect(fetchFn).toHaveBeenCalledTimes(5);
  });

  it('acepta la cadena 301 y 302 hasta el HTML final', async () => {
    const fetchFn = stubFetch().mockResolvedValueOnce(new Response('home'))
      .mockResolvedValueOnce(new Response(null, { status: 301, headers: { location: '/series/comic-foo/capitulo/7' } }))
      .mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: '/series/comic-foo/capitulo/7' } }))
      .mockResolvedValueOnce(new Response('<main class="strip"></main>'));
    await expect(new OlympusClient(fetchFn).getReaderHtml(origin, 'foo', '1')).resolves.toMatchObject({ url: `${origin}/series/comic-foo/capitulo/7` });
    expect(fetchFn).toHaveBeenCalledTimes(4);
  });
});
