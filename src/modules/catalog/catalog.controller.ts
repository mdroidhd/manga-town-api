import {
  BadRequestException,
  Body,
  Post,
  HttpCode,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Query,
  Res,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';

import type { OperationResult } from '../../domain/provider';
import type { Response } from 'express';
import { CatalogService } from './catalog.service';

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
  constructor(private readonly catalog: CatalogService) {}

  @Get(':provider/latest')
  @ApiOperation({ summary: 'Lista las series actualizadas recientemente en una extensión' })
  @ApiQuery({ name: 'page', required: false, schema: { type: 'integer', minimum: 1, default: 1 } })
  async latest(@Param('provider') providerId: string, @Query('page') query: unknown = '1', @Res({ passthrough: true }) response?: Response) {
    const page = typeof query === 'string' && /^\d+$/.test(query) ? Number(query) : NaN;
    if (!Number.isSafeInteger(page) || page < 1) {
      throw new BadRequestException({
        code: 'INVALID_QUERY',
        message: 'El parámetro page debe ser un entero mayor o igual a 1',
      });
    }
    const { result, cache } = await this.catalog.latest(providerId, page);
    response?.setHeader('X-Cache', cache);
    const { items, hasNextPage } = unwrap(result);
    return { data: items, page, hasNextPage };
  }

  @Get(':provider/search')
  @ApiOperation({ summary: 'Busca series en una extensión' })
  @ApiQuery({ name: 'q', required: true })
  async search(@Param('provider') providerId: string, @Query('q') query?: string, @Res({ passthrough: true }) response?: Response) {
    const term = (query ?? '').trim();
    if (term.length < 2) {
      throw new BadRequestException({
        code: 'INVALID_QUERY',
        message: 'El parámetro q necesita al menos 2 caracteres',
      });
    }
    const { result, cache } = await this.catalog.search(providerId, term);
    response?.setHeader('X-Cache', cache);
    return { data: unwrap(result) };
  }

  @Get(':provider/series/:id')
  @ApiOperation({ summary: 'Ficha de una serie' })
  async series(@Param('provider') providerId: string, @Param('id') id: string, @Res({ passthrough: true }) response?: Response) {
    const { result, cache } = await this.catalog.series(providerId, id);
    response?.setHeader('X-Cache', cache);
    return { data: unwrap(result) };
  }

  @Get(':provider/series/:id/chapters')
  @ApiOperation({ summary: 'Capítulos de una serie' })
  async chapters(@Param('provider') providerId: string, @Param('id') id: string, @Res({ passthrough: true }) response?: Response) {
    const { result, cache } = await this.catalog.chapters(providerId, id);
    response?.setHeader('X-Cache', cache);
    return { data: unwrap(result) };
  }

  @Get(':provider/series/:id/chapters/:chapter/pages')
  @ApiOperation({ summary: 'Páginas de un capítulo' })
  async pages(
    @Param('provider') providerId: string,
    @Param('id') id: string,
    @Param('chapter') chapter: string,
    @Res({ passthrough: true }) response?: Response,
  ) {
    const provider = this.catalog.provider(providerId);
    if (provider.manifest.capabilities.pages === 'app') {
      if (!provider.getPageFetchAction) throw new HttpException({ code: 'ACTION_NOT_SUPPORTED', message: 'Acción no disponible' }, 500);
      response?.status(HttpStatus.ACCEPTED);
      return { status: 'client_action_required', action: provider.getPageFetchAction(id, chapter) };
    }
    const result = await provider.getPages(id, chapter, { userId: 'anonymous' });
    return { data: unwrap(result) };
  }

  @Post(':provider/series/:id/chapters/:chapter/pages')
  @HttpCode(200)
  parsePages(@Param('provider') providerId: string, @Body() body: unknown) {
    const provider = this.catalog.provider(providerId);
    if (!provider.parsePages) throw new BadRequestException({ code: 'PARSE_NOT_SUPPORTED', message: 'El provider no admite parseo' });
    if (!body || typeof body !== 'object' || typeof (body as { html?: unknown }).html !== 'string') {
      throw new BadRequestException({ code: 'INVALID_BODY', message: 'Se requiere html como texto' });
    }
    const html = (body as { html: string }).html;
    if (Buffer.byteLength(html, 'utf8') > 5 * 1024 * 1024) {
      throw new HttpException({ code: 'HTML_TOO_LARGE', message: 'HTML excede 5 MB' }, HttpStatus.PAYLOAD_TOO_LARGE);
    }
    const result = provider.parsePages(html, { userId: 'anonymous' });
    if (result.status === 'error' && result.error.code === 'INVALID_HTML') throw new HttpException(result.error, HttpStatus.UNPROCESSABLE_ENTITY);
    return { data: unwrap(result) };
  }
}
