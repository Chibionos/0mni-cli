import type { Provider } from '../config/defaults.js';

export type TaskType =
  | 'complex_reasoning'
  | 'code_generation'
  | 'code_review'
  | 'search'
  | 'multimodal'
  | 'refactor'
  | 'simple_qa';

interface PatternRule {
  patterns: RegExp[];
  taskType: TaskType;
}

const TASK_RULES: PatternRule[] = [
  {
    taskType: 'search',
    patterns: [
      /\b(search|find|look\s*up|grep|locate|where\s+is)\b/i,
    ],
  },
  {
    taskType: 'code_review',
    patterns: [
      /\b(review|check|audit|inspect|analyze|lint)\b/i,
    ],
  },
  {
    taskType: 'refactor',
    patterns: [
      /\b(refactor|rename|reorganize|restructure|extract|move\s+to|split\s+into)\b/i,
    ],
  },
  {
    taskType: 'complex_reasoning',
    patterns: [
      /\b(fix|debug|solve|why|diagnose|trace|investigate)\b/i,
    ],
  },
  {
    taskType: 'simple_qa',
    patterns: [
      /\b(explain|what\s+is|how\s+does|describe|summarize|tell\s+me\s+about)\b/i,
    ],
  },
  {
    taskType: 'code_generation',
    patterns: [
      /\b(write|create|implement|add|generate|build|make|scaffold|stub)\b/i,
    ],
  },
  {
    taskType: 'multimodal',
    patterns: [
      /\b(image|screenshot|picture|photo|diagram|vision|draw)\b/i,
    ],
  },
];

const TASK_PROVIDER_MAP: Record<TaskType, Provider> = {
  complex_reasoning: 'claude',
  code_generation: 'claude',
  code_review: 'claude',
  search: 'gemini',
  multimodal: 'gemini',
  simple_qa: 'gemini',
  refactor: 'codex',
};

export function classifyTask(prompt: string): TaskType {
  const text = prompt.toLowerCase();
  for (const rule of TASK_RULES) {
    if (rule.patterns.some((p) => p.test(text))) {
      return rule.taskType;
    }
  }
  return 'code_generation';
}

export function getProviderForTask(taskType: TaskType): Provider {
  return TASK_PROVIDER_MAP[taskType];
}

export function routePrompt(
  prompt: string,
  override?: Provider,
): { provider: Provider; taskType: TaskType } {
  const taskType = classifyTask(prompt);
  const provider = override ?? getProviderForTask(taskType);
  return { provider, taskType };
}
