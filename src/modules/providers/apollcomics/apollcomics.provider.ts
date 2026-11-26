import { load, type CheerioAPI } from 'cheerio';

import type {
  ChapterSummary,
  OperationResult,
  PageRef,
  Paginated,
  ProviderManifest,
  SeriesSummary,
} from '../../../domain/provider';
import type { Provider, ProviderContext, SeriesDetail } from '../../../domain/provider.contract';

import {
  ApollComicsClient,
  ApollComicsError,
  IMAGE_ORIGIN,
  SITE_ORIGIN,
} from './apollcomics.client';

const manifest: ProviderManifest = {
  id: 'apollcomics',
  name: 'Apoll Comics',
  version: '0.1.0',
  contractVersion: 1,
  kinds: ['comic'],
  languages: ['es'],
  origins: [SITE_ORIGIN, IMAGE_ORIGIN],
  capabilities: {
    login: 'none',
    captcha: 'none',
    pages: 'server',
    deviceEgress: false,
  },
};

function validSlug(slug: string): boolean {
  return /^[\p{L}\p{M}\p{N}_-]+$/u.test(slug);
}

function mangaUrl(series: string, chapter?: string): URL {
  if (!validSlug(series) || (chapter !== undefined && !validSlug(chapter))) {
    throw new ApollComicsError('NOT_FOUND');
  }
  const path = `/manga/${encodeURIComponent(series)}/`;
  return new URL(
    chapter === undefined ? path : `${path}${encodeURIComponent(chapter)}/`,
    SITE_ORIGIN,
  );
}

function safeUrl(value: string | undefined, base: URL): URL | undefined {
  if (!value?.trim()) return undefined;
  try {
    const url = new URL(value.trim(), base);
    if (url.protocol === 'https:' && !url.username && !url.password) return url;
  } catch {
    return undefined;
  }
}

function mangaLink(
  href: string | undefined,
  base: URL,
): { series: string; chapter?: string } | undefined {
  const url = safeUrl(href, base);
  if (url?.origin !== SITE_ORIGIN) return undefined;
  const match = /^\/manga\/([^/]+)(?:\/([^/]+))?\/?$/.exec(url.pathname);
  const rawSeries = match?.[1];
  const rawChapter = match?.[2];
  if (!rawSeries) return undefined;
  try {
    const series = decodeURIComponent(rawSeries);
    const chapter = rawChapter === undefined ? undefined : decodeURIComponent(rawChapter);
    if (validSlug(series) && (chapter === undefined || validSlug(chapter)))
      return { series, chapter };
  } catch {
    return undefined;
  }
}

function imageUrl(
  dataSrc: string | undefined,
  src: string | undefined,
  base: URL,
): URL | undefined {
  const url = safeUrl(dataSrc?.trim() || src, base);
  if (url && (url.origin === SITE_ORIGIN || url.origin === IMAGE_ORIGIN)) return url;
}

function coverImageUrl(
  dataSrc: string | undefined,
  src: string | undefined,
  base: URL,
): URL | undefined {
  const url = imageUrl(dataSrc, src, base);
  if (url && !/\/dflazy\.jpg$/i.test(url.pathname)) return url;
}

function cleanText(text: string): string {
  return text.replace(/\s+/gu, ' ').trim();
}

function seriesSummaries(
  $: CheerioAPI,
  url: URL,
  linkSelector: string,
  itemSelector: string,
): SeriesSummary[] {
  const results = new Map<string, SeriesSummary>();
  $(linkSelector).each((_index, element) => {
    const anchor = $(element);
    const link = mangaLink(anchor.attr('href'), url);
    const title = cleanText(anchor.text());
    if (!link || link.chapter || !title || results.has(link.series)) return;
    const summary: SeriesSummary = { id: link.series, providerId: manifest.id, title };
    const cover = anchor.closest(itemSelector).find('img').first();
    const coverUrl = coverImageUrl(cover.attr('data-src'), cover.attr('src'), url);
    if (coverUrl?.origin === SITE_ORIGIN) summary.coverUrl = coverUrl.toString();
    results.set(link.series, summary);
  });
  return [...results.values()];
}

export class ApollComicsProvider implements Provider {
  readonly manifest = manifest;

  constructor(private readonly client: ApollComicsClient = new ApollComicsClient()) {}

