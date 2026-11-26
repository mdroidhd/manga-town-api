import type { Provider, ProviderContext } from '../../domain/provider.contract';
import type {
  ChapterSummary,
  OperationResult,
  PageRef,
  ProviderManifest,
  SeriesSummary,
} from '../../domain/provider';
import type { SeriesDetail } from '../../domain/provider.contract';

const manifest: ProviderManifest = {
  id: 'demo',
  name: 'Demo',
  version: '0.0.1',
  contractVersion: 1,
  kinds: ['manga'],
  languages: ['es'],
  origins: [],
  capabilities: {
    login: 'none',
    captcha: 'none',
    pages: 'server',
    deviceEgress: false,
  },
};

const SERIES: SeriesDetail[] = [
  {
    id: 'demo-1',
    providerId: 'demo',
    title: 'Serie de ejemplo',
    description: 'Provider local sin red, para validar el contrato.',
    status: 'ongoing',
  },
];

/**
 * Provider de ejemplo. No toca la red: existe para que el contrato, el
 * registro y los endpoints se puedan probar de punta a punta desde el día uno.
 */
export class DemoProvider implements Provider {
  readonly manifest = manifest;

  async search(query: string, _ctx: ProviderContext): Promise<OperationResult<SeriesSummary[]>> {
    const needle = query.trim().toLowerCase();
    const data = SERIES.filter((serie) => serie.title.toLowerCase().includes(needle)).map(
      ({ id, providerId, title }) => ({ id, providerId, title }),
    );
    return { status: 'ok', data };
  }

  async getSeries(id: string, _ctx: ProviderContext): Promise<OperationResult<SeriesDetail>> {
    const found = SERIES.find((serie) => serie.id === id);
    if (!found) {
      return { status: 'error', error: { code: 'NOT_FOUND', message: 'Serie desconocida' } };
    }
    return { status: 'ok', data: found };
  }

  async listChapters(
    id: string,
    _ctx: ProviderContext,
  ): Promise<OperationResult<ChapterSummary[]>> {
    if (!SERIES.some((serie) => serie.id === id)) {
      return { status: 'error', error: { code: 'NOT_FOUND', message: 'Serie desconocida' } };
    }
    return {
      status: 'ok',
      data: [
        { id: '1', number: '1', title: 'Capítulo 1' },
        { id: '2', number: '2', title: 'Capítulo 2' },
      ],
    };
  }

  async getPages(
    id: string,
    chapter: string,
    _ctx: ProviderContext,
  ): Promise<OperationResult<PageRef[]>> {
    if (!SERIES.some((serie) => serie.id === id)) {
      return { status: 'error', error: { code: 'NOT_FOUND', message: 'Serie desconocida' } };
    }
    return {
      status: 'ok',
      data: [
        { index: 0, handle: `${id}/${chapter}/0` },
        { index: 1, handle: `${id}/${chapter}/1` },
      ],
    };
  }
}
