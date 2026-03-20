import React from 'react';
import { Box, Text } from 'ink';

export interface WelcomeScreenProps {
  availableProviders: string[];
}

const ASCII_ART = `
  ___                  _
 / _ \\ _ __ ___  _ __ (_)
| | | | '_ \` _ \\| '_ \\| |
| |_| | | | | | | | | | |
 \\___/|_| |_| |_|_| |_|_|
`;

const ALL_PROVIDERS: { name: string; cli: string }[] = [
  { name: 'claude', cli: 'claude' },
  { name: 'gemini', cli: 'gemini' },
  { name: 'codex', cli: 'codex' },
];

export function WelcomeScreen({ availableProviders }: WelcomeScreenProps) {
  const available = new Set(availableProviders);

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1}>
      <Text bold color="cyan">{ASCII_ART}</Text>

      <Text bold>Welcome to 0mni - Multi-Agent Coding CLI</Text>
      <Text dimColor>Combine Claude, Gemini, and Codex in one terminal.</Text>

      <Box flexDirection="column" marginTop={1}>
        <Text bold>Provider Status:</Text>
        {ALL_PROVIDERS.map(({ name, cli }) => {
          const isConfigured = available.has(name);
          return (
            <Box key={name} marginLeft={2}>
              <Text color={isConfigured ? 'green' : 'red'}>
                {isConfigured ? '\u2714' : '\u2718'}
              </Text>
              <Text> {name}</Text>
              {!isConfigured && (
                <Text dimColor> (install the {cli} CLI)</Text>
              )}
            </Box>
          );
        })}
      </Box>

      <Box flexDirection="column" marginTop={1}>
        <Text bold>Quick Setup:</Text>
        <Box marginLeft={2} flexDirection="column">
          <Text dimColor>npm install -g @anthropic-ai/claude-code  # claude CLI</Text>
          <Text dimColor>npm install -g @anthropic-ai/gemini-cli   # gemini CLI</Text>
          <Text dimColor>npm install -g @openai/codex               # codex CLI</Text>
        </Box>
      </Box>

      <Box marginTop={1}>
        <Text dimColor>Install and authenticate at least one CLI, then restart 0mni.</Text>
      </Box>
    </Box>
  );
}
