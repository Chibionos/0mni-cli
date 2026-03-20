import { streamText, type ToolSet } from 'ai';
import type { Provider } from '../config/defaults.js';
import { getModel } from './providers.js';
import type { ConversationContext } from './context.js';

export interface OrchestratorOptions {
  provider: Provider;
  model?: string;
  tools: ToolSet;
  context: ConversationContext;
  maxSteps?: number;
  onText?: (text: string) => void;
  onToolCall?: (name: string, args: unknown) => void;
  onToolResult?: (name: string, result: string) => void;
  onFinish?: (usage: unknown) => void;
  onError?: (error: Error) => void;
}

export async function runAgent(
  prompt: string,
  options: OrchestratorOptions,
): Promise<string> {
  const {
    provider,
    model,
    tools,
    context,
    maxSteps = 25,
    onText,
    onToolCall,
    onToolResult,
    onFinish,
    onError,
  } = options;

  context.addUserMessage(prompt);

  try {
    const result = streamText({
      model: getModel(provider, model),
      tools,
      maxSteps,
      messages: context.toAIMessages(),
    });

    let fullText = '';

    for await (const part of result.fullStream) {
      // Cast to access type discriminator -- ToolSet's generic resolution
      // collapses tool-result out of the union, but it still appears at runtime.
      const chunk = part as { type: string; [k: string]: unknown };

      switch (chunk.type) {
        case 'text-delta':
          fullText += chunk.textDelta as string;
          onText?.(chunk.textDelta as string);
          break;

        case 'tool-call':
          onToolCall?.(chunk.toolName as string, chunk.args);
          break;

        case 'tool-result':
          onToolResult?.(chunk.toolName as string, String(chunk.result));
          break;

        case 'finish':
          onFinish?.(chunk.usage);
          break;

        case 'error':
          onError?.(
            chunk.error instanceof Error
              ? chunk.error
              : new Error(String(chunk.error)),
          );
          break;
      }
    }

    const modelName = model ?? provider;
    context.addAssistantMessage(fullText, provider, modelName);

    return fullText;
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    onError?.(error);
    throw error;
  }
}
