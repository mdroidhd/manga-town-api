import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { ApollComicsClient } from './apollcomics.client';
import { ApollComicsProvider } from './apollcomics.provider';

const ctx = { userId: 'test' };
const fixture = (name: string): string =>
  readFileSync(join(process.cwd(), 'test/fixtures/apollcomics', name), 'utf8');

describe('ApollComicsProvider', () => {
  let fetchFn: jest.MockedFunction<typeof fetch>;
  let provider: ApollComicsProvider;

  beforeEach(() => {
    fetchFn = jest.fn();
    provider = new ApollComicsProvider(new ApollComicsClient(fetchFn));
  });

  it('extrae títulos y portadas de novedades y detecta el enlace a la página siguiente', async () => {
    fetchFn.mockResolvedValueOnce(new Response(fixture('latest-page-1.html')));

    await expect(provider.listLatest(1, ctx)).resolves.toEqual({
      status: 'ok',
      data: {
        items: [
          {
            id: 'invocador',
            providerId: 'apollcomics',
            title: 'El invocador',
            coverUrl: 'https://apollcomics.es/wp-content/uploads/invocador.jpg',
          },
          {
            id: 'leviatan',
            providerId: 'apollcomics',
            title: 'Leviatán',
            coverUrl: 'https://apollcomics.es/wp-content/uploads/leviatan.jpg',
          },
        ],
        hasNextPage: true,
      },
    });
    expect(fetchFn).toHaveBeenCalledWith(
      'https://apollcomics.es/manga/?m_orderby=latest',
      expect.objectContaining({ method: 'GET', redirect: 'manual' }),
    );
  });

  it('requiere un enlace al número exacto de la página siguiente', async () => {
    fetchFn.mockResolvedValueOnce(new Response(fixture('latest-page-3.html')));

    await expect(provider.listLatest(3, ctx)).resolves.toEqual({
      status: 'ok',
      data: {
        items: [{ id: 'los-viajeros', providerId: 'apollcomics', title: 'Los viajeros' }],
        hasNextPage: false,
      },
    });
  });

  it.each([
    'https://[',
    'https://user@apollcomics.es/wp-content/uploads/serie.jpg',
    'http://apollcomics.es/wp-content/uploads/serie.jpg',
    'https://cdn1.apollcomics.net/serie.jpg',
    '/wp-content/themes/madara/images/dflazy.jpg',
  ])('conserva la serie de novedades cuando la portada %s no es válida', async (source) => {
    fetchFn.mockResolvedValueOnce(
      new Response(`<div class="page-item-detail">
        <img data-src="${source}" alt="">
        <h3 class="post-title"><a href="/manga/serie/">Serie</a></h3>
      </div>`),
    );

    await expect(provider.listLatest(1, ctx)).resolves.toEqual({
      status: 'ok',
      data: {
        items: [{ id: 'serie', providerId: 'apollcomics', title: 'Serie' }],
        hasNextPage: false,
      },
    });
  });

  it.each([
    'https://cdn1.apollcomics.es/serie.jpg',
    'https://cdn1.apollcomics.com/serie.jpg',
  ])('acepta una portada del CDN permitido %s', async (source) => {
    fetchFn.mockResolvedValueOnce(
      new Response(`<div class="page-item-detail">
        <img data-src="${source}" alt="">
        <h3 class="post-title"><a href="/manga/serie/">Serie</a></h3>
      </div>`),
    );

    await expect(provider.listLatest(1, ctx)).resolves.toEqual({
      status: 'ok',
      data: {
        items: [
          {
            id: 'serie',
            providerId: 'apollcomics',
            title: 'Serie',
            coverUrl: source,
          },
        ],
        hasNextPage: false,
      },
    });
  });

  it('extrae el título y el slug de un enlace dentro de h3.h4 de Madara', async () => {
    fetchFn.mockResolvedValueOnce(
      new Response(
        '<h3 class="h4"><a href="https://apollcomics.es/manga/invocador/">Invocador</a></h3>',
      ),
    );

    await expect(provider.search('invocador', ctx)).resolves.toEqual({
      status: 'ok',
      data: [{ id: 'invocador', providerId: 'apollcomics', title: 'Invocador' }],
    });
  });

  it('devuelve una lista vacía en una búsqueda sin coincidencias', async () => {
    fetchFn.mockResolvedValueOnce(new Response('<main>Sin resultados</main>'));
    await expect(provider.search('sin resultados', ctx)).resolves.toEqual({
      status: 'ok',
      data: [],
    });
  });

  it('permite reutilizar un slug de WordPress codificado en el enlace de búsqueda', async () => {
    fetchFn
      .mockResolvedValueOnce(
        new Response('<h3 class="h4"><a href="/manga/%E6%BC%AB%E7%94%BB/">漫画</a></h3>'),
      )
      .mockResolvedValueOnce(new Response('<h1>漫画</h1>'));

    await expect(provider.search('漫画', ctx)).resolves.toMatchObject({
      status: 'ok',
      data: [{ id: '漫画' }],
    });
    await expect(provider.getSeries('漫画', ctx)).resolves.toMatchObject({ status: 'ok' });
    expect(fetchFn).toHaveBeenLastCalledWith(
      'https://apollcomics.es/manga/%E6%BC%AB%E7%94%BB/',
      expect.anything(),
    );
  });

  it('omite una portada de placeholder cuando falta data-src', async () => {
    fetchFn.mockResolvedValueOnce(
      new Response('<h1>Serie</h1><div class="summary_image"><img src="/dflazy.jpg"></div>'),
    );
    await expect(provider.getSeries('serie', ctx)).resolves.toEqual({
      status: 'ok',
      data: { id: 'serie', title: 'Serie', providerId: 'apollcomics' },
    });
  });

  it('rechaza una ficha sin título', async () => {
    fetchFn.mockResolvedValueOnce(new Response('<main><h1> </h1></main>'));
    await expect(provider.getSeries('serie', ctx)).resolves.toMatchObject({
      status: 'error',
      error: { code: 'UPSTREAM_INVALID_RESPONSE' },
    });
  });

  it.each(['', '..', 'otro/slug', 'otro%2Fslug', 'serie?style=list'])(
    'rechaza el slug inválido %j',
    async (slug) => {
      const results = await Promise.all([
        provider.getSeries(slug, ctx),
        provider.listChapters(slug, ctx),
        provider.getPages('serie', slug, ctx),
      ]);
      for (const result of results) {
        expect(result).toMatchObject({ status: 'error', error: { code: 'NOT_FOUND' } });
      }
      expect(fetchFn).not.toHaveBeenCalled();
    },
  );

  it.each([
    'https://externo.invalid/pagina.jpg',
    'https://usuario@cdn1.apollcomics.es/pagina.jpg',
    'http://cdn1.apollcomics.es/pagina.jpg',
    '',
  ])('rechaza el lector con una fuente de imagen inválida %j', async (source) => {
    fetchFn.mockResolvedValueOnce(
      new Response(`
      <div class="reading-content"><div class="page-break">
        <img src="/valida.jpg"><img src="${source}">
      </div></div>
    `),
    );
    await expect(provider.getPages('serie', 'capitulo-1', ctx)).resolves.toMatchObject({
      status: 'error',
      error: { code: 'UPSTREAM_INVALID_RESPONSE' },
    });
  });

  it('extrae páginas de los dos CDNs conocidos en su orden original', async () => {
    fetchFn.mockResolvedValueOnce(
      new Response(`
      <div class="reading-content"><div class="page-break">
        <img data-src=" https://cdn1.apollcomics.es/uno.jpg " alt="">
        <img src="https://cdn1.apollcomics.com/dos.jpg" alt="">
      </div></div>
    `),
    );

    await expect(provider.getPages('serie', 'capitulo-1', ctx)).resolves.toEqual({
      status: 'ok',
      data: [
        { index: 0, url: 'https://cdn1.apollcomics.es/uno.jpg' },
        { index: 1, url: 'https://cdn1.apollcomics.com/dos.jpg' },
      ],
    });
  });
});
