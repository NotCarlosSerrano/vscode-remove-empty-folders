import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as assert from 'assert';
import { getEmptyFolders, deleteFolders, isDirectoryEmpty } from '../src/utils/fsTools';

async function main() {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'remove-empty-folders-test-'));
  try {
    const a = path.join(tempDir, 'a');
    const b = path.join(a, 'b');
    const c = path.join(b, 'c');
    const d = path.join(tempDir, 'd');
    await fs.mkdir(c, { recursive: true });
    await fs.mkdir(d, { recursive: true });

    // create a file under d to make it non-empty
    await fs.writeFile(path.join(d, 'file.txt'), 'hello');

    // initial test: nested empty directories
    const results = await getEmptyFolders(tempDir, { includeHidden: false, ignorePatterns: ['.git'] });
    // results should include a/b/c, a/b, a and maybe others
    const expected = [c, b, a];

    // ensure expected items are included
    for (const ex of expected) {
      assert.ok(results.includes(ex), `Expected ${ex} to be included in empty folder list`);
    }

    // delete the found empty directories via dry-run (should not delete)
    const { deleted, failed } = await deleteFolders(results, { dryRun: true });
    assert.strictEqual(deleted.length, results.length);
    assert.strictEqual(failed.length, 0);

    // do actual deletion
    const { deleted: realDeleted } = await deleteFolders(results, { dryRun: false });
    assert.strictEqual(realDeleted.length, results.length);

    // after deletion, check that a is gone
    const existsA = await exists(a);
    assert.strictEqual(existsA, false);

    console.log('Initial nested folder tests passed.');

    // Test ignorePatterns: create a folder with an ignored file/folder
    const e = path.join(tempDir, 'e');
    await fs.mkdir(e, { recursive: true });
    // create .git folder inside e
    const gitFolder = path.join(e, '.git');
    await fs.mkdir(gitFolder);

    const res2 = await getEmptyFolders(tempDir, { includeHidden: false, ignorePatterns: ['.git'] });
    // folder 'e' should NOT be considered empty because it contains a .git folder which matches ignorePatterns
    assert.ok(!res2.includes(e), 'Folder e (contains .git) should NOT be considered empty when .git is in ignorePatterns');

    console.log('ignorePatterns tests passed.');

    // Test hidden files handling
    const h = path.join(tempDir, 'hiddenTest');
    await fs.mkdir(h);
    await fs.writeFile(path.join(h, '.hiddenfile'), 'secret');

    const resHiddenIncludeFalse = await getEmptyFolders(h, { includeHidden: false, ignorePatterns: [] });
    console.log('resHiddenIncludeFalse =', resHiddenIncludeFalse);
    const isEmptyCheckFalse = await isDirectoryEmpty(h, false, []);
    console.log('isDirectoryEmpty(h, false) =', isEmptyCheckFalse);
    assert.ok(resHiddenIncludeFalse.includes(h), 'Folder with only hidden file should be considered empty when includeHidden=false');

    const resHiddenIncludeTrue = await getEmptyFolders(h, { includeHidden: true, ignorePatterns: [] });
    const isEmptyCheckTrue = await isDirectoryEmpty(h, true, []);
    console.log('isDirectoryEmpty(h, true) =', isEmptyCheckTrue);
    console.log('resHiddenIncludeTrue =', resHiddenIncludeTrue);
    assert.ok(!resHiddenIncludeTrue.includes(h), 'Folder with hidden file should NOT be considered empty when includeHidden=true');

    console.log('Hidden file tests passed.');

    // Test symlink handling (skip if symlink creation fails, e.g., on Windows without privileges)
    const src = path.join(tempDir, 'src');
    const linkHolder = path.join(tempDir, 'linkHolder');
    await fs.mkdir(src, { recursive: true });
    await fs.writeFile(path.join(src, 'file.txt'), 'hello');
    await fs.mkdir(linkHolder);
    const symlinkPath = path.join(linkHolder, 'link');
    let createdSymlink = false;
    try {
      // use directory symlink
      await fs.symlink(src, symlinkPath, 'junction');
      createdSymlink = true;
    } catch (err: any) {
      console.warn('Could not create symlink/junction on this platform or with current permissions; skipping symlink test.');
    }

    if (createdSymlink) {
      const resSymlink = await getEmptyFolders(tempDir, { includeHidden: false, ignorePatterns: [] });
      // linkHolder should NOT be considered empty because it contains a symlink treated as non-empty by getEmptyFolders
      assert.ok(!resSymlink.includes(linkHolder), 'Folder containing a symlink to a non-empty folder should NOT be considered empty');
      console.log('Symlink tests passed.');
    } else {
      console.log('Symlink tests skipped.');
    }

    // Test ignoreInitPy option: folder with only __init__.py
    const initDir = path.join(tempDir, 'initFolder');
    await fs.mkdir(initDir, { recursive: true });
    await fs.writeFile(path.join(initDir, '__init__.py'), '');

    // Default: ignoreInitPy=false -> folder should NOT be considered empty
    const resInitDefault = await getEmptyFolders(initDir, { includeHidden: false, ignorePatterns: [], });
    assert.ok(!resInitDefault.includes(initDir), 'Folder with __init__.py should NOT be considered empty by default');

    // With ignoreInitPy=true -> folder should be considered empty
    const resInitIgnored = await getEmptyFolders(initDir, { includeHidden: false, ignorePatterns: [], ignoreInitPy: true });
    assert.ok(resInitIgnored.includes(initDir), 'Folder with __init__.py should be considered empty when ignoreInitPy=true');

    // Delete when ignoreInitPy true
    const { deleted: initDeleted } = await deleteFolders(resInitIgnored, { dryRun: false, ignoreInitPy: true });
    assert.ok(initDeleted.includes(initDir));

    console.log('ignoreInitPy tests passed.');
  } finally {
    // cleanup
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
