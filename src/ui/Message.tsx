import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import { Markdown } from './Markdown.js';

export interface MessageProps {
  role: 'user' | 'assistant' | 'tool';
  content: string;
  provider?: string;
  toolName?: string;
  toolArgs?: Record<string, unknown>;
  isStreaming?: boolean;
}

const PROVIDER_COLORS: Record<string, string> = {
  claude: '#FF6600',
  gemini: 'magenta',
  codex: '#4A90D9',
  system: 'gray',
};

// Tools that ask the user a question — show the question prominently
const QUESTION_TOOLS = ['AskUserQuestion', 'ask_user', 'askUser'];

// Internal/meta tools the user doesn't need to see
const HIDDEN_TOOLS = ['ToolSearch', 'TodoWrite', 'TaskCreate', 'TaskUpdate', 'TaskList', 'TaskGet'];

function StreamingCursor() {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const timer = setInterval(() => setVisible((v) => !v), 530);
    return () => clearInterval(timer);
  }, []);
  return <Text color="cyan">{visible ? '\u2588' : ' '}</Text>;
}

function formatToolDetail(name: string, args?: Record<string, unknown>): string {
  if (!args || Object.keys(args).length === 0) return '';

  // Question tools — extract the question
  const question = args.question ?? args.prompt ?? args.text;
  if (question) return String(question);

  // File tools
  const path = args.path ?? args.file_path ?? args.file ?? args.filename ?? args.file_name;
  if (path) return String(path);

  // Shell/command tools
  const command = args.command ?? args.cmd ?? args.description;
  if (command) return String(command).slice(0, 100);

  // Search tools
  const pattern = args.pattern ?? args.query ?? args.glob ?? args.search ?? args.regex;
  if (pattern) return String(pattern);

  // URL tools
  const url = args.url ?? args.href;
  if (url) return String(url);

  // Skill/agent tools
  const skill = args.skill ?? args.agent ?? args.name;
  if (skill) return String(skill);

  // Fallback: show first string arg value
  for (const val of Object.values(args)) {
    if (typeof val === 'string' && val.length > 0) return val.slice(0, 80);
  }
  return '';
}

export function Message({ role, content, provider, toolName, toolArgs, isStreaming }: MessageProps) {
  // System messages (slash command feedback)
  if (provider === 'system') {
    return (
      <Box marginY={0} paddingLeft={2}>
        <Text dimColor italic>{content}</Text>
      </Box>
    );
  }

  // User messages
  if (role === 'user') {
    return (
      <Box marginY={0}>
        <Text bold color="white">{'\u276F '}</Text>
        <Text>{content}</Text>
      </Box>
    );
  }

  // Tool messages
  if (role === 'tool') {
    const name = toolName ?? 'tool';
    const color = PROVIDER_COLORS[provider ?? ''] ?? '#999999';

    // Hide internal/meta tools — don't clutter the UI
    if (HIDDEN_TOOLS.includes(name)) {
      return null;
    }

    // Question tools — show prominently so the user can answer
    if (QUESTION_TOOLS.includes(name)) {
      const question = (toolArgs?.question ?? toolArgs?.prompt ?? toolArgs?.text ?? content) as string;
      return (
        <Box flexDirection="column" marginY={0} paddingLeft={2}>
          <Box gap={1}>
            <Text color="yellow" bold>{'\u2753'}</Text>
            <Text bold color="yellow">Question from {provider ?? 'agent'}:</Text>
          </Box>
          <Box paddingLeft={2}>
            <Text>{question}</Text>
          </Box>
        </Box>
      );
    }

    // Regular tool calls
    const detail = formatToolDetail(name, toolArgs);
    return (
      <Box marginY={0} paddingLeft={2}>
        <Text color={color}>{'\u25B8 '}</Text>
        <Text bold color={color}>{name}</Text>
        {detail ? <Text dimColor> {detail}</Text> : null}
      </Box>
    );
  }

  // Assistant messages
  const color = PROVIDER_COLORS[provider ?? ''] ?? 'cyan';

  return (
    <Box flexDirection="column" marginY={0}>
      <Box>
        <Text color={color}>{'\u25CF '}</Text>
        <Text bold color={color}>{provider ?? 'assistant'}</Text>
        <Text color={color}>:</Text>
        {isStreaming && !content && (
          <Text color={color}> <Spinner type="dots" /></Text>
        )}
      </Box>
      {content ? (
        <Box paddingLeft={2} flexDirection="column">
          <Markdown text={content} />
          {isStreaming && <StreamingCursor />}
        </Box>
      ) : null}
    </Box>
  );
}
