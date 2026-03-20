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

const PROVIDER_ICONS: Record<string, string> = {
  claude: '\u2726',   // sparkle
  gemini: '\u25C6',   // diamond
  openai: '\u25CF',   // circle
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
        <Text color="yellow">[tool] {toolName ?? 'unknown'}</Text>
        <Box marginLeft={2}>
          <Text dimColor>{content.length > 500 ? content.slice(0, 500) + '...' : content}</Text>
        </Box>
      </Box>
    );
  }

  // assistant
  const icon = provider ? (PROVIDER_ICONS[provider] ?? '\u25B8') : '\u25B8';
  const displayName = provider ?? 'assistant';

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text bold color="cyan">
        {icon} {displayName}:
      </Text>
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
