import { load } from 'cheerio';
import { z } from 'zod';

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
  CANONICAL_ORIGINS,
  DISCOVERY_ORIGIN,
  IMAGE_ORIGIN,
  OlympusClient,
  OlympusError,
  safeUrl,
  waitFor,
} from './olympus.client';

const MINUTE = 60_000;
const LIST_TTL_MS = 15 * MINUTE;
const LIST_MAX_AGE_MS = 60 * MINUTE;
const LIST_RETRY_DELAY_MS = 30_000;

const manifest: ProviderManifest = {
  id: 'olympus',
  name: 'Olympus Scanlation',
  version: '0.1.0',
  contractVersion: 1,
  kinds: ['comic'],
  languages: ['es'],
  origins: [DISCOVERY_ORIGIN, ...CANONICAL_ORIGINS, IMAGE_ORIGIN],
  capabilities: {
    login: 'none',
    captcha: 'none',
    pages: 'server',
    deviceEgress: false,
  },
};

function validSlug(slug: string): boolean {
  if (
    !slug.trim() ||
    slug === '.' ||
    slug === '..' ||
    slug.includes('/') ||
    slug.includes('\\') ||
    [...slug].some((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)
  ) {
    return false;
  }
  try {
    encodeURIComponent(slug);
    return true;
  } catch {
    return false;
  }
}

function normalized(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

const listSchema = z.object({
  data: z.array(
    z.object({
      id: z.number().int().positive().safe(),
      name: z.string().min(1),
      slug: z.string().refine(validSlug),
      cover: z.unknown().optional(),
      type: z.string(),
    }),
  ),
});
const latestSchema = listSchema.extend({
  current_page: z.number().int().positive().safe(),
  last_page: z.number().int().positive().safe(),
});
const detailSchema = z.object({
  data: z.object({
    id: z.number().int().positive().safe(),
    name: z.string().min(1),
    summary: z.unknown().optional(),
  }),
});
const chaptersSchema = z.object({
  data: z.array(
    z.object({
      id: z.number().int().positive().safe(),
      name: z.string().min(1),
      published_at: z.string().nullable().optional(),
    }),
  ),
  meta: z.object({ total: z.number().int().nonnegative().safe() }),
});

function parseJson<T>(body: string, schema: z.ZodType<T>): T {
  let raw: unknown;
  try {
    raw = JSON.parse(body) as unknown;
  } catch {
    throw new OlympusError('UPSTREAM_INVALID_RESPONSE');
  }
  const result = schema.safeParse(raw);
  if (!result.success) throw new OlympusError('UPSTREAM_INVALID_RESPONSE');
  return result.data;
}

function seriesSummary(
  item: z.infer<typeof listSchema>['data'][number],
  origin: string,
): SeriesSummary {
  const cover = typeof item.cover === 'string' ? safeUrl(item.cover, origin) : undefined;
  const coverUrl =
    cover && (cover.origin === origin || cover.origin === IMAGE_ORIGIN)
      ? cover.toString()
      : undefined;
  return {
    id: item.slug,
    providerId: 'olympus',
    title: item.name,
    ...(coverUrl ? { coverUrl } : {}),
  };
}

interface ListEntry {
  summary: SeriesSummary;
  normalizedTitle: string;
}

interface ListSnapshot {
  entries: ListEntry[];
  loadedAt: number;
}

export class OlympusProvider implements Provider {
  readonly manifest = manifest;
  private readonly snapshots = new Map<string, ListSnapshot>();
  private readonly listFlights = new Map<string, Promise<ListSnapshot>>();
  private readonly retryListAfter = new Map<string, number>();

  constructor(private readonly client: OlympusClient = new OlympusClient()) {}

  listLatest(
    page: number,
    ctx: ProviderContext,
  ): Promise<OperationResult<Paginated<SeriesSummary>>> {
    return this.operation(ctx, 15_000, async (signal) => {
      const [origin] = CANONICAL_ORIGINS;
      const body = await this.client.getJsonText(
        origin,
        `/api/new-chapters?page=${page}`,
        signal,
        true,
      );
      const { data, current_page, last_page } = parseJson(body, latestSchema);
      const results = new Map<string, SeriesSummary>();
      for (const item of data) {
        if (item.type === 'comic' && !results.has(item.slug)) {
          results.set(item.slug, seriesSummary(item, origin));
        }
      }
      return { items: [...results.values()], hasNextPage: current_page < last_page };
    });
  }

  search(query: string, ctx: ProviderContext): Promise<OperationResult<SeriesSummary[]>> {
    return this.operation(ctx, 15_000, async (signal) => {
      const origin = await this.client.getOrigin(signal);
      const snapshot = await this.getList(origin, signal);
      const needle = normalized(query);
      return snapshot.entries
        .filter((entry) => entry.normalizedTitle.includes(needle))
        .map((entry) => ({ ...entry.summary }));
    });
  }

  getSeries(id: string, ctx: ProviderContext): Promise<OperationResult<SeriesDetail>> {
    return this.operation(ctx, 15_000, async (signal) => {
      if (!validSlug(id)) throw new OlympusError('NOT_FOUND');
      const origin = await this.client.getOrigin(signal);
      const body = await this.client.getJsonText(
        origin,
        `/api/series/${encodeURIComponent(id)}?type=comic`,
        signal,
        true,
      );
      const { data } = parseJson(body, detailSchema);
      return {
        id,
        providerId: 'olympus',
        title: data.name,
        ...(typeof data.summary === 'string' ? { description: data.summary } : {}),
      };
    });
  }

  listChapters(id: string, ctx: ProviderContext): Promise<OperationResult<ChapterSummary[]>> {
    return this.operation(ctx, 30_000, async (signal) => {
      if (!validSlug(id)) throw new OlympusError('NOT_FOUND');
      const origin = await this.client.getOrigin(signal);
      const chapters: ChapterSummary[] = [];
      const seen = new Set<string>();
      let total: number | undefined;

      for (let page = 1; ; page++) {
        const path = `/api/series/${encodeURIComponent(id)}/chapters?page=${page}&direction=desc&type=comic`;
        const response = parseJson(
          await this.client.getJsonText(origin, path, signal, page === 1),
          chaptersSchema,
        );
        if (total !== undefined && total !== response.meta.total) {
          throw new OlympusError('UPSTREAM_INVALID_RESPONSE');
        }
        total = response.meta.total;
        let added = 0;
        for (const item of response.data) {
          const chapterId = String(item.id);
          if (seen.has(chapterId)) continue;
          seen.add(chapterId);
          chapters.push({
            id: chapterId,
            number: item.name,
            ...(typeof item.published_at === 'string' ? { publishedAt: item.published_at } : {}),
          });
          added++;
        }
        if (chapters.length > total) throw new OlympusError('UPSTREAM_INVALID_RESPONSE');
        if (chapters.length === total) return chapters;
        if (added === 0) throw new OlympusError('UPSTREAM_INVALID_RESPONSE');
      }
    });
  }

  getPages(id: string, chapter: string, ctx: ProviderContext): Promise<OperationResult<PageRef[]>> {
    return this.operation(ctx, 15_000, async (signal) => {
      if (!validSlug(id) || !/^0*[1-9]\d*$/.test(chapter)) {
        throw new OlympusError('NOT_FOUND');
      }
      const origin = await this.client.getOrigin(signal);
      const { html, url } = await this.client.getReaderHtml(origin, id, chapter, signal);
      const $ = load(html);
      const panels = $('main.strip div.panel');
      if (panels.length === 0) throw new OlympusError('UPSTREAM_INVALID_RESPONSE');

      const pages: PageRef[] = [];
      panels.each((_position, panel) => {
        const item = $(panel);
        const rawIndex = item.attr('data-i');
        const images = item.children('img');
        const source = images.first().attr('src');
        const image = source ? safeUrl(source, url) : undefined;
        if (
          !rawIndex ||
          !/^\d+$/.test(rawIndex) ||
          !Number.isSafeInteger(Number(rawIndex)) ||
          images.length !== 1 ||
          !image ||
          image.origin !== IMAGE_ORIGIN
        ) {
          throw new OlympusError('UPSTREAM_INVALID_RESPONSE');
        }
        pages.push({ index: Number(rawIndex), url: image.toString() });
      });
      pages.sort((a, b) => a.index - b.index);
      if (pages.some((page, index) => page.index !== index)) {
        throw new OlympusError('UPSTREAM_INVALID_RESPONSE');
      }
      return pages;
    });
  }

  private async getList(origin: string, signal: AbortSignal): Promise<ListSnapshot> {
    const snapshot = this.snapshots.get(origin);
    const age = snapshot ? Date.now() - snapshot.loadedAt : Infinity;
    if (snapshot && age < LIST_TTL_MS) return snapshot;
    if (snapshot && age < LIST_MAX_AGE_MS) {
      if (!this.listFlights.has(origin) && Date.now() >= (this.retryListAfter.get(origin) ?? 0)) {
        void this.refreshList(origin).catch(() => undefined);
      }
      return snapshot;
    }
    return waitFor(this.refreshList(origin), signal);
  }

  private refreshList(origin: string): Promise<ListSnapshot> {
    const pending = this.listFlights.get(origin);
    if (pending) return pending;
    const flight = this.fetchList(origin)
      .then((snapshot) => {
        this.snapshots.set(origin, snapshot);
        this.retryListAfter.delete(origin);
        return snapshot;
      })
      .catch((error: unknown) => {
        this.retryListAfter.set(origin, Date.now() + LIST_RETRY_DELAY_MS);
        throw error;
      })
      .finally(() => {
        if (this.listFlights.get(origin) === flight) this.listFlights.delete(origin);
      });
    this.listFlights.set(origin, flight);
    return flight;
  }

  private async fetchList(origin: string): Promise<ListSnapshot> {
    const body = await this.client.getJsonText(origin, '/api/series/list');
    const { data } = parseJson(body, listSchema);
    const entries = data
      .filter((item) => item.type === 'comic')
      .map((item) => ({
        summary: seriesSummary(item, origin),
        normalizedTitle: normalized(item.name),
      }));
    return { entries, loadedAt: Date.now() };
  }

  private async operation<T>(
    ctx: ProviderContext,
    timeout: number,
    action: (signal: AbortSignal) => Promise<T>,
  ): Promise<OperationResult<T>> {
    const controller = new AbortController();
    const onAbort = () => controller.abort(new OlympusError('REQUEST_ABORTED'));
    if (ctx.signal?.aborted) onAbort();
    else ctx.signal?.addEventListener('abort', onAbort, { once: true });
    const timer = setTimeout(() => controller.abort(new OlympusError('UPSTREAM_TIMEOUT')), timeout);
    try {
      if (controller.signal.aborted) throw controller.signal.reason;
      const data = await waitFor(action(controller.signal), controller.signal);
      return { status: 'ok', data };
    } catch (error: unknown) {
      const failure = error instanceof OlympusError ? error : new OlympusError('UPSTREAM_UNAVAILABLE');
      return { status: 'error', error: { code: failure.code, message: failure.message } };
    } finally {
      clearTimeout(timer);
      ctx.signal?.removeEventListener('abort', onAbort);
    }
  }
}
