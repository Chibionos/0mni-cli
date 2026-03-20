import { spawn, execSync, type ChildProcess } from 'node:child_process';
import type { Provider } from '../config/defaults.js';

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

export interface StreamEvent {
  type: 'init' | 'text' | 'tool_call' | 'tool_result' | 'error' | 'result' | 'thinking';
  content?: string;
  toolName?: string;
  toolId?: string;
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

/**
 * Multi-turn CLI provider interface.
 *
 * Providers come in two flavours:
 *  - **persistent** (Claude): a single long-lived process that accepts new
 *    messages on stdin via NDJSON.
 *  - **per-turn** (Gemini, Codex): a fresh process is spawned for every user
 *    turn, with an optional session/thread id for resume.
 */
export interface CLIProvider {
  name: string;

  /** Whether this provider keeps one process alive across turns. */
  persistent: boolean;

  // -- Persistent-process providers (Claude) --------------------------------

  /** Spawn a long-lived process (no prompt in args). */
  spawnPersistent?(options: SpawnOptions): ChildProcess;

  /** Write a user message into the persistent process's stdin. */
  sendMessage?(proc: ChildProcess, message: string, sessionId: string): void;

  // -- Per-turn providers (Gemini, Codex) -----------------------------------

  /** Spawn a one-shot process for a single turn. */
  spawnTurn?(prompt: string, options: SpawnOptions & { sessionId?: string }): ChildProcess;

  // -- Common ---------------------------------------------------------------

  /** Parse one NDJSON line from stdout into zero or more StreamEvents. */
  parseEvents(line: string): StreamEvent[];
}

// ---------------------------------------------------------------------------
// Model catalogue
// ---------------------------------------------------------------------------

export const PROVIDER_MODELS: Record<Provider, string[]> = {
  claude: ['claude-sonnet-4-6', 'claude-opus-4-6', 'claude-haiku-4-5', 'sonnet', 'opus', 'haiku'],
  gemini: ['gemini-2.5-flash', 'gemini-2.5-pro', 'auto-gemini-2.5'],
  codex: ['gpt-5.4', 'codex-mini-latest', 'o3', 'o4-mini'],
};

// ---------------------------------------------------------------------------
// Claude CLI — Bidirectional streaming on a single persistent process
// ---------------------------------------------------------------------------
//
// Launch once:
//   claude -p --input-format stream-json --output-format stream-json \
//          --include-partial-messages --dangerously-skip-permissions
//
// stdin  (NDJSON):
//   {"type":"user","message":{"role":"user","content":"..."},
//    "session_id":"<from init>","parent_tool_use_id":null}
//
// stdout (NDJSON): system/init, assistant, user (tool_result), result, etc.
// ---------------------------------------------------------------------------

const claudeProvider: CLIProvider = {
  name: 'claude',
  persistent: true,

  spawnPersistent(options: SpawnOptions): ChildProcess {
    const args: string[] = [
      '-p',
      '--input-format', 'stream-json',
      '--output-format', 'stream-json',
      '--include-partial-messages',
      '--dangerously-skip-permissions',
    ];

    if (options.model) {
      args.push('--model', options.model);
    }

    return spawn('claude', args, {
      cwd: options.cwd ?? process.cwd(),
      stdio: ['pipe', 'pipe', 'pipe'],   // stdin writable
      env: { ...process.env },
    });
  },

  sendMessage(proc: ChildProcess, message: string, sessionId: string): void {
    if (!proc.stdin || proc.stdin.destroyed) return;

    const payload = JSON.stringify({
      type: 'user',
      message: { role: 'user', content: message },
      session_id: sessionId,
      parent_tool_use_id: null,
    });

    proc.stdin.write(payload + '\n');
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

    // Init — emitted once when the session starts
    if (data.type === 'system' && data.subtype === 'init') {
      return [{
        type: 'init',
        model: data.model as string,
        sessionId: data.session_id as string,
      }];
    }

    // Result — usage stats at end of turn
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

    // Assistant messages — can contain multiple content blocks
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
            toolId: block.id as string,
            toolArgs: (block.input as Record<string, unknown>) ?? {},
          });
        }
        if (block.type === 'thinking' && typeof block.thinking === 'string') {
          events.push({ type: 'thinking', content: block.thinking });
        }
      }
      return events;
    }

    // Tool results streamed back from the CLI (type: "user" with tool_result blocks)
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
            toolId: block.tool_use_id as string,
            toolResult: resultContent,
          });
        }
      }
      return events;
    }

    // Ignore rate_limit_event, ping, and other housekeeping events
    return [];
  },
};

// ---------------------------------------------------------------------------
// Gemini CLI — Spawn per turn, resume with --resume <session_id>
// ---------------------------------------------------------------------------
//
// First turn:
//   gemini -p "prompt" --output-format stream-json --approval-mode auto_edit
//
// Follow-up:
//   gemini --resume <session_id> -p "follow-up" --output-format stream-json
//          --approval-mode auto_edit
//
// Actual event shapes:
//   {"type":"init","session_id":"...","model":"..."}
//   {"type":"message","role":"assistant","content":"chunk","delta":true}
//   {"type":"tool_use","tool_name":"...","tool_id":"...","parameters":{...}}
//   {"type":"tool_result","tool_id":"...","status":"success","output":"..."}
//   {"type":"result","status":"success","stats":{...}}
// ---------------------------------------------------------------------------

