import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import { Markdown } from './Markdown.js';

export interface MessageProps {
  role: 'user' | 'assistant' | 'tool';
  content: string;
  provider?: string;
  toolName?: string;
  isStreaming?: boolean;
}

const PROVIDER_COLORS: Record<string, string> = {
  claude: 'blue',
  gemini: 'green',
  codex: 'yellow',
  system: 'gray',
};

function StreamingCursor() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setVisible((v) => !v);
    }, 530);
    return () => clearInterval(interval);
  }, []);

  return <Text color="cyan">{visible ? '\u258B' : ' '}</Text>;
}

export function Message({ role, content, provider, toolName, isStreaming }: MessageProps) {
  // --- System messages: italic dim, no prefix ---
  if (provider === 'system') {
    return (
      <Box marginY={0} paddingLeft={2}>
        <Text dimColor italic>{content}</Text>
      </Box>
    );
  }

  // --- User messages: compact single line with chevron ---
  if (role === 'user') {
    return (
      <Box marginY={0}>
        <Text bold color="white">{'\u276F '}</Text>
        <Text>{content}</Text>
      </Box>
    );
  }

  // --- Tool messages: indented sub-items ---
  if (role === 'tool') {
    const truncated = content.length > 200 ? content.slice(0, 200) + '...' : content;
    return (
      <Box flexDirection="column" marginY={0} paddingLeft={2}>
        <Box>
          <Text dimColor color="yellow">{'  \u23F5 '}</Text>
          <Text bold color="yellow">{toolName ?? 'tool'}</Text>
        </Box>
        {truncated && (
          <Box paddingLeft={4}>
            <Text dimColor>{truncated}</Text>
          </Box>
        )}
      </Box>
    );
  }

  // --- Assistant messages ---
  const dotColor = provider ? (PROVIDER_COLORS[provider] ?? 'cyan') : 'cyan';
  const displayName = provider ?? 'assistant';

  return (
    <Box flexDirection="column" marginY={0}>
      <Box>
        <Text color={dotColor}>{'\u25CF '}</Text>
        <Text bold color={dotColor}>{displayName}</Text>
        <Text color={dotColor}>:</Text>
      </Box>
      <Box paddingLeft={2} flexDirection="column">
        {content ? <Markdown text={content} /> : null}
        {isStreaming && <StreamingCursor />}
      </Box>
    </Box>
  );
}
