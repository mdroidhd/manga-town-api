import { Module } from '@nestjs/common';

import { DemoProvider } from './demo.provider';
import { ProviderRegistry } from './provider.registry';
import { ProvidersController } from './providers.controller';

@Module({
  controllers: [ProvidersController],
  providers: [
    {
      provide: ProviderRegistry,
      useFactory: () => {
        const registry = new ProviderRegistry();
        registry.register(new DemoProvider());
        return registry;
      },
    },
  ],
  exports: [ProviderRegistry],
})
export class ProvidersModule {}
