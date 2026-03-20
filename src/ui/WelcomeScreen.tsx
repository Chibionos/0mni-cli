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

const ALL_PROVIDERS: { name: string; envVars: string }[] = [
  { name: 'claude', envVars: 'ANTHROPIC_API_KEY' },
  { name: 'gemini', envVars: 'GEMINI_API_KEY or GOOGLE_API_KEY' },
  { name: 'openai', envVars: 'OPENAI_API_KEY' },
];

export function WelcomeScreen({ availableProviders }: WelcomeScreenProps) {
  const available = new Set(availableProviders);

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1}>
      <Text bold color="cyan">{ASCII_ART}</Text>

      <Text bold>Welcome to 0mni - Multi-Agent Coding CLI</Text>
      <Text dimColor>Combine Claude, Gemini, and OpenAI in one terminal.</Text>

      <Box flexDirection="column" marginTop={1}>
        <Text bold>Provider Status:</Text>
        {ALL_PROVIDERS.map(({ name, envVars }) => {
          const isConfigured = available.has(name);
          return (
            <Box key={name} marginLeft={2}>
              <Text color={isConfigured ? 'green' : 'red'}>
                {isConfigured ? '\u2714' : '\u2718'}
              </Text>
              <Text> {name}</Text>
              {!isConfigured && (
                <Text dimColor> (set {envVars})</Text>
              )}
            </Box>
          );
        })}
      </Box>

      <Box flexDirection="column" marginTop={1}>
        <Text bold>Quick Setup:</Text>
        <Box marginLeft={2} flexDirection="column">
          <Text dimColor>export ANTHROPIC_API_KEY=sk-ant-...</Text>
          <Text dimColor>export GEMINI_API_KEY=AI...</Text>
          <Text dimColor>export OPENAI_API_KEY=sk-...</Text>
        </Box>
      </Box>

      <Box marginTop={1}>
        <Text dimColor>Configure at least one provider, then restart 0mni.</Text>
      </Box>
    </Box>
  );
}
