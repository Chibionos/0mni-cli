import React from 'react';
import { Box } from 'ink';
import { Message } from './Message.js';

export interface MessageItem {
  id: string;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  provider?: string;
  toolName?: string;
  isStreaming?: boolean;
}

export interface MessageListProps {
  messages: MessageItem[];
}

export function MessageList({ messages }: MessageListProps) {
  return (
    <Box flexDirection="column" paddingX={2}>
      {messages.map((msg, idx) => {
        // Add a blank spacer line before user messages (except the very first message)
        const needsSpacer = msg.role === 'user' && idx > 0;

        return (
          <Box key={msg.id} flexDirection="column">
            {needsSpacer && <Box marginBottom={1} />}
            <Message
              role={msg.role}
              content={msg.content}
              provider={msg.provider}
              toolName={msg.toolName}
              isStreaming={msg.isStreaming}
            />
          </Box>
        );
      })}
    </Box>
  );
}
