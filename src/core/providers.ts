import { spawn, execSync, type ChildProcess } from 'node:child_process';
import type { Provider } from '../config/defaults.js';

export interface StreamEvent {
  type: 'init' | 'text' | 'tool_call' | 'tool_result' | 'error' | 'result' | 'thinking';
  content?: string;
  toolName?: string;
  toolArgs?: Record<string, unknown>;
  toolResult?: string;
  model?: string;
  sessionId?: string;
  usage?: { inputTokens: number; outputTokens: number; costUsd?: number };
}

export interface SpawnOptions {
  cwd?: string;
  model?: string;
  yolo?: boolean;
  maxTurns?: number;
}

export interface CLIProvider {
  name: string;
  spawn(prompt: string, options: SpawnOptions): ChildProcess;
  parseEvents(line: string): StreamEvent[];
}

export const PROVIDER_MODELS: Record<Provider, string[]> = {
  claude: ['claude-sonnet-4-6', 'claude-opus-4-6', 'claude-haiku-4-5', 'sonnet', 'opus', 'haiku'],
  gemini: ['gemini-2.5-flash', 'gemini-2.5-pro', 'auto-gemini-2.5'],
  codex: ['gpt-5.4', 'codex-mini-latest', 'o3', 'o4-mini'],
};

// ---------------------------------------------------------------------------
// Claude CLI
// ---------------------------------------------------------------------------

const claudeProvider: CLIProvider = {
  name: 'claude',

  spawn(prompt: string, options: SpawnOptions): ChildProcess {
    const args: string[] = [
      '-p', prompt,
      '--output-format', 'stream-json',
      '--include-partial-messages',  // stream text deltas in real-time
    ];

    if (options.yolo) {
      args.push('--dangerously-skip-permissions');
    }
    if (options.model) {
      args.push('--model', options.model);
    }

    return spawn('claude', args, {
      cwd: options.cwd ?? process.cwd(),
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env },
    });
  },

  parseEvents(line: string): StreamEvent[] {
    const trimmed = line.trim();
    if (!trimmed) return [];

    let data: Record<string, unknown>;
    try {
      data = JSON.parse(trimmed);
    } catch {
      return [];
    }

    // Init
    if (data.type === 'system' && data.subtype === 'init') {
      return [{ type: 'init', model: data.model as string, sessionId: data.session_id as string }];
    }

    // Result — contains usage stats. Don't emit text here (already streamed via assistant events)
    if (data.type === 'result') {
      const usage = data.usage as Record<string, number> | undefined;
      return [{
        type: 'result',
        usage: usage ? {
          inputTokens: usage.input_tokens ?? 0,
          outputTokens: usage.output_tokens ?? 0,
          costUsd: data.total_cost_usd as number | undefined,
        } : undefined,
      }];
    }

    // Assistant messages — can have MULTIPLE content blocks
    if (data.type === 'assistant') {
      const message = data.message as Record<string, unknown> | undefined;
      const contentBlocks = message?.content as Array<Record<string, unknown>> | undefined;
      if (!contentBlocks || !Array.isArray(contentBlocks)) return [];

      const events: StreamEvent[] = [];
      for (const block of contentBlocks) {
        if (block.type === 'text' && typeof block.text === 'string') {
          events.push({ type: 'text', content: block.text });
        }
        if (block.type === 'tool_use') {
          events.push({
            type: 'tool_call',
            toolName: block.name as string,
            toolArgs: (block.input as Record<string, unknown>) ?? {},
          });
        }
        if (block.type === 'thinking' && typeof block.thinking === 'string') {
          events.push({ type: 'thinking', content: block.thinking });
        }
      }
      return events;
    }

    // Tool results from CLI (type: "user" with tool_result content)
    if (data.type === 'user') {
      const message = data.message as Record<string, unknown> | undefined;
      const contentBlocks = message?.content as Array<Record<string, unknown>> | undefined;
      if (!contentBlocks || !Array.isArray(contentBlocks)) return [];

      const events: StreamEvent[] = [];
      for (const block of contentBlocks) {
        if (block.type === 'tool_result') {
          const resultContent = typeof block.content === 'string'
            ? block.content
            : JSON.stringify(block.content);
          events.push({
            type: 'tool_result',
            toolName: block.tool_use_id as string,
            toolResult: resultContent,
          });
        }
      }
      return events;
    }

    // Ignore rate_limit_event and other event types
    return [];
  },
};

// ---------------------------------------------------------------------------
// Gemini CLI
// ---------------------------------------------------------------------------

