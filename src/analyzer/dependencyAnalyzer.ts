import { promises as fs } from 'node:fs';
import path from 'node:path';
import { LOCKFILE_MAX_BYTES } from '../constants';
import type { DependencyOverview } from '../models/AuditResult';
import type { ExtensionInfo } from '../models/ExtensionInfo';
import type { Finding } from '../models/Finding';
import type { SecurityAnalyzer } from '../models/AuditResult';
import { asRecord, safeString } from '../utils/sanitization';

export class DependencyAnalyzer implements SecurityAnalyzer {
  readonly id = 'dependency-analyzer';

  async analyze(extension: ExtensionInfo): Promise<Finding[]> {
    const overview = await analyzeDependencies(extension);
    if (!overview.available) {
      return [];
    }
    const findings: Finding[] = [
      {
        id: 'dependency-overview',
        severity: 'informational',
        title: 'Local dependency metadata available',
        category: 'dependency',
        confidence: 'high',
        detectionSource: overview.lockfileName ?? 'package.json',
        evidence: [
          `${overview.dependencyCount} lockfile or declared packages counted`,
          `${overview.directDependencies.length} direct dependencies`,
        ],
        explanation:
          'A local dependency overview was generated from package.json and an optional lockfile. Packages were not installed, lifecycle scripts were not executed, and no vulnerability database was queried.',
        recommendation:
          'Use this list only as inventory. Vulnerability status was not checked unless a trusted local source is present.',
      },
    ];
    if (overview.rangeMismatches.length > 0) {
      findings.push({
        id: 'dependency-range-mismatch',
        severity: 'low',
        title: 'Declared dependency range may not match lockfile version',
        category: 'dependency',
        confidence: 'medium',
        detectionSource: overview.lockfileName ?? 'package.json',
        evidence: overview.rangeMismatches.slice(0, 10),
        explanation:
          'A locally declared version range and a locked version appear inconsistent. This can happen with stale lockfiles or manual edits. It is not a vulnerability confirmation.',
        recommendation:
          'Review the extension package metadata if this extension is unexpected or unpublished.',
      });
    }
    return findings;
  }
}

export async function analyzeDependencies(extension: ExtensionInfo): Promise<DependencyOverview> {
  const empty: DependencyOverview = {
    available: false,
    directDependencies: [],
    dependencyCount: 0,
    lockfilePresent: false,
    rangeMismatches: [],
    vulnerabilityStatus: 'Vulnerability status not checked.',
    note: 'No local dependency metadata was read.',
  };

  const direct = Object.entries(extension.dependencies ?? {}).map(([name, requested]) => ({
    name,
    requested,
  }));

  if (!extension.extensionPath) {
    if (direct.length === 0) {
      return empty;
    }
    return {
      available: true,
      directDependencies: direct,
      dependencyCount: direct.length,
      lockfilePresent: false,
      rangeMismatches: [],
      vulnerabilityStatus: 'Vulnerability status not checked.',
      note: 'Local-only overview from declared package.json dependencies. Registry versions were not queried.',
    };
  }

  const lockfile = await readLockfile(extension.extensionPath);
  const lockedVersions = lockfile?.versions ?? {};
  const withLocked = direct.map((item) => ({
    ...item,
    locked: lockedVersions[item.name],
  }));

  const rangeMismatches = withLocked
    .filter(
      (item) =>
        item.requested && item.locked && !satisfiesRangeLocally(item.requested, item.locked),
    )
    .map((item) => `${item.name}: declared ${item.requested}, locked ${item.locked}`);

  const dependencyCount = lockfile?.count ?? direct.length;

  return {
    available: direct.length > 0 || Boolean(lockfile),
    directDependencies: withLocked,
    dependencyCount,
    lockfilePresent: Boolean(lockfile),
    lockfileName: lockfile?.name,
    maxDepth: lockfile?.maxDepth,
    rangeMismatches,
    vulnerabilityStatus: 'Vulnerability status not checked.',
    note: 'Local-only overview. Registry versions were not queried and packages were not downloaded.',
  };
}

async function readLockfile(
  extensionPath: string,
): Promise<
  { name: string; versions: Record<string, string>; count: number; maxDepth?: number } | undefined
