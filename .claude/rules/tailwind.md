---
description: Tailwind CSS conventions for Dz-bridge
paths:
  - "src/**/*.tsx"
  - "src/index.css"
  - "tailwind.config.js"
---

# Tailwind Rules

## Layout
- Section wrapper: `py-20 px-4` (vertical padding 20, horizontal 4)
- Inner container: `max-w-6xl mx-auto`
- Grid: use `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8`
- Flex: `flex items-center justify-between gap-4`

## Spacing
- Use Tailwind scale only — no arbitrary values like `p-[13px]`
- Prefer `gap-*` over `space-x-*` / `space-y-*` in flex/grid containers

## Colors
- Background dark: `bg-navy-dz` (custom, defined in tailwind.config.js)
- Text: `text-white`, `text-gray-300`, `text-gray-400` for hierarchy
- Accent: check `tailwind.config.js` for project accent colors

## Responsive
- Mobile-first: base styles are mobile, add `md:` and `lg:` breakpoints as needed
- Never use `sm:` unless there's a specific need — `md:` is the primary breakpoint

## Animation classes
- Prefer Framer Motion over Tailwind `animate-*` for complex animations
- Use `transition-colors duration-200` for hover state color transitions

## Don'ts
- No inline `style={{}}` — use Tailwind classes
- No arbitrary values unless absolutely unavoidable
- Don't mix Tailwind with CSS modules
