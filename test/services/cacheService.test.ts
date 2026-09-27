import { buildAuditResult } from '../../src/analyzer/findingsEngine';
import { cacheKeyEquals, CacheService, toCacheKey } from '../../src/services/cacheService';
import { emptyExtension } from '../helpers';

describe('cacheService', () => {
  it('returns cached results for an unchanged extension', () => {
    const extension = emptyExtension({ packageJsonMtime: 10, extensionPath: '/tmp/ext' });
    const result = buildAuditResult(extension, [], { workspaceTrusted: true });
    const cache = new CacheService();
    cache.set(result);
    const cached = cache.get(toCacheKey({ extension }));
    expect(cached?.cached).toBe(true);
    expect(cached?.extension.id).toBe(extension.id);
  });

  it('invalidates when version or mtime changes', () => {
    const extension = emptyExtension({
      version: '1.0.0',
      packageJsonMtime: 10,
      extensionPath: '/tmp/ext',
    });
    const cache = new CacheService();
    cache.set(buildAuditResult(extension, [], { workspaceTrusted: true }));
    expect(cache.get({ ...toCacheKey({ extension }), version: '1.0.1' })).toBeUndefined();
    expect(cache.get({ ...toCacheKey({ extension }), packageJsonMtime: 11 })).toBeUndefined();
  });

  it('compares cache keys', () => {
    const key = { extensionId: 'a.b', version: '1.0.0', packageJsonMtime: 1, extensionPath: '/x' };
    expect(cacheKeyEquals(key, { ...key })).toBe(true);
    expect(cacheKeyEquals(key, { ...key, extensionPath: '/y' })).toBe(false);
  });

  it('can clear and serialize', () => {
    const cache = new CacheService();
    cache.set(
      buildAuditResult(emptyExtension({ extensionPath: '/tmp/a' }), [], { workspaceTrusted: true }),
    );
    expect(cache.serialize()).toHaveLength(1);
    cache.invalidate('example.empty');
    expect(
      cache.get(toCacheKey({ extension: emptyExtension({ extensionPath: '/tmp/a' }) })),
    ).toBeUndefined();
    cache.clear();
    expect(cache.serialize()).toHaveLength(0);
  });
});
