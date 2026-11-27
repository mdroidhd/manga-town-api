import { BadRequestException, Body, Controller, ForbiddenException, Headers, HttpCode, NotFoundException, Post } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'crypto';
import { CacheService } from './cache.service';
@Controller('cache')
export class CacheController {
  constructor(private readonly cache: CacheService, private readonly config: ConfigService) {}
  @Post('purge') @HttpCode(200)
  async purge(@Headers('x-cache-token') token: string | undefined, @Body() body?: {provider?: unknown; all?: unknown}) {
    const expected = this.config.get<string>('CACHE_PURGE_TOKEN');
    if (!expected) throw new NotFoundException();
    const actual = Buffer.from(token || ''); const wanted = Buffer.from(expected);
    if (actual.length !== wanted.length || !timingSafeEqual(actual, wanted)) throw new ForbiddenException();
    if (body?.provider !== undefined && (typeof body.provider !== 'string' || !body.provider.trim()) || body?.all !== undefined && typeof body.all !== 'boolean' || body?.provider && body?.all) throw new BadRequestException();
    await this.cache.purge(body?.provider as string | undefined);
    return { ok: true };
  }
}
