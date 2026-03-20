import { describe, it, expect } from 'vitest';
import { ConversationContext } from '../core/context.js';

describe('ConversationContext', () => {
  it('starts empty', () => {
    const ctx = new ConversationContext();
    expect(ctx.getMessages()).toEqual([]);
    expect(ctx.getTokenEstimate()).toBe(0);
  });

  it('adds user messages', () => {
    const ctx = new ConversationContext();
    const msg = ctx.addUserMessage('hello');
    expect(msg.role).toBe('user');
    expect(msg.content).toBe('hello');
    expect(ctx.getMessages()).toHaveLength(1);
  });

  it('adds assistant messages', () => {
    const ctx = new ConversationContext();
    const msg = ctx.addAssistantMessage('hi there', 'claude', 'opus');
    expect(msg.role).toBe('assistant');
    expect(msg.provider).toBe('claude');
    expect(msg.model).toBe('opus');
  });

  it('tracks multiple messages', () => {
    const ctx = new ConversationContext();
    ctx.addUserMessage('q1');
    ctx.addAssistantMessage('a1', 'claude', 'sonnet');
    ctx.addUserMessage('q2');
    expect(ctx.getMessages()).toHaveLength(3);
  });

  it('clears all messages', () => {
    const ctx = new ConversationContext();
    ctx.addUserMessage('hello');
    ctx.addAssistantMessage('hi', 'claude', 'sonnet');
    ctx.clear();
    expect(ctx.getMessages()).toEqual([]);
    expect(ctx.getTokenEstimate()).toBe(0);
  });

  it('estimates tokens (roughly 4 chars per token)', () => {
    const ctx = new ConversationContext();
    ctx.addUserMessage('hello world'); // 11 chars → ~3 tokens
    const estimate = ctx.getTokenEstimate();
    expect(estimate).toBeGreaterThan(0);
    expect(estimate).toBeLessThan(20);
  });

  it('generates unique message ids', () => {
    const ctx = new ConversationContext();
    const m1 = ctx.addUserMessage('a');
    const m2 = ctx.addUserMessage('b');
    expect(m1.id).not.toBe(m2.id);
  });

  it('handles empty content gracefully', () => {
    const ctx = new ConversationContext();
    const msg = ctx.addAssistantMessage('', 'claude', 'sonnet');
    expect(msg.content).toBe('');
    expect(ctx.getTokenEstimate()).toBe(0);
  });
});
