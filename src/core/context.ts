export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'tool' | 'system';
  content: string;
  provider?: string;
  model?: string;
  toolName?: string;
  timestamp: number;
  isStreaming?: boolean;
}

let idCounter = 0;

export class ConversationContext {
  private messages: Message[] = [];

  private generateId(): string {
    return `ctx-${++idCounter}-${Date.now()}`;
  }

  addUserMessage(content: string): Message {
    const msg: Message = {
      id: this.generateId(),
      role: 'user',
      content,
      timestamp: Date.now(),
    };
    this.messages.push(msg);
    return msg;
  }

  addAssistantMessage(
    content: string,
    provider?: string,
    model?: string,
  ): Message {
    const msg: Message = {
      id: this.generateId(),
      role: 'assistant',
      content,
      provider,
      model,
      timestamp: Date.now(),
    };
    this.messages.push(msg);
    return msg;
  }

  addToolMessage(toolName: string, content: string): Message {
    const msg: Message = {
      id: this.generateId(),
      role: 'tool',
      content,
      toolName,
      timestamp: Date.now(),
    };
    this.messages.push(msg);
    return msg;
  }

  addSystemMessage(content: string): Message {
    const msg: Message = {
      id: this.generateId(),
      role: 'system',
      content,
      timestamp: Date.now(),
    };
    this.messages.push(msg);
    return msg;
  }

  add(msg: Omit<Message, 'id' | 'timestamp'>): Message {
    const full: Message = {
      ...msg,
      id: this.generateId(),
      timestamp: Date.now(),
    };
    this.messages.push(full);
    return full;
  }

  getMessages(): Message[] {
    return [...this.messages];
  }

  getLastMessage(): Message | undefined {
    return this.messages[this.messages.length - 1];
  }

  getMessageById(id: string): Message | undefined {
    return this.messages.find((m) => m.id === id);
  }

  updateMessage(id: string, updates: Partial<Message>): void {
    const idx = this.messages.findIndex((m) => m.id === id);
    if (idx !== -1) {
      this.messages[idx] = { ...this.messages[idx], ...updates };
    }
  }

  clear(): void {
    this.messages = [];
  }

  getTokenEstimate(): number {
    return Math.ceil(
      this.messages.reduce((sum, m) => sum + m.content.length, 0) / 4,
    );
  }
}
