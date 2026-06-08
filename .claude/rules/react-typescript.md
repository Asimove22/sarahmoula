---
description: React and TypeScript patterns for Dz-bridge
paths:
  - "src/**/*.tsx"
  - "src/**/*.ts"
---

# React / TypeScript Rules

## Component rules
- All components are default exports in their own file
- Props interfaces are defined inline above the component (not exported unless reused)
- Use `React.FC` only when children are needed; otherwise type props directly

## Hooks
- `useState` for local UI state only
- `useRef` for DOM refs and animation targets
- No `useEffect` for data fetching — this project has no API calls
- Keep hooks at the top of the function body, never inside conditions

## Framer Motion
- Wrap animated elements in `motion.div` (or appropriate tag)
- Use `useInView` from `framer-motion` for scroll-triggered animations
- Keep `initial`, `animate`, `transition` on the motion element itself
- Prefer `viewport={{ once: true }}` for section entrance animations

## TypeScript
- No `any` — use `unknown` or a proper type
- Prefer `interface` over `type` for object shapes
- Don't suppress TS errors with `@ts-ignore` — fix the root cause
- Run `npm run build` to type-check before committing

## Lucide icons
- Import only the icons used: `import { ArrowRight, Mail } from 'lucide-react'`
- Size via `size` prop or Tailwind (`className="w-5 h-5"`)
