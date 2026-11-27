import { Injectable, NotFoundException } from '@nestjs/common';
import { ProviderRegistry } from '../providers/provider.registry';
import { CacheService } from '../../infrastructure/cache/cache.service';
import type { Provider } from '../../domain/provider.contract';
@Injectable()
export class CatalogService {
  constructor(private readonly registry: ProviderRegistry, private readonly cache: CacheService) {}
  provider(id: string): Provider {
    const found = this.registry.get(id);
    if (!found) throw new NotFoundException({ code: 'PROVIDER_NOT_FOUND', message: `No existe el provider '${id}'` });
    return found;
  }
  latest(id: string, page: number) { const p = this.provider(id); return this.cache.get(id, p.manifest.version, 'latest', {page}, () => p.listLatest(page, { userId: 'anonymous' })); }
  search(id: string, q: string) { const p = this.provider(id); return this.cache.get(id, p.manifest.version, 'search', {q}, () => p.search(q, { userId: 'anonymous' })); }
  series(id: string, series: string) { const p = this.provider(id); return this.cache.get(id, p.manifest.version, 'series', {id: series}, () => p.getSeries(series, { userId: 'anonymous' })); }
  chapters(id: string, series: string) { const p = this.provider(id); return this.cache.get(id, p.manifest.version, 'chapters', {id: series}, () => p.listChapters(series, { userId: 'anonymous' })); }
}
