import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';

export interface StatusBarProps {
  sessionStartTime: number;
}

function formatElapsed(startTime: number): string {
  const seconds = Math.floor((Date.now() - startTime) / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (minutes < 60) return `${minutes}m ${secs}s`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins}m`;
}

export function StatusBar({ sessionStartTime }: StatusBarProps) {
  const [elapsed, setElapsed] = useState(() => formatElapsed(sessionStartTime));

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(formatElapsed(sessionStartTime));
    }, 1000);
    return () => clearInterval(interval);
  }, [sessionStartTime]);

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
      <Text bold color="cyan">omni</Text>
      <Text dimColor>Cooked for {elapsed}</Text>
    </Box>
  );
}
