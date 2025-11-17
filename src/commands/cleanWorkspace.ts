import * as vscode from 'vscode';
import { getEmptyFolders, deleteFolders } from '../utils/fsTools';

export function registerCleanWorkspaceCommand(context: vscode.ExtensionContext, logger: { info: (s:string)=>void, warn: (s:string)=>void, error: (s:string)=>void }) {
  const disposable = vscode.commands.registerCommand('removeEmptyFolders.cleanWorkspace', async () => {
    const config = vscode.workspace.getConfiguration('removeEmptyFolders');
    const includeHidden: boolean = config.get('includeHidden', false);
    const ignorePatterns: string[] = config.get('ignorePatterns', ['.git', 'node_modules', '.vscode']);
    const ignoreInitPy: boolean = config.get('ignoreInitPy', false);
    const confirmBeforeDelete: boolean = config.get('confirmBeforeDelete', true);
    const confirmThreshold: number = config.get('confirmThreshold', 50);

    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) {
      vscode.window.showErrorMessage('No workspace open - open a workspace to use Remove Empty Folders.');
      return;
    }

    const start = Date.now();

    try {
      const results: string[] = [];
      for (const f of folders) {
        logger.info(`Scanning workspace folder: ${f.uri.fsPath}`);
        const empty = await getEmptyFolders(f.uri.fsPath, { includeHidden, ignorePatterns, ignoreInitPy });
        results.push(...empty);
      }

      if (results.length === 0) {
        const timeMs = Date.now() - start;
        const message = `No empty folders found (scanned ${folders.length} workspace folder(s)) (${timeMs}ms).`;
        logger.info(message);
        vscode.window.showInformationMessage(message);
        return;
      }

      // confirm if above threshold
      if (confirmBeforeDelete && results.length >= confirmThreshold) {
        const pick = await vscode.window.showWarningMessage(
          `About to delete ${results.length} folders. Continue?`,
          { modal: true },
          'Yes',
          'No'
        );
        if (pick !== 'Yes') {
          logger.info('User cancelled deletion.');
          return;
        }
      }

      // prompt dry run or real run
      const dryRun = await vscode.window.showQuickPick(['Dry Run (preview)', 'Delete folders (permanent)'], { placeHolder: 'Choose action' });
      const isDry = dryRun === 'Dry Run (preview)';

      if (isDry) {
        logger.info(`Dry run: Found ${results.length} empty folders; no deletions performed.`);
        vscode.window.showInformationMessage(`Dry run: ${results.length} empty folders found. Use 'Delete folders' to actually remove them.`, 'View details').then((selection?: string) => {
            if (selection === 'View details') {
              vscode.commands.executeCommand('workbench.action.output.toggleOutput');
            }
          });
        return;
      }

      const { deleted, failed } = await deleteFolders(results, { dryRun: false, ignoreInitPy });
      const timeMs = Date.now() - start;
      logger.info(`Deleted ${deleted.length} folders in ${timeMs}ms (${failed.length} failures).`);
      if (failed.length > 0) {
        logger.warn(`Failures (${failed.length}): ${JSON.stringify(failed.slice(0, 10))}`);
      }

      const message = `Removed ${deleted.length} folder(s) in ${timeMs}ms. ${failed.length} failed.`;
      vscode.window.showInformationMessage(message, 'View details').then((selection?: string) => {
        if (selection === 'View details') {
          vscode.commands.executeCommand('workbench.action.output.toggleOutput');
        }
      });

    } catch (err) {
      logger.error(`Unhandled error: ${(err as Error).message}`);
      vscode.window.showErrorMessage(`Error removing empty folders: ${(err as Error).message}`);
    }
  });

  context.subscriptions.push(disposable);
}

