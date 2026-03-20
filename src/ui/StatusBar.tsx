import React from 'react';
import { Box, Text } from 'ink';

export interface StatusBarProps {
  provider: string;
  model: string;
  cwd: string;
  tokenCount?: number;
  autoRoute?: boolean;
}

const PROVIDER_COLORS: Record<string, string> = {
  claude: 'blue',
  gemini: 'green',
  codex: 'yellow',
};

function abbreviatePath(fullPath: string): string {
  const home = process.env['HOME'] ?? '';
  if (home && fullPath.startsWith(home)) {
    return '~' + fullPath.slice(home.length);
  }
  return fullPath;
}

export function StatusBar({ provider, model, cwd, tokenCount, autoRoute }: StatusBarProps) {
  const displayPath = abbreviatePath(cwd);
  const dotColor = PROVIDER_COLORS[provider] ?? 'white';

  return (
    <Box
      flexDirection="row"
      justifyContent="space-between"
      borderStyle="single"
      borderBottom={true}
      borderTop={false}
      borderLeft={false}
      borderRight={false}
      paddingLeft={1}
      paddingRight={1}
    >
      <Box gap={2}>
        <Text bold color="cyan">0mni</Text>
        <Box gap={1}>
          <Text color={dotColor}>{'\u25CF'}</Text>
          <Text dimColor>
            {provider} · {model}
          </Text>
        </Box>
        {autoRoute && (
          <Text color="magenta">[auto]</Text>
        )}
      </Box>
      <Box gap={2}>
        <Text dimColor>{displayPath}</Text>
        {tokenCount !== undefined && tokenCount > 0 && (
          <Text dimColor>~{tokenCount.toLocaleString()} tokens</Text>
        )}
      </Box>
    </Box>
  );
}
