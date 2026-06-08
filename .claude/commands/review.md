---
description: Review all staged or recently changed components for code quality
---

Run a full code review of the Dz-bridge project changes:

1. Run `npm run lint` and report any lint errors
2. Run `npm run build` and report any TypeScript errors
3. For each changed `.tsx` file, check:
   - TypeScript correctness (no `any`, proper types)
   - React best practices (hook rules, keys, no side effects in render)
   - Tailwind usage (mobile-first, no arbitrary values)
   - Framer Motion usage (scroll animations have `viewport={{ once: true }}`)
   - Accessibility (semantic HTML, alt text, aria labels)
4. Summarize: list ISSUES (must fix) and SUGGESTIONS (optional)
