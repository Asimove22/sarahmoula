---
description: Scaffold a new landing page section component
argument-hint: [section-name]
---

Create a new section component for the Dz-bridge landing page.

Section name: $ARGUMENTS

Steps:
1. Create `src/components/$ARGUMENTS.tsx` using the standard template:
   - `<section id="[section-id]" className="py-20 px-4">`
   - `<div className="max-w-6xl mx-auto">`
   - Framer Motion entrance animation with `viewport={{ once: true }}`
   - Proper TypeScript types
2. Import and add the new component to `src/App.tsx` in the appropriate position
3. Run `npm run build` to verify no TypeScript errors
4. Report what was created and where it was inserted in App.tsx
