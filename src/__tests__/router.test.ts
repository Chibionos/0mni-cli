import { describe, it, expect } from 'vitest';
import { classifyTask, routePrompt } from '../core/router.js';

describe('classifyTask', () => {
  it('routes search queries to search', () => {
    expect(classifyTask('search for the error in logs')).toBe('search');
    expect(classifyTask('find all TODO comments')).toBe('search');
    expect(classifyTask('look up the API docs')).toBe('search');
  });

  it('routes code review to code_review', () => {
    expect(classifyTask('review the auth module')).toBe('code_review');
    expect(classifyTask('check this code for bugs')).toBe('code_review');
    expect(classifyTask('audit the security of this function')).toBe('code_review');
  });

  it('routes refactoring to refactor', () => {
    expect(classifyTask('refactor the auth module')).toBe('refactor');
    expect(classifyTask('rename this variable everywhere')).toBe('refactor');
    expect(classifyTask('reorganize the file structure')).toBe('refactor');
  });

  it('routes debugging to complex_reasoning', () => {
    expect(classifyTask('fix the login bug')).toBe('complex_reasoning');
    expect(classifyTask('debug the failing test')).toBe('complex_reasoning');
    expect(classifyTask('why is this crashing?')).toBe('complex_reasoning');
  });

  it('routes simple questions to simple_qa', () => {
    expect(classifyTask('explain how this works')).toBe('simple_qa');
    expect(classifyTask('what is this function doing?')).toBe('simple_qa');
  });

  it('routes creation tasks to code_generation', () => {
    expect(classifyTask('write a new test file')).toBe('code_generation');
    expect(classifyTask('create a REST API endpoint')).toBe('code_generation');
    expect(classifyTask('implement the login feature')).toBe('code_generation');
    expect(classifyTask('add error handling to the parser')).toBe('code_generation');
  });

  it('defaults to code_generation for ambiguous prompts', () => {
    expect(classifyTask('hello')).toBe('code_generation');
    expect(classifyTask('do something cool')).toBe('code_generation');
  });
});

describe('routePrompt', () => {
  it('returns a provider and taskType', () => {
    const result = routePrompt('fix the bug');
    expect(result).toHaveProperty('provider');
    expect(result).toHaveProperty('taskType');
    expect(['claude', 'gemini', 'codex']).toContain(result.provider);
  });

  it('respects manual override', () => {
    const result = routePrompt('anything', 'gemini');
    expect(result.provider).toBe('gemini');
  });

  it('routes search to gemini', () => {
    const result = routePrompt('search for the API docs');
    expect(result.provider).toBe('gemini');
    expect(result.taskType).toBe('search');
  });

  it('routes complex reasoning to claude', () => {
    const result = routePrompt('fix the authentication bug');
    expect(result.provider).toBe('claude');
    expect(result.taskType).toBe('complex_reasoning');
  });

  it('routes refactoring to codex', () => {
    const result = routePrompt('refactor the auth module');
    expect(result.provider).toBe('codex');
    expect(result.taskType).toBe('refactor');
  });
});
