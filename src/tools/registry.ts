import { readFileTool } from './file-read.js';
import { writeFileTool, editFileTool } from './file-write.js';
import { listFilesTool, searchContentTool } from './file-search.js';
import { shellExecTool } from './shell.js';
import { webSearchTool } from './web-search.js';
import { askUserTool } from './ask-user.js';

/**
 * Tools that modify the filesystem or run arbitrary commands.
 * These should require user confirmation before execution.
 */
export const DANGEROUS_TOOLS = ['shell_exec', 'write_file', 'edit_file'] as const;

/**
 * Returns a record of all available tools keyed by their canonical name.
 */
export function getAllTools() {
  return {
    read_file: readFileTool,
    write_file: writeFileTool,
    edit_file: editFileTool,
    list_files: listFilesTool,
    search_content: searchContentTool,
    shell_exec: shellExecTool,
    web_search: webSearchTool,
    ask_user: askUserTool,
  };
}
