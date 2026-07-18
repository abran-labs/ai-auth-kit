# AI Auth Kit Design System

## 1. Atmosphere & Identity

AI Auth Kit reads like a private credential ledger: warm archival paper, precise ink, narrow
rules, and enough whitespace to make security guidance easy to scan. The signature mark is a
vertical authorization record built from short and long Morse-like strokes beside a numbered
ledger margin. It suggests credentials being recorded and resolved without using a network,
graph, node, edge, lock, shield, or copied product mark.

The visual direction combines minimalist editorial discipline with warm workspace-document
principles: content leads, color stays scarce, borders whisper, and controls remain visibly
functional. Product copy is plain and specific. No gradients, glass, pills, generic card grids,
emoji, stock imagery, or ornamental security clichés.

## 2. Color

| Role | Token | Light | Dark |
| --- | --- | --- | --- |
| Canvas | `--paper` | `#f2eee4` | `#171613` |
| Raised surface | `--paper-raised` | `#fbf8f0` | `#211f1b` |
| Quiet surface | `--paper-muted` | `#e7e0d2` | `#2b2822` |
| Primary ink | `--ink` | `#23201b` | `#f2ecdf` |
| Muted ink | `--ink-muted` | `#625c51` | `#beb5a7` |
| Hairline | `--rule` | `#c8bdab` | `#4c473d` |
| Accent | `--accent` | `#8d3829` | `#df755f` |
| Accent strong | `--accent-strong` | `#68271d` | `#f19a84` |
| Success | `--success` | `#315d3d` | `#8bbc94` |
| Warning | `--warning` | `#745514` | `#d8b56a` |
| Error | `--error` | `#872e2b` | `#eb8983` |
| Info | `--info` | `#31596a` | `#8db5c4` |

Accent marks an action, active location, or editorial annotation only. Semantic colors appear
only in status and aside contexts. All component colors reference custom properties; literals
remain in token declarations. Primary and muted copy meet WCAG AA in both themes.

## 3. Typography

Display and major headings use Newsreader Variable, Georgia, serif for a human editorial voice.
Body and controls use Public Sans Variable, Arial, sans-serif. Commands, paths, labels, and the
authorization mark use Fragment Mono, ui-monospace, monospace. No Inter or copied proprietary
font appears.

Tokens: display `clamp(3rem, 7vw, 6.75rem)`; H1 `clamp(2.25rem, 5vw, 4.25rem)`; H2
`clamp(1.75rem, 3vw, 2.625rem)`; H3 `1.375rem`; lead `1.1875rem`; body `1rem`; small
`0.875rem`; label `0.75rem`. Display tracking uses `--tracking-display`; labels use
`--tracking-label`. Line-height, measure, and weights use declared `--leading-*`, `--measure-*`,
and `--weight-*` tokens. The authorization mark uses `--ledger-type-record`,
`--ledger-type-number`, and `--ledger-signal-stroke` for its SVG typography and signal weight.

## 4. Spacing & Layout

Four-pixel base. Tokens: `--space-1` 4px, `--space-2` 8px, `--space-3` 12px,
`--space-4` 16px, `--space-5` 20px, `--space-6` 24px, `--space-8` 32px,
`--space-10` 40px, `--space-12` 48px, `--space-16` 64px, `--space-20` 80px,
`--space-24` 96px. Landing max width is 1280px; reading measure is 72ch. The hero uses a
12-column ledger grid, six columns at tablet width, and one flow on mobile. Starlight owns docs
layout, navigation, search, table of contents, code rendering, and responsive shell behavior.

Media thresholds, SVG coordinates, intrinsic ratios, and zero values are structural geometry,
not reusable visual tokens. Reusable grid counts, target sizes, and artwork bounds stay tokenized.

## 5. Components

### Editorial action
- Semantic anchor with ink-filled primary and ruled secondary variants.
- Uses spacing tokens, compact radius, and a 44px minimum target.
- Hover changes rule and ink; active translates one hairline; focus uses accent outline.
- Disabled uses muted ink. Loading preserves width; errors require an announced live region.

### Authorization ledger mark
- Semantic SVG with title and description, one margin rule, numbered records, and short/long
  signal strokes arranged vertically.
- Uses paper, ink, rule, and accent tokens in both themes; never uses connected geometry.
- Decorative strokes stay inert. Reveal motion becomes static under reduced motion.

### Ruled pathway
- Ordinal label, heading, concise outcome, and optional text link separated by hairlines.
- Standard and wide variants use logical headings plus complete hover, active, and focus states.
- Static content has no artificial loading, empty, or error state.

### Code ledger
- A bordered preformatted block showing a real install or first-use sequence.
- Mono type, raised paper, sharp corners, horizontal overflow contained within the block.
- Copy controls are omitted unless a real announced success/failure interaction is added.

### Starlight shell
- Preserve upstream header, sidebar, content, TOC, search, theme picker, and Expressive Code.
- Preserve mobile and desktop behavior, light and dark variants, keyboard order, and all
  accessibility states. Narrow token overrides only; no shell fork.
- The custom landing shares the `starlight-theme` preference, resolves it before paint, and
  provides equivalent theme selection and skip-to-content controls.

## 6. Motion & Interaction

Micro: 120ms ease-out. Standard: 220ms ease-in-out. Emphasis: 520ms
`cubic-bezier(0.16, 1, 0.3, 1)`. Animate only transform, opacity, color, and filter. The landing
copy and ledger mark reveal once with a restrained stagger; no scroll listener or client runtime
is required. Every interactive element has hover, active, and visible focus. Reduced-motion
preference removes reveal motion and smooth scrolling.

## 7. Depth & Surface

Borders-only with tonal shift. One-pixel hairlines, overlapping paper registers, and quiet
surface changes create depth. Controls use 3px radius; surfaces use 2px radius. No shadows,
glass, gradients, pills, soft SaaS panels, or floating card stacks. The authorization mark gains
depth through offset ledger sheets and rules, never elevation effects.
