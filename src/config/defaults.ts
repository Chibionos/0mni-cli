export const DEFAULT_CONFIG = {
  defaultProvider: 'claude' as const,
  autoRoute: false,
  yolo: false,
  models: {
    claude: 'claude-sonnet-4-6',
    gemini: 'gemini-2.5-flash',
    openai: 'gpt-4.1',
  },
  maxSteps: 25,
  skillsDirs: ['.0mni/skills', '~/.config/0mni/skills'],
};

export type Provider = 'claude' | 'gemini' | 'openai';
export type Config = typeof DEFAULT_CONFIG;
