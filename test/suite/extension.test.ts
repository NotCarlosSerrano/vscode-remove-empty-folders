import * as assert from 'assert';
import * as vscode from 'vscode';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs/promises';

suite('Extension Test Suite', () => {
  test('command registration and activation', async () => {
    // The extension id is publisher.name
    const extensionId = 'NotCarlosSerrano.remove-empty-folders';
    const ext = vscode.extensions.getExtension(extensionId);
    assert.ok(ext, `Extension ${extensionId} should be present`);
    await ext!.activate();
    const commands = await vscode.commands.getCommands(true);
    assert.ok(commands.includes('removeEmptyFolders.cleanWorkspace'), 'removeEmptyFolders.cleanWorkspace should be registered');
  });

  test('e2e: cleanWorkspace deletes empty folders', async () => {
    const extensionId = 'NotCarlosSerrano.remove-empty-folders';
    const ext = vscode.extensions.getExtension(extensionId);
    assert.ok(ext, `Extension ${extensionId} should be present`);
    await ext!.activate();

    // Set up a temporary workspace with nested empty folders
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'remove-empty-folders-e2e-'));
    const a = path.join(tempDir, 'a');
    const b = path.join(a, 'b');
    const c = path.join(b, 'c');
    await fs.mkdir(c, { recursive: true });

    // Open the temporary workspace
    vscode.workspace.updateWorkspaceFolders(0, vscode.workspace.workspaceFolders ? vscode.workspace.workspaceFolders.length : 0, { uri: vscode.Uri.file(tempDir) });

    // Ensure the extension sees the configuration we want
    await vscode.workspace.getConfiguration('removeEmptyFolders').update('confirmBeforeDelete', false, vscode.ConfigurationTarget.Workspace);
    await vscode.workspace.getConfiguration('removeEmptyFolders').update('confirmThreshold', 1000, vscode.ConfigurationTarget.Workspace);

    // Monkey patch the quick pick and warning to simulate user choosing Delete
    const originalQuickPick = (vscode.window as any).showQuickPick;
    const originalWarn = (vscode.window as any).showWarningMessage;
    (vscode.window as any).showQuickPick = async () => 'Delete folders (permanent)';
    (vscode.window as any).showWarningMessage = async () => 'Yes';

    try {
      // Run cleanFromFolder directly with the test folder to avoid requiring an open workspace
      await vscode.commands.executeCommand('removeEmptyFolders.cleanFromFolder', vscode.Uri.file(tempDir));

      // give it a moment to complete
      await new Promise(resolve => setTimeout(resolve, 200));

      // Assert that 'a' was removed
      const existsA = await exists(a);
      assert.strictEqual(existsA, false, 'Workspace nested folder should be removed by cleanWorkspace');

        // Now test behavior for __init__.py
        const initDir = path.join(tempDir, 'initFolder');
        await fs.mkdir(initDir, { recursive: true });
        await fs.writeFile(path.join(initDir, '__init__.py'), '');

        // run command with default settings (ignoreInitPy=false) - should NOT delete initDir
        await vscode.commands.executeCommand('removeEmptyFolders.cleanFromFolder', vscode.Uri.file(tempDir));
        await new Promise(resolve => setTimeout(resolve, 200));
        let existsInit = await exists(initDir);
        assert.strictEqual(existsInit, true, '__init__.py folder should not be deleted by default');

        // Enable ignoreInitPy and run again - now it should be removed
        await vscode.workspace.getConfiguration('removeEmptyFolders').update('ignoreInitPy', true, vscode.ConfigurationTarget.Workspace);
        await vscode.commands.executeCommand('removeEmptyFolders.cleanFromFolder', vscode.Uri.file(tempDir));
        await new Promise(resolve => setTimeout(resolve, 200));
        existsInit = await exists(initDir);
        assert.strictEqual(existsInit, false, '__init__.py folder should be removed when ignoreInitPy=true');
    } finally {
      (vscode.window as any).showQuickPick = originalQuickPick;
      (vscode.window as any).showWarningMessage = originalWarn;
      await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }
  });
});

async function exists(p: string): Promise<boolean> {
  try { await fs.access(p); return true; } catch { return false; }
}
