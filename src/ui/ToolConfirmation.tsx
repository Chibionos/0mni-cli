import React from 'react';
import { Box, Text, useInput } from 'ink';

export interface ToolConfirmationProps {
  toolName: string;
  args: Record<string, unknown>;
  onConfirm: () => void;
  onDeny: () => void;
}

export function ToolConfirmation({ toolName, args, onConfirm, onDeny }: ToolConfirmationProps) {
  useInput((input) => {
    if (input === 'y' || input === 'Y') {
      onConfirm();
    } else if (input === 'n' || input === 'N') {
      onDeny();
    }
  });

  const argsDisplay = Object.entries(args)
    .map(([key, val]) => {
      const strVal = typeof val === 'string' ? val : JSON.stringify(val);
      const truncated = strVal.length > 80 ? strVal.slice(0, 80) + '...' : strVal;
      return `  ${key}: ${truncated}`;
    })
    .join('\n');

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="yellow"
      paddingX={1}
      paddingY={0}
      marginX={1}
    >
      <Text bold color="yellow">Tool Approval Required</Text>
      <Box marginTop={1} flexDirection="column">
        <Text>
          <Text bold>{toolName}</Text> wants to execute:
        </Text>
        <Box marginLeft={1} marginTop={1}>
          <Text dimColor>{argsDisplay}</Text>
        </Box>
      </Box>
      <Box marginTop={1}>
        <Text>
          Allow? (<Text bold color="green">y</Text>/<Text bold color="red">n</Text>)
        </Text>
      </Box>
    </Box>
  );
}
