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
      this.messages.reduce((sum, m) => sum + (m.content?.length ?? 0), 0) / 4,
    );
  }

  /**
   * Build a context summary for handoff between providers.
   * Includes recent conversation so the new provider has context.
   */
  summarizeForHandoff(): string {
    const msgs = this.messages.filter(m => m.role === 'user' || m.role === 'assistant');
    if (msgs.length === 0) return '';

    // Take last 10 exchanges max to stay within token limits
    const recent = msgs.slice(-10);
    const lines = recent.map(m => {
      const prefix = m.role === 'user' ? 'User' : `Assistant (${m.provider ?? 'unknown'})`;
      const text = m.content.length > 300 ? m.content.slice(0, 300) + '...' : m.content;
      return `${prefix}: ${text}`;
    });

    return [
      'Here is the conversation so far (you are continuing from another AI assistant):',
      '',
      ...lines,
      '',
      'Continue the conversation naturally. The user just switched to you.',
    ].join('\n');
  }

  hasMessages(): boolean {
    return this.messages.length > 0;
  }
}
