---
description: Frontend development guidelines (React, UI components, visual changes)
paths:
  - apps/web/**
  - apps/desktop/**
---

# UI Development

## Before UI changes
- Brainstorm first — UI decisions are hard to reverse once users see them
- Start the dev server (`bun run dev:web`) and verify changes in a browser before reporting done
- Include before/after descriptions for any visual change

## Contracts dependency
- UI consumes schemas from `packages/contracts` — if a contract change is needed, plan it as a separate step first
- Never modify contracts just to satisfy a UI convenience; contracts define the protocol
