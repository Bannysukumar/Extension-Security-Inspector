<!-- readme-seo: bannysukumar-professional-v4 -->

# Extension Security Inspector

Extension Security Inspector is a VS Code extension that inspects installed extension metadata locally. The package description says it shows capabilities, contribution points, and security-relevant indicators. It does not say an extension is safe or unsafe, and it does not detect malware.

## Overview

`package.json` names the extension `extension-security-inspector`, version 0.1.1, publisher `bannysukumar2255`. It requires VS Code `^1.96.0` and Node.js 18 or newer. The implementation is TypeScript under `src/`, bundled with esbuild. Tests use Vitest (`vitest.config.ts`).

The analyzer files cover extension scanning, manifest parsing, capability analysis, dependency analysis, and findings. Commands in `src/commands` are audit all, audit selected, and export report.

## Features

- Local scan of installed extension metadata
- Manifest, capability, dependency, and findings analyzers
- Commands `auditAll`, `auditSelected`, and `exportReport`
- Tree providers for extensions and security findings

## Tech Stack

| Technology | Where it shows up |
|---|---|
| TypeScript | `tsconfig.json` and `src/` |
| VS Code extension API | `engines.vscode` and `src/extension.ts` |
| esbuild | `esbuild.js` |
| Vitest | `vitest.config.ts` |

## Architecture

VS Code extension host → `src/extension.ts` → analyzer modules in `src/analyzer` → audit and report services.

## Project Structure

```text
Extension-Security-Inspector/
├── src/analyzer/
├── src/commands/
├── src/providers/
├── src/services/
├── media/
├── package.json
├── esbuild.js
└── vitest.config.ts
```

## Prerequisites

- VS Code 1.96 or newer
- Node.js 18 or newer

## Installation

```bash
git clone https://github.com/Bannysukumar/Extension-Security-Inspector.git
cd Extension-Security-Inspector
npm install
```

Package and run the extension from the VS Code extension host. `engines.vscode` is the version floor.

## Usage

Run the audit commands from the extension. Review findings in the editor. The extension reports declared capabilities. It does not classify an extension as safe or unsafe.

## Testing

`vitest.config.ts` and `src/test` are present.

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request.

## License

Licensed under MIT. See [LICENSE](LICENSE). `package.json` also sets `"license": "MIT"`.

## Author

Banny Sukumar

GitHub: https://github.com/Bannysukumar
