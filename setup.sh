#!/usr/bin/env bash
# IQU web platform — one-time setup
# Place this script next to CLAUDE.md and DESIGN.md, then run:  bash setup.sh
# Needs: git, Node 20+, Claude Code CLI (`claude`)
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"

# 1. Repo
git clone https://github.com/IlmulQuran-USA/iqu-web-platform.git
cd iqu-web-platform

# 2. Move the spec out of the root (create-next-app refuses a root README.md; docs/ is allowed)
mkdir -p docs
git mv README.md docs/UI-SPEC.md

# 3. Next.js scaffold (App Router + TS + Tailwind)
npx create-next-app@latest . --ts --tailwind --eslint --app --src-dir \
  --import-alias "@/*" --use-npm --yes

# 4. Project rule files
cp "$HERE/CLAUDE.md" "$HERE/DESIGN.md" .

# 5. Impeccable — skill + design hook for Claude Code, project scope (accept the hook when asked)
npx impeccable install --providers=claude --scope=project

# 6. Vercel web-design-guidelines skill
npx skills add https://github.com/vercel-labs/agent-skills --skill web-design-guidelines

# 7. Playwright MCP — project scope, written to .mcp.json so it is shared via git
claude mcp add --scope project playwright npx @playwright/mcp@latest

# 8. Impeccable .gitignore block (from the Impeccable README)
cat >> .gitignore <<'EOF'

# impeccable-ignore-start
**/.impeccable/config.local.json
**/.impeccable/hook.cache.json
**/.impeccable/hook.pending.json
**/.impeccable/*.png
**/.impeccable/review/
**/.impeccable/questions/
**/.impeccable/live/server.json
**/.impeccable/live/sessions/
**/.impeccable/live/previews/
**/.impeccable/live/annotations/
**/.impeccable/live/cache/
**/.impeccable/live/manual-edit-apply-transaction.json
**/.impeccable/live/manual-edit-events.jsonl
**/.impeccable/live/manual-edit-evidence/
**/.impeccable/live/pending-manual-edits.json
**/.impeccable/live/deferred-svelte-component-accepts.json
**/.impeccable/live/*.png
# impeccable-ignore-end
EOF

# 9. First commit
git add -A
git commit -m "chore: Next.js scaffold, design rules, Impeccable, web-design-guidelines, Playwright MCP"

echo
echo "Done. Next: cd iqu-web-platform && claude   → then run /impeccable init"
