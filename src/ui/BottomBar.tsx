import React from 'react';
import { Box, Text } from 'ink';
import { execSync } from 'child_process';

export interface BottomBarProps {
  provider: string;
  model: string;
  autoRoute: boolean;
  isLoading: boolean;
  tokenCount: number;
  costUsd: number;
  yolo: boolean;
}

const PROVIDER_COLORS: Record<string, string> = {
  claude: 'blue',
  gemini: 'green',
  codex: 'yellow',
};

function getGitBranch(): string | null {
  try {
    const branch = execSync('git branch --show-current', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
    return branch || null;
  } catch {
    return null;
  }
}

function formatTokens(count: number): string {
  return count.toLocaleString();
}

function getModeText(provider: string, autoRoute: boolean): string {
  if (autoRoute) return 'auto-routing on';
  return `${provider} mode`;
}

export function BottomBar({
  provider,
  model: _model,
  autoRoute,
  isLoading: _isLoading,
  tokenCount,
  costUsd,
  yolo: _yolo,
}: BottomBarProps) {
  const branch = getGitBranch();
  const dotColor = PROVIDER_COLORS[provider] ?? 'white';
  const modeText = getModeText(provider, autoRoute);

  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderTop={true}
      borderBottom={false}
      borderLeft={false}
      borderRight={false}
      paddingLeft={1}
      paddingRight={1}
    >
      {/* Line 1 */}
      <Box flexDirection="row" justifyContent="space-between">
        <Box gap={1}>
          <Text color="cyan">{'\u2192'}</Text>
          <Text bold>omni</Text>
          {branch && (
            <Text>
              <Text dimColor>git:(</Text>
              <Text color="cyan">{branch}</Text>
              <Text dimColor>)</Text>
            </Text>
          )}
          <Text color={dotColor}>{'\u25CF'}</Text>
          <Text dimColor>{provider}</Text>
        </Box>
        <Box gap={2}>
          <Text dimColor>{formatTokens(tokenCount)} tokens</Text>
          {costUsd > 0 && (
            <Text color="green">${costUsd.toFixed(2)}</Text>
          )}
        </Box>
      </Box>

      {/* Line 2 */}
      <Box flexDirection="row" justifyContent="space-between">
        <Box gap={1}>
          <Text color="yellow">{'\u25B8\u25B8'}</Text>
          <Text>{modeText}</Text>
          <Text dimColor>(/claude /gemini /codex to switch)</Text>
        </Box>
        <Text dimColor>omni v0.1.0</Text>
      </Box>
    </Box>
  );
}
