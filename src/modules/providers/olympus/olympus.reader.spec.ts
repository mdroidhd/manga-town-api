import { OlympusClient } from './olympus.client';
import { OlympusProvider } from './olympus.provider';

const origin = 'https://olympusxyz.com';
const cdn = 'https://media.imagesolymp.xyz';
const context = { userId: 'test' };

describe('OlympusProvider: validación del lector', () => {
  let provider: OlympusProvider;
  let html: jest.SpyInstance;

  beforeEach(() => {
    const client = new OlympusClient();
    jest.spyOn(client, 'getOrigin').mockResolvedValue(origin);
    html = jest.spyOn(client, 'getReaderHtml');
    provider = new OlympusProvider(client);
  });

  it.each([
    ['lector vacío', '<main class="strip"></main>'],
    ['índice ausente', `<main class="strip"><div class="panel"><img src="${cdn}/p.webp"></div></main>`],
    [
      'índices duplicados',
      `<main class="strip"><div class="panel" data-i="0"><img src="${cdn}/a"></div><div class="panel" data-i="0"><img src="${cdn}/b"></div></main>`,
    ],
    [
      'índices discontinuos',
      `<main class="strip"><div class="panel" data-i="0"><img src="${cdn}/a"></div><div class="panel" data-i="2"><img src="${cdn}/b"></div></main>`,
    ],
    [
      'panel sin imagen',
      `<main class="strip"><div class="panel" data-i="0"><img src="${cdn}/a"></div><div class="panel" data-i="1"></div></main>`,
    ],
    [
      'imagen fuera del CDN',
      '<main class="strip"><div class="panel" data-i="0"><img src="https://evil.invalid/a"></div></main>',
    ],
    [
      'URL con credenciales',
      '<main class="strip"><div class="panel" data-i="0"><img src="https://user@media.imagesolymp.xyz/a"></div></main>',
    ],
    [
      'URL relativa que resuelve al canónico',
      '<main class="strip"><div class="panel" data-i="0"><img src="/a.webp"></div></main>',
    ],
  ])('rechaza %s', async (_scenario, markup) => {
    html.mockResolvedValue({ html: markup, url: `${origin}/series/comic-serie/capitulo/1` });
    await expect(provider.getPages('serie', '1', context)).resolves.toMatchObject({
      status: 'error',
      error: { code: 'UPSTREAM_INVALID_RESPONSE' },
    });
  });

  it('resuelve imágenes relativas al protocolo si apuntan al CDN', async () => {
    html.mockResolvedValue({
      html: '<main class="strip"><div class="panel" data-i="0"><img src="//media.imagesolymp.xyz/comics/1/p.webp"></div></main>',
      url: `${origin}/series/comic-serie/capitulo/1`,
    });
    await expect(provider.getPages('serie', '1', context)).resolves.toEqual({
      status: 'ok',
      data: [{ index: 0, url: `${cdn}/comics/1/p.webp` }],
    });
  });
});
