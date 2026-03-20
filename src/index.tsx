import meow from 'meow';
import { startApp } from './app.js';

const cli = meow(
  `
  Usage
    $ 0mni [prompt]

  Options
    --provider, -p  Provider to use (claude, gemini, openai)
    --model, -m     Model name override
    --auto          Enable auto-routing between providers
    --yolo          Auto-approve all tool calls (skip confirmations)

  Examples
    $ 0mni "Fix the failing tests"
    $ 0mni --provider gemini "Explain this codebase"
    $ 0mni -m claude-opus-4-6 "Refactor the auth module"
    $ 0mni --auto "Search and fix the bug"
`,
  {
    importMeta: import.meta,
    flags: {
      provider: {
        type: 'string',
        shortFlag: 'p',
      },
      model: {
        type: 'string',
        shortFlag: 'm',
      },
      auto: {
        type: 'boolean',
        default: false,
      },
      yolo: {
        type: 'boolean',
        default: false,
      },
    },
  },
);

const initialPrompt = cli.input.join(' ') || undefined;

startApp({
  initialPrompt,
  provider: cli.flags.provider,
  model: cli.flags.model,
  autoRoute: cli.flags.auto,
  yolo: cli.flags.yolo,
});
