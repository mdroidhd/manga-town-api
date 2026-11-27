import { Module } from '@nestjs/common';
import { AEDEX_FETCH, AedexClient } from './aedex/aedex.client';
import { AedexProvider } from './aedex/aedex.provider';

import { APOLLCOMICS_FETCH, ApollComicsClient } from './apollcomics/apollcomics.client';
import { ApollComicsProvider } from './apollcomics/apollcomics.provider';
import { OLYMPUS_FETCH, OlympusClient } from './olympus/olympus.client';
import { OlympusProvider } from './olympus/olympus.provider';
import { ProviderRegistry } from './provider.registry';
import { ProvidersController } from './providers.controller';

@Module({
  controllers: [ProvidersController],
  providers: [
    { provide: AEDEX_FETCH, useFactory: () => globalThis.fetch },
    { provide: AedexClient, useFactory: (fetchFn: typeof fetch) => new AedexClient(fetchFn), inject: [AEDEX_FETCH] },
    { provide: AedexProvider, useFactory: (client: AedexClient) => new AedexProvider(client), inject: [AedexClient] },
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
      useFactory: (olympus: OlympusProvider, apollComics: ApollComicsProvider, aedex: AedexProvider) => {
        const registry = new ProviderRegistry();
        registry.register(olympus);
        registry.register(apollComics);
        registry.register(aedex);
        return registry;
      },
      inject: [OlympusProvider, ApollComicsProvider, AedexProvider],
    },
  ],
  exports: [ProviderRegistry],
})
export class ProvidersModule {}
