import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { ProviderRegistry } from './provider.registry';

@ApiTags('providers')
@Controller('providers')
export class ProvidersController {
  constructor(private readonly registry: ProviderRegistry) {}

  @Get()
  @ApiOperation({ summary: 'Lista las extensiones instaladas' })
  list() {
    return { data: this.registry.manifests() };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Manifest de una extensión' })
  get(@Param('id') id: string) {
    const provider = this.registry.get(id);
    if (!provider) {
      throw new NotFoundException({
        code: 'PROVIDER_NOT_FOUND',
        message: `No existe el provider '${id}'`,
      });
    }
    return { data: provider.manifest };
  }
}
