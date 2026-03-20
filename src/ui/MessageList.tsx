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
    <Box flexDirection="column" paddingLeft={1} paddingRight={1}>
      {messages.map((msg) => (
        <Message
          key={msg.id}
          role={msg.role}
          content={msg.content}
          provider={msg.provider}
          toolName={msg.toolName}
          isStreaming={msg.isStreaming}
        />
      ))}
    </Box>
  );
}
