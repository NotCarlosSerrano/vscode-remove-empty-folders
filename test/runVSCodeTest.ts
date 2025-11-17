import * as path from 'path';
import { runTests } from '@vscode/test-electron';

async function main() {
  try {
    // The extension development path should point to the project root (two levels up from out/test)
    const extensionDevelopmentPath = path.resolve(__dirname, '..', '..');
    const extensionTestsPath = path.resolve(__dirname, 'suite', 'index');

    await runTests({ extensionDevelopmentPath, extensionTestsPath });
  } catch (err) {
    console.error('Failed to run VS Code integration tests', err);
    process.exit(1);
  }
}

main();
