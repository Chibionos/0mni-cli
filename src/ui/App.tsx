import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Box } from 'ink';
import { StatusBar } from './StatusBar.js';
import { MessageList, type MessageItem } from './MessageList.js';
import { Composer } from './Composer.js';
import { ToolConfirmation } from './ToolConfirmation.js';
import { WelcomeScreen } from './WelcomeScreen.js';
import { runAgent } from '../core/orchestrator.js';
import { getAllTools, DANGEROUS_TOOLS } from '../tools/registry.js';
import { PROVIDER_MODELS } from '../core/providers.js';
import { ConversationContext } from '../core/context.js';
import { routePrompt } from '../core/router.js';
import { getAvailableProviders } from '../config/auth.js';
import { DEFAULT_CONFIG, type Provider } from '../config/defaults.js';

export interface AppProps {
  initialPrompt?: string;
  provider?: string;
  model?: string;
  autoRoute?: boolean;
  yolo?: boolean;
}

interface PendingConfirmation {
  toolName: string;
  args: Record<string, unknown>;
  resolve: (allowed: boolean) => void;
}

let msgIdCounter = 0;
function nextId(): string {
  return `msg-${++msgIdCounter}`;
}

export function App({ initialPrompt, provider, model, autoRoute, yolo }: AppProps) {
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [currentProvider, setCurrentProvider] = useState<Provider>(
    (provider as Provider) ?? DEFAULT_CONFIG.defaultProvider,
  );
  const [currentModel, setCurrentModel] = useState<string>(
    model ?? DEFAULT_CONFIG.models[(provider as Provider) ?? DEFAULT_CONFIG.defaultProvider],
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isAutoRoute, setIsAutoRoute] = useState(autoRoute ?? DEFAULT_CONFIG.autoRoute);
  // yolo mode: auto-approve all tool calls without confirmation
  const isYolo = yolo ?? DEFAULT_CONFIG.yolo;
  const [pendingConfirmation, setPendingConfirmation] = useState<PendingConfirmation | null>(null);
  const [cwd] = useState(process.cwd());
  const [availableProviders] = useState(() => getAvailableProviders());

  const contextRef = useRef(new ConversationContext());
  const streamingIdRef = useRef<string | null>(null);

  const addMessage = useCallback((msg: Omit<MessageItem, 'id'>): string => {
    const id = nextId();
    setMessages((prev) => [...prev, { ...msg, id }]);
    return id;
  }, []);

  const updateMessage = useCallback((id: string, updater: (msg: MessageItem) => MessageItem) => {
    setMessages((prev) => prev.map((m) => (m.id === id ? updater(m) : m)));
  }, []);

  const sendToAgent = useCallback(
    async (prompt: string) => {
      setIsLoading(true);

      // Determine provider
      let activeProvider = currentProvider;
      let activeModel = currentModel;

      if (isAutoRoute) {
        const route = routePrompt(prompt);
        activeProvider = route.provider;
        activeModel = DEFAULT_CONFIG.models[route.provider];
      }

      // Add user message to display
      addMessage({ role: 'user', content: prompt });

      // Create streaming assistant message
      const assistantId = addMessage({
        role: 'assistant',
        content: '',
        provider: activeProvider,
        isStreaming: true,
      });
      streamingIdRef.current = assistantId;

      const tools = getAllTools();

      try {
        await runAgent(prompt, {
          provider: activeProvider,
          model: activeModel,
          tools,
          context: contextRef.current,
          onText: (text) => {
            updateMessage(assistantId, (m) => ({
              ...m,
              content: m.content + text,
            }));
          },
          onToolCall: (name) => {
            const isDangerous = DANGEROUS_TOOLS.includes(name as typeof DANGEROUS_TOOLS[number]);
            addMessage({
              role: 'tool',
              content: isDangerous && !isYolo ? `Calling ${name} (requires approval)...` : `Calling ${name}...`,
              toolName: name,
            });
          },
          onToolResult: (name, result) => {
            addMessage({
              role: 'tool',
              content: result,
              toolName: name,
            });
          },
          onFinish: () => {
            updateMessage(assistantId, (m) => ({
              ...m,
              isStreaming: false,
            }));
            streamingIdRef.current = null;
            setIsLoading(false);
          },
          onError: (error) => {
            updateMessage(assistantId, (m) => ({
              ...m,
              content: m.content || `Error: ${error.message}`,
              isStreaming: false,
            }));
            streamingIdRef.current = null;
            setIsLoading(false);
          },
        });
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        updateMessage(assistantId, (m) => ({
          ...m,
          content: m.content || `Error: ${errorMsg}`,
          isStreaming: false,
        }));
        streamingIdRef.current = null;
        setIsLoading(false);
      }
    },
    [currentProvider, currentModel, isAutoRoute, addMessage, updateMessage],
  );

  const handleSlashCommand = useCallback(
    (text: string): boolean => {
      const parts = text.split(/\s+/);
      const cmd = parts[0]?.toLowerCase();

      switch (cmd) {
        case '/claude':
          setCurrentProvider('claude');
          setCurrentModel(DEFAULT_CONFIG.models.claude);
          addMessage({ role: 'assistant', content: 'Switched to Claude.', provider: 'system' });
          return true;

        case '/gemini':
          setCurrentProvider('gemini');
          setCurrentModel(DEFAULT_CONFIG.models.gemini);
          addMessage({ role: 'assistant', content: 'Switched to Gemini.', provider: 'system' });
          return true;

        case '/codex':
        case '/openai':
          setCurrentProvider('openai');
          setCurrentModel(DEFAULT_CONFIG.models.openai);
          addMessage({ role: 'assistant', content: 'Switched to OpenAI.', provider: 'system' });
          return true;

        case '/auto':
          setIsAutoRoute((prev) => !prev);
          addMessage({
            role: 'assistant',
            content: `Auto-routing ${!isAutoRoute ? 'enabled' : 'disabled'}.`,
            provider: 'system',
          });
          return true;

        case '/model': {
          const modelArg = parts[1];
          if (!modelArg) {
            const allModels = PROVIDER_MODELS[currentProvider];
            addMessage({
              role: 'assistant',
              content: `Current: ${currentModel}\nAvailable for ${currentProvider}: ${allModels.join(', ')}`,
              provider: 'system',
            });
          } else {
            setCurrentModel(modelArg);
            addMessage({
              role: 'assistant',
              content: `Model set to ${modelArg}.`,
              provider: 'system',
            });
          }
          return true;
        }

        case '/clear':
          setMessages([]);
          contextRef.current.clear();
          addMessage({ role: 'assistant', content: 'Conversation cleared.', provider: 'system' });
          return true;

        case '/help':
          addMessage({
            role: 'assistant',
            content: [
              'Available commands:',
              '  /claude    - Switch to Claude',
              '  /gemini    - Switch to Gemini',
              '  /openai    - Switch to OpenAI',
              '  /auto      - Toggle auto-routing',
              '  /model [n] - Show or set model',
              '  /clear     - Clear conversation',
              '  /help      - Show this help',
            ].join('\n'),
            provider: 'system',
          });
          return true;

        default:
          return false;
      }
    },
    [currentProvider, currentModel, isAutoRoute, addMessage],
  );

  const handleSubmit = useCallback(
    (text: string) => {
      if (text.startsWith('/')) {
        if (handleSlashCommand(text)) return;
      }
      sendToAgent(text);
    },
    [handleSlashCommand, sendToAgent],
  );

  const handleConfirm = useCallback(() => {
    if (pendingConfirmation) {
      pendingConfirmation.resolve(true);
      setPendingConfirmation(null);
    }
  }, [pendingConfirmation]);

  const handleDeny = useCallback(() => {
    if (pendingConfirmation) {
      pendingConfirmation.resolve(false);
      setPendingConfirmation(null);
    }
  }, [pendingConfirmation]);

  // Handle initial prompt
  useEffect(() => {
    if (initialPrompt) {
      handleSubmit(initialPrompt);
    }
  }, []);

  // Show welcome screen if no providers are configured
  if (availableProviders.length === 0) {
    return <WelcomeScreen availableProviders={availableProviders} />;
  }

  const tokenCount = contextRef.current.getTokenEstimate();

  return (
    <Box flexDirection="column" height="100%">
      <StatusBar
        provider={currentProvider}
        model={currentModel}
        cwd={cwd}
        tokenCount={tokenCount}
      />
      <Box flexGrow={1} flexDirection="column" overflow="hidden">
        <MessageList messages={messages} />
      </Box>
      {pendingConfirmation && (
        <ToolConfirmation
          toolName={pendingConfirmation.toolName}
          args={pendingConfirmation.args}
          onConfirm={handleConfirm}
          onDeny={handleDeny}
        />
      )}
      <Composer
        onSubmit={handleSubmit}
        isLoading={isLoading}
        placeholder={isAutoRoute ? 'Ask anything (auto-routing)...' : `Ask ${currentProvider}...`}
      />
    </Box>
  );
}
