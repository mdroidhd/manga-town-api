import { OlympusClient, OlympusError } from './olympus.client';
import { OlympusProvider } from './olympus.provider';

const origin = 'https://olympusxyz.com';
const context = { userId: 'test' };

function list(name: string, slug = 'serie'): string {
  return JSON.stringify({ data: [{ id: 8, name, slug, type: 'comic', cover: null }] });
}

describe('OlympusProvider: límites y caché', () => {
  let client: OlympusClient;
  let provider: OlympusProvider;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-11-26T00:00:00Z'));
    client = new OlympusClient();
    jest.spyOn(client, 'getOrigin').mockResolvedValue(origin);
    provider = new OlympusProvider(client);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('sirve copia mientras refresca una sola vez, espera tras fallo y actualiza tras el cooldown', async () => {
    let finish: (value: string) => void = () => undefined;
    const get = jest
      .spyOn(client, 'getJsonText')
      .mockResolvedValueOnce(list('Título anterior'))
      .mockRejectedValueOnce(new OlympusError('UPSTREAM_UNAVAILABLE'))
      .mockImplementationOnce(() => new Promise<string>((resolve) => (finish = resolve)));

    await expect(provider.search('titulo', context)).resolves.toMatchObject({
      status: 'ok',
      data: [{ title: 'Título anterior' }],
    });
    await jest.advanceTimersByTimeAsync(15 * 60_000);
    await expect(provider.search('titulo', context)).resolves.toMatchObject({
      status: 'ok',
      data: [{ title: 'Título anterior' }],
    });
    await jest.advanceTimersByTimeAsync(0);
    await provider.search('titulo', context);
    expect(get).toHaveBeenCalledTimes(2);

    await jest.advanceTimersByTimeAsync(30_000);
    await provider.search('titulo', context);
    await provider.search('titulo', context);
    expect(get).toHaveBeenCalledTimes(3);
    finish(list('Título nuevo'));
    await jest.advanceTimersByTimeAsync(0);
    await expect(provider.search('titulo', context)).resolves.toMatchObject({
      status: 'ok',
      data: [{ title: 'Título nuevo' }],
    });
  });

  it('conserva la copia hasta el límite duro, pero no devuelve datos pasados 60 minutos', async () => {
    const get = jest
      .spyOn(client, 'getJsonText')
      .mockResolvedValueOnce(list('Título anterior'))
      .mockRejectedValue(new OlympusError('UPSTREAM_UNAVAILABLE'));
    await provider.search('titulo', context);
    await jest.advanceTimersByTimeAsync(60 * 60_000);
    await expect(provider.search('titulo', context)).resolves.toMatchObject({
      status: 'error',
      error: { code: 'UPSTREAM_UNAVAILABLE' },
    });
    expect(get).toHaveBeenCalledTimes(2);
  });

  it('aísla los snapshots por origen', async () => {
    jest
      .spyOn(client, 'getOrigin')
      .mockResolvedValueOnce('https://one.example')
      .mockResolvedValueOnce('https://two.example')
      .mockResolvedValueOnce('https://one.example');
    const get = jest
      .spyOn(client, 'getJsonText')
      .mockImplementation(async (source) => list(source, source === 'https://one.example' ? 'one' : 'two'));

    const first = await provider.search('example', context);
    const second = await provider.search('example', context);
    const third = await provider.search('example', context);
    expect(first).toMatchObject({ status: 'ok', data: [{ id: 'one' }] });
    expect(second).toMatchObject({ status: 'ok', data: [{ id: 'two' }] });
    expect(third).toMatchObject({ status: 'ok', data: [{ id: 'one' }] });
    expect(get).toHaveBeenCalledTimes(2);
  });

  it('si un consumidor cancela, la descarga compartida continúa para el otro', async () => {
    let finish: (value: string) => void = () => undefined;
    const get = jest
      .spyOn(client, 'getJsonText')
      .mockImplementationOnce(() => new Promise<string>((resolve) => (finish = resolve)));
    const abort = new AbortController();
    const first = provider.search('titulo', { ...context, signal: abort.signal });
    const second = provider.search('titulo', context);
    await jest.advanceTimersByTimeAsync(0);
    abort.abort();
    await expect(first).resolves.toMatchObject({
      status: 'error',
      error: { code: 'REQUEST_ABORTED' },
    });
    expect(get).toHaveBeenCalledTimes(1);
    expect(get.mock.calls[0]?.[2]).toBeUndefined();
    finish(list('Título'));
    await expect(second).resolves.toMatchObject({
      status: 'ok',
      data: [{ id: 'serie' }],
    });
  });

  it('limita la operación completa incluso si un cliente queda colgado', async () => {
    jest.spyOn(client, 'getJsonText').mockImplementation(() => new Promise<string>(() => undefined));
    const result = provider.getSeries('serie', context);
    await jest.advanceTimersByTimeAsync(15_000);
    await expect(result).resolves.toMatchObject({
      status: 'error',
      error: { code: 'UPSTREAM_TIMEOUT' },
    });
  });

  it('rechaza IDs no válidos sin descubrir el origen', async () => {
    const discover = jest.spyOn(client, 'getOrigin');
    await expect(provider.getSeries('../invalido', context)).resolves.toMatchObject({
      status: 'error',
      error: { code: 'NOT_FOUND' },
    });
    await expect(provider.getPages('serie', '0', context)).resolves.toMatchObject({
      status: 'error',
      error: { code: 'NOT_FOUND' },
    });
    expect(discover).not.toHaveBeenCalled();
  });
});
