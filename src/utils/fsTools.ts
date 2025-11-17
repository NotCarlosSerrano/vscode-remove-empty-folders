import * as fs from 'fs/promises';
import * as path from 'path';

export interface ScanOptions {
  includeHidden?: boolean;
  ignorePatterns?: string[];
}

export async function getEmptyFolders(rootPath: string, options: ScanOptions = {}): Promise<string[]> {
  const includeHidden = !!options.includeHidden;
  const ignorePatterns = options.ignorePatterns || ['.git', 'node_modules', '.vscode'];

  const visited = new Set<string>();

  const emptyDirs: string[] = [];

  async function checkDir(dir: string): Promise<boolean> {
    try {
      const real = await fs.realpath(dir).catch(() => dir);
      if (visited.has(real)) {
        // avoid cycles
        return true;
      }
      visited.add(real);

      const entries = await fs.readdir(dir, { withFileTypes: true });
      if (!entries || entries.length === 0) {
        emptyDirs.push(dir);
        return true;
      }

      let allEmpty = true;

      for (const entry of entries) {
        const name = entry.name;
        if (!includeHidden && name.startsWith('.')) {
          // treat as non-visible, skip check
          continue;
        }
        // check ignore patterns -- simple wildcard '*' to regex
        if (matchesIgnore(name, ignorePatterns)) {
          // If a file or folder matches ignore patterns, we consider the dir as non-empty (safer)
          return false;
        }

        const fullPath = path.join(dir, name);
        if (entry.isDirectory()) {
          const childEmpty = await checkDir(fullPath);
          if (!childEmpty) {
            allEmpty = false;
          }
        } else if (entry.isSymbolicLink()) {
          // don't follow symlinks by default, treat as non-empty
          allEmpty = false;
        } else {
          // file
          // visible file makes the directory non-empty
          allEmpty = false;
        }

        if (!allEmpty) {
          // short-circuit
          break;
        }
      }

      if (allEmpty) {
        emptyDirs.push(dir);
        return true;
      }

      return false;
    } catch (err) {
      // unreadable directory - treat as non-empty to be safe
      return false;
    }
  }

  await checkDir(rootPath);

  // Deduplicate and sort deepest-first
  const unique = Array.from(new Set(emptyDirs));
  unique.sort((a, b) => b.length - a.length);
  return unique;
}

export async function deleteFolders(folderPaths: string[], options: { dryRun?: boolean } = {}): Promise<{ deleted: string[], failed: { path: string, error: string }[] }> {
  const deleted: string[] = [];
  const failed: { path: string, error: string }[] = [];
  const { dryRun = false } = options;

  // Ensure we delete deepest folders first
  const paths = [...folderPaths].sort((a, b) => b.length - a.length);

  for (const dir of paths) {
    if (dryRun) {
      deleted.push(dir);
      continue;
    }
    try {
      // Use rmdir to ensure it's empty; fallback to rm if necessary
      await fs.rmdir(dir);
      deleted.push(dir);
    } catch (err) {
      // try rm with force false
      try {
        // @ts-ignore in case rm not available
        if ((fs as any).rm) {
          // attempt non-recursive removal
          await (fs as any).rm(dir, { recursive: false, force: false });
          deleted.push(dir);
        } else {
          failed.push({ path: dir, error: (err as Error).message });
        }
      } catch (err2) {
        failed.push({ path: dir, error: (err2 as Error).message });
      }
    }
  }

  return { deleted, failed };
}

export async function isDirectoryEmpty(dirPath: string, includeHidden = false, ignorePatterns: string[] = ['.git', 'node_modules', '.vscode']): Promise<boolean> {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    if (!entries || entries.length === 0) {
      return true;
    }
    for (const entry of entries) {
      const name = entry.name;
      if (!includeHidden && name.startsWith('.')) {
        continue;
      }
      if (matchesIgnore(name, ignorePatterns)) {
        return false;
      }
      if (entry.isDirectory()) {
        const subPath = path.join(dirPath, name);
        const empty = await isDirectoryEmpty(subPath, includeHidden, ignorePatterns);
        if (!empty) {
          return false;
        }
      } else {
        return false;
      }
    }
    return true;
  } catch (err) {
    return false;
  }
}

function matchesIgnore(name: string, patterns: string[]) {
  if (!patterns || patterns.length === 0) return false;
  for (const p of patterns) {
    if (!p) continue;
    if (p === name) return true;
    // simple wildcard support: '*' only
    if (p.includes('*')) {
      const rx = new RegExp('^' + escapeRegExp(p).replace(/\\\*/g, '.*') + '$');
      if (rx.test(name)) return true;
    } else if (name.includes(p)) {
      // substring match as fallback
      return true;
    }
  }
  return false;
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
