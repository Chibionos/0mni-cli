import { tool } from 'ai';
import { z } from 'zod';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { dirname } from 'path';

export const writeFileTool = tool({
  description:
    'Write content to a file. Creates the file if it does not exist, or overwrites it if it does. ' +
    'Automatically creates parent directories as needed.',
  parameters: z.object({
    path: z.string().describe('Absolute path to the file to write'),
    content: z.string().describe('The full content to write to the file'),
  }),
  execute: async ({ path, content }) => {
    try {
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, content, 'utf-8');
      const lineCount = content.split('\n').length;
      return `Successfully wrote ${lineCount} lines to ${path}`;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return `Error writing file: ${msg}`;
    }
  },
});

export const editFileTool = tool({
  description:
    'Perform a search-and-replace edit on a file. The old_string must appear exactly once in the file. ' +
    'The replacement is performed in-place.',
  parameters: z.object({
    path: z.string().describe('Absolute path to the file to edit'),
    old_string: z.string().describe('The exact text to search for (must be unique in the file)'),
    new_string: z.string().describe('The text to replace old_string with'),
  }),
  execute: async ({ path, old_string, new_string }) => {
    try {
      const content = await readFile(path, 'utf-8');

      const occurrences = content.split(old_string).length - 1;

      if (occurrences === 0) {
        return `Error: old_string not found in ${path}. Make sure the string matches exactly, including whitespace and indentation.`;
      }

      if (occurrences > 1) {
        return `Error: old_string appears ${occurrences} times in ${path}. It must be unique. Provide more surrounding context to make the match unique.`;
      }

      const updated = content.replace(old_string, new_string);
      await writeFile(path, updated, 'utf-8');

      return `Successfully edited ${path}`;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return `Error editing file: ${msg}`;
    }
  },
});
