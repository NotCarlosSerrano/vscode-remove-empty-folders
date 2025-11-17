import * as vscode from 'vscode';
import { getEmptyFolders, deleteFolders } from '../utils/fsTools';

export function registerCleanFromFolderCommand(context: vscode.ExtensionContext, logger: { info: (s:string)=>void, warn: (s:string)=>void, error: (s:string)=>void }) {
  const disposable = vscode.commands.registerCommand('removeEmptyFolders.cleanFromFolder', async (resource: vscode.Uri | undefined) => {
    try {
      let uri: vscode.Uri | undefined = resource;
      if (!uri) {
        // not invoked from explorer - ask user to pick a folder
        const chosen = await vscode.window.showOpenDialog({ canSelectFiles: false, canSelectFolders: true, canSelectMany: false, openLabel: 'Select folder to scan' });
        if (!chosen || chosen.length === 0) {
          return;
        }
        uri = chosen[0];
      }

      const fsPath = uri.fsPath;
      const stat = await vscode.workspace.fs.stat(uri);
      // Check if it's a folder using http://w3c.github.io/FileAPI/#File and workspace fs stat flags are numeric; check fileType?
      const isFolder = (stat.type & vscode.FileType.Directory) !== 0;
      if (!isFolder) {
        vscode.window.showErrorMessage('The selected resource is not a folder.');
        return;
      }

      const config = vscode.workspace.getConfiguration('removeEmptyFolders');
      const includeHidden: boolean = config.get('includeHidden', false);
      const ignorePatterns: string[] = config.get('ignorePatterns', ['.git', 'node_modules', '.vscode']);
      const confirmBeforeDelete: boolean = config.get('confirmBeforeDelete', true);
      const confirmThreshold: number = config.get('confirmThreshold', 50);

      logger.info(`Scanning folder: ${fsPath}`);

      const start = Date.now();

      const results = await getEmptyFolders(fsPath, { includeHidden, ignorePatterns });

      if (results.length === 0) {
        const timeMs = Date.now() - start;
        const message = `No empty folders found under ${fsPath} (${timeMs}ms).`;
        logger.info(message);
        vscode.window.showInformationMessage(message);
        return;
      }

      if (confirmBeforeDelete && results.length >= confirmThreshold) {
        const pick = await vscode.window.showWarningMessage(
          `About to delete ${results.length} folders in ${fsPath}. Continue?`,
          { modal: true },
          'Yes',
          'No'
        );
        if (pick !== 'Yes') {
          logger.info('User cancelled deletion.');
          return;
        }
      }

      const dryRun = await vscode.window.showQuickPick(['Dry Run (preview)', 'Delete folders (permanent)'], { placeHolder: 'Choose action' });
      const isDry = dryRun === 'Dry Run (preview)';
      if (isDry) {
        logger.info(`Dry run: Found ${results.length} empty folders; no deletions performed.`);
        vscode.window.showInformationMessage(`Dry run: ${results.length} empty folders found.`, 'View details').then((s?: string) => {
          if (s === 'View details') {
            vscode.commands.executeCommand('workbench.action.output.toggleOutput');
          }
        });
        return;
      }

      const { deleted, failed } = await deleteFolders(results, { dryRun: false });
      const timeMs = Date.now() - start;
      logger.info(`Deleted ${deleted.length} folders in ${timeMs}ms (${failed.length} failures).`);

      const message = `Removed ${deleted.length} folder(s) in ${timeMs}ms. ${failed.length} failed.`;
      vscode.window.showInformationMessage(message, 'View details').then((s?: string) => {
        if (s === 'View details') {
          vscode.commands.executeCommand('workbench.action.output.toggleOutput');
        }
      });

    } catch (err) {
      logger.error(`Error in cleanFromFolder: ${(err as Error).message}`);
      vscode.window.showErrorMessage(`Error removing empty folders: ${(err as Error).message}`);
    }
  });

  context.subscriptions.push(disposable);
}
