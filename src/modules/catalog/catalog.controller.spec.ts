import { DemoProvider } from '../providers/demo.provider';
import { ProviderRegistry } from '../providers/provider.registry';
import { CatalogController } from './catalog.controller';

describe('CatalogController.latest', () => {
  const setup = () => {
    const registry = new ProviderRegistry();
    const provider = new DemoProvider();
    registry.register(provider);
    return {
      controller: new CatalogController(registry),
      listLatest: jest.spyOn(provider, 'listLatest'),
    };
  };

  it('pasa la página numérica y el contexto al provider', async () => {
    const { controller, listLatest } = setup();

    await expect(controller.latest('demo', '2')).resolves.toEqual({
      data: [],
      page: 2,
      hasNextPage: false,
    });
    expect(listLatest).toHaveBeenCalledWith(2, { userId: 'anonymous' });
  });

  it('rechaza páginas inválidas antes de consultar el provider', async () => {
    const { controller, listLatest } = setup();

    await expect(controller.latest('demo', ['1', '2'])).rejects.toMatchObject({
      status: 400,
      response: { code: 'INVALID_QUERY' },
    });
    expect(listLatest).not.toHaveBeenCalled();
  });
});
