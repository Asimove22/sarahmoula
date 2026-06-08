# CLAUDE.md — Dz-bridge (sarahmoula)

This file guides Claude Code when working in this repository.

## Project Overview

**Dz-bridge** is a React 19 landing page for a digital bridge/agency connecting Algeria to the world.
Stack: React 19 + TypeScript + Vite + Tailwind CSS + Framer Motion + Lucide React.

## Project Structure

```
src/
  App.tsx                  # Root — renders all sections in order
  components/
    Navbar.tsx             # Sticky navigation
    Hero.tsx               # Above-the-fold hero section
    Apropos.tsx            # About section
    Services.tsx           # Services offered
    Portfolio.tsx          # Past work / case studies
    Roadmap.tsx            # Timeline / roadmap
    Team.tsx               # Team members
    Contact.tsx            # Contact form
    Footer.tsx             # Footer with links
```

## Dev Commands

```bash
npm run dev      # Start dev server (localhost:5173)
npm run build    # TypeScript check + Vite production build
npm run lint     # ESLint
npm run preview  # Preview production build
```

## Key Conventions

- **Tailwind only** — no inline styles, no CSS modules
- **Framer Motion** for all animations (`motion.div`, `useInView`, `AnimatePresence`)
- **Lucide React** for icons (`import { IconName } from 'lucide-react'`)
- **No routing** — single-page, scroll-based navigation
- Custom Tailwind color: `bg-navy-dz` (dark navy background)
- All components are default exports, no named exports

## Component Pattern

```tsx
import { motion } from 'framer-motion'

export default function SectionName() {
  return (
    <section id="section-id" className="py-20 px-4">
      <div className="max-w-6xl mx-auto">
        {/* content */}
      </div>
    </section>
  )
}
```

## Workflow Best Practices

- **Plan before coding**: Use plan mode for any change touching multiple components
- **Keep context lean**: `/compact` at ~50% context usage; `/clear` between unrelated tasks
- **One concern per session**: Don't mix UI changes with refactors in the same session
- **Type safety**: Always run `npm run build` after changes to catch TypeScript errors
- **Test visually**: Run `npm run dev` and verify in browser before marking done

## Git Commit Rules

- Separate commit per component file changed
- Message format: `feat(Hero): add scroll animation` or `fix(Contact): validate email field`
- Never bundle unrelated changes in one commit

## Rules Files

- `.claude/rules/react-typescript.md` — React/TypeScript patterns (loaded when touching `*.tsx`, `*.ts`)
- `.claude/rules/tailwind.md` — Tailwind class conventions (loaded when touching `*.tsx`, `*.css`)
