import { ConfigService } from '@nestjs/config';
import { CacheService } from './cache.service';

describe('CacheService without Redis (fails open)', () => {
  const cache = new CacheService({ get: () => undefined } as unknown as ConfigService);

  it('reports disabled and always runs the loader', async () => {
    expect(cache.enabled).toBe(false);
    const loader = jest.fn().mockResolvedValue(['x']);
    expect(await cache.getOrSet('k', 60, loader)).toEqual(['x']);
    expect(await cache.getOrSet('k', 60, loader)).toEqual(['x']);
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it('version/bump are harmless no-ops', async () => {
    await expect(cache.bump('s:1')).resolves.toBeUndefined();
    await expect(cache.version('s:1')).resolves.toBe('0');
  });
});

describe('CacheService with an unreachable Redis (fails open)', () => {
  it('still serves from the loader', async () => {
    const cache = new CacheService({ get: () => 'redis://127.0.0.1:1' } as unknown as ConfigService);
    const loader = jest.fn().mockResolvedValue(42);
    expect(await cache.getOrSet('k', 60, loader)).toBe(42);
    await cache.onModuleDestroy();
  });
});
