import { Module } from '@nestjs/common';

import { ProvidersModule } from '../providers/providers.module';
import { CatalogController } from './catalog.controller';

@Module({
  imports: [ProvidersModule],
  controllers: [CatalogController],
})
export class CatalogModule {}
