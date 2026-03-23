# git-ai

> AI-Powered Visual Git CLI for modern developers

[![CI](https://github.com/BeyteFlow/git-ai/actions/workflows/ci.yml/badge.svg)](https://github.com/BeyteFlow/git-ai/actions/workflows/ci.yml)
[![CodeQL](https://github.com/BeyteFlow/git-ai/actions/workflows/codeql.yml/badge.svg)](https://github.com/BeyteFlow/git-ai/actions/workflows/codeql.yml)
[![npm version](https://img.shields.io/npm/v/git-ai.svg)](https://www.npmjs.com/package/git-ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen)](https://nodejs.org/)

`git-ai` is a terminal-native CLI that brings AI into your everyday Git workflow. It generates meaningful commit messages from your staged diff, resolves merge conflicts automatically, and gives you an interactive TUI for browsing GitHub Pull Requests — all without leaving your terminal.

---

## Features

- **AI commit messages** — Analyze staged changes and generate conventional, context-aware commit messages via Google Gemini.
- **Merge conflict resolution** — Detect all conflicted files and apply AI-suggested resolutions in one command.
- **Interactive PR viewer** — Browse, filter, and inspect GitHub Pull Requests in a rich terminal UI built with [Ink](https://github.com/vadimdemedes/ink).
- **Guided setup** — A single `init` command walks you through connecting your API keys and preferences.
- **Secure config** — Credentials are stored in `~/.aigitrc` with `0600` permissions, never in your repo.
- **Type-safe configuration** — Config schema validated at runtime with [Zod](https://zod.dev/).

---

## Installation

### npm (recommended)

```bash
npm install -g git-ai
```

### From source

```bash
git clone https://github.com/BeyteFlow/git-ai.git
cd git-ai/git-ai
npm install
npm run build
npm install -g .
```

**Requirements:** Node.js `>= 20.0.0`

---

## Quick Start

```bash
# 1. Configure your API keys
ai-git init

# 2. Stage your changes as usual
git add .

# 3. Let AI write the commit message
ai-git commit
```

---

## Usage

### `ai-git init`

Run once to set up your Gemini API key and preferences. Saves config to `~/.aigitrc`.

```bash
ai-git init
```

You will be prompted for:

| Prompt | Description |
|--------|-------------|
| Gemini API Key | Your key from [Google AI Studio](https://aistudio.google.com/app/apikey) |
| Model name | Defaults to `gemini-1.5-flash` |

If a config already exists you can choose to **overwrite**, create a **backup**, or **cancel**.

---

### `ai-git commit`

Generates a commit message for your currently staged changes and lets you accept, edit, or reject it before committing.

```bash
git add src/feature.ts
ai-git commit
```

Example session:

```
🤖 Analyzing changes with Gemini...

✨ Suggested message: "feat(auth): add JWT refresh token rotation"

Choose [a]ccept, [e]dit, or [r]eject: a
✅ Committed successfully!
```

- `a` / `accept` — Commit with the suggested message.
- `e` / `edit` — Manually type a replacement message.
- `r` / `reject` — Abort the commit.

Commit messages are validated against the following rules before being applied:

- Cannot be empty or whitespace-only.
- Must be 72 characters or fewer.
- Must not contain control characters.

---

### `ai-git prs`

Opens an interactive terminal UI for browsing GitHub Pull Requests in the current repository.

```bash
ai-git prs
```

Requires a `github.token` entry in your `~/.aigitrc` (see [Configuration](#configuration)).

---

### `ai-git resolve`

Detects all files with active merge conflicts and applies AI-generated resolutions to each one.

```bash
git merge feature-branch
ai-git resolve
```

Example output:

```
🤖 Resolving: src/utils/parser.ts...
✅ Applied AI fix to src/utils/parser.ts

🎉 Successfully resolved 1 file(s).
```

Review the applied changes with `git diff` before staging and committing.

---

## Command Reference

| Command | Description |
|---------|-------------|
| `ai-git init` | Interactive setup wizard for API keys and preferences |
| `ai-git commit` | Generate an AI commit message for staged changes |
| `ai-git prs` | Launch interactive GitHub PR browser |
| `ai-git resolve` | Auto-resolve merge conflicts using AI |
| `ai-git --version` | Print the current version |
| `ai-git --help` | Show help for all commands |

---

## Configuration

Configuration is stored in `~/.aigitrc` as a JSON file with `0600` permissions.

```jsonc
{
  "ai": {
    "provider": "gemini",          // "gemini" | "openai"
    "apiKey": "YOUR_API_KEY",
    "model": "gemini-1.5-flash"    // optional, defaults to gemini-1.5-flash
  },
  "github": {
    "token": "ghp_..."             // optional, required for `ai-git prs`
  },
  "git": {
    "autoStage": false,            // auto-run `git add -A` before committing
    "messagePrefix": ""            // optional prefix prepended to every message
  },
  "ui": {
    "theme": "dark",               // "dark" | "light" | "system"
    "showIcons": true
  }
}
```

Re-run `ai-git init` at any time to update your configuration.

---

## Examples

### Generate a commit after a bug fix

```bash
git add src/api/handler.ts
ai-git commit
# 🤖 Analyzing changes with Gemini...
# ✨ Suggested message: "fix(api): handle null response from upstream service"
# Choose [a]ccept, [e]dit, or [r]eject: a
# ✅ Committed successfully!
```

### Recover from a messy merge

```bash
git merge origin/main
# CONFLICT (content): Merge conflict in src/config.ts
ai-git resolve
# 🤖 Resolving: src/config.ts...
# ✅ Applied AI fix to src/config.ts
git add src/config.ts
git commit
```

### Review open PRs before merging

```bash
ai-git prs
# Opens an interactive TUI listing all open pull requests
```

---

## Project Structure

```
git-ai/
├── src/
│   ├── index.ts              # CLI entry point (Commander.js)
│   ├── commands/
│   │   ├── CommitCommand.ts  # AI commit message generation
│   │   ├── InitCommand.ts    # Setup wizard
│   │   ├── ResolveCommand.ts # Merge conflict resolver
│   │   └── TreeCommand.ts    # Repository tree viewer
│   ├── cli/
│   │   └── pr-command.ts     # GitHub PR TUI launcher
│   ├── core/
│   │   └── GitService.ts     # Git operations (simple-git wrapper)
│   ├── services/
│   │   ├── AIService.ts      # Google Gemini integration
│   │   ├── ConfigService.ts  # Config load/save with Zod validation
│   │   ├── ConflictResolver.ts
│   │   └── GitHubService.ts  # Octokit GitHub API client
│   ├── ui/
│   │   ├── PRList.tsx        # Ink/React TUI component
│   │   └── TreeUI.tsx
│   └── utils/
│       └── logger.ts         # Pino structured logger
├── package.json
├── tsconfig.json
└── LICENSE
```

---

## Development Setup

```bash
# Clone the repository
git clone https://github.com/BeyteFlow/git-ai.git
cd git-ai/git-ai

# Install dependencies
npm install

# Run in development mode (no build step needed)
npm run dev -- commit
```

Available scripts:

| Script | Description |
|--------|-------------|
| `npm run dev` | Run from source with `tsx` (no compile step) |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm run lint` | Type-check with `tsc --noEmit` |
| `npm test` | Run linter (type-check) |

---

## Testing

Type-checking acts as the current test gate:

```bash
npm test
```

To manually exercise a command during development:

```bash
# Run commit command without building first
npm run dev -- commit

# Run init command
npm run dev -- init
```

---

## Roadmap

- [ ] OpenAI / GPT-4o support (`provider: "openai"`)
- [ ] Conventional Commits format enforcement
- [ ] `ai-git log` — AI-summarized git log
- [ ] `ai-git review` — AI inline code review before push
- [ ] Plugin system for custom AI providers
- [ ] Shell completions (bash / zsh / fish)

---

## Contributing

Contributions are welcome! Please follow these steps:

1. **Fork** the repository and create a feature branch:
   ```bash
   git checkout -b feat/your-feature
   ```
2. Make your changes, ensuring `npm test` passes.
3. Commit using [Conventional Commits](https://www.conventionalcommits.org/):
   ```bash
   git commit -m "feat(commit): add --dry-run flag"
   ```
4. Open a Pull Request against `main` with a clear description.

Please open an issue first for major changes or new features to discuss the approach.

---

## License

[MIT](LICENSE) © 2026 [BeyteFlow](https://github.com/BeyteFlow)

---

## Acknowledgements

- [Google Generative AI](https://ai.google.dev/) — Gemini API powering AI features
- [Ink](https://github.com/vadimdemedes/ink) — React-based terminal UI framework
- [Commander.js](https://github.com/tj/commander.js/) — CLI argument parsing
- [simple-git](https://github.com/steveukx/git-js) — Fluent Git interface for Node.js
- [Zod](https://zod.dev/) — TypeScript-first schema validation
