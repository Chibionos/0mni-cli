# 0mni

A TUI coding agent that combines **Claude**, **Gemini**, and **Codex** into a single CLI. Uses your locally installed coding agents as the runtime — no API keys needed.

```
┌─────────────────────────────────────────┐
│ 0mni v0.1.0 · ● claude-sonnet-4-6      │
├─────────────────────────────────────────┤
│                                         │
│ You: Fix the login bug in auth.ts       │
│                                         │
│ ● Claude: I'll look at auth.ts...       │
│ → read_file src/auth.ts                 │
│ → edit_file src/auth.ts                 │
│                                         │
│ Done. Fixed the null check on line 42.  │
│                                         │
├─────────────────────────────────────────┤
│ > _                                     │
└─────────────────────────────────────────┘
```

## Install

```bash
npm install -g omni-cli
```

Or run directly:

```bash
npx omni-cli "fix the failing tests"
```

## Prerequisites

You need at least one of these coding agents installed and authenticated:

- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) — `npm install -g @anthropic-ai/claude-code`
- [Gemini CLI](https://github.com/google-gemini/gemini-cli) — `npm install -g @google/gemini-cli`
- [Codex CLI](https://github.com/openai/codex) — `npm install -g @openai/codex`

0mni uses your existing CLI authentication. No separate API keys required.

## Usage

```bash
# Interactive TUI
omni

# Start with a prompt
omni "explain this codebase"

# Force a specific provider
omni --provider claude "fix the bug"
omni -p gemini "search for the error"
omni -p codex "refactor the auth module"

# Auto-route to best provider per task
omni --auto "find and fix the performance issue"

# Specify a model
omni -m claude-opus-4-6 "design the new API"

# Auto-approve all tool calls
omni --yolo "fix all lint errors"
```

## Slash Commands

Inside the TUI, use these commands:

| Command | Description |
|---------|-------------|
| `/claude` | Switch to Claude |
| `/gemini` | Switch to Gemini |
| `/codex` | Switch to Codex |
| `/auto` | Toggle auto-routing |
| `/model <name>` | Set a specific model |
| `/clear` | Clear conversation |
| `/cost` | Show token usage and cost |
| `/help` | Show all commands |

## Auto-Routing

When `--auto` is enabled, omni classifies your task and routes to the best provider:

| Task Type | Provider | Why |
|-----------|----------|-----|
| Complex reasoning, debugging | Claude | Best at multi-step reasoning |
| Code generation, review | Claude | Strong code understanding |
| Search, web queries | Gemini | Built-in Google Search grounding |
| Multimodal (images) | Gemini | Best multimodal support |
| Refactoring | Codex | Optimized for code transforms |
| Simple Q&A | Claude Haiku | Fast and cheap |

## How It Works

0mni is a TUI wrapper that spawns your installed coding agents as subprocesses:

```
0mni TUI (React + Ink)
    │
    ├── claude -p "prompt" --output-format stream-json
    ├── gemini -p "prompt" --output-format stream-json
    └── codex exec "prompt" --json
```

Each CLI handles its own:
- Tool execution (file editing, shell commands, search)
- Authentication (OAuth, API keys)
- Sandboxing and permissions

omni parses the streaming JSON output and displays it in a unified terminal UI.

## Skills

0mni supports [skills.sh](https://skills.sh) for extensibility:

```bash
# Install skills
omni skills add vercel-labs/agent-skills
omni skills add anthropic/skills

# List installed skills
omni skills list
```

## Configuration

Create `.omni/config.toml` in your project or `~/.config/omni/config.toml` globally:

```toml
defaultProvider = "claude"
autoRoute = false
yolo = false

[models]
claude = "claude-sonnet-4-6"
gemini = "gemini-2.5-flash"
codex = "gpt-5.4"
```

## License

MIT
