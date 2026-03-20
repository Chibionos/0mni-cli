import type { CoreMessage } from 'ai';

export interface Message {
  role: 'user' | 'assistant' | 'tool';
  content: string;
  provider?: string;
  model?: string;
  timestamp: number;
  toolName?: string;
  toolCallId?: string;
}

export class ConversationContext {
  messages: Message[] = [];

  addUserMessage(content: string): void {
    this.messages.push({
      role: 'user',
      content,
      timestamp: Date.now(),
    });
  }

  addAssistantMessage(
    content: string,
    provider: string,
    model: string,
  ): void {
    this.messages.push({
      role: 'assistant',
      content,
      provider,
      model,
      timestamp: Date.now(),
    });
  }

  addToolResult(toolName: string, result: string, callId: string): void {
    this.messages.push({
      role: 'tool',
      content: result,
      toolName,
      toolCallId: callId,
      timestamp: Date.now(),
    });
  }

  getMessages(): Message[] {
    return [...this.messages];
  }

  clear(): void {
    this.messages = [];
  }

  getTokenEstimate(): number {
    return Math.ceil(
      this.messages.reduce((sum, m) => sum + m.content.length, 0) / 4,
    );
  }

  toAIMessages(): CoreMessage[] {
    return this.messages.map((m): CoreMessage => {
      if (m.role === 'tool') {
        return {
          role: 'tool',
          content: [
            {
              type: 'tool-result',
              toolCallId: m.toolCallId ?? '',
              toolName: m.toolName ?? '',
              result: m.content,
            },
          ],
        };
      }
      return { role: m.role, content: m.content };
    });
  }
}
