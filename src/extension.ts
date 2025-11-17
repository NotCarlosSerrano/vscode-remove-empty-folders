import * as vscode from 'vscode';
import { registerCleanWorkspaceCommand } from './commands/cleanWorkspace';
import { registerCleanFromFolderCommand } from './commands/cleanFromFolder';

let outputChannel: vscode.OutputChannel;

export function activate(context: vscode.ExtensionContext) {
  outputChannel = vscode.window.createOutputChannel('Remove Empty Folders');
  outputChannel.appendLine('Remove Empty Folders extension activated.');

  const logger = createLogger(outputChannel);

  context.subscriptions.push(outputChannel);

  registerCleanWorkspaceCommand(context, logger);
  registerCleanFromFolderCommand(context, logger);
}

export function deactivate() {
  if (outputChannel) {
    outputChannel.appendLine('Remove Empty Folders extension deactivated.');
    outputChannel.dispose();
  }
}

function createLogger(channel: vscode.OutputChannel) {
  return {
    info: (msg: string) => {
      const t = new Date().toISOString();
      channel.appendLine(`[INFO ${t}] ${msg}`);
    },
    warn: (msg: string) => {
      const t = new Date().toISOString();
      channel.appendLine(`[WARN ${t}] ${msg}`);
    },
    error: (msg: string) => {
      const t = new Date().toISOString();
      channel.appendLine(`[ERROR ${t}] ${msg}`);
    }
  };
}
