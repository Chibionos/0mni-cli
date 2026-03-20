export interface StreamCallbacks {
  onText: (text: string) => void;
  onToolCall: (name: string, args: Record<string, unknown>) => void;
  onToolResult: (name: string, result: string) => void;
  onFinish: (usage?: {
    promptTokens: number;
    completionTokens: number;
  }) => void;
  onError: (error: Error) => void;
}
