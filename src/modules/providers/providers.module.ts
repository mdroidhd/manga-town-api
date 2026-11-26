import { Module } from '@nestjs/common';

import { DemoProvider } from './demo.provider';
import { OLYMPUS_FETCH, OlympusClient } from './olympus/olympus.client';
import { OlympusProvider } from './olympus/olympus.provider';
import { ProviderRegistry } from './provider.registry';
import { ProvidersController } from './providers.controller';

@Module({
  controllers: [ProvidersController],
  providers: [
    { provide: OLYMPUS_FETCH, useFactory: () => globalThis.fetch },
    {
      provide: OlympusClient,
      useFactory: (fetchFn: typeof fetch) => new OlympusClient(fetchFn),
      inject: [OLYMPUS_FETCH],
    },
    {
      provide: OlympusProvider,
      useFactory: (client: OlympusClient) => new OlympusProvider(client),
      inject: [OlympusClient],
    },
    {
      provide: ProviderRegistry,
      useFactory: (olympus: OlympusProvider) => {
        const registry = new ProviderRegistry();
        registry.register(new DemoProvider());
        registry.register(olympus);
        return registry;
      },
      inject: [OlympusProvider],
    },
  ],
  exports: [ProviderRegistry],
})
export class ProvidersModule {}
