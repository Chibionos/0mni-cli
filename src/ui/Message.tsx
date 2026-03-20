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
  const path = args.path ?? args.file_path ?? args.file ?? args.filename;
  if (path) return String(path);
  const command = args.command ?? args.cmd;
  if (command) return String(command).slice(0, 80);
  const pattern = args.pattern ?? args.query ?? args.glob;
  if (pattern) return String(pattern);
  const url = args.url;
  if (url) return String(url);
  const firstVal = Object.values(args)[0];
  if (firstVal && typeof firstVal === 'string') return firstVal.slice(0, 60);
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

  // Tool messages — show tool name + useful arg info
  if (role === 'tool') {
    const color = PROVIDER_COLORS[provider ?? ''] ?? '#999999';
    const detail = formatToolDetail(toolName ?? '', toolArgs);
    return (
      <Box marginY={0} paddingLeft={2}>
        <Text color={color}>{'\u25B8 '}</Text>
        <Text bold color={color}>{toolName ?? 'tool'}</Text>
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
