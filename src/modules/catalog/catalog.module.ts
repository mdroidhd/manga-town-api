import { Module } from '@nestjs/common';

import { ProvidersModule } from '../providers/providers.module';
import { CacheModule } from '../../infrastructure/cache/cache.module';
import { CatalogService } from './catalog.service';
import { CatalogController } from './catalog.controller';

@Module({
  imports: [ProvidersModule, CacheModule],
  controllers: [CatalogController],
  providers: [CatalogService],
})
export class CatalogModule {}
