import {
  BadRequestException,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  NotFoundException,
  Param,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';

import type { OperationResult } from '../../domain/provider';
import type { Provider } from '../../domain/provider.contract';
import { ProviderRegistry } from '../providers/provider.registry';

/** Traduce el resultado de una operación a HTTP sin filtrar detalles internos. */
function unwrap<T>(result: OperationResult<T>): T {
  if (result.status === 'ok') {
    return result.data;
  }
  if (result.status === 'client_action_required') {
    throw new HttpException(
      {
        code: 'CLIENT_ACTION_REQUIRED',
        action: result.action,
        continuationId: result.continuationId,
        expiresAt: result.expiresAt,
      },
      HttpStatus.ACCEPTED,
    );
  }
  const status =
    result.error.code === 'NOT_FOUND'
      ? HttpStatus.NOT_FOUND
      : result.error.code === 'LOGIN_REQUIRED'
        ? HttpStatus.UNAUTHORIZED
        : HttpStatus.BAD_GATEWAY;
  throw new HttpException(result.error, status);
}

@ApiTags('catalog')
@Controller('catalog')
export class CatalogController {
  constructor(private readonly registry: ProviderRegistry) {}

  private provider(id: string): Provider {
    const found = this.registry.get(id);
    if (!found) {
      throw new NotFoundException({
        code: 'PROVIDER_NOT_FOUND',
        message: `No existe el provider '${id}'`,
      });
    }
    return found;
  }

  @Get(':provider/latest')
  @ApiOperation({ summary: 'Lista las series actualizadas recientemente en una extensión' })
  @ApiQuery({ name: 'page', required: false, schema: { type: 'integer', minimum: 1, default: 1 } })
  async latest(@Param('provider') providerId: string, @Query('page') query: unknown = '1') {
    const page = typeof query === 'string' && /^\d+$/.test(query) ? Number(query) : NaN;
    if (!Number.isSafeInteger(page) || page < 1) {
      throw new BadRequestException({
        code: 'INVALID_QUERY',
        message: 'El parámetro page debe ser un entero mayor o igual a 1',
      });
    }
    const result = await this.provider(providerId).listLatest(page, { userId: 'anonymous' });
    const { items, hasNextPage } = unwrap(result);
    return { data: items, page, hasNextPage };
  }

  @Get(':provider/search')
  @ApiOperation({ summary: 'Busca series en una extensión' })
  @ApiQuery({ name: 'q', required: true })
  async search(@Param('provider') providerId: string, @Query('q') query?: string) {
    const term = (query ?? '').trim();
    if (term.length < 2) {
      throw new BadRequestException({
        code: 'INVALID_QUERY',
        message: 'El parámetro q necesita al menos 2 caracteres',
      });
    }
    const result = await this.provider(providerId).search(term, { userId: 'anonymous' });
    return { data: unwrap(result) };
  }

  @Get(':provider/series/:id')
  @ApiOperation({ summary: 'Ficha de una serie' })
  async series(@Param('provider') providerId: string, @Param('id') id: string) {
    const result = await this.provider(providerId).getSeries(id, { userId: 'anonymous' });
    return { data: unwrap(result) };
  }

  @Get(':provider/series/:id/chapters')
  @ApiOperation({ summary: 'Capítulos de una serie' })
  async chapters(@Param('provider') providerId: string, @Param('id') id: string) {
    const result = await this.provider(providerId).listChapters(id, { userId: 'anonymous' });
    return { data: unwrap(result) };
  }

  @Get(':provider/series/:id/chapters/:chapter/pages')
  @ApiOperation({ summary: 'Páginas de un capítulo' })
  async pages(
    @Param('provider') providerId: string,
    @Param('id') id: string,
    @Param('chapter') chapter: string,
  ) {
    const result = await this.provider(providerId).getPages(id, chapter, { userId: 'anonymous' });
    return { data: unwrap(result) };
  }
}
