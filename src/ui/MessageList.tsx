import React from 'react';
import { Static, Box } from 'ink';
import { Message } from './Message.js';

export interface MessageItem {
  id: string;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  provider?: string;
  toolName?: string;
  toolArgs?: Record<string, unknown>;
  isStreaming?: boolean;
}

export interface MessageListProps {
  messages: MessageItem[];
}

export function MessageList({ messages }: MessageListProps) {
  // Split: completed messages use <Static> (scroll up, not re-rendered)
  // The last streaming message renders live below
  const lastMsg = messages[messages.length - 1];
  const isLastStreaming = lastMsg?.isStreaming;

  const staticMessages = isLastStreaming ? messages.slice(0, -1) : messages;
  const liveMessage = isLastStreaming ? lastMsg : null;

  return (
    <Box flexDirection="column" paddingX={2}>
      <Static items={staticMessages}>
        {(msg) => (
          <Box key={msg.id} flexDirection="column">
            {msg.role === 'user' && <Box marginTop={1} />}
            <Message
              role={msg.role}
              content={msg.content}
              provider={msg.provider}
              toolName={msg.toolName}
              toolArgs={msg.toolArgs}
              isStreaming={false}
            />
          </Box>
        )}
      </Static>
      {liveMessage && (
        <Message
          role={liveMessage.role}
          content={liveMessage.content}
          provider={liveMessage.provider}
          toolName={liveMessage.toolName}
          toolArgs={liveMessage.toolArgs}
          isStreaming={true}
        />
      )}
    </Box>
  );
}
