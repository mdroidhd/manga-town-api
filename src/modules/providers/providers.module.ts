import { Module } from '@nestjs/common';

import { APOLLCOMICS_FETCH, ApollComicsClient } from './apollcomics/apollcomics.client';
import { ApollComicsProvider } from './apollcomics/apollcomics.provider';
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
    { provide: APOLLCOMICS_FETCH, useFactory: () => globalThis.fetch },
    {
      provide: ApollComicsClient,
      useFactory: (fetchFn: typeof fetch) => new ApollComicsClient(fetchFn),
      inject: [APOLLCOMICS_FETCH],
    },
    {
      provide: ApollComicsProvider,
      useFactory: (client: ApollComicsClient) => new ApollComicsProvider(client),
      inject: [ApollComicsClient],
    },
    {
      provide: ProviderRegistry,
      useFactory: (olympus: OlympusProvider, apollComics: ApollComicsProvider) => {
        const registry = new ProviderRegistry();
        registry.register(olympus);
        registry.register(apollComics);
        return registry;
      },
      inject: [OlympusProvider, ApollComicsProvider],
    },
  ],
  exports: [ProviderRegistry],
})
export class ProvidersModule {}
