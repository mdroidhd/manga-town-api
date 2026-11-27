import { EventEmitter } from 'events';
import { Logger } from '@nestjs/common';
import { RedisCacheStore } from './redis-cache.store';

const client = new EventEmitter();
jest.mock('ioredis', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => Object.assign(client, {
    status: 'ready', connect: jest.fn().mockResolvedValue(undefined), disconnect: jest.fn(),
    set: jest.fn().mockRejectedValue(new Error('offline')),
  })),
}));

describe('avisos de disponibilidad Redis', () => {
  it('avisa una vez por caída y vuelve a avisar tras recuperarse', async () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    const store = new RedisCacheStore('redis://localhost', 'test:');
    try {
      client.emit('error', new Error('offline'));
      await store.set('key', {status: 'ok', data: 1}, 1000);
      client.emit('error', new Error('offline'));
      expect(warn).toHaveBeenCalledTimes(1);
      client.emit('ready');
      client.emit('error', new Error('offline again'));
      expect(warn).toHaveBeenCalledTimes(2);
    } finally { store.close(); client.removeAllListeners(); warn.mockRestore(); }
  });
});
