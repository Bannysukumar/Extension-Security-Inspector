import type { Finding, FindingCategory, Severity } from '../models/Finding';
import type { ExtensionInfo } from '../models/ExtensionInfo';
import { asRecord, safeString } from '../utils/sanitization';

export interface RuleContext {
  showUnknownCapabilities: boolean;
}

export interface RiskRule {
  id: string;
  analyze(extension: ExtensionInfo, context: RuleContext): Finding | Finding[] | undefined;
}

function finding(partial: Omit<Finding, 'evidence'> & { evidence?: string[] }): Finding {
  return {
    ...partial,
    evidence: partial.evidence ?? [],
  };
}

export const riskRules: RiskRule[] = [
  {
    id: 'filesystem-provider',
    analyze(extension) {
      if (extension.contributes.fileSystemProviders.length === 0) {
        return undefined;
      }
      return finding({
        id: 'filesystem-provider',
        severity: 'medium',
        title: 'File-system provider capability detected',
        category: 'filesystem',
        confidence: 'high',
        detectionSource: 'manifest.contributes.fileSystem',
        evidence: extension.contributes.fileSystemProviders,
        explanation:
          'This extension declares a file-system provider. That contribution can expose a custom scheme or virtual file system inside VS Code. This finding does not mean the extension is malicious.',
        recommendation:
          'Review whether a custom file system is expected for this extension and confirm the publisher and repository if the capability is unexpected.',
      });
    },
  },
  {
    id: 'workspace-capabilities',
    analyze(extension) {
      const capabilities = asRecord(extension.capabilities);
      const evidence: string[] = [];
      if (capabilities?.untrustedWorkspaces) {
        evidence.push('capabilities.untrustedWorkspaces is declared');
      }
      if (capabilities?.virtualWorkspaces) {
        evidence.push('capabilities.virtualWorkspaces is declared');
      }
      if (evidence.length === 0) {
        return undefined;
      }
      return finding({
        id: 'workspace-capabilities',
        severity: 'informational',
        title: 'Workspace access capability declared',
        category: 'filesystem',
        confidence: 'high',
        detectionSource: 'manifest.capabilities',
        evidence,
        explanation:
          'The extension declares workspace-related capability metadata, such as support for untrusted or virtual workspaces. This describes intended workspace participation and is not a verdict about trustworthiness.',
        recommendation:
          'Review the declared workspace capabilities against how you use this workspace. Do not trust an unknown workspace solely because an extension supports Restricted Mode.',
      });
    },
  },
  {
    id: 'process-tasks',
    analyze(extension) {
      if (
        extension.contributes.taskDefinitions.length === 0 &&
        extension.contributes.tasks.length === 0
      ) {
        return undefined;
      }
      return finding({
        id: 'process-tasks',
        severity: 'medium',
        title: 'Process execution capability detected',
        category: 'tasks',
        confidence: 'high',
        detectionSource: 'manifest.contributes.taskDefinitions',
        evidence: [...extension.contributes.taskDefinitions, ...extension.contributes.tasks],
        explanation:
          'This extension contributes task functionality. This may allow the extension to participate in workflows that execute processes. This finding does not mean the extension is malicious.',
        recommendation:
          'Review whether task execution is expected, and inspect the contributed task types before running unfamiliar tasks.',
      });
    },
  },
  {
    id: 'process-terminal',
    analyze(extension) {
      if (extension.contributes.terminals.length === 0) {
        return undefined;
      }
      return finding({
        id: 'process-terminal',
        severity: 'medium',
        title: 'Terminal-related functionality detected',
        category: 'terminal',
        confidence: 'high',
        detectionSource: 'manifest.contributes.terminal',
        evidence: extension.contributes.terminals,
        explanation:
          'This extension contributes terminal-related functionality. This may allow the extension to participate in workflows that execute processes. This finding does not mean the extension is malicious.',
        recommendation: 'Review whether terminal integration is expected for this extension.',
      });
    },
  },
  {
    id: 'process-debugger',
    analyze(extension) {
      if (extension.contributes.debuggers.length === 0) {
        return undefined;
      }
      return finding({
        id: 'process-debugger',
        severity: 'medium',
        title: 'Debugger integration detected',
        category: 'debugger',
        confidence: 'high',
        detectionSource: 'manifest.contributes.debuggers',
        evidence: extension.contributes.debuggers,
        explanation:
          'This extension contributes debugger functionality. Debugger integrations often launch or attach to processes. This is a capability indicator, not a determination that the extension is dangerous.',
        recommendation:
          'Review the debugger types and whether launching programs through this extension is expected.',
      });
    },
  },
  {
    id: 'authentication-provider',
    analyze(extension) {
      if (extension.contributes.authentication.length === 0) {
        return undefined;
      }
      return finding({
        id: 'authentication-provider',
        severity: 'high',
        title: 'Authentication provider capability detected',
        category: 'authentication',
        confidence: 'high',
        detectionSource: 'manifest.contributes.authentication',
        evidence: extension.contributes.authentication,
        explanation:
          'This extension contributes an authentication provider. Authentication integration may provide access to accounts through VS Code APIs. This tool does not access those credentials and does not determine how they are used.',
        recommendation:
          'Review the publisher, account types, and whether you expect this extension to participate in sign-in flows. Do not paste credentials into untrusted extensions.',
      });
    },
  },
  {
    id: 'webview-capability',
    analyze(extension) {
      if (
        extension.contributes.webviewHints.length === 0 &&
        extension.contributes.customEditors.length === 0
      ) {
        return undefined;
      }
      return finding({
        id: 'webview-capability',
        severity: 'medium',
        title: 'Webview functionality detected',
        category: 'webview',
        confidence: 'high',
        detectionSource: 'manifest.contributes.views/customEditors',
        evidence: [...extension.contributes.webviewHints, ...extension.contributes.customEditors],
        explanation:
          "Webviews can execute web content inside VS Code. Review the extension's source and publisher if this capability is unexpected. Detection is based on declared contribution points, not runtime inspection of webview content.",
        recommendation:
          'Review whether an embedded web UI is expected and confirm the publisher if it is not.',
      });
    },
  },
  {
    id: 'network-indicated',
    analyze(extension) {
      const evidence = collectNetworkEvidence(extension);
      if (evidence.length === 0) {
        return undefined;
      }
      return finding({
        id: 'network-indicated',
        severity: 'medium',
        title: 'Network capability/functionality indicated',
        category: 'network',
        confidence: evidence.some((item) => item.startsWith('configuration:')) ? 'medium' : 'low',
        detectionSource: 'manifest metadata and configuration defaults',
        evidence,
        explanation:
          'Local metadata indicates network-related functionality, such as URI-style configuration, remote endpoints, or URI activation. This tool does not inspect network traffic, does not bypass TLS, and does not determine which hosts are contacted at runtime.',
        recommendation:
          'Review declared endpoints and settings. Treat unexpected remote configuration as a reason to inspect the publisher and source, not as proof of malice.',
      });
    },
  },
  {
    id: 'commands-contributed',
    analyze(extension) {
      if (extension.contributes.commands.length === 0) {
        return undefined;
      }
      return finding({
        id: 'commands-contributed',
        severity: 'informational',
        title: 'Commands contributed',
        category: 'commands',
        confidence: 'high',
        detectionSource: 'manifest.contributes.commands',
        evidence: extension.contributes.commands.slice(0, 12).map((item) => item.command),
        explanation:
          'This extension contributes commands to VS Code. Commands are not executed by this audit. A command list describes declared UI or API actions, not whether those actions are harmful.',
        recommendation:
          'Inspect command IDs and titles if the extension is unfamiliar. Do not run unknown commands solely to test them.',
      });
    },
  },
  {
    id: 'sensitive-configuration',
    analyze(extension) {
      const sensitive = extension.contributes.configuration.filter(
        (item) => item.sensitiveIndicators.length > 0,
      );
      if (sensitive.length === 0) {
        return undefined;
      }
      return finding({
        id: 'sensitive-configuration',
        severity: 'low',
        title: 'Security-relevant settings contributed',
        category: 'configuration',
        confidence: 'medium',
        detectionSource: 'manifest.contributes.configuration',
        evidence: sensitive
          .slice(0, 15)
          .map((item) => `${item.key}: ${item.sensitiveIndicators.join(', ')}`),
        explanation:
          'One or more contributed settings appear related to commands, executable paths, network endpoints, external services, or security-sensitive behavior. This is based on names and descriptions, not on reading current setting values.',
        recommendation:
          'Review these settings before changing them. This tool never changes settings automatically.',
      });
    },
  },
  {
    id: 'activation-wildcard',
    analyze(extension) {
      const wildcards = extension.activationEvents.filter(
        (event) => event === '*' || event.startsWith('onUri'),
      );
      if (wildcards.length === 0) {
        return undefined;
      }
      const severity: Severity = extension.activationEvents.includes('*') ? 'medium' : 'low';
      return finding({
        id: 'activation-wildcard',
        severity,
        title: 'Broad activation event detected',
        category: 'activation',
        confidence: 'high',
        detectionSource: 'manifest.activationEvents',
        evidence: wildcards,
        explanation:
          'The extension declares activation events that can start it broadly, such as "*" or URI-based activation. Broad activation increases the circumstances in which extension code may run. This is not evidence of malicious behavior.',
        recommendation: 'Confirm that broad activation is expected for this kind of extension.',
      });
    },
  },
  {
    id: 'proposed-apis',
    analyze(extension) {
      if (!extension.enabledApiProposals || extension.enabledApiProposals.length === 0) {
        return undefined;
      }
      return finding({
        id: 'proposed-apis',
        severity: 'low',
        title: 'Proposed API usage declared',
        category: 'other',
        confidence: 'high',
        detectionSource: 'manifest.enabledApiProposals',
        evidence: extension.enabledApiProposals,
        explanation:
          'The extension lists proposed VS Code APIs. Proposed APIs may change and can expose capabilities that are not part of the stable public surface. Declaration alone does not mean those APIs are abused.',
        recommendation:
          'Review whether proposed API use is expected and documented by the publisher.',
      });
    },
  },
  {
    id: 'chat-or-language-model-tools',
    analyze(extension) {
      const evidence = [
        ...extension.contributes.chatParticipants,
        ...extension.contributes.languageModelTools,
      ];
      if (evidence.length === 0) {
        return undefined;
      }
      return finding({
        id: 'chat-or-language-model-tools',
        severity: 'medium',
        title: 'Chat or language-model tool capability detected',
        category: 'other',
        confidence: 'high',
        detectionSource: 'manifest.contributes.chatParticipants/tools',
        evidence,
        explanation:
          'The extension contributes chat participants or language-model tools. These features can participate in assistant workflows and may send prompts or results depending on the extension implementation. This audit does not inspect runtime tool behavior.',
        recommendation:
          'Review whether assistant integration is expected and what data the publisher says the feature uses.',
      });
    },
  },
  {
    id: 'node-runtime',
    analyze(extension) {
      if (!extension.main) {
        return undefined;
      }
      return finding({
        id: 'node-runtime',
        severity: 'informational',
        title: 'Node.js extension entry point declared',
        category: 'process',
        confidence: 'high',
        detectionSource: 'manifest.main',
        evidence: [extension.main],
        explanation:
          'The extension declares a Node.js entry point (`main`). Desktop extensions with a main entry typically run in the extension host process. This is common and is not a malicious indicator by itself.',
        recommendation:
          'Treat a Node entry point as normal for desktop extensions. Review other capability findings for context.',
      });
    },
  },
  {
    id: 'insufficient-metadata',
    analyze(extension, context) {
      if (!context.showUnknownCapabilities || !extension.metadataInsufficient) {
        return undefined;
      }
      return finding({
        id: 'insufficient-metadata',
        severity: 'unknown',
        title: 'Insufficient metadata',
        category: 'metadata',
        confidence: extension.parseError ? 'high' : 'medium',
        detectionSource: 'manifest completeness',
        evidence: [
          extension.parseError ??
            'Display name, publisher, description, or contribution metadata is missing.',
        ],
        explanation:
          'The tool could not obtain enough local metadata to describe this extension completely. Missing metadata is not proof of risk; it only limits what can be explained.',
        recommendation:
          'Inspect the extension listing and publisher if you need more information. The audit continued for other extensions.',
      });
    },
  },
  {
    id: 'manifest-unreadable',
    analyze(extension) {
      if (!extension.parseError) {
        return undefined;
      }
      return finding({
        id: 'manifest-unreadable',
        severity: 'unknown',
        title: `Unable to analyze ${extension.displayName || extension.id}`,
        category: 'metadata',
        confidence: 'high',
        detectionSource: 'manifestParser',
        evidence: [extension.parseError],
        explanation:
          'The installed package.json could not be parsed safely. The extension was skipped for deep analysis so the remaining inventory could still be audited.',
        recommendation:
          'If this is a third-party extension you rely on, inspect its installation or reinstall from a trusted source.',
      });
    },
  },
];

function collectNetworkEvidence(extension: ExtensionInfo): string[] {
  const evidence: string[] = [];
  for (const setting of extension.contributes.configuration) {
    const text =
      `${setting.key} ${setting.description ?? ''} ${setting.defaultValue ?? ''}`.toLowerCase();
    if (/(https?:\/\/|wss?:\/\/|endpoint|proxy|hostname|baseurl)/.test(text)) {
      evidence.push(`configuration:${setting.key}`);
    }
  }
  for (const event of extension.activationEvents) {
    if (event.startsWith('onUri') || event.includes('onResolveRemoteAuthority')) {
      evidence.push(`activation:${event}`);
    }
  }
  const homepage = safeString(extension.homepage);
  if (/^https?:\/\//i.test(homepage) && /api|endpoint/i.test(homepage)) {
    evidence.push('homepage indicates a service endpoint');
  }
  const capabilities = asRecord(extension.capabilities);
  if (capabilities && JSON.stringify(capabilities).toLowerCase().includes('untrusted')) {
    evidence.push('workspace capability metadata present');
  }
  return evidence.slice(0, 20);
}

export function findingsForCategory(findings: Finding[], category: FindingCategory): Finding[] {
  return findings.filter((findingItem) => findingItem.category === category);
}
