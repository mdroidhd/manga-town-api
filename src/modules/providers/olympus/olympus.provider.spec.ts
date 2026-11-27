import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { OlympusClient } from './olympus.client';
import { OlympusProvider } from './olympus.provider';

const fixtureDir = join(process.cwd(), 'test/fixtures/olympus');
const fixture = (name: string): string => readFileSync(join(fixtureDir, name), 'utf8');
const pages = JSON.parse(fixture('chapters.json')) as { page1: unknown; page2: unknown };
const context = { userId: 'test' };
const origin = 'https://olympusxyz.com';
const slug = '20-225-2sabueso13424';
const discovery = 'https://olympus.pages.dev/';
const listUrl = `${origin}/api/series/list`;
const latestUrl = (page: number) => `${origin}/api/new-chapters?page=${page}`;
const detailUrl = `${origin}/api/series/${slug}?type=comic`;
const pageUrl = (page: number) =>
  `${origin}/api/series/${slug}/chapters?page=${page}&direction=desc&type=comic`;
const readerUrl = `${origin}/capitulo/135953/comic-${slug}`;
const destinationUrl = `${origin}/series/comic-${slug}/capitulo/190`;

type Reply = { body?: string; status?: number; location?: string };

function setup() {
  const routes = new Map<string, Reply>([
    [`${origin}/`, { body: '' }],
    [discovery, { body: fixture('landing.html') }],
    [listUrl, { body: fixture('series-list.json') }],
    [detailUrl, { body: fixture('series-detail.json') }],
    [pageUrl(1), { body: JSON.stringify(pages.page1) }],
    [pageUrl(2), { body: JSON.stringify(pages.page2) }],
    [readerUrl, { status: 301, location: destinationUrl }],
    [destinationUrl, { body: fixture('chapter.html') }],
  ]);
  const fetchFn = jest.fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>(
    async (input, options) => {
      const url = String(input);
      const response = routes.get(url);
      if (!response) throw new Error(`Unexpected fetch: ${url}`);
      if (options?.redirect !== 'manual') throw new Error('Redirect not manual');
      return new Response(response.body ?? null, {
        status: response.status ?? 200,
        headers: response.location ? { location: response.location } : undefined,
      });
    },
  );
  return { routes, fetchFn, provider: new OlympusProvider(new OlympusClient(fetchFn)) };
}

