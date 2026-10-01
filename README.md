# Extension Security Inspector

Understand what your installed VS Code extensions can do.

This extension gives you a clear, local review of extension metadata, declared capabilities, and contribution points. It helps you decide what to inspect more closely.

**It does not say an extension is safe or unsafe.**  
**It does not detect malware.**  
**It does not replace your own review of a publisher or source repository.**

---

## What this extension does

Extension Security Inspector reads information already available on your computer:

- VS Code extension metadata
- Each installed extension’s `package.json` manifest
- Declared contribution points such as commands, tasks, terminals, webviews, and authentication providers

It then presents that information in a sidebar and a detail view, with plain-language explanations.

The audit stays on your machine. It does not execute other extensions, does not run their commands, and does not upload your project.

---

## What this extension does not do

- It does not disable Workspace Trust or other VS Code security features
- It does not intercept passwords, tokens, cookies, or account credentials
- It does not scan your network traffic
- It does not change other extensions
- It does not automatically change VS Code security settings
- It does not prove that a publisher or remote server is trustworthy

If something cannot be determined from local metadata, the result is shown as **Unknown** or **Not available**.

---

## How to use it

1. Open the **Security Inspector** icon in the Activity Bar.
2. Run **Extension Security Inspector: Run Audit** from the Command Palette or the sidebar.
3. Review the overview cards: installed, enabled, third-party, built-in, review recommended, high attention, and unknown.
4. Open an extension to see its findings, declared capabilities, and metadata.
5. Use **Search**, **Compare**, or **Export Security Report** when you need a closer look or a shareable summary.

A typical first review takes a few minutes. The audit never runs another extension’s code just to test it.

---

## What you will see

### Overview

A summary of your installed extensions, including how many are third-party and how many have findings that deserve a closer look.

### Extension details

For each extension you can review:

- Name, publisher, version, and enabled status
- Built-in or third-party
- Installation path when VS Code provides it
- Homepage, repository, and Marketplace link when declared
- Activation events
- Commands, settings, languages, tasks, terminals, debuggers, webviews, and authentication providers
- Why a capability may need review
- What the tool can and cannot determine

### Findings

Findings are review indicators, not verdicts.

| Level            | Meaning                                              |
| ---------------- | ---------------------------------------------------- |
| Informational    | Declared information that is useful context          |
| Low attention    | Worth noticing during a routine review               |
| Medium attention | Capability that often deserves a closer look         |
| High attention   | Capability that should be reviewed before you rely on it |
| Unknown          | Not enough local metadata to classify confidently    |

Every finding includes:

- What was detected
- Why it can matter
- What the extension declares
- What this tool cannot determine
- What you should review

Example: a task or terminal contribution may take part in process execution. That does **not** mean the extension is malicious.

### Reports

You can export a local report as **Markdown**, **JSON**, or **HTML**. Reports include inventory and finding summaries only. They do not include passwords, tokens, source code, workspace files, or environment variables.

---

## Commands

Open the Command Palette (`Ctrl+Shift+P` or `Cmd+Shift+P`) and search for **Extension Security Inspector**.

| Command                                      | What it does                                      |
| -------------------------------------------- | ------------------------------------------------- |
| Run Audit                                    | Scan installed extensions and refresh the sidebar |
| Audit Selected Extension                     | Inspect one extension in detail                   |
| Export Security Report                       | Save a Markdown, JSON, or HTML report             |
| Refresh                                      | Clear the session cache and run a new audit       |
| Search                                       | Find extensions by name, publisher, command, or capability |
| Compare Extensions                           | Compare declared capabilities side by side        |
| Open Settings                                | Open this extension’s settings                    |
| Open Overview / Privacy                      | Open the overview or privacy page                 |

Comparison is descriptive. It does not label one extension as safer than another.

---

## Settings

Search for **Extension Security Inspector** in Settings.

| Setting                         | Default | What it controls                                                                 |
| ------------------------------- | ------- | -------------------------------------------------------------------------------- |
| Show built-in extensions        | On      | Include VS Code built-in extensions in the inventory                             |
| Include disabled extensions     | On      | Include disabled extensions when they can be found locally                       |
| Scan dependencies               | Off     | Read local lockfile or `package.json` dependency names. Never installs packages  |
| Show unknown capabilities       | On      | Show findings when metadata is missing or incomplete                             |
| Auto audit                      | Off     | Run a local audit on startup and when extensions change. Debounced, not constant |
| Report directory                | Empty   | Optional folder for exported reports. Leave empty to choose a location each time |

Defaults are privacy-preserving: no telemetry, no workspace-wide file scan, and no uploads.

If dependency scanning is enabled and no vulnerability database is available, the report shows **Vulnerability status not checked.**

---

## Privacy

This extension is **local only**.

It does not send the following to external servers:

- Your source code
- Other extensions’ source
- Workspace files
- Credentials
- Environment variables
- Tokens
- Telemetry

No analytics are included. If analytics are added in a future version, they will be opt-in and documented here first.

---

## Workspace Trust

This extension respects VS Code Workspace Trust and does not ask you to trust an unknown workspace.

In Restricted Mode you may see:

> Some capabilities cannot be fully analyzed while the workspace is untrusted.

You can still review available metadata. Trust the workspace only if you already intend to trust that project.

---

## Limitations

This tool cannot reliably determine:

- Whether an extension is malicious
- What every line of an extension’s code does
- Whether an extension behaves differently at runtime than its manifest suggests
- Whether a publisher or external server is trustworthy
- Whether an extension contains an unknown vulnerability

Use it as a visibility and review aid, not as a security certification.

---

## Requirements

- Visual Studio Code 1.96 or later
- A desktop VS Code window with access to installed extensions

### Install from the Marketplace

Search for **Extension Security Inspector** in the Extensions view and select **Install**.

### Install from a VSIX

1. Open the Command Palette.
2. Choose **Extensions: Install from VSIX...**
3. Select `extension-security-inspector-0.1.1.vsix`.

---

## Updates

New versions are documented in [CHANGELOG.md](CHANGELOG.md).

| Version | Status          | Notes                                                                 |
| ------- | --------------- | --------------------------------------------------------------------- |
| 0.1.1   | Current release | Clearer Marketplace description and install documentation             |
| 0.1.0   | Previous        | First public release: local audit, sidebar, detail view, and reports  |

Planned improvements, only if they can be implemented safely and accurately:

- Clearer publisher and install-source information when VS Code exposes it
- Better filters for large extension lists
- Optional local-only dependency insights without downloading packages

Each release will keep the same rule: no malware verdicts, no hidden telemetry, and no weakening of Workspace Trust.

---

## Support

- Publisher: `bannysukumar2255`
- Extension ID: `bannysukumar2255.extension-security-inspector`
- License: [MIT](LICENSE)

If something looks incomplete, treat the result as **Unknown** and review the publisher or source yourself.

<!-- readme-seo: bannysukumar -->

## Open source

This repository is open source and maintained by [Banny Sukumar](https://github.com/Bannysukumar). Extension Security Inspector is published so other developers can study the code and contribute.

## License

Released under the [MIT License](LICENSE). Copyright (c) 2026 Banny Sukumar. See [CONTRIBUTING.md](CONTRIBUTING.md) if you want to help.
