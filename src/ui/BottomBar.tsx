import React from 'react';
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

// Context window limits per provider
const CONTEXT_LIMITS: Record<string, number> = {
  claude: 200000,
  gemini: 1000000,
  codex: 200000,
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
  if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
  return String(count);
}

function getModeText(provider: string, autoRoute: boolean, isLoading: boolean): string {
  if (autoRoute) return isLoading ? 'auto-routing' : 'auto';
  return provider;
}

// Renders a tiny context bar like: [▓▓▓▓░░░░░░] 15%
function ContextBar({ tokens, provider }: { tokens: number; provider: string }) {
  const limit = CONTEXT_LIMITS[provider] ?? 200000;
  const ratio = Math.min(tokens / limit, 1);
  const pct = Math.round(ratio * 100);
  const barWidth = 10;
  const filled = Math.round(ratio * barWidth);
  const empty = barWidth - filled;

  const color = pct < 50 ? 'green' : pct < 80 ? 'yellow' : 'red';

  return (
    <Box gap={1}>
      <Text dimColor>ctx</Text>
      <Text>
        <Text color={color}>{'\u2593'.repeat(filled)}</Text>
        <Text dimColor>{'\u2591'.repeat(empty)}</Text>
      </Text>
      <Text dimColor>{pct}%</Text>
    </Box>
  );
}

export function BottomBar({
  provider,
  model: _model,
  autoRoute,
  isLoading,
  tokenCount,
  yolo: _yolo,
}: BottomBarProps) {
  const branch = getGitBranch();
  const dotColor = PROVIDER_COLORS[provider] ?? 'white';
  const modeText = getModeText(provider, autoRoute, isLoading);

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
          <Text color={dotColor} bold>{provider}</Text>
        </Box>
        <Box gap={2}>
          <Text dimColor>{formatTokens(tokenCount)} tokens</Text>
          <ContextBar tokens={tokenCount} provider={provider} />
        </Box>
      </Box>

      {/* Line 2 */}
      <Box flexDirection="row" justifyContent="space-between">
        <Box gap={1}>
          <Text color={dotColor}>{'\u25B8\u25B8'}</Text>
          <Text>{modeText}</Text>
          <Text dimColor>{isLoading ? '(x to stop)' : '(/cc /ge /co)'}</Text>
        </Box>
        <Text dimColor>omni v0.1.0</Text>
      </Box>
    </Box>
  );
}
