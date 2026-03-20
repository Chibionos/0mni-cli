import { tool } from 'ai';
import { z } from 'zod';
import { readFile, readdir, stat } from 'fs/promises';
import { glob } from 'glob';
import { join, resolve } from 'path';

export const listFilesTool = tool({
  description:
    'Find files matching a glob pattern. Returns a list of matching file paths sorted by name. ' +
    'Useful for discovering files in a project.',
  parameters: z.object({
    pattern: z.string().describe('Glob pattern to match (e.g. "**/*.ts", "src/**/*.tsx")'),
    path: z
      .string()
      .optional()
      .describe('Directory to search in. Defaults to the current working directory.'),
  }),
  execute: async ({ pattern, path }) => {
    try {
      const cwd = path ? resolve(path) : process.cwd();

      const matches = await glob(pattern, {
        cwd,
        nodir: true,
        absolute: true,
        ignore: ['**/node_modules/**', '**/.git/**'],
      });

      if (matches.length === 0) {
        return `No files found matching pattern "${pattern}" in ${cwd}`;
      }

      matches.sort();
      return matches.join('\n');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return `Error listing files: ${msg}`;
    }
  },
});

/**
 * Recursively collect files from a directory, respecting an optional glob filter.
 */
async function collectFiles(
  dir: string,
  globFilter?: string,
  collected: string[] = [],
  depth = 0,
): Promise<string[]> {
  if (depth > 20) return collected;

  try {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);

      // Skip common noise directories
      if (entry.isDirectory()) {
        if (['node_modules', '.git', 'dist', '.next', '__pycache__'].includes(entry.name)) {
          continue;
        }
        await collectFiles(fullPath, globFilter, collected, depth + 1);
      } else if (entry.isFile()) {
        collected.push(fullPath);
      }
    }
  } catch {
    // Permission errors or similar — silently skip
  }

  return collected;
}

/**
 * Test whether a file path matches a simple glob filter (e.g. "*.ts", "*.{ts,tsx}").
 */
function matchesGlob(filePath: string, pattern: string): boolean {
  // Expand {a,b} patterns
  const alternatives = expandBraces(pattern);
  return alternatives.some((alt) => {
    const regex = globToRegex(alt);
    return regex.test(filePath);
  });
}

function expandBraces(pattern: string): string[] {
  const match = pattern.match(/^(.*)\{([^}]+)\}(.*)$/);
  if (!match) return [pattern];

  const [, prefix, alts, suffix] = match;
  return alts.split(',').map((alt) => `${prefix}${alt}${suffix}`);
}

function globToRegex(pattern: string): RegExp {
  const re = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '{{GLOBSTAR}}')
    .replace(/\*/g, '[^/]*')
    .replace(/\?/g, '[^/]')
    .replace(/\{\{GLOBSTAR\}\}/g, '.*');

  return new RegExp(re + '$');
}

export const searchContentTool = tool({
  description:
    'Search file contents for a pattern (string or regex). Returns matching lines with ' +
    'file paths and line numbers in "file:line: content" format.',
  parameters: z.object({
    pattern: z.string().describe('Search pattern (string or regex)'),
    path: z
      .string()
      .optional()
      .describe('Directory to search in. Defaults to the current working directory.'),
    glob: z
      .string()
      .optional()
      .describe('Glob filter to restrict which files are searched (e.g. "*.ts", "*.{js,jsx}")'),
  }),
  execute: async ({ pattern, path: searchPath, glob: globFilter }) => {
    try {
      const cwd = searchPath ? resolve(searchPath) : process.cwd();

      // Verify search target exists
      const cwdStat = await stat(cwd);
      let filesToSearch: string[];

      if (cwdStat.isFile()) {
        filesToSearch = [cwd];
      } else {
        filesToSearch = await collectFiles(cwd, globFilter);
      }

      // Apply glob filter if provided
      if (globFilter) {
        filesToSearch = filesToSearch.filter((f) => matchesGlob(f, globFilter));
      }

      let regex: RegExp;
      try {
        regex = new RegExp(pattern, 'i');
      } catch {
        // If the pattern is not valid regex, escape it and try as literal
        const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        regex = new RegExp(escaped, 'i');
      }

      const results: string[] = [];
      const maxResults = 200;
      const maxFileSize = 2 * 1024 * 1024; // 2 MB — skip large files

      for (const filePath of filesToSearch) {
        if (results.length >= maxResults) break;

        try {
          const fileStat = await stat(filePath);
          if (fileStat.size > maxFileSize) continue;

          const content = await readFile(filePath, 'utf-8');
          const lines = content.split('\n');

          for (let i = 0; i < lines.length; i++) {
            if (regex.test(lines[i])) {
              results.push(`${filePath}:${i + 1}: ${lines[i]}`);
              if (results.length >= maxResults) break;
            }
          }
        } catch {
          // Skip files that can't be read (binary, permissions, etc.)
        }
      }

      if (results.length === 0) {
        return `No matches found for "${pattern}" in ${cwd}`;
      }

      const header =
        results.length >= maxResults
          ? `(showing first ${maxResults} matches)\n`
          : `(${results.length} match${results.length === 1 ? '' : 'es'})\n`;

      return header + results.join('\n');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return `Error searching content: ${msg}`;
    }
  },
});
