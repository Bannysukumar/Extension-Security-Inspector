import type { AuditResult, CacheKey } from '../models/AuditResult';

export interface StoredCacheEntry {
  key: CacheKey;
  result: AuditResult;
}

export function cacheKeyEquals(left: CacheKey, right: CacheKey): boolean {
  return (
    left.extensionId === right.extensionId &&
    left.version === right.version &&
    left.packageJsonMtime === right.packageJsonMtime &&
    left.extensionPath === right.extensionPath
  );
}

export function toCacheKey(result: Pick<AuditResult, 'extension'>): CacheKey {
  return {
    extensionId: result.extension.id,
    version: result.extension.version,
    packageJsonMtime: result.extension.packageJsonMtime,
    extensionPath: result.extension.extensionPath,
  };
}

export class CacheService {
  private readonly memory = new Map<string, StoredCacheEntry>();

  constructor(initial?: StoredCacheEntry[]) {
    for (const entry of initial ?? []) {
      this.memory.set(this.index(entry.key), entry);
    }
  }

  get(key: CacheKey): AuditResult | undefined {
    const entry = this.memory.get(this.index(key));
    if (!entry || !cacheKeyEquals(entry.key, key)) {
      return undefined;
    }
    return { ...entry.result, cached: true };
  }

  set(result: AuditResult): void {
    const key = toCacheKey(result);
    this.memory.set(this.index(key), {
      key,
      result: { ...result, cached: true },
    });
  }

  invalidate(extensionId: string): void {
    for (const [index, entry] of this.memory.entries()) {
      if (entry.key.extensionId === extensionId) {
        this.memory.delete(index);
      }
    }
  }

  clear(): void {
    this.memory.clear();
  }

  serialize(): StoredCacheEntry[] {
    return [...this.memory.values()].map((entry) => ({
      key: entry.key,
      result: entry.result,
    }));
  }

  private index(key: CacheKey): string {
    return `${key.extensionId}@${key.version}@${key.packageJsonMtime ?? 0}@${key.extensionPath ?? ''}`;
  }
}
