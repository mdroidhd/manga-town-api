import { Injectable, Logger } from '@nestjs/common';

import type { Provider } from '../../domain/provider.contract';
import type { ProviderManifest } from '../../domain/provider';

/**
 * Registro de extensiones. De momento en memoria: cada provider se registra al
 * arrancar. Cuando haya carga dinámica, esta clase es el único punto a tocar.
 */
@Injectable()
export class ProviderRegistry {
  private readonly logger = new Logger(ProviderRegistry.name);
  private readonly providers = new Map<string, Provider>();

  register(provider: Provider): void {
    const { id } = provider.manifest;
    if (this.providers.has(id)) {
      throw new Error(`Provider duplicado: ${id}`);
    }
    this.providers.set(id, provider);
    this.logger.log(`Provider registrado: ${id}@${provider.manifest.version}`);
  }

  registerAll(providers: Provider[]): void {
    providers.forEach((provider) => this.register(provider));
  }

  get(id: string): Provider | undefined {
    return this.providers.get(id);
  }

  require(id: string): Provider {
    const provider = this.get(id);
    if (!provider) {
      throw new Error(`Provider desconocido: ${id}`);
    }
    return provider;
  }

  manifests(): ProviderManifest[] {
    return [...this.providers.values()]
      .map((provider) => provider.manifest)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  get size(): number {
    return this.providers.size;
  }
}
