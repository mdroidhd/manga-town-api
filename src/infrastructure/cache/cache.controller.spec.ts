import { ConfigService } from '@nestjs/config';
import { CacheController } from './cache.controller';
import { CacheService } from './cache.service';

describe('purga protegida', () => {
  let service: CacheService;
  let controller: CacheController;
  beforeEach(() => { delete process.env.CACHE_PURGE_TOKEN; service = new CacheService(new ConfigService()); controller = new CacheController(service, new ConfigService()); });
  afterEach(() => { delete process.env.CACHE_PURGE_TOKEN; service.onModuleDestroy(); });
  it('oculta endpoint sin token configurado', async () => {
    await expect(controller.purge(undefined)).rejects.toMatchObject({status: 404});
  });
  it('rechaza token incorrecto y purga con token válido', async () => {
    process.env.CACHE_PURGE_TOKEN = 'secret';
    await expect(controller.purge('wrong')).rejects.toMatchObject({status: 403});
    const purge = jest.spyOn(service, 'purge');
    await expect(controller.purge('secret', {provider: 'p'})).resolves.toEqual({ok: true});
    expect(purge).toHaveBeenCalledWith('p');
  });
});
