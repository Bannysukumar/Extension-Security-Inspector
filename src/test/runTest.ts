import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { runTests } from '@vscode/test-electron';

function withoutSpaces(target: string): string {
  if (!target.includes(' ')) {
    return target;
  }
  const alias = path.join(os.homedir(), 'esi-inspector-dev');
  if (!existsSync(alias)) {
    execFileSync('cmd.exe', ['/c', 'mklink', '/J', alias, target]);
  }
  return alias;
}

async function main(): Promise<void> {
  const realRoot = path.resolve(__dirname, '..', '..');
  const extensionDevelopmentPath = withoutSpaces(realRoot);
  const extensionTestsPath = path.join(extensionDevelopmentPath, 'out', 'test', 'suite', 'index');
  const workspace = path.join(extensionDevelopmentPath, '.vscode-test', 'workspace');

  await runTests({
    extensionDevelopmentPath,
    extensionTestsPath,
    launchArgs: [workspace, '--disable-extensions'],
  });
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
