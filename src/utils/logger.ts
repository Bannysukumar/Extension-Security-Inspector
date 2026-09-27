import * as vscode from 'vscode';
import { OUTPUT_CHANNEL_NAME } from '../constants';
import { sanitizeLogText } from './sanitization';

export type LogLevel = 'INFO' | 'WARN' | 'ERROR';

export class Logger {
  private readonly channel: vscode.OutputChannel;

  constructor(channel?: vscode.OutputChannel) {
    this.channel = channel ?? vscode.window.createOutputChannel(OUTPUT_CHANNEL_NAME);
  }

  info(message: string): void {
    this.write('INFO', message);
  }

  warn(message: string): void {
    this.write('WARN', message);
  }

  error(message: string, error?: unknown): void {
    const details = error ? ` ${sanitizeLogText(error)}` : '';
    this.write('ERROR', `${message}${details}`);
  }

  show(preserveFocus = true): void {
    this.channel.show(preserveFocus);
  }

  dispose(): void {
    this.channel.dispose();
  }

  private write(level: LogLevel, message: string): void {
    const line = `[${level}] ${sanitizeLogText(message)}`;
    this.channel.appendLine(line);
  }
}
