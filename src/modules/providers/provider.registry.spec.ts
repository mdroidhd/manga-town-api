import { OlympusProvider } from './olympus/olympus.provider';
import { ProviderRegistry } from './provider.registry';

describe('ProviderRegistry', () => {
  it('registra y expone manifiestos ordenados', () => {
    const registry = new ProviderRegistry();
    registry.register(new OlympusProvider());
    expect(registry.size).toBe(1);
    expect(registry.manifests()[0]?.id).toBe('olympus');
  });

  it('rechaza ids duplicados', () => {
    const registry = new ProviderRegistry();
    registry.register(new OlympusProvider());
    expect(() => registry.register(new OlympusProvider())).toThrow(/duplicado/i);
  });

  it('require lanza si no existe', () => {
    const registry = new ProviderRegistry();
    expect(() => registry.require('nope')).toThrow(/desconocido/i);
  });
});
