import type {
  ChapterSummary,
  OperationResult,
  PageRef,
  Paginated,
  ProviderManifest,
  SeriesSummary,
} from './provider';

/** Contexto acotado que recibe un provider en cada operación. */
export interface ProviderContext {
  userId: string;
  /** Cookies o tokens que el usuario haya cedido para esta fuente. */
  session?: Readonly<Record<string, string>>;
  signal?: AbortSignal;
}

export interface SeriesDetail extends SeriesSummary {
  description?: string;
  status?: string;
}

/**
 * Contrato que implementa cada extensión. Todo pasa por aquí: el runtime no
 * conoce detalles de ninguna web.
 */
export interface Provider {
  readonly manifest: ProviderManifest;

  listLatest(page: number, ctx: ProviderContext): Promise<OperationResult<Paginated<SeriesSummary>>>;

  search(query: string, ctx: ProviderContext): Promise<OperationResult<SeriesSummary[]>>;

  getSeries(id: string, ctx: ProviderContext): Promise<OperationResult<SeriesDetail>>;

  listChapters(id: string, ctx: ProviderContext): Promise<OperationResult<ChapterSummary[]>>;

  getPages(
    id: string,
    chapter: string,
    ctx: ProviderContext,
  ): Promise<OperationResult<PageRef[]>>;
}
