import { describe, it, expect } from 'vitest';
import { getProvider, getAvailableProviders } from '../core/providers.js';

// ---------------------------------------------------------------------------
// Claude parser
// ---------------------------------------------------------------------------
describe('Claude parseEvents', () => {
  const claude = getProvider('claude');

  it('parses init event', () => {
    const line = JSON.stringify({
      type: 'system', subtype: 'init',
      model: 'claude-opus-4-6', session_id: 'sess-123',
    });
    const events = claude.parseEvents(line);
    expect(events).toEqual([{ type: 'init', model: 'claude-opus-4-6', sessionId: 'sess-123' }]);
  });

  it('parses stream_event text delta (--include-partial-messages)', () => {
    const line = JSON.stringify({
      type: 'stream_event',
      event: { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Hello' } },
    });
    const events = claude.parseEvents(line);
    expect(events).toEqual([{ type: 'text', content: 'Hello' }]);
  });

  it('parses stream_event thinking delta', () => {
    const line = JSON.stringify({
      type: 'stream_event',
      event: { type: 'content_block_delta', delta: { type: 'thinking_delta', thinking: 'hmm' } },
    });
    const events = claude.parseEvents(line);
    expect(events).toEqual([{ type: 'thinking', content: 'hmm' }]);
  });

  it('does NOT duplicate text from assistant message (already streamed via deltas)', () => {
    const line = JSON.stringify({
      type: 'assistant',
      message: { content: [{ type: 'text', text: 'Hello world' }] },
    });
    const events = claude.parseEvents(line);
    // Should be empty — text already came via stream_event deltas
    expect(events).toEqual([]);
  });

  it('parses tool_use from assistant message', () => {
    const line = JSON.stringify({
      type: 'assistant',
      message: {
        content: [{
          type: 'tool_use', id: 'toolu_123', name: 'Bash',
          input: { command: 'ls -la' },
        }],
      },
    });
    const events = claude.parseEvents(line);
    expect(events).toEqual([{
      type: 'tool_call',
      toolName: 'Bash',
      toolId: 'toolu_123',
      toolArgs: { command: 'ls -la' },
    }]);
  });

  it('parses multiple blocks in one assistant message', () => {
    const line = JSON.stringify({
      type: 'assistant',
      message: {
        content: [
          { type: 'text', text: 'Let me check' },
          { type: 'tool_use', id: 'toolu_1', name: 'Read', input: { path: '/foo' } },
          { type: 'tool_use', id: 'toolu_2', name: 'Glob', input: { pattern: '*.ts' } },
        ],
      },
    });
    const events = claude.parseEvents(line);
    // text is skipped (streamed via deltas), both tool_use parsed
    expect(events).toHaveLength(2);
    expect(events[0]?.toolName).toBe('Read');
    expect(events[1]?.toolName).toBe('Glob');
  });

  it('parses tool_result from user event', () => {
    const line = JSON.stringify({
      type: 'user',
      message: {
        content: [{ type: 'tool_result', tool_use_id: 'toolu_123', content: 'file contents here' }],
      },
    });
    const events = claude.parseEvents(line);
    expect(events).toEqual([{
      type: 'tool_result',
      toolId: 'toolu_123',
      toolResult: 'file contents here',
    }]);
  });

  it('parses result event with usage', () => {
    const line = JSON.stringify({
      type: 'result', subtype: 'success',
      result: 'Final answer',
      total_cost_usd: 0.05,
      usage: { input_tokens: 1000, output_tokens: 200 },
    });
    const events = claude.parseEvents(line);
    expect(events).toEqual([{
      type: 'result',
      usage: { inputTokens: 1000, outputTokens: 200, costUsd: 0.05 },
    }]);
  });

  it('ignores rate_limit_event', () => {
    const line = JSON.stringify({ type: 'rate_limit_event', rate_limit_info: {} });
    expect(claude.parseEvents(line)).toEqual([]);
  });

  it('ignores non-JSON lines', () => {
    expect(claude.parseEvents('not json at all')).toEqual([]);
    expect(claude.parseEvents('')).toEqual([]);
    expect(claude.parseEvents('   ')).toEqual([]);
  });

  it('ignores stream_event with unknown delta type', () => {
    const line = JSON.stringify({
      type: 'stream_event',
      event: { type: 'content_block_delta', delta: { type: 'unknown_type' } },
    });
    expect(claude.parseEvents(line)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Gemini parser
// ---------------------------------------------------------------------------
describe('Gemini parseEvents', () => {
  const gemini = getProvider('gemini');

  it('parses init event', () => {
    const line = JSON.stringify({
      type: 'init', session_id: 'gem-sess', model: 'gemini-2.5-flash',
      timestamp: '2026-01-01T00:00:00Z',
    });
    const events = gemini.parseEvents(line);
    expect(events).toEqual([{ type: 'init', model: 'gemini-2.5-flash', sessionId: 'gem-sess' }]);
  });

  it('parses text delta message', () => {
    const line = JSON.stringify({
      type: 'message', role: 'assistant', content: 'Hello there', delta: true,
    });
    const events = gemini.parseEvents(line);
    expect(events).toEqual([{ type: 'text', content: 'Hello there' }]);
  });

  it('ignores user messages', () => {
    const line = JSON.stringify({ type: 'message', role: 'user', content: 'hi' });
    expect(gemini.parseEvents(line)).toEqual([]);
  });

  it('parses tool_use event', () => {
    const line = JSON.stringify({
      type: 'tool_use', tool_name: 'list_directory',
      tool_id: 'list-123', parameters: { dir_path: '.' },
    });
    const events = gemini.parseEvents(line);
    expect(events).toEqual([{
      type: 'tool_call',
      toolName: 'list_directory',
      toolId: 'list-123',
      toolArgs: { dir_path: '.' },
    }]);
  });

  it('parses tool_result event', () => {
    const line = JSON.stringify({
      type: 'tool_result', tool_id: 'list-123',
      status: 'success', output: 'file1.ts\nfile2.ts',
    });
    const events = gemini.parseEvents(line);
    expect(events).toEqual([{
      type: 'tool_result',
      toolId: 'list-123',
      toolResult: 'file1.ts\nfile2.ts',
    }]);
  });

  it('parses result event with stats', () => {
    const line = JSON.stringify({
      type: 'result', status: 'success',
      stats: { input_tokens: 500, output_tokens: 100, total_tokens: 600, duration_ms: 3000, tool_calls: 2 },
    });
    const events = gemini.parseEvents(line);
    expect(events[0]?.type).toBe('result');
    expect(events[0]?.usage?.inputTokens).toBe(500);
    expect(events[0]?.usage?.outputTokens).toBe(100);
  });

  it('handles non-JSON lines from Gemini (YOLO warnings, credentials, etc.)', () => {
    expect(gemini.parseEvents('YOLO mode is enabled.')).toEqual([]);
    expect(gemini.parseEvents('Loaded cached credentials.')).toEqual([]);
    expect(gemini.parseEvents('Hook registry initialized with 0 hook entries')).toEqual([]);
    expect(gemini.parseEvents('\x1b[31mYOLO mode is disabled\x1b[0m')).toEqual([]);
  });

  it('handles null content in text delta', () => {
    const line = JSON.stringify({ type: 'message', role: 'assistant', content: null, delta: true });
    const events = gemini.parseEvents(line);
    // Should handle gracefully — either empty array or text with "null"
    expect(events.length).toBeLessThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// Codex parser
// ---------------------------------------------------------------------------
describe('Codex parseEvents', () => {
  const codex = getProvider('codex');

  it('parses thread.started', () => {
    const line = JSON.stringify({ type: 'thread.started', thread_id: 'thread-abc' });
    const events = codex.parseEvents(line);
    expect(events).toEqual([{ type: 'init', sessionId: 'thread-abc' }]);
  });

  it('parses agent_message', () => {
    const line = JSON.stringify({
      type: 'item.completed',
      item: { id: 'item_0', type: 'agent_message', text: 'Here are the files.' },
    });
    const events = codex.parseEvents(line);
    expect(events).toEqual([{ type: 'text', content: 'Here are the files.' }]);
  });

  it('skips empty agent_message', () => {
    const line = JSON.stringify({
      type: 'item.completed',
      item: { id: 'item_0', type: 'agent_message', text: '' },
    });
    expect(codex.parseEvents(line)).toEqual([]);
  });

  it('parses command_execution started (tool_call)', () => {
    const line = JSON.stringify({
      type: 'item.started',
      item: { id: 'item_1', type: 'command_execution', command: "/bin/zsh -lc 'ls -la'", status: 'in_progress' },
    });
    const events = codex.parseEvents(line);
    expect(events).toEqual([{
      type: 'tool_call',
      toolName: 'Bash',
      toolId: 'item_1',
      toolArgs: { command: 'ls -la' },
    }]);
  });

  it('parses command_execution completed (tool_result)', () => {
    const line = JSON.stringify({
      type: 'item.completed',
      item: {
        id: 'item_1', type: 'command_execution',
        command: "/bin/zsh -lc 'ls'",
        aggregated_output: 'README.md\nsrc/\n',
        exit_code: 0, status: 'completed',
      },
    });
    const events = codex.parseEvents(line);
    expect(events[0]?.type).toBe('tool_result');
    expect(events[0]?.toolResult).toContain('README.md');
  });

  it('parses file_change event', () => {
    const line = JSON.stringify({
      type: 'item.completed',
      item: {
        id: 'item_3', type: 'file_change',
        changes: [{ path: 'src/index.ts', kind: 'update' }],
        status: 'completed',
      },
    });
    const events = codex.parseEvents(line);
    expect(events).toEqual([{
      type: 'tool_call',
      toolName: 'Edit',
      toolId: 'item_3',
      toolArgs: { path: 'src/index.ts', kind: 'update' },
    }]);
  });

  it('parses turn.completed with usage', () => {
    const line = JSON.stringify({
      type: 'turn.completed',
      usage: { input_tokens: 5000, cached_input_tokens: 3000, output_tokens: 150 },
    });
    const events = codex.parseEvents(line);
    expect(events).toEqual([{
      type: 'result',
      usage: { inputTokens: 5000, outputTokens: 150 },
    }]);
  });

  it('handles non-JSON header lines from Codex', () => {
    expect(codex.parseEvents('OpenAI Codex v0.115.0 (research preview)')).toEqual([]);
    expect(codex.parseEvents('--------')).toEqual([]);
    expect(codex.parseEvents('workdir: /Users/foo/bar')).toEqual([]);
    expect(codex.parseEvents('model: gpt-5.4')).toEqual([]);
    expect(codex.parseEvents('mcp: figma starting')).toEqual([]);
  });

  it('ignores turn.started', () => {
    const line = JSON.stringify({ type: 'turn.started' });
    expect(codex.parseEvents(line)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// getAvailableProviders
// ---------------------------------------------------------------------------
describe('getAvailableProviders', () => {
  it('returns an array', () => {
    const providers = getAvailableProviders();
    expect(Array.isArray(providers)).toBe(true);
  });

  it('only returns valid provider names', () => {
    const valid = ['claude', 'gemini', 'codex'];
    for (const p of getAvailableProviders()) {
      expect(valid).toContain(p);
    }
  });
});
