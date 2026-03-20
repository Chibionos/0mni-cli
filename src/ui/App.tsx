import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Box, useInput, useApp } from 'ink';
import { StatusBar } from './StatusBar.js';
import { BottomBar } from './BottomBar.js';
import { MessageList, type MessageItem } from './MessageList.js';
import { Composer } from './Composer.js';
import { WelcomeScreen } from './WelcomeScreen.js';
import { runAgent, killAgent, type OrchestratorCallbacks } from '../core/orchestrator.js';
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

interface UsageStats {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCostUsd: number;
}

let msgIdCounter = 0;
function nextId(): string {
  return `msg-${++msgIdCounter}`;
}

export function App({ initialPrompt, provider, model, autoRoute, yolo }: AppProps) {
  const { exit } = useApp();

  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [currentProvider, setCurrentProvider] = useState<Provider>(
    (provider as Provider) ?? DEFAULT_CONFIG.defaultProvider,
  );
  const [currentModel, setCurrentModel] = useState<string>(
    model ?? DEFAULT_CONFIG.models[(provider as Provider) ?? DEFAULT_CONFIG.defaultProvider],
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isAutoRoute, setIsAutoRoute] = useState(autoRoute ?? DEFAULT_CONFIG.autoRoute);
  const isYolo = yolo ?? DEFAULT_CONFIG.yolo;
  const [sessionStartTime] = useState(() => Date.now());
  const [availableProviders] = useState(() => getAvailableProviders());
  const [usage, setUsage] = useState<UsageStats>({
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalCostUsd: 0,
  });

  const contextRef = useRef(new ConversationContext());
  const streamingIdRef = useRef<string | null>(null);

  // ---- helpers ----

  const addMessage = useCallback((msg: Omit<MessageItem, 'id'>): string => {
    const id = nextId();
    setMessages((prev) => [...prev, { ...msg, id }]);
    return id;
  }, []);

  const updateMessage = useCallback((id: string, updater: (msg: MessageItem) => MessageItem) => {
    setMessages((prev) => prev.map((m) => (m.id === id ? updater(m) : m)));
  }, []);

  // ---- helper to stop running agent ----

  const stopAgent = useCallback(() => {
    killAgent();
    if (streamingIdRef.current) {
      updateMessage(streamingIdRef.current, (m) => ({
        ...m,
        content: m.content + '\n\n[Stopped]',
        isStreaming: false,
      }));
      streamingIdRef.current = null;
    }
    setIsLoading(false);
  }, [updateMessage]);

  // ---- Ctrl+C / Escape: kill agent or exit ----

  useInput((_input, key) => {
    if (key.ctrl && _input === 'c') {
      if (isLoading) {
        stopAgent();
      } else {
        exit();
      }
    }

    if (key.escape && isLoading) {
      stopAgent();
    }
  });

  // ---- send prompt to CLI agent subprocess ----

  const sendToAgent = useCallback(
    async (prompt: string) => {
      setIsLoading(true);

      let activeProvider = currentProvider;
      let activeModel = currentModel;

      if (isAutoRoute) {
        const route = routePrompt(prompt);
        activeProvider = route.provider;
        activeModel = DEFAULT_CONFIG.models[route.provider];
      }

      addMessage({ role: 'user', content: prompt });

      const assistantId = addMessage({
        role: 'assistant',
        content: '',
        provider: activeProvider,
        isStreaming: true,
      });
      streamingIdRef.current = assistantId;

      const callbacks: OrchestratorCallbacks = {
        onInit: (modelName) => {
          setCurrentModel(modelName);
        },
        onText: (text) => {
          updateMessage(assistantId, (m) => ({
            ...m,
            content: m.content + text,
          }));
        },
        onToolCall: (name) => {
          addMessage({
            role: 'tool',
            content: `Calling ${name}...`,
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
        onThinking: () => {
          updateMessage(assistantId, (m) => ({
            ...m,
            isStreaming: true,
          }));
        },
        onFinish: (u) => {
          updateMessage(assistantId, (m) => ({
            ...m,
            isStreaming: false,
          }));
          streamingIdRef.current = null;
          setIsLoading(false);
          if (u) {
            setUsage((prev) => ({
              totalInputTokens: prev.totalInputTokens + (u.inputTokens ?? 0),
              totalOutputTokens: prev.totalOutputTokens + (u.outputTokens ?? 0),
              totalCostUsd: prev.totalCostUsd + (u.costUsd ?? 0),
            }));
          }
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
      };

      try {
        await runAgent(prompt, {
          provider: activeProvider,
          model: activeModel,
          context: contextRef.current,
          yolo: isYolo,
          callbacks,
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
    [currentProvider, currentModel, isAutoRoute, isYolo, addMessage, updateMessage],
  );

  // ---- slash commands ----

  const handleSlashCommand = useCallback(
    (text: string): boolean => {
      const parts = text.split(/\s+/);
      const cmd = parts[0]?.toLowerCase();

      switch (cmd) {
        case '/claude':
          setCurrentProvider('claude');
          setCurrentModel(DEFAULT_CONFIG.models.claude);
          addMessage({ role: 'assistant', content: 'Switched to Claude CLI.', provider: 'system' });
          return true;

        case '/gemini':
          setCurrentProvider('gemini');
          setCurrentModel(DEFAULT_CONFIG.models.gemini);
          addMessage({ role: 'assistant', content: 'Switched to Gemini CLI.', provider: 'system' });
          return true;

        case '/codex':
          setCurrentProvider('codex');
          setCurrentModel(DEFAULT_CONFIG.models.codex);
          addMessage({ role: 'assistant', content: 'Switched to Codex CLI.', provider: 'system' });
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
            const allModels = PROVIDER_MODELS[currentProvider] ?? [];
            addMessage({
              role: 'assistant',
              content: `Current: ${currentModel}\nAvailable for ${currentProvider}: ${allModels.join(', ')}`,
              provider: 'system',
            });
          } else {
            setCurrentModel(modelArg);
            addMessage({
              role: 'assistant',
              content: `Model set to ${modelArg}. Will be passed to ${currentProvider} CLI via -m flag.`,
              provider: 'system',
            });
          }
          return true;
        }

        case '/clear':
          setMessages([]);
          contextRef.current.clear();
          setUsage({ totalInputTokens: 0, totalOutputTokens: 0, totalCostUsd: 0 });
          addMessage({ role: 'assistant', content: 'Conversation cleared.', provider: 'system' });
          return true;

        case '/cost': {
          const costDisplay = usage.totalCostUsd > 0
            ? `$${usage.totalCostUsd.toFixed(4)}`
            : 'N/A';
          addMessage({
            role: 'assistant',
            content: [
              'Session Usage:',
              `  Input tokens:  ${usage.totalInputTokens.toLocaleString()}`,
              `  Output tokens: ${usage.totalOutputTokens.toLocaleString()}`,
              `  Estimated cost: ${costDisplay}`,
            ].join('\n'),
            provider: 'system',
          });
          return true;
        }

        case '/help':
          addMessage({
            role: 'assistant',
            content: [
              'Available commands:',
              '  /claude    - Switch to Claude CLI',
              '  /gemini    - Switch to Gemini CLI',
              '  /codex     - Switch to Codex CLI',
              '  /auto      - Toggle auto-routing',
              '  /model [n] - Show or set model',
              '  /cost      - Show accumulated tokens/cost',
              '  /clear     - Clear conversation',
              '  /help      - Show this help',
              '',
              'Keyboard:',
              '  Ctrl+C     - Stop running agent / Exit',
              '  Escape     - Stop running agent',
              '  Enter      - Submit prompt',
            ].join('\n'),
            provider: 'system',
          });
          return true;

        default:
          return false;
      }
    },
    [currentProvider, currentModel, isAutoRoute, usage, addMessage],
  );

  // ---- submit handler ----

  const handleSubmit = useCallback(
    (text: string) => {
      if (text.startsWith('/')) {
        if (handleSlashCommand(text)) return;
      }
      sendToAgent(text);
    },
    [handleSlashCommand, sendToAgent],
  );

  // Kill the active CLI subprocess on unmount
  useEffect(() => {
    return () => {
      killAgent();
    };
  }, []);

  // Handle initial prompt
  useEffect(() => {
    if (initialPrompt) {
      handleSubmit(initialPrompt);
    }
  }, []);

  // Show welcome screen if no CLI providers are installed
  if (availableProviders.length === 0) {
    return <WelcomeScreen availableProviders={availableProviders} />;
  }

  return (
    <Box flexDirection="column" minHeight={process.stdout.rows || 24}>
      <StatusBar sessionStartTime={sessionStartTime} />
      <Box flexGrow={1} flexDirection="column" paddingX={1}>
        <MessageList messages={messages} />
      </Box>
      <Composer
        onSubmit={handleSubmit}
        isLoading={isLoading}
        placeholder={
          isAutoRoute
            ? 'Ask anything (auto-routing)...'
            : `Ask ${currentProvider}...`
        }
      />
      <BottomBar
        provider={currentProvider}
        model={currentModel}
        autoRoute={isAutoRoute}
        isLoading={isLoading}
        tokenCount={usage.totalInputTokens + usage.totalOutputTokens}
        costUsd={usage.totalCostUsd}
        yolo={isYolo}
      />
    </Box>
  );
}
