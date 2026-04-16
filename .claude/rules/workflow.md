---
description: Core development workflow using Superpowers skills
---

# Development Workflow

Follow this workflow for any task that changes behavior or adds functionality:

## 1. Understand before acting
- **New feature or behavior change** → invoke `superpowers:brainstorming` before writing any code
- **Bug or test failure** → invoke `superpowers:systematic-debugging` before proposing fixes
- **Ambiguous request** → ask clarifying questions, don't guess

## 2. Plan before coding
- **Multi-step task** (touches 3+ files or spans multiple packages) → invoke `superpowers:writing-plans`
- **Independent subtasks identified** → invoke `superpowers:dispatching-parallel-agents`
- Single-file, obvious changes can skip planning

## 3. Implement with discipline
- Follow the plan step by step — don't skip ahead or combine steps
- When executing a written plan → invoke `superpowers:executing-plans`

## 4. Verify before claiming done
- Invoke `superpowers:verification-before-completion` before saying work is complete
- Run `/verify` (fmt, lint, typecheck, test) as part of verification
- Never claim success without evidence

## 5. Commit and integrate
- **Small/simple task** → commit directly to main, no PR needed
- **Larger feature** → feature branch → push → open PR → merge (normal or squash)
- GitHub Copilot reviews trigger automatically on PR creation — wait for that feedback before merging
- When receiving review feedback → invoke `superpowers:receiving-code-review`
- When ready to merge → invoke `superpowers:finishing-a-development-branch`
- Do NOT use git worktrees — always use branches
