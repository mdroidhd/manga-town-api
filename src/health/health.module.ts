import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';

import { ProvidersModule } from '../modules/providers/providers.module';
import { HealthController } from './health.controller';

@Module({
  imports: [TerminusModule, ProvidersModule],
  controllers: [HealthController],
})
export class HealthModule {}
