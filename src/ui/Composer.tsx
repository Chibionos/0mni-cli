import React, { useState } from 'react';
import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';
import Spinner from 'ink-spinner';

const PROVIDER_COLORS: Record<string, string> = {
  claude: '#FF6600',
  gemini: 'magenta',
  codex: '#4A90D9',
};

export interface ComposerProps {
  onSubmit: (text: string) => void;
  isLoading: boolean;
  placeholder?: string;
  activeProvider?: string;
}

export function Composer({ onSubmit, isLoading, placeholder, activeProvider }: ComposerProps) {
  const [value, setValue] = useState('');

  const handleSubmit = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setValue('');
    onSubmit(trimmed);
  };

  if (isLoading) {
    const providerName = activeProvider ?? 'assistant';
    const dotColor = activeProvider ? (PROVIDER_COLORS[activeProvider] ?? 'cyan') : 'cyan';

    return (
      <Box paddingLeft={2} paddingRight={2} marginTop={1}>
        <Box gap={1}>
          <Text color={dotColor}>
            <Spinner type="dots" />
          </Text>
          <Text dimColor>
            {providerName} is thinking...
          </Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box paddingLeft={2} paddingRight={2} marginTop={1}>
      <Box flexDirection="row" flexGrow={1}>
        <Text color="cyan" bold>{'> '}</Text>
        <Box flexGrow={1}>
          {value.length === 0 ? (
            <TextInput
              value={value}
              onChange={setValue}
              onSubmit={handleSubmit}
              placeholder={placeholder ?? 'Type a message... (/ for commands)'}
              focus={true}
            />
          ) : (
            <TextInput
              value={value}
              onChange={setValue}
              onSubmit={handleSubmit}
              focus={true}
            />
          )}
        </Box>
      </Box>
    </Box>
  );
}
