import { z } from 'zod';
import type { ChapterSummary, OperationResult, PageRef, Paginated, ProviderManifest, SeriesSummary } from '../../../domain/provider';
import type { Provider, ProviderContext, SeriesDetail } from '../../../domain/provider.contract';
import { AedexClient, AedexError, AEDEX_ORIGIN } from './aedex.client';

const manga = z.object({ slug: z.string().optional().nullable(), nombre: z.string().min(1), descripcion: z.string().nullish(), portada_url: z.string().nullish(), estado: z.string().nullish() });
const listing = z.object({ data: z.array(manga), total_pages: z.number().int().nonnegative() });
const detail = manga.extend({ capitulos: z.array(z.object({ numero: z.union([z.number(), z.string()]), titulo: z.string().nullish(), fecha_publicacion: z.string().nullish() })) });
type Manga = z.infer<typeof manga>;
const manifest: ProviderManifest = { id: 'aedex', name: 'Aedex', version: '0.1.0', contractVersion: 1, kinds: ['comic'], languages: ['es'], origins: [AEDEX_ORIGIN], capabilities: { login: 'app', captcha: 'app', pages: 'app', deviceEgress: true } };
function slugify(value: string): string { return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
function summary(item: Manga, id = item.slug || slugify(item.nombre)): SeriesSummary {
  if (!id) throw new AedexError('UPSTREAM_INVALID_RESPONSE');
  const result: SeriesSummary = { id, providerId: 'aedex', title: item.nombre };
  if (item.portada_url) result.coverUrl = `${AEDEX_ORIGIN}/assets/${encodeURIComponent(item.portada_url)}`;
  return result;
}
function parse<T>(schema: z.ZodType<T>, data: unknown): T { const result = schema.safeParse(data); if (!result.success) throw new AedexError('UPSTREAM_INVALID_RESPONSE'); return result.data; }
function path(id: string): string { if (!/^[\p{L}\p{M}\p{N}_-]+$/u.test(id)) throw new AedexError('NOT_FOUND'); return `/api/backend/mangas/${encodeURIComponent(id)}`; }
export class AedexProvider implements Provider {
  readonly manifest = manifest;
  constructor(private readonly client: AedexClient = new AedexClient()) {}
  listLatest(page: number, ctx: ProviderContext): Promise<OperationResult<Paginated<SeriesSummary>>> { return this.operation(async () => { const data = parse(listing, await this.client.get('/api/backend/mangas', { page: String(page), limit: '50', sort: '-date_created' }, ctx.signal)); return { items: data.data.map(item => summary(item)), hasNextPage: page < data.total_pages }; }); }
  search(query: string, ctx: ProviderContext): Promise<OperationResult<SeriesSummary[]>> { return this.operation(async () => parse(listing, await this.client.get('/api/backend/mangas', { page: '1', limit: '50', search: query }, ctx.signal)).data.map(item => summary(item))); }
  getSeries(id: string, ctx: ProviderContext): Promise<OperationResult<SeriesDetail>> { return this.operation(async () => { const item = parse(detail, await this.client.get(path(id), {}, ctx.signal)); const result: SeriesDetail = summary(item, id); if (item.descripcion) result.description = item.descripcion; if (item.estado) result.status = item.estado; return result; }); }
  listChapters(id: string, ctx: ProviderContext): Promise<OperationResult<ChapterSummary[]>> { return this.operation(async () => { const item = parse(detail, await this.client.get(path(id), {}, ctx.signal)); return item.capitulos.map(ch => ({ id: String(ch.numero), number: String(ch.numero), ...(ch.titulo ? { title: ch.titulo } : {}), ...(ch.fecha_publicacion ? { publishedAt: ch.fecha_publicacion } : {}) })); }); }
  getPages(_id: string, _chapter: string, _ctx: ProviderContext): Promise<OperationResult<PageRef[]>> { return Promise.resolve({ status: 'error', error: { code: 'READER_NOT_AVAILABLE', message: 'El lector de Aedex aún no está disponible' } }); }
  private async operation<T>(action: () => Promise<T>): Promise<OperationResult<T>> { try { return { status: 'ok', data: await action() }; } catch (error: unknown) { const e = error instanceof AedexError ? error : new AedexError('UPSTREAM_UNAVAILABLE'); return { status: 'error', error: { code: e.code, message: e.message } }; } }
}
