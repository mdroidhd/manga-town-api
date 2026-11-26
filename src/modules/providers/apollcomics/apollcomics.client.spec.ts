import { ApollComicsClient } from './apollcomics.client';

const url = new URL('https://apollcomics.es/manga/serie/');

describe('ApollComicsClient', () => {
  let fetchFn: jest.MockedFunction<typeof fetch>;
  let client: ApollComicsClient;

  beforeEach(() => {
    fetchFn = jest.fn();
    client = new ApollComicsClient(fetchFn);
  });

  it.each([
    [404, true, 'NOT_FOUND'],
    [404, false, 'UPSTREAM_UNAVAILABLE'],
    [429, false, 'UPSTREAM_RATE_LIMIT'],
    [503, false, 'UPSTREAM_UNAVAILABLE'],
  ])('traduce HTTP %i con recurso individual %s', async (status, notFound, code) => {
    fetchFn.mockResolvedValueOnce(new Response('Detalle interno', { status }));
    await expect(client.getHtml(url, undefined, notFound)).rejects.toMatchObject({ code });
  });

  it('no filtra el mensaje de un fallo de transporte', async () => {
    fetchFn.mockRejectedValueOnce(new Error('Detalle interno'));
    await expect(client.getHtml(url)).rejects.toMatchObject({
      code: 'UPSTREAM_UNAVAILABLE',
      message: 'La fuente no está disponible',
    });
  });

  it('rechaza un origen ajeno antes de llamar a fetch', async () => {
    await expect(client.getHtml(new URL('https://externo.invalid/'))).rejects.toMatchObject({
      code: 'UPSTREAM_INVALID_RESPONSE',
    });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('cancela incluso si fetch sigue pendiente', async () => {
    fetchFn.mockReturnValueOnce(new Promise(() => undefined));
    const controller = new AbortController();
    const result = client.getHtml(url, controller.signal);
    controller.abort(new Error('Detalle interno'));
    await expect(result).rejects.toMatchObject({
      code: 'REQUEST_ABORTED',
      message: 'Solicitud cancelada',
    });
    expect(fetchFn.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
    await expect(client.getHtml(url, controller.signal)).rejects.toMatchObject({
      code: 'REQUEST_ABORTED',
    });
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('mantiene el plazo activo durante la lectura del cuerpo', async () => {
    jest.useFakeTimers();
    try {
      const response = new Response('HTML');
      const readBody = jest.spyOn(response, 'text').mockReturnValue(new Promise(() => undefined));
      fetchFn.mockResolvedValueOnce(response);
      const assertion = expect(client.getHtml(url)).rejects.toMatchObject({
        code: 'UPSTREAM_TIMEOUT',
      });
      await jest.advanceTimersByTimeAsync(4_999);
      expect(readBody).toHaveBeenCalledTimes(1);
      expect(fetchFn.mock.calls[0]?.[1]?.signal?.aborted).toBe(false);
      await jest.advanceTimersByTimeAsync(1);
      await assertion;
      expect(fetchFn.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
    } finally {
      jest.useRealTimers();
    }
  });
});
