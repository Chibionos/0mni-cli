import React, { useState } from 'react';
import { Box, Text } from 'ink';
import { execSync } from 'child_process';

export interface BottomBarProps {
  provider: string;
  model: string;
  autoRoute: boolean;
  isLoading: boolean;
  tokenCount: number;
  yolo: boolean;
}

const PROVIDER_COLORS: Record<string, string> = {
  claude: '#FF6600',
  gemini: 'magenta',
  codex: '#4A90D9',
};

function getGitBranch(): string | null {
  try {
    return execSync('git branch --show-current', {
      encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'], timeout: 3000,
    }).trim() || null;
  } catch { return null; }
}

function formatTokens(count: number): string {
  if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
  return String(count);
}

export function BottomBar({
  provider, autoRoute, isLoading, tokenCount,
}: BottomBarProps) {
  const [branch] = useState(() => getGitBranch());
  const color = PROVIDER_COLORS[provider] ?? 'white';
  const mode = autoRoute ? (isLoading ? 'auto-routing' : 'auto') : provider;

  return (
    <Box justifyContent="space-between" paddingX={1} overflow="hidden">
      <Box gap={1}>
        <Text color="cyan">{'\u2192'}</Text>
        <Text bold>omni</Text>
        {branch && <Text dimColor>({branch})</Text>}
        <Text color={color}>{'\u25CF'} {provider}</Text>
        <Text dimColor>{mode}</Text>
        <Text dimColor>{isLoading ? '(x to stop)' : ''}</Text>
      </Box>
      <Text dimColor>{formatTokens(tokenCount)} tokens</Text>
    </Box>
  );
}
