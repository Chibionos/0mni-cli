import React, { useState } from 'react';
import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';
import Spinner from 'ink-spinner';

export interface ComposerProps {
  onSubmit: (text: string) => void;
  isLoading: boolean;
  placeholder?: string;
}

export function Composer({ onSubmit, isLoading, placeholder }: ComposerProps) {
  const [value, setValue] = useState('');

  const handleSubmit = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setValue('');
    onSubmit(trimmed);
  };

  return (
    <Box
      flexDirection="row"
      borderStyle="single"
      borderTop={true}
      borderBottom={false}
      borderLeft={false}
      borderRight={false}
      paddingLeft={1}
      paddingRight={1}
    >
      {isLoading ? (
        <Box gap={1}>
          <Text color="cyan">
            <Spinner type="dots" />
          </Text>
          <Text dimColor>Thinking...</Text>
        </Box>
      ) : (
        <Box flexDirection="row" flexGrow={1}>
          <Text color="green" bold>{`> `}</Text>
          <Box flexGrow={1}>
            <TextInput
              value={value}
              onChange={setValue}
              onSubmit={handleSubmit}
              placeholder={placeholder ?? 'Ask anything...'}
              focus={!isLoading}
            />
          </Box>
        </Box>
      )}
      <Box marginLeft={2}>
        <Text dimColor>(Ctrl+C to exit)</Text>
      </Box>
    </Box>
  );
}