  listLatest(
    page: number,
    ctx: ProviderContext,
  ): Promise<OperationResult<Paginated<SeriesSummary>>> {
    return this.operation(async () => {
      const path = page === 1 ? '/manga/' : `/manga/page/${page}/`;
      const url = new URL(`${path}?m_orderby=latest`, SITE_ORIGIN);
      const $ = load(await this.client.getHtml(url, ctx.signal, true));
      const items = seriesSummaries($, url, '.page-item-detail .post-title a', '.page-item-detail');
      const nextPath = `/manga/page/${page + 1}`;
      const hasNextPage = $(`a[href*="${nextPath}"]`).is((_index, element) => {
        const next = safeUrl($(element).attr('href'), url);
        return (
          next?.origin === SITE_ORIGIN &&
          (next.pathname === nextPath || next.pathname === `${nextPath}/`)
        );
      });
      return { items, hasNextPage };
    });
  }

  search(query: string, ctx: ProviderContext): Promise<OperationResult<SeriesSummary[]>> {
    return this.operation(async () => {
      const url = new URL('/', SITE_ORIGIN);
      url.searchParams.set('s', query);
      url.searchParams.set('post_type', 'wp-manga');
      const $ = load(await this.client.getHtml(url, ctx.signal));
      return seriesSummaries(
        $,
        url,
        '.h4 a[href], .post-title a[href]',
        '.c-tabs-item__content, .page-item-detail',
      );
    });
  }

  getSeries(id: string, ctx: ProviderContext): Promise<OperationResult<SeriesDetail>> {
    return this.operation(async () => {
      const url = mangaUrl(id);
      const $ = load(await this.client.getHtml(url, ctx.signal, true));
      const title = cleanText($('h1').first().text());
      if (!title) throw new ApollComicsError('UPSTREAM_INVALID_RESPONSE');

      const detail: SeriesDetail = { id, providerId: manifest.id, title };
      const cover = $('.summary_image img').first();
      const coverUrl = coverImageUrl(cover.attr('data-src'), cover.attr('src'), url);
      if (coverUrl) detail.coverUrl = coverUrl.toString();

      const description = cleanText($('.description-summary').first().text());
      if (description) detail.description = description;

      const statusItem = $('.post-content_item')
        .filter((_index, item) =>
          /^(?:estado|status)\s*:?$/iu.test(cleanText($(item).find('.summary-heading').text())),
        )
        .first();
      const status = cleanText(statusItem.find('.summary-content').text());
      if (status) detail.status = status;
      return detail;
    });
  }

  listChapters(id: string, ctx: ProviderContext): Promise<OperationResult<ChapterSummary[]>> {
    return this.operation(async () => {
      const url = mangaUrl(id);
      url.searchParams.set('style', 'list');
      const $ = load(await this.client.getHtml(url, ctx.signal, true));
      const chapters = new Map<string, ChapterSummary>();

      $('li.wp-manga-chapter > a').each((_index, element) => {
        const anchor = $(element);
        const link = mangaLink(anchor.attr('href'), url);
        const label = cleanText(anchor.text());
        if (link?.series !== id || !link.chapter || !label || chapters.has(link.chapter)) return;
        const visibleNumber =
          /^(?:(?:cap[ií]tulo|chapter|cap\.?)\s*:?\s*)?(\d+(?:[.,]\d+)?)(?=\s|$)/iu.exec(
            label,
          )?.[1];
        chapters.set(link.chapter, { id: link.chapter, number: visibleNumber ?? label });
      });

      return [...chapters.values()];
    });
  }

  getPages(id: string, chapter: string, ctx: ProviderContext): Promise<OperationResult<PageRef[]>> {
    return this.operation(async () => {
      const url = mangaUrl(id, chapter);
      const $ = load(await this.client.getHtml(url, ctx.signal, true));
      const images = $('div.reading-content .page-break img');
      if (!images.length) throw new ApollComicsError('UPSTREAM_INVALID_RESPONSE');

      return images
        .map((index, element) => {
          const image = $(element);
          const source = imageUrl(image.attr('data-src'), image.attr('src'), url);
          if (!source) throw new ApollComicsError('UPSTREAM_INVALID_RESPONSE');
          return { index, url: source.toString() };
        })
        .get();
    });
  }

  private async operation<T>(action: () => Promise<T>): Promise<OperationResult<T>> {
    try {
      return { status: 'ok', data: await action() };
    } catch (error: unknown) {
      const failure =
        error instanceof ApollComicsError ? error : new ApollComicsError('UPSTREAM_UNAVAILABLE');
      return { status: 'error', error: { code: failure.code, message: failure.message } };
    }
  }
}
