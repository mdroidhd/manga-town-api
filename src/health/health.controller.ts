import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { HealthCheck, HealthCheckService, MemoryHealthIndicator } from '@nestjs/terminus';

import { ProviderRegistry } from '../modules/providers/provider.registry';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly memory: MemoryHealthIndicator,
    private readonly registry: ProviderRegistry,
  ) {}

  @Get()
  @HealthCheck()
  @ApiOperation({ summary: 'Estado del servicio' })
  check() {
    return this.health.check([() => this.memory.checkHeap('heap', 512 * 1024 * 1024)]);
  }

  @Get('providers')
  @ApiOperation({ summary: 'Extensiones cargadas' })
  providers() {
    return { data: { count: this.registry.size, ids: this.registry.manifests().map((m) => m.id) } };
  }
}
