import { ConfigService } from '@nestjs/config';
import { OlympusProvider } from '../providers/olympus/olympus.provider';
import { ProviderRegistry } from '../providers/provider.registry';
import { CacheService } from '../../infrastructure/cache/cache.service';
import { CatalogService } from './catalog.service';
import { CatalogController } from './catalog.controller';

describe('CatalogController.latest', () => {
  const setup = () => {
    const registry = new ProviderRegistry();
    const provider = new OlympusProvider();
    registry.register(provider);
    return {
      controller: new CatalogController(new CatalogService(registry, new CacheService(new ConfigService()))),
      listLatest: jest.spyOn(provider, 'listLatest').mockResolvedValue({
        status: 'ok',
        data: { items: [], hasNextPage: false },
      }),
    };
  };

  it('pasa la página numérica y el contexto al provider', async () => {
    const { controller, listLatest } = setup();

    await expect(controller.latest('olympus', '2')).resolves.toEqual({
      data: [],
      page: 2,
      hasNextPage: false,
    });
    expect(listLatest).toHaveBeenCalledWith(2, { userId: 'anonymous' });
  });

  it('rechaza páginas inválidas antes de consultar el provider', async () => {
    const { controller, listLatest } = setup();

    await expect(controller.latest('olympus', ['1', '2'])).rejects.toMatchObject({
      status: 400,
      response: { code: 'INVALID_QUERY' },
    });
    expect(listLatest).not.toHaveBeenCalled();
  });
});
