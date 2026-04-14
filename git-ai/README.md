# git-ai

AI metadata for your git history.

This CLI stores AI attribution (model, prompt, intent) in `git notes` so it can be queried later and shared across a team without changing code.

## Install

From the `git-ai/` folder:

```bash
npm install
npm run build
npm link
```

## Commands

This repo exposes both `ai-git` (standalone assistant) and `git-ai` (git subcommand).

Use the git subcommand form:

```bash
git ai log
git ai blame <file>
git ai inspect <id>
```

### Attribution Workflow

1. Record attribution for a commit:

```bash
git ai record --intent "refactor" --prompt "simplify parser" --path src/parser.ts --lines-from-file
```

2. View attribution timeline:

```bash
git ai log -n 200
git ai log --model gemini-1.5-flash --since 2026-01-01T00:00:00Z
```

3. Inspect the full record:

```bash
git ai inspect <record-id> --commit HEAD
```

4. AI blame ("why does this code exist"):

```bash
git ai blame src/parser.ts
```

### Sharing Notes Across Remotes

Git notes are stored in `refs/notes/git-ai`.

```bash
git push origin refs/notes/git-ai
git fetch origin refs/notes/git-ai:refs/notes/git-ai
git config --add notes.displayRef refs/notes/git-ai
git config --add notes.rewriteRef refs/notes/git-ai
```

The `notes.rewriteRef` line helps preserve notes when commits are rewritten (rebase/cherry-pick).

### Export/Import

```bash
git ai export --out audit.jsonl
git ai import --file audit.jsonl
```

## Design Notes

1. Storage: git notes (`refs/notes/git-ai`)
1. Versioning: schema has `v: 1`
1. Survivability: records can include line-hash anchors so attribution can be correlated even after refactors
