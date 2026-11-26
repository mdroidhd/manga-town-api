export type ProviderKind = 'manga' | 'comic' | 'anime' | 'movie' | 'series';

/** Dónde se ejecuta cada paso que la fuente pueda necesitar. */
export type ExecutionSite = 'server' | 'app';

export interface ProviderCapabilities {
  /** La fuente necesita cuenta para leer más allá del límite de invitado. */
  login: 'none' | ExecutionSite;
  /** Hay captcha o reto anti-bot. */
  captcha: 'none' | ExecutionSite;
  /** Las páginas se resuelven en el servidor o hay que pedirlas desde la app. */
  pages: ExecutionSite;
  /** La fuente exige que las peticiones salgan desde la IP del usuario. */
  deviceEgress: boolean;
}

export interface ProviderManifest {
  id: string;
  name: string;
  version: string;
  contractVersion: number;
  kinds: ProviderKind[];
  languages: string[];
  /** Orígenes que el runtime tiene permitido tocar. */
  origins: string[];
  capabilities: ProviderCapabilities;
}

export type OperationStatus = 'ok' | 'client_action_required' | 'error';

export type ClientActionType = 'login' | 'captcha' | 'fetch';

export interface ClientAction {
  type: ClientActionType;
  /** Origen autorizado para esta acción; la app no debe salir de aquí. */
  origin: string;
  url: string;
  /** Qué debe devolver la app al reanudar. */
  expect: 'cookies' | 'token' | 'body';
  method?: 'GET' | 'POST';
  /** Solo para `fetch`: lista blanca de cabeceras que la app puede reenviar. */
  headers?: Record<string, string>;
}

export interface Continuation {
  id: string;
  userId: string;
  providerId: string;
  action: ClientAction;
  expiresAt: string;
}

export interface OperationError {
  code: string;
  message: string;
}

export type OperationResult<T> =
  | { status: 'ok'; data: T }
  | { status: 'client_action_required'; continuationId: string; action: ClientAction; expiresAt: string }
  | { status: 'error'; error: OperationError };

export type Paginated<T> = { items: T[]; hasNextPage: boolean };

export interface PageRef {
  index: number;
  /** URL que la app puede descargar directamente, si la fuente lo permite. */
  url?: string;
  /** Referencia opaca que el servidor resuelve. */
  handle?: string;
}

export interface ChapterSummary {
  id: string;
  number: string;
  title?: string;
  publishedAt?: string;
}

export interface SeriesSummary {
  id: string;
  providerId: string;
  title: string;
  coverUrl?: string;
  year?: number;
}
