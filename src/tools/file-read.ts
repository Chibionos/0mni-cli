import { tool } from 'ai';
import { z } from 'zod';
import { readFile } from 'fs/promises';

export const readFileTool = tool({
  description:
    'Read a file from the filesystem. Returns content with line numbers (cat -n style). ' +
    'Use offset and limit to read specific portions of large files.',
  parameters: z.object({
    path: z.string().describe('Absolute path to the file to read'),
    offset: z
      .number()
      .int()
      .min(1)
      .optional()
      .describe('Line number to start reading from (1-based). Defaults to 1.'),
    limit: z
      .number()
      .int()
      .min(1)
      .optional()
      .describe('Maximum number of lines to read. Defaults to reading the entire file.'),
  }),
  execute: async ({ path, offset, limit }) => {
    try {
      const raw = await readFile(path, 'utf-8');
      const allLines = raw.split('\n');

      const startIndex = offset ? offset - 1 : 0;
      const endIndex = limit ? startIndex + limit : allLines.length;
      const slice = allLines.slice(startIndex, endIndex);

      const totalLines = allLines.length;
      const widest = String(Math.min(endIndex, totalLines)).length;

      const numbered = slice
        .map((line, i) => {
          const lineNum = String(startIndex + i + 1).padStart(widest, ' ');
          return `${lineNum}\t${line}`;
        })
        .join('\n');

      return numbered || '(empty file)';
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return `Error reading file: ${msg}`;
    }
  },
});
