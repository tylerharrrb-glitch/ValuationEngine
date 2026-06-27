# WOLF Valuation Engine — Design Handoff

A drop-in design system extracted from the approved mockup
(`WOLF Valuation Engine.dc.html`). Goal: re-skin the existing app to
match this look **without touching calculation logic or data flow.**

---

## Files in this package
- `WOLF Valuation Engine.dc.html` — the full visual reference (all screens, both themes).
- `tokens.css` — the complete color + type system as CSS variables (dark default, light via `[data-theme="light"]`).
- `HANDOFF.md` — this file.

> The `.dc.html` is a **static mockup with sample TechCorp data**. Treat its
> *styling* as the source of truth — NOT its markup structure. Your real
> components stay; only their appearance changes.

---

## The system in one screen

**Themes** — every color is a CSS variable. Dark = navy + brass (original).
Light = cream paper + olive ink. Toggle by setting `data-theme="light"` on
`<html>` (persist the choice in `localStorage`).

**Type**
- Headlines & big figures → `--font-display` (Spectral serif)
- UI / body → `--font-ui` (IBM Plex Sans)
- All numbers, labels, eyebrows, tickers → `--font-mono` (IBM Plex Mono), tabular

**Section pattern** (repeat everywhere):
1. Mono uppercase eyebrow, letter-spaced — e.g. `01 — INPUTS` (color `--text3`)
2. Serif title — e.g. *Valuation Parameters* (color `--text`)
3. Flat card: `background:var(--panel); border:1px solid var(--border); border-radius:8px`

**Grouping inside cards** — one disciplined treatment only: a small gold tick
(`--gold`) + mono-caps label (`--label`) + hairline rule (`--hair`).
Do **not** color-code groups (no red/orange/purple/green headers).

**Color discipline**
- `--gold` → wordmark, active tab, key figures, primary buttons.
- `--pos` / `--neg` → ONLY up/down, valuation verdicts, validation. Never decoration.
- Charts may use the fixed series palette (steel `#5e87c4`, slate-violet `#9b7fd4`,
  teal `#5cb88a`, gold, muted `#7f93ad`, clay `#d9745f`) — those are data fills, fine in both themes.

**Inputs**: `background:var(--field); border:1px solid var(--border); border-radius:5px`,
mono text, focus border = `--gold`.

**Scale**: 1180px max content column, hairline rules, flat cards, no heavy shadows.

---

## Component cheat-sheet (CSS-var versions)
```css
.card       { background:var(--panel); border:1px solid var(--border); border-radius:8px; padding:28px 30px; }
.eyebrow    { font:600 11px var(--font-mono); letter-spacing:.2em; text-transform:uppercase; color:var(--text3); }
.title      { font:600 22px var(--font-display); color:var(--text); }
.label      { font:500 12px var(--font-ui); color:var(--text2); }     /* field labels */
.input      { background:var(--field); border:1px solid var(--border); border-radius:5px;
              padding:11px 13px; color:var(--text); font:500 14px var(--font-mono); }
.input:focus{ border-color:var(--gold); outline:none; }
.value      { font:600 16px var(--font-mono); color:var(--text); }    /* tabular figures */
.btn-gold   { background:var(--gold); color:#16120a; border-radius:7px; font:600 12px var(--font-mono); }
.up         { color:var(--pos); }
.down       { color:var(--neg); }
```

---

## PASTE THIS INTO CLAUDE CODE

```
I'm restyling my existing valuation app to a finished design. I'm attaching
two files: `WOLF Valuation Engine.dc.html` (the visual reference) and
`tokens.css` (the design system).

Do this:
1. Add tokens.css to my global styles. Wire `:root` as the default (dark) theme
   and `[data-theme="light"]` as light. Load the three Google Fonts
   (Spectral, IBM Plex Sans, IBM Plex Mono).
2. Add a light/dark toggle (sun/moon) in the top nav that sets data-theme on
   <html> and persists to localStorage; default to dark.
3. Refactor my components to consume the CSS variables (--bg, --panel, --field,
   --border, --hair, --text, --text2, --text3, --gold, --pos, --neg, etc.) and
   the font stacks (--font-display for headings/figures, --font-ui for UI,
   --font-mono for all numbers/labels/eyebrows). Remove hardcoded colors.
4. Apply the section pattern from the reference: mono uppercase eyebrow → serif
   title → flat card (border:1px solid var(--border); border-radius:8px). Unify
   all group headers to a single gold-tick + mono-caps + hairline treatment —
   remove any multicolor section headings.
5. Match the layout: 1180px max content column, hairline dividers, flat cards,
   no heavy shadows. Reserve --pos/--neg strictly for up/down and validation.

CRITICAL: The .dc.html is a static mockup with placeholder data. Treat the
STYLING as the source of truth, not its markup. Do NOT change my calculation
logic, data fetching, state, or component structure — only the visual layer.
Work component by component and keep the app functional after each step.
```