> {
  const candidates = ['package-lock.json', 'npm-shrinkwrap.json'];
  for (const name of candidates) {
    const filePath = path.join(extensionPath, name);
    try {
      const stat = await fs.stat(filePath);
      if (!stat.isFile() || stat.size > LOCKFILE_MAX_BYTES) {
        continue;
      }
      const text = await fs.readFile(filePath, 'utf8');
      const parsed = JSON.parse(text) as unknown;
      const record = asRecord(parsed);
      if (!record) {
        continue;
      }
      const versions: Record<string, string> = {};
      let count = 0;
      const packages = asRecord(record.packages);
      if (packages) {
        for (const [pkgPath, meta] of Object.entries(packages)) {
          if (!pkgPath || pkgPath === '') {
            continue;
          }
          count += 1;
          const packageName = pkgPath
            .replace(/^node_modules\//, '')
            .replace(/\/node_modules\//g, '/');
          const version = safeString(asRecord(meta)?.version);
          if (packageName && version && !packageName.includes('/')) {
            versions[packageName] = version;
          } else if (packageName && version) {
            const simple = packageName.split('/').slice(-2).join('/');
            if (simple.startsWith('@') || !simple.includes('/')) {
              versions[packageName.split('/').pop() ?? packageName] = version;
            }
            versions[packageName] = version;
          }
        }
      }
      const dependencies = asRecord(record.dependencies);
      if (dependencies) {
        walkLegacyDependencies(dependencies, versions, 1);
        count = Math.max(count, Object.keys(versions).length);
      }
      return {
        name,
        versions,
        count: count || Object.keys(versions).length,
        maxDepth: estimateDepth(packages ? Object.keys(packages) : []),
      };
    } catch {
      continue;
    }
  }
  return undefined;
}

function walkLegacyDependencies(
  dependencies: Record<string, unknown>,
  versions: Record<string, string>,
  depth: number,
  maxDepth = 6,
): void {
  if (depth > maxDepth) {
    return;
  }
  for (const [name, value] of Object.entries(dependencies)) {
    const record = asRecord(value);
    const version = safeString(record?.version);
    if (version && !versions[name]) {
      versions[name] = version;
    }
    const nested = asRecord(record?.dependencies);
    if (nested) {
      walkLegacyDependencies(nested, versions, depth + 1, maxDepth);
    }
  }
}

function estimateDepth(packagePaths: string[]): number | undefined {
  if (packagePaths.length === 0) {
    return undefined;
  }
  let max = 0;
  for (const item of packagePaths) {
    const depth = item.split('node_modules').length - 1;
    if (depth > max) {
      max = depth;
    }
  }
  return max;
}

export function satisfiesRangeLocally(range: string, version: string): boolean {
  const pinned = range.trim();
  if (pinned === version || pinned === `=${version}`) {
    return true;
  }
  const exact = pinned.match(/^(?:workspace:)?[~^]?(?:\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?)$/);
  if (exact) {
    const normalized = pinned.replace(/^[~^]/, '').replace(/^workspace:/, '');
    if (pinned.startsWith('^')) {
      return sameMajor(normalized, version);
    }
    if (pinned.startsWith('~')) {
      return sameMinor(normalized, version);
    }
    return normalized === version;
  }
  if (pinned === '*' || pinned === 'latest' || pinned.startsWith('workspace:')) {
    return true;
  }
  return true;
}

function parseSemver(version: string): [number, number, number] | undefined {
  const match = version.trim().match(/^v?(\d+)\.(\d+)\.(\d+)/);
  if (!match) {
    return undefined;
  }
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function sameMajor(rangeVersion: string, actual: string): boolean {
  const left = parseSemver(rangeVersion);
  const right = parseSemver(actual);
  if (!left || !right) {
    return true;
  }
  return (
    left[0] === right[0] &&
    (right[1] > left[1] || (right[1] === left[1] && right[2] >= left[2]) || right[0] === 0)
  );
}

function sameMinor(rangeVersion: string, actual: string): boolean {
  const left = parseSemver(rangeVersion);
  const right = parseSemver(actual);
  if (!left || !right) {
    return true;
  }
  return left[0] === right[0] && left[1] === right[1] && right[2] >= left[2];
}
