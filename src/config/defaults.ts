export const DEFAULT_CONFIG = {
  defaultProvider: 'claude' as const,
  autoRoute: true,
  yolo: false,
  models: {
    claude: 'sonnet',
    gemini: 'gemini-2.5-flash',
    codex: 'o3-mini',
  },
  maxSteps: 25,
  skillsDirs: ['.0mni/skills', '~/.config/0mni/skills'],
};

export type Provider = 'claude' | 'gemini' | 'codex';
export type Config = typeof DEFAULT_CONFIG;