const geminiProvider: CLIProvider = {
  name: 'gemini',

  spawn(prompt: string, options: SpawnOptions): ChildProcess {
    const args: string[] = [
      '-p', prompt,
      '--output-format', 'stream-json',
      '--approval-mode', 'auto_edit',  // auto-approve edits, avoid --yolo (often blocked)
    ];

    if (options.yolo) {
      args.push('--yolo');
    }
    if (options.model) {
      args.push('--model', options.model);
    }

    return spawn('gemini', args, {
      cwd: options.cwd ?? process.cwd(),
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env },
    });
  },

  parseEvents(line: string): StreamEvent[] {
    const trimmed = line.trim();
    if (!trimmed) return [];

    let data: Record<string, unknown>;
    try {
      data = JSON.parse(trimmed);
    } catch {
      return [];
    }

    if (data.type === 'init') {
      return [{ type: 'init', model: data.model as string, sessionId: data.session_id as string }];
    }

    // Gemini streams text as delta messages
    if (data.type === 'message' && data.role === 'assistant') {
      return [{ type: 'text', content: data.content as string }];
    }

    if (data.type === 'tool_call') {
      return [{
        type: 'tool_call',
        toolName: data.name as string,
        toolArgs: (data.args as Record<string, unknown>) ?? {},
      }];
    }

    if (data.type === 'tool_result') {
      return [{
        type: 'tool_result',
        toolName: data.name as string,
        toolResult: data.output as string,
      }];
    }

    // Gemini also emits actionComplete for tool calls
    if (data.type === 'actionComplete') {
      const action = data.action as Record<string, unknown> | undefined;
      if (action) {
        return [{
          type: 'tool_call',
          toolName: (action.toolName ?? action.name ?? 'tool') as string,
          toolArgs: (action.input as Record<string, unknown>) ?? {},
        }];
      }
    }

    if (data.type === 'result') {
      const stats = data.stats as Record<string, number> | undefined;
      return [{
        type: 'result',
        usage: stats ? {
          inputTokens: stats.input_tokens ?? (stats.input as number) ?? 0,
          outputTokens: stats.output_tokens ?? (stats.output as number) ?? 0,
        } : undefined,
      }];
    }

    return [];
  },
};

// ---------------------------------------------------------------------------
// Codex CLI
// ---------------------------------------------------------------------------

const codexProvider: CLIProvider = {
  name: 'codex',

  spawn(prompt: string, options: SpawnOptions): ChildProcess {
    const args: string[] = ['exec', prompt, '--json'];

    if (options.model) {
      args.push('-m', options.model);
    }
    if (options.yolo) {
      args.push('-c', 'approval_policy=never');
    }

    return spawn('codex', args, {
      cwd: options.cwd ?? process.cwd(),
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env },
    });
  },

  parseEvents(line: string): StreamEvent[] {
    const trimmed = line.trim();
    if (!trimmed) return [];

    let data: Record<string, unknown>;
    try {
      data = JSON.parse(trimmed);
    } catch {
      return [];
    }

    if (data.type === 'thread.started') {
      return [{ type: 'init', sessionId: data.thread_id as string }];
    }

    // Codex tool calls come as command_execution items
    if (data.type === 'item.started') {
      const item = data.item as Record<string, unknown> | undefined;
      if (item?.type === 'command_execution') {
        const cmd = (item.command as string) ?? '';
        // Extract the actual command from shell wrapper like "/bin/zsh -lc 'actual cmd'"
        const match = cmd.match(/-[lc]+\s+'(.+)'$/);
        const cleanCmd = match ? match[1] : cmd;
        return [{
          type: 'tool_call',
          toolName: 'Bash',
          toolArgs: { command: cleanCmd },
        }];
      }
    }

    if (data.type === 'item.completed') {
      const item = data.item as Record<string, unknown> | undefined;
      if (!item) return [];

      if (item.type === 'agent_message') {
        return [{ type: 'text', content: item.text as string }];
      }

      if (item.type === 'command_execution') {
        const output = (item.aggregated_output as string) ?? '';
        return [{
          type: 'tool_result',
          toolName: 'Bash',
          toolResult: output.slice(0, 200),
        }];
      }

      if (item.type === 'tool_call') {
        return [{
          type: 'tool_call',
          toolName: (item.name as string) ?? 'tool',
          toolArgs: (item.arguments as Record<string, unknown>) ?? {},
        }];
      }

      if (item.type === 'tool_output') {
        return [{
          type: 'tool_result',
          toolName: (item.name as string) ?? 'tool',
          toolResult: (item.output as string) ?? '',
        }];
      }

      // Codex also has file_edit, file_read, etc.
      if (item.type === 'file_edit' || item.type === 'file_read') {
        return [{
          type: 'tool_call',
          toolName: item.type === 'file_edit' ? 'Edit' : 'Read',
          toolArgs: { path: (item.path ?? item.file) as string },
        }];
      }
    }

    if (data.type === 'turn.completed') {
      const usage = data.usage as Record<string, number> | undefined;
      return [{
        type: 'result',
        usage: usage ? {
          inputTokens: usage.input_tokens ?? 0,
          outputTokens: usage.output_tokens ?? 0,
        } : undefined,
      }];
    }

    return [];
  },
};

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

const providers: Record<Provider, CLIProvider> = {
  claude: claudeProvider,
  gemini: geminiProvider,
  codex: codexProvider,
};

export function getProvider(name: Provider): CLIProvider {
  const p = providers[name];
  if (!p) throw new Error(`Unknown provider: ${name}`);
  return p;
}

export const getCLIProvider = getProvider;

export function getAvailableProviders(): Provider[] {
  const all: Provider[] = ['claude', 'gemini', 'codex'];
  return all.filter((name) => {
    try {
      execSync(`which ${name}`, { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  });
}
