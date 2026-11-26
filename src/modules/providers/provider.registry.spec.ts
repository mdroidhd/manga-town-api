import { ProviderRegistry } from './provider.registry';
import { DemoProvider } from './demo.provider';

describe('ProviderRegistry', () => {
  it('registra y expone manifiestos ordenados', () => {
    const registry = new ProviderRegistry();
    registry.register(new DemoProvider());
    expect(registry.size).toBe(1);
    expect(registry.manifests()[0]?.id).toBe('demo');
  });

  it('rechaza ids duplicados', () => {
    const registry = new ProviderRegistry();
    registry.register(new DemoProvider());
    expect(() => registry.register(new DemoProvider())).toThrow(/duplicado/i);
  });

  it('require lanza si no existe', () => {
    const registry = new ProviderRegistry();
    expect(() => registry.require('nope')).toThrow(/desconocido/i);
  });
});