describe('OlympusProvider', () => {
  it('lista una página de cómics recientes sin repetir slugs', async () => {
    const { routes, fetchFn, provider } = setup();
    routes.set(latestUrl(1), { body: fixture('latest-page-1.json') });

    await expect(provider.listLatest(1, context)).resolves.toEqual({
      status: 'ok',
      data: {
        items: [
          {
            id: 'sabueso',
            providerId: 'olympus',
            title: 'Sabueso',
            coverUrl: `${origin}/covers/sabueso.webp`,
          },
          {
            id: 'torre',
            providerId: 'olympus',
            title: 'La torre',
            coverUrl: 'https://media.imagesolymp.xyz/comics/covers/82/torre.webp',
          },
        ],
        hasNextPage: true,
      },
    });
    expect(fetchFn.mock.calls.map(([url]) => String(url))).toEqual([latestUrl(1)]);
  });

  it('usa los metadatos de Olympus aunque la página solicitada difiera de current_page', async () => {
    const { routes, provider } = setup();
    routes.set(latestUrl(21), { body: fixture('latest-page-1.json') });

    await expect(provider.listLatest(21, context)).resolves.toMatchObject({
      status: 'ok',
      data: { hasNextPage: true },
    });
  });

  it('rechaza metadatos de paginación inválidos', async () => {
    const { routes, provider } = setup();
    routes.set(latestUrl(1), { body: '{"data":[],"current_page":1,"last_page":"20"}' });

    await expect(provider.listLatest(1, context)).resolves.toMatchObject({
      status: 'error',
      error: { code: 'UPSTREAM_INVALID_RESPONSE' },
    });
  });

  it('busca cómics sin distinguir tildes o mayúsculas y conserva el slug exacto', async () => {
    const { provider } = setup();
    await expect(provider.search('CRONICA DEL HEROE', context)).resolves.toEqual({
      status: 'ok',
      data: [
        {
          id: 'cronica-del-heroe-aureo',
          providerId: 'olympus',
          title: 'Crónica del Héroe Áureo',
          coverUrl: `${origin}/covers/aureo.webp`,
        },
      ],
    });
    await expect(provider.search('sabueso', context)).resolves.toMatchObject({
      status: 'ok',
      data: [{ id: slug, providerId: 'olympus' }],
    });
    await expect(provider.search('sin resultados', context)).resolves.toEqual({
      status: 'ok',
      data: [],
    });
  });

  it('omite portadas inválidas en búsqueda y novedades', async () => {
    const { routes, provider } = setup();
    const data = [
      { id: 1, slug: 'a', name: 'A', type: 'comic', cover: 'https://evil.invalid/a' },
      { id: 2, slug: 'b', name: 'B', type: 'comic', cover: 'http://olympusxyz.com/b' },
      { id: 3, slug: 'c', name: 'C', type: 'comic', cover: 'https://user@olympusxyz.com/c' },
      { id: 4, slug: 'd', name: 'D', type: 'comic', cover: '  ' },
      { id: 5, slug: 'e', name: 'E', type: 'comic', cover: 'https://[' },
      { id: 6, slug: 'f', name: 'F', type: 'comic', cover: null },
    ];
    const items = data.map(({ slug: id, name: title }) => ({ id, providerId: 'olympus', title }));
    routes.set(listUrl, {
      body: JSON.stringify({ data }),
    });
    routes.set(latestUrl(1), {
      body: JSON.stringify({ data, current_page: 1, last_page: 1 }),
    });
    await expect(provider.search('', context)).resolves.toEqual({
      status: 'ok',
      data: items,
    });
    await expect(provider.listLatest(1, context)).resolves.toEqual({
      status: 'ok',
      data: { items, hasNextPage: false },
    });
  });

  it('obtiene la ficha sin búsqueda previa ni campos no verificados', async () => {
    const { provider, fetchFn } = setup();
    await expect(provider.getSeries(slug, context)).resolves.toEqual({
      status: 'ok',
      data: {
        id: slug,
        providerId: 'olympus',
        title: '20-225: 2 Sabueso',
        description: 'Un cazador sigue el rastro de dos sabuesos.',
      },
    });
    expect(fetchFn.mock.calls.map(([url]) => String(url))).toEqual([discovery, detailUrl]);
  });

  it('pagina, desduplica y conserva el orden y número decimal de capítulos', async () => {
    const { provider } = setup();
    await expect(provider.listChapters(slug, context)).resolves.toEqual({
      status: 'ok',
      data: [
        { id: '135953', number: '190', publishedAt: '2026-11-24T18:42:00.000000Z' },
        { id: '135952', number: '189.5', publishedAt: '2026-11-20T10:10:00.000000Z' },
        { id: '135951', number: '189' },
      ],
    });
  });

  it('no devuelve resultados parciales si la paginación se trunca', async () => {
    const { routes, provider } = setup();
    routes.set(pageUrl(2), { body: JSON.stringify(pages.page1) });
    await expect(provider.listChapters(slug, context)).resolves.toMatchObject({
      status: 'error',
      error: { code: 'UPSTREAM_INVALID_RESPONSE' },
    });
  });

  it('acepta una serie sin capítulos', async () => {
    const { routes, provider } = setup();
    routes.set(pageUrl(1), { body: JSON.stringify({ data: [], meta: { total: 0 } }) });
    await expect(provider.listChapters(slug, context)).resolves.toEqual({ status: 'ok', data: [] });
  });

  it.each(['not json', '{"data":[{"id":"incorrecto"}]}'])(
    'rechaza JSON de listado inválido',
    async (body) => {
      const { routes, provider } = setup();
      routes.set(listUrl, { body });
      await expect(provider.search('titulo', context)).resolves.toMatchObject({
        status: 'error',
        error: { code: 'UPSTREAM_INVALID_RESPONSE' },
      });
    },
  );

  it.each([
    [404, 'NOT_FOUND'],
    [429, 'UPSTREAM_RATE_LIMIT'],
    [503, 'UPSTREAM_UNAVAILABLE'],
  ])('traduce HTTP %i al código %s', async (status, code) => {
    const { routes, provider } = setup();
    routes.set(detailUrl, { status });
    await expect(provider.getSeries(slug, context)).resolves.toMatchObject({
      status: 'error',
      error: { code },
    });
  });

  it('resuelve páginas desde el HTML y ordena los índices', async () => {
    const { provider, fetchFn } = setup();
    await expect(provider.getPages(slug, '135953', context)).resolves.toEqual({
      status: 'ok',
      data: [0, 1, 2].map((index) => ({
        index,
        url: `https://media.imagesolymp.xyz/comics/743/135953/${index}_${index + 1}.webp`,
      })),
    });
    expect(fetchFn.mock.calls.map(([url]) => String(url))).toEqual([
      discovery,
      `${origin}/`,
      readerUrl,
      destinationUrl,
    ]);
  });
});
