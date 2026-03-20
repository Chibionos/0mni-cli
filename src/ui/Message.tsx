import React from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import { Markdown } from './Markdown.js';

export interface MessageProps {
  role: 'user' | 'assistant' | 'tool';
  content: string;
  provider?: string;
  toolName?: string;
  isStreaming?: boolean;
}

const PROVIDER_STYLE: Record<string, { icon: string; color: string }> = {
  claude: { icon: '\u25CF', color: 'blue' },      // blue dot
  gemini: { icon: '\u25CF', color: 'green' },     // green dot
  codex:  { icon: '\u25CF', color: 'yellow' },    // yellow dot
  system: { icon: '\u25B8', color: 'gray' },      // gray arrow
};

export function Message({ role, content, provider, toolName, isStreaming }: MessageProps) {
  if (role === 'user') {
    return (
      <Box flexDirection="column" marginBottom={1}>
        <Text bold color="green">You:</Text>
        <Box marginLeft={2}>
          <Text>{content}</Text>
        </Box>
      </Box>
    );
  }

  if (role === 'tool') {
    return (
      <Box flexDirection="column" marginBottom={1}>
        <Box gap={1}>
          <Text color="yellow">{'\u2192'}</Text>
          <Text color="yellow" bold>{toolName ?? 'tool'}</Text>
        </Box>
        <Box marginLeft={2}>
          <Text dimColor>{content.length > 500 ? content.slice(0, 500) + '...' : content}</Text>
        </Box>
      </Box>
    );
  }

  // assistant
  const style = provider ? (PROVIDER_STYLE[provider] ?? { icon: '\u25B8', color: 'cyan' }) : { icon: '\u25B8', color: 'cyan' };
  const displayName = provider === 'system' ? 'system' : (provider ?? 'assistant');

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box gap={1}>
        <Text color={style.color}>{style.icon}</Text>
        <Text bold color={style.color}>
          {displayName}:
        </Text>
      </Box>
      <Box marginLeft={2} flexDirection="column">
        <Markdown text={content} />
        {isStreaming && (
          <Box>
            <Text color="cyan">
              <Spinner type="dots" />
            </Text>
          </Box>
        )}
      </Box>
    </Box>
  );
}