const geminiProvider: CLIProvider = {
  name: 'gemini',
  persistent: false,

  spawnTurn(prompt: string, options: SpawnOptions & { sessionId?: string }): ChildProcess {
    const args: string[] = [];

    // Resume an existing session or start fresh
    if (options.sessionId) {
      args.push('--resume', options.sessionId);
    }

    args.push(
      '-p', prompt,
      '--output-format', 'stream-json',
      '--approval-mode', 'auto_edit',
    );

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

    // Init
    if (data.type === 'init') {
      return [{
        type: 'init',
        model: data.model as string,
        sessionId: data.session_id as string,
      }];
    }

    // Text deltas — Gemini uses type:"message" with role:"assistant" and delta:true
    if (data.type === 'message' && data.role === 'assistant') {
      return [{ type: 'text', content: data.content as string }];
    }

    // Tool use — Gemini uses type:"tool_use" with tool_name and parameters
    if (data.type === 'tool_use') {
      return [{
        type: 'tool_call',
        toolName: data.tool_name as string,
        toolId: data.tool_id as string,
        toolArgs: (data.parameters as Record<string, unknown>) ?? {},
      }];
    }

    // Tool result — matched to tool_use via tool_id
    if (data.type === 'tool_result') {
      return [{
        type: 'tool_result',
        toolId: data.tool_id as string,
        toolResult: data.output as string,
      }];
    }

    // Result — end-of-turn usage stats
    if (data.type === 'result') {
      const stats = data.stats as Record<string, number> | undefined;
      return [{
        type: 'result',
        usage: stats ? {
          inputTokens: stats.input_tokens ?? 0,
          outputTokens: stats.output_tokens ?? 0,
        } : undefined,
      }];
    }

    return [];
  },
};

// ---------------------------------------------------------------------------
// Codex CLI — Spawn per turn, resume with `codex exec resume <thread_id>`
// ---------------------------------------------------------------------------
//
// First turn:
//   codex exec "prompt" --json
//
// Follow-up:
//   codex exec resume <thread_id> "follow-up" --json
//
// Actual event shapes:
//   {"type":"thread.started","thread_id":"..."}
//   {"type":"turn.started"}
//   {"type":"item.started","item":{"id":"...","type":"command_execution",
//     "command":"...","status":"in_progress"}}
//   {"type":"item.completed","item":{"id":"...","type":"command_execution",
//     "command":"...","aggregated_output":"...","exit_code":0,"status":"completed"}}
//   {"type":"item.completed","item":{"id":"...","type":"agent_message","text":"..."}}
//   {"type":"item.completed","item":{"id":"...","type":"file_change",
//     "changes":[{"path":"...","kind":"update"}]}}
//   {"type":"turn.completed","usage":{"input_tokens":...,"cached_input_tokens":...,
//     "output_tokens":...}}
// ---------------------------------------------------------------------------

const codexProvider: CLIProvider = {
  name: 'codex',
  persistent: false,

  spawnTurn(prompt: string, options: SpawnOptions & { sessionId?: string }): ChildProcess {
    const args: string[] = ['exec'];

    // Resume an existing thread or start fresh
    if (options.sessionId) {
      args.push('resume', options.sessionId);
    }

    args.push(prompt, '--json');

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

    // Thread init
    if (data.type === 'thread.started') {
      return [{ type: 'init', sessionId: data.thread_id as string }];
    }

    // Item started — command_execution gives us tool_call early
    if (data.type === 'item.started') {
      const item = data.item as Record<string, unknown> | undefined;
      if (item?.type === 'command_execution') {
        const cmd = (item.command as string) ?? '';
        // Strip shell wrappers like "/bin/zsh -lc 'actual cmd'"
        const match = cmd.match(/-[lc]+\s+'(.+)'$/);
        const cleanCmd = match ? match[1] : cmd;
        return [{
          type: 'tool_call',
          toolName: 'Bash',
          toolId: item.id as string,
          toolArgs: { command: cleanCmd },
        }];
      }
    }

    // Item completed — text, command output, or file change
    if (data.type === 'item.completed') {
      const item = data.item as Record<string, unknown> | undefined;
      if (!item) return [];

      // Agent text message
      if (item.type === 'agent_message') {
        return [{ type: 'text', content: item.text as string }];
      }

      // Command execution result
      if (item.type === 'command_execution') {
        const output = (item.aggregated_output as string) ?? '';
        return [{
          type: 'tool_result',
          toolName: 'Bash',
          toolId: item.id as string,
          toolResult: output.slice(0, 200),
        }];
      }

      // File change events
      if (item.type === 'file_change') {
        const changes = item.changes as Array<Record<string, unknown>> | undefined;
        if (!changes?.length) return [];
        const events: StreamEvent[] = [];
        for (const change of changes) {
          events.push({
            type: 'tool_call',
            toolName: change.kind === 'update' ? 'Edit' : 'Write',
            toolId: item.id as string,
            toolArgs: { path: change.path as string, kind: change.kind as string },
          });
        }
        return events;
      }
    }

    // Turn completed — usage stats
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
