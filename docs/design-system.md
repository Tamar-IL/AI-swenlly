# The Conductor — Visual Design System

> Owner: **ui-visual-designer** · Stack: **Next.js + Tailwind CSS** · Modes: **Light + Dark (both first-class)**
> Status: buildable spec — every value here is a real token a frontend engineer can paste in.

This is the concrete visual contract for the Conductor. It defines tokens first (color, type,
space, radius, shadow), then composes them into the signature components. Where a choice isn't
obvious, there's a one-line rationale. All contrast ratios were computed against the WCAG 2.1
relative-luminance formula and are stated inline; every body/label pair clears **AA (≥4.5:1)**.

---

## 1. Brand concept — "The Conductor"

Most chat apps are a solo performer. The Conductor is an **orchestra**: many AI models sit in
the pit, and the product is the conductor that picks the right one for each phrase, brings it in,
and hands you a single, clean answer. The signature move is the **trust receipt** — after every
answer you see exactly which "instrument" played, at what tier, and what it saved you versus
booking the whole string section.

**The feeling: composed confidence.** Calm, precise, and quietly premium — the poise of a
conductor who never rushes. Not loud, not "AI-neon." The room is dark and warm; the baton (our
indigo accent) is the only thing that catches the light. Every screen should feel *inevitable*,
like it was arranged, not assembled.

**Design north stars**
1. **One answer, many minds.** The multiplicity is the *proof*, shown in the receipt — never the noise.
2. **Trust is a visual, not a claim.** The receipt must look like a real receipt: aligned figures, honest math, nothing hidden.
3. **Restraint = taste.** Neutral canvas, one accent, color used only to carry meaning (the tiers).

---

## 2. Color system

Colors ship as CSS custom properties on `:root` (light) and `.dark` (dark), then are mapped into
Tailwind via `theme.extend.colors` using the `rgb(var(--token) / <alpha-value>)` pattern so
opacity utilities (`bg-surface/60`) keep working.

### 2.1 Token definitions (paste-ready)

```css
/* ---------- LIGHT (default) ---------- */
:root {
  /* Backgrounds & surfaces */
  --bg:            251 251 250;   /* #FBFBFA  app canvas (warm near-white) */
  --surface:       255 255 255;   /* #FFFFFF  cards, sidebar, composer */
  --surface-raised:255 255 255;   /* #FFFFFF  popovers/menus (elevated by shadow) */
  --surface-sunken:246 246 244;   /* #F6F6F4  wells, code blocks, inputs */
  --overlay:        16  15  20;   /* #10100F  scrim base (used at ~50% alpha) */

  /* Text */
  --text:           22  21  26;   /* #16151A  primary   — 17.5:1 on --bg */
  --text-secondary: 90  88  98;   /* #5A5862  secondary —  6.7:1 on --bg */
  --text-muted:    110 107 119;   /* #6E6B77  muted     —  5.0:1 on --bg */
  --text-inverse:  251 251 250;   /* #FBFBFA  text on accent/dark fills */

  /* Lines */
  --border:        232 230 225;   /* #E8E6E1  hairlines, dividers */
  --border-strong: 214 211 205;   /* #D6D3CD  input borders, focus rest state */

  /* Brand — the "baton" */
  --accent:         91  80 232;   /* #5B50E8  indigo — white text = 5.6:1 */
  --accent-hover:   76  65 214;   /* #4C41D6 */
  --accent-soft:   238 236 253;   /* #EEECFD  tinted fill behind accent things */
  --accent-ring:    91  80 232;   /* focus ring */

  /* Tier semantics (the receipt) */
  --tier-cheap:     15 122  79;   /* #0F7A4F  green  text — 5.2:1 on surface */
  --tier-cheap-bg: 228 245 236;   /* #E4F5EC */
  --tier-cheap-bd: 183 228 206;   /* #B7E4CE */
  --tier-cheap-solid: 18 163 100; /* #12A364  dot/bar */

  --tier-mid:      180  83   9;   /* #B45309  amber text — 4.85:1 on surface */
  --tier-mid-bg:   253 243 224;   /* #FDF3E0 */
  --tier-mid-bd:   246 218 165;   /* #F6DAA5 */
  --tier-mid-solid:217 143  38;   /* #D98F26  dot/bar */

  --tier-strong:   124  58 237;   /* #7C3AED  purple text — 5.5:1 on surface */
  --tier-strong-bg:243 236 254;   /* #F3ECFE */
  --tier-strong-bd:221 202 251;   /* #DDCAFB */
  --tier-strong-solid:124 58 237; /* #7C3AED  dot/bar */

  /* Status */
  --success:        15 122  79;   /* #0F7A4F */
  --warning:       180  83   9;   /* #B45309 */
  --danger:        180  35  24;   /* #B42318  text ≈ 5.9:1 on surface */
  --danger-bg:     253 235 233;   /* #FDEBE9 */
  --danger-solid:  217  45  32;   /* #D92D20 */
  --info:           91  80 232;   /* reuse accent */

  /* Savings emphasis (money you kept) */
  --savings:        15 122  79;   /* #0F7A4F — same green as cheap, "money" reads green */
}

/* ---------- DARK ---------- */
.dark {
  --bg:             14  14  18;   /* #0E0E12  cool near-black w/ faint violet */
  --surface:        23  23  28;   /* #17171C  cards, sidebar */
  --surface-raised: 30  30  37;   /* #1E1E25  popovers/menus */
  --surface-sunken: 18  18  23;   /* #121217  wells, code, inputs */
  --overlay:         0   0   0;   /* pure black scrim @ ~60% */

  --text:          244 243 247;   /* #F4F3F7  primary   — 17.4:1 on --bg */
  --text-secondary:180 178 190;   /* #B4B2BE  secondary —  9.2:1 on --bg */
  --text-muted:    134 131 143;   /* #86838F  muted     —  5.2:1 on --bg */
  --text-inverse:   22  21  26;   /* dark text on light accent fills */

  --border:         42  42  51;   /* #2A2A33 */
  --border-strong:  58  58  69;   /* #3A3A45 */

  --accent:        139 128 255;   /* #8B80FF  brightened indigo — 6.1:1 on --bg */
  --accent-hover:  163 152 255;   /* #A398FF */
  --accent-soft:    35  32  64;   /* #232040  tinted fill */
  --accent-ring:   139 128 255;

  --tier-cheap:     67 217 163;   /* #43D9A3  — 9.9:1 on surface */
  --tier-cheap-bg:  18  40  33;   /* #122821 */
  --tier-cheap-bd:  32  71  58;   /* #20473A */
  --tier-cheap-solid:67 217 163;

  --tier-mid:      245 181  68;   /* #F5B544  — 9.8:1 on surface */
  --tier-mid-bg:    46  36  16;   /* #2E2410 */
  --tier-mid-bd:    77  59  27;   /* #4D3B1B */
  --tier-mid-solid:245 181  68;

  --tier-strong:   167 139 250;   /* #A78BFA  — 6.6:1 on surface */
  --tier-strong-bg: 39  31  64;   /* #271F40 */
  --tier-strong-bd: 62  50  99;   /* #3E3263 */
  --tier-strong-solid:167 139 250;

  --success:        67 217 163;
  --warning:       245 181  68;
  --danger:        255 138 128;   /* #FF8A80  ≈ 6.4:1 on surface */
  --danger-bg:      54  24  22;   /* #361816 */
  --danger-solid:  240  68  56;   /* #F04438 */
  --info:          139 128 255;

  --savings:        67 217 163;
}
```

### 2.2 Tailwind wiring

```js
// tailwind.config.js — theme.extend.colors
const c = (v) => `rgb(var(${v}) / <alpha-value>)`;
colors: {
  bg: c('--bg'), surface: c('--surface'), 'surface-raised': c('--surface-raised'),
  'surface-sunken': c('--surface-sunken'),
  text: { DEFAULT: c('--text'), secondary: c('--text-secondary'), muted: c('--text-muted'), inverse: c('--text-inverse') },
  border: { DEFAULT: c('--border'), strong: c('--border-strong') },
  accent: { DEFAULT: c('--accent'), hover: c('--accent-hover'), soft: c('--accent-soft') },
  tier: {
    cheap:  { DEFAULT: c('--tier-cheap'),  bg: c('--tier-cheap-bg'),  bd: c('--tier-cheap-bd'),  solid: c('--tier-cheap-solid') },
    mid:    { DEFAULT: c('--tier-mid'),    bg: c('--tier-mid-bg'),    bd: c('--tier-mid-bd'),    solid: c('--tier-mid-solid') },
    strong: { DEFAULT: c('--tier-strong'), bg: c('--tier-strong-bg'), bd: c('--tier-strong-bd'), solid: c('--tier-strong-solid') },
  },
  success: c('--success'), warning: c('--warning'),
  danger: { DEFAULT: c('--danger'), bg: c('--danger-bg'), solid: c('--danger-solid') },
  savings: c('--savings'),
}
```

### 2.3 Contrast ledger (WCAG 2.1, computed)

| Pair | Light | Dark | Bar |
|---|---|---|---|
| Primary text on canvas | **17.5:1** | **17.4:1** | AAA |
| Secondary text on canvas | **6.7:1** | **9.2:1** | AAA (normal) |
| Muted text on canvas | **5.0:1** | **5.2:1** | AA |
| White/inverse on accent fill | **5.6:1** | 8.9:1 | AA |
| Accent as link text on canvas | 5.6:1 | 6.1:1 | AA |
| Cheap-tier text on surface | 5.2:1 | 9.9:1 | AA |
| Mid-tier text on surface | 4.85:1 | 9.8:1 | AA |
| Strong-tier text on surface | 5.5:1 | 6.6:1 | AA |
| Danger text on surface | 5.9:1 | 6.4:1 | AA |

**Rationale for the tier hues:** green→amber→purple is a natural "cost climbs" ramp (go / caution /
premium) *and* stays distinct from the indigo brand accent, so the receipt never reads as "brand
chrome." The three hues are also distinguishable in the common deuteranopia/protanopia cases when
paired — which is why every tier is **never color-only**: it always carries a text label and an
icon/glyph (see §5c, §7).

---

## 3. Typography

**Families (all free / self-hostable via `next/font`):**
- **UI + body + display:** `Inter` (variable). One family, full weight range — keeps the system tight. Load with `next/font/google` and `display: 'swap'`.
- **Numeric / mono:** `JetBrains Mono` — for code blocks **and** every figure in the receipt (cost, tokens, savings). Its even width sells "this is a real ledger."
- Enable `font-feature-settings: "cv05","cv08","ss01"` on Inter for a slightly more geometric, less "default" wordmark feel; enable `"tnum"` (tabular numbers) anywhere figures must align in columns (receipt, cost meter).

```css
--font-sans: 'Inter', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif;
--font-mono: 'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, monospace;
```

**Scale** (1rem = 16px). `tracking` = letter-spacing.

| Token | Use | Size / line-height | Weight | Tracking |
|---|---|---|---|---|
| `display` | Wordmark, empty-state hero | 30px / 36px (1.875rem) | 680 | -0.02em |
| `h1` | Section / conversation title | 22px / 28px | 620 | -0.015em |
| `h2` | Card & panel headers | 18px / 26px | 600 | -0.01em |
| `body-lg` | Chat message text | **16px / 26px** (1.625) | 400 | -0.006em |
| `body` | Default UI text, buttons | 14px / 22px | 450 | -0.003em |
| `label` | **Receipt labels**, meta, sidebar items | 13px / 18px | 550 | 0 |
| `micro` | Small print, timestamps, "vs strong" caption | 12px / 16px | 500 | +0.002em |
| `overline` | Tier tag TEXT ("CHEAP · GPT-4o-mini") | 11px / 14px | 650 | +0.06em, UPPERCASE |
| `code` | Code blocks & receipt figures | 13.5px / 22px, mono | 450 | 0 |
| `figure` | Big receipt savings number | 20px / 24px, mono, `tnum` | 600 | -0.01em |

Rationale: chat text at **16/26** matches the reading comfort of ChatGPT/Claude; everything else
steps down so the message stays the hero. Weights use Inter's variable axis (450/550/620/680) to
feel crafted rather than the blunt 400/700 default.

---

## 4. Spacing, radius, shadow, motion tokens

**Space** — 4px base grid. Tailwind default scale already matches; the rhythm to hold to:

| Token | px | Primary use |
|---|---|---|
| `1` | 4 | icon/text gap, tier-dot to label |
| `2` | 8 | intra-component padding, pill padding-y |
| `3` | 12 | button padding-x, receipt row gap |
| `4` | 16 | card padding, message vertical gap |
| `5` | 20 | composer padding |
| `6` | 24 | message-block padding-x in main column |
| `8` | 32 | section gaps, sidebar padding |
| `12`| 48 | empty-state breathing room |

Layout constants: **sidebar 280px** (collapsible to 0), **reading column max-width 768px** (centered), **composer max-width 768px** (aligns to column), touch/hit targets **min 40px**.

**Radius**

```css
--radius-xs: 6px;   /* tags, tier pills, small chips */
--radius-sm: 10px;  /* buttons, inputs, menu items */
--radius-md: 14px;  /* message bubbles, receipt card */
--radius-lg: 20px;  /* composer, large cards, council columns */
--radius-xl: 28px;  /* modals */
--radius-full: 9999px; /* avatars, dots, toggle */
```

**Shadow** — soft, low-spread, cool-tinted (never black-heavy). Dark mode leans on borders + a faint top highlight instead of big shadows.

```css
/* light */
--shadow-sm: 0 1px 2px rgb(16 15 20 / 0.05);
--shadow-md: 0 2px 4px rgb(16 15 20 / 0.06), 0 8px 20px rgb(16 15 20 / 0.06);
--shadow-lg: 0 4px 8px rgb(16 15 20 / 0.06), 0 24px 48px rgb(16 15 20 / 0.10);
--shadow-accent: 0 4px 16px rgb(91 80 232 / 0.28);   /* on the primary send button */
/* dark: swap to */
--shadow-md: 0 2px 6px rgb(0 0 0 / 0.40), 0 12px 32px rgb(0 0 0 / 0.36);
--shadow-lg: 0 8px 24px rgb(0 0 0 / 0.48);
--shadow-accent: 0 4px 20px rgb(139 128 255 / 0.35);
```

**Motion tokens**

```css
--ease-out: cubic-bezier(0.22, 1, 0.36, 1);   /* the house curve — decisive, no bounce */
--ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
--dur-fast: 120ms;  --dur-base: 200ms;  --dur-slow: 380ms;
```

---

## 5. Components

Every component below is described to Tailwind-implementable precision. Class sketches use the
tokens from §2–§4.

### The chat shell (sidebar · main · composer)

Three-region app frame, full viewport height, no page scroll (only the transcript scrolls).

```
┌──────────┬───────────────────────────────────────────┐
│ SIDEBAR  │  HEADER  (title · model-scope · theme · ⚙) │ 56px, sticky, border-b
│ 280px    ├───────────────────────────────────────────┤
│ surface  │                                           │
│ border-r │   TRANSCRIPT (scrolls) — column max-w-768 │ flex-1, overflow-y-auto
│          │                                           │
│          ├───────────────────────────────────────────┤
│          │   COMPOSER  (sticky bottom, max-w-768)     │ auto height
└──────────┴───────────────────────────────────────────┘
```

- **Frame:** `h-screen grid grid-cols-[280px_1fr] bg-bg text-text`. Sidebar collapses via `grid-cols-[0_1fr]` with `--dur-base` transition; a floating "☰" appears when collapsed.
- **Sidebar:** `bg-surface border-r border-border flex flex-col`. Top: a **"＋ New conversation"** primary-ghost button (full width, `rounded-sm`, `label` type). Middle: scrollable history grouped by day, items `rounded-sm px-3 h-9 text-label text-text-secondary hover:bg-surface-sunken`, active item `bg-accent-soft text-text` with a 2px `bg-accent` left rail. Bottom: a compact **savings-to-date** stat ("You've saved **$4.12** this month") in `micro`, plus account row. The running-savings figure in the sidebar is the product's ambient trust signal.
- **Header:** `h-14 px-6 flex items-center justify-between border-b border-border bg-bg/80 backdrop-blur`. Left: conversation title (`h2`, editable on click). Right cluster: the **model-scope control** (§5d), a theme toggle, settings.
- **Transcript:** `flex-1 overflow-y-auto`; inner `mx-auto max-w-[768px] px-6 py-8 space-y-6`. Scroll uses `overscroll-contain` and a thin custom scrollbar (`--border-strong` thumb).
- **Composer:** container `sticky bottom-0` with a `bg-bg` → transparent gradient mask above it so text scrolls *under* a fade. Input card: `mx-auto max-w-[768px] rounded-lg border border-border-strong bg-surface shadow-md focus-within:border-accent focus-within:ring-4 focus-within:ring-accent/15`. Inside: auto-growing `textarea` (max ~200px then scroll), a left **attach** icon-button, a right **send** button (accent circle, `rounded-full h-9 w-9 shadow-accent`, disabled = `bg-border-strong`). Below the input, a `micro` helper row shows the current cost-cap state and active model scope (links to §5d and §5f).

### Chat message — user vs assistant

The two roles are distinguished by **alignment + surface**, not loud color.

- **User message:** right-aligned block, `max-w-[85%] ml-auto`. Bubble `bg-accent-soft text-text rounded-md rounded-tr-xs px-4 py-3 body-lg`. No avatar (it's clearly "you"). Timestamp on hover, `micro text-text-muted`, below-right.
- **Assistant message:** full-column, left-aligned, **no bubble fill** (like Claude/ChatGPT) — just the reading column on `--bg`, so long answers read like a document. Leading a **conductor mark**: a 28px `rounded-full` avatar with a small baton/waveform glyph in `--accent` on `--accent-soft`. Body is `body-lg` with rich-text styles (see below). Under the message, a horizontal action row appears on hover: copy, regenerate, thumbs, and — always visible, not on hover — **the receipt (§5c)** docked at the bottom-left of the message.
- **Assistant rich text:** headings map to §3; inline `code` = `bg-surface-sunken rounded-xs px-1.5 py-0.5 font-mono text-[13px]`; code block = `bg-surface-sunken border border-border rounded-md p-4 overflow-x-auto` with a header strip (language label + copy). Links = `text-accent underline underline-offset-2`. Blockquote = 3px `border-l border-accent/40 pl-4 text-text-secondary`.
- **Streaming state:** assistant text renders token-by-token with the streaming cursor (§6).

### ★ THE RECEIPT — the signature component

The trust artifact. It appears attached under each assistant answer, and expands for detail. It
must feel like a **real, honest receipt**: monospace figures, aligned columns, visible math, one
proud "you saved" line. It is the product.

**Collapsed state (always shown, one line):**

```
▸  ● STRONG · Claude Opus 4.8   ·   1,240 tok   ·   $0.019   ·   saved $0.204  ⌄
   └tier dot   └model (label)       └mono/tnum     └mono       └savings, green, bold
```

- Container: `inline-flex items-center gap-3 rounded-md border bg-surface px-3 py-2 text-label` where the **border + a 3px left bar** take the **tier color** (`border-tier-<x>-bd`, left bar `bg-tier-<x>-solid`). The tint is subtle — the card stays on `--surface`, only the rail and the tier tag carry hue.
- **Tier tag:** `overline` text in the tier color inside a `rounded-xs px-1.5 py-0.5 bg-tier-<x>-bg` pill, prefixed by a 8px `rounded-full bg-tier-<x>-solid` dot. Reads e.g. `● STRONG`.
- **Model name:** `label` weight 550, `text-text`.
- **Figures:** `font-mono tnum text-text-secondary`, separated by `·` dividers in `text-text-muted`.
- **Savings:** `saved $0.204` in `text-savings` weight 600 — the one colored figure, because "money you kept" is the emotional payload. If savings is $0 (the strong model *was* the right call), this reads `best model for this — $0 wasted` in `text-text-muted`, never a red/negative.
- A trailing `⌄` chevron toggles the expanded panel; whole row is a `button`, `aria-expanded`.

**Expanded state (on click — the ledger):**

A `rounded-md border border-border bg-surface-raised shadow-md p-4 mt-2 max-w-[420px]` panel:

```
┌─────────────────────────────────────────────┐
│  ● STRONG    Claude Opus 4.8                 │  tier pill + model
│  Chosen because: reasoning-heavy prompt      │  micro, text-muted — the WHY
│─────────────────────────────────────────────│  border-border divider
│  Input          420 tok           $0.0063    │  label left · mono tnum right (right-aligned col)
│  Output         820 tok           $0.0129    │
│  ─────────────                    ───────    │
│  This answer                      $0.0192    │  weight 600
│─────────────────────────────────────────────│
│  If we'd forced the strong tier   $0.2230    │  text-muted, the counterfactual
│  You saved                        $0.2038    │  ← big figure, text-savings, `figure` type
│  ▓▓▓▓▓▓▓▓▓░ 91% cheaper                       │  savings bar (see below)
│─────────────────────────────────────────────│
│  [ Re-run on a stronger model ↗ ]            │  ghost button → §5d
└─────────────────────────────────────────────┘
```

- The two-column ledger uses a `grid grid-cols-[1fr_auto_auto]`; every figure column is `font-mono tnum` and **right-aligned** so decimals stack — this alignment is what makes the math read as *audited*, not decorative.
- The **"Chosen because"** line is load-bearing for trust: it names the routing reason in plain language (`reasoning-heavy prompt`, `simple lookup`, `you pinned this model`). Never omit it.
- **Savings bar:** `h-1.5 rounded-full bg-surface-sunken` track with a `bg-savings` fill at `width: {pct}%`, animated on reveal (§6). Caption `micro`.
- Counterfactual baseline: always the top "strong" tier's price for the *same* token count — state that assumption in a tooltip on "If we'd forced the strong tier" so the claim is falsifiable.
- **Honesty rule (design-enforced):** figures come from real usage; if a number is estimated (e.g. cost pre-final-token during stream), show it in `text-text-muted italic` with a `~` prefix and resolve to solid on completion. Never round savings *up*.

### The manual model-override control ("Scope")

Lets the user override auto-routing — pin a tier, pin a specific model, or stay on Auto. Lives in
the header and is deep-linked from the receipt's "Re-run on a stronger model."

- **Trigger:** a `rounded-sm border border-border-strong bg-surface h-9 px-3 inline-flex items-center gap-2 text-label` button showing current scope. Default: `⟐ Auto` with the conductor glyph. When pinned, the glyph is a tier dot and text is the model/tier name in the tier color.
- **Popover** (`surface-raised`, `shadow-lg`, `rounded-md`, `w-[300px]`): a segmented header **Auto / By tier / Specific model**.
  - *Auto* (default, recommended badge): "Let the Conductor pick per message." Selected row has `bg-accent-soft` + accent check.
  - *By tier*: three radio rows, each a tier pill (Cheap / Mid / Strong) with its dot, a one-line "best for…" caption, and a `~$/1k tok` estimate in mono on the right.
  - *Specific model*: searchable list; each row = provider glyph, model name, its tier dot, and price. Selecting one shows a subtle `warning`-tinted `micro` note: "Pinning disables cost savings from routing."
- **Rationale:** Auto is the product's value; the override exists for trust and control, so the UI always frames pinning as a *tradeoff* (you may pay more), never hides it.

### The Council — "3 answers side by side"

Invoked explicitly (a "Convene the council ⌘⏎" action) for high-stakes prompts: run three tiers/models in parallel and compare.

- Layout: transcript column widens to `max-w-[1120px]` for this turn only; three columns `grid grid-cols-1 md:grid-cols-3 gap-4`, each a `rounded-lg border border-border bg-surface p-4 flex flex-col`.
- **Column header:** tier pill + model name (§5c styling) and a live `micro` status (`streaming…` with cursor, then `done · 0.8s`). The recommended/cheapest-sufficient column gets a 2px `border-accent` and a small `★ Conductor's pick` accent ribbon top-right — this is the "one answer" resolving out of "many minds."
- **Body:** each column streams its own answer (`body`, slightly smaller than solo chat to fit), independently scrollable at tall heights (`max-h-[52vh] overflow-y-auto`).
- **Footer per column:** a **mini-receipt** (collapsed §5c row, scaled to fit) + a `Use this answer` ghost button that collapses the council back to a single accepted message (carrying its receipt).
- **Comparison strip** under the trio: a single row aligning the three costs and highlighting the delta — `Cheap $0.002 · Mid $0.011 · Strong $0.019 — same verdict, 90% cheaper` in `micro`, the savings clause in `text-savings`.
- Responsive: below `md`, columns stack vertically; the Conductor's pick sorts to the top with its ribbon retained.

### Cost-cap warning / gated state

Three escalating levels tied to a user/session budget, so cost never surprises.

- **Approaching (≥80% of cap):** a `micro` inline note under the composer, `text-warning`, with a slim meter: `bg-surface-sunken h-1 rounded-full` track + `bg-warning` fill. Text: "Budget: **$4.02 / $5.00** used." Non-blocking.
- **At cap (gated):** the composer enters a disabled state — textarea `opacity-60 pointer-events-none`, send button `bg-border-strong`. Above it, a **gate card**: `rounded-lg border border-danger/40 bg-danger-bg p-4 flex gap-3`. Left: a `⛔`/lock glyph in `text-danger`. Body: `label` weight 600 "Monthly cost cap reached ($5.00)" + `micro text-text-secondary` "New messages are paused to protect your budget." Actions (buttons): **Raise cap** (primary accent), **Switch to Cheap-only** (ghost — lets them keep going free/cheap, reinforcing the product's own value prop), **Wait for reset** (text link, shows the reset date).
- **Per-message pre-flight (optional):** if a *pinned strong model* on a long prompt would exceed a per-message soft limit, show a confirm inline: "This will cost ~**$0.34** on the pinned Strong model. Auto would spend ~$0.03. Continue?" with **Continue** / **Let Auto decide** — the second is accent, nudging back to savings.
- **Rationale:** every gated state offers a *cheaper path forward*, not just a wall. The cap defends trust; the "Cheap-only" escape hatch turns the limit into a demonstration of the product's core promise.

### Supporting primitives (for consistency)

- **Buttons.** Primary: `bg-accent text-text-inverse rounded-sm h-9 px-4 body font-medium shadow-accent hover:bg-accent-hover active:scale-[.98]`. Ghost: `bg-transparent text-text-secondary hover:bg-surface-sunken border border-transparent`. Outline: `border border-border-strong bg-surface hover:border-accent`. Danger: `bg-danger-solid text-white`. Icon button: `h-9 w-9 rounded-sm grid place-items-center`.
- **Inputs.** `bg-surface-sunken border border-border-strong rounded-sm h-10 px-3 body focus:border-accent focus:ring-4 focus:ring-accent/15 focus:bg-surface`.
- **Tier pill (reusable).** `inline-flex items-center gap-1.5 rounded-xs px-2 py-0.5 overline bg-tier-<x>-bg text-tier-<x>` + leading dot. This one atom appears in the receipt, scope control, and council headers — it is the visual thread of the whole system.

---

## 6. Motion — micro-interactions

Three, all using `--ease-out`. Governed by `@media (prefers-reduced-motion: reduce)` → replace transforms with a plain opacity fade or none.

1. **Message appear.** New message: `opacity 0→1` + `translateY(6px→0)` over `--dur-base` (200ms). Assistant avatar does a tiny `scale(.85→1)` on the same curve. Nothing slides far — it *settles*, like a note landing.
2. **Receipt reveal.** When an answer finishes streaming, the collapsed receipt does a **200ms wipe-in**: `clip-path inset(0 100% 0 0 → inset(0 0 0 0))` left-to-right, so the receipt "prints." On expand, the ledger panel grows height `--dur-base` and the **savings bar fills** from 0→{pct}% over `--dur-slow` (380ms) with the big savings figure counting up (respect reduced-motion: snap to final). This is the product's hero moment — it earns the extra 180ms.
3. **Streaming cursor.** A 2px-wide, `body-lg`-tall bar in `--accent`, `rounded-full`, trailing the last token, blinking via `@keyframes` `opacity 1→0.2→1` at `1s steps(1)`-ish (soft, not a harsh terminal blink). It disappears the instant the receipt prints (interaction 2), visually handing off "thinking → answered."

Plus ambient: sidebar collapse (width `--dur-base`), hover states (`--dur-fast`, 120ms), theme switch (colors transition `--dur-base`; wrap in a `disable-transitions` class toggle to avoid flashing on first paint).

---

## 7. Accessibility

- **Focus.** Every interactive element gets a visible ring: `outline: 2px solid rgb(var(--accent-ring)); outline-offset: 2px` (via `:focus-visible`, not `:focus`, so mouse users don't see it but keyboard users always do). Never remove focus outlines without a replacement. The composer uses the `focus-within` ring so the whole card signals focus.
- **Contrast.** All body/label/figure pairs meet **AA ≥4.5:1** (see §2.3 ledger, all computed). Large display text and the muted tier text clear AA-large ≥3:1 with margin. Test both themes; dark-mode danger text (`#FF8A80`) is intentionally desaturated up to hold 6.4:1.
- **Color is never the only signal.** Tiers always pair the hue with (a) a text label (`CHEAP/MID/STRONG`), (b) a distinct dot position, and where space allows an icon. The Council's "pick" is marked by a ribbon + border, not color alone. Savings uses green *and* the words "saved"/"cheaper."
- **Keyboard.** Full operation without a mouse: `⌘K` command palette, `⌘⏎` send, `⌘⇧⏎` convene council, `Esc` closes popovers/menus and returns focus to trigger, `↑` in an empty composer edits your last message. Sidebar history is arrow-navigable; the scope popover is a proper `radiogroup`. Receipt expand/collapse is a `<button aria-expanded>`; the ledger is a `<dl>` (labels = `<dt>`, figures = `<dd>`) so screen readers read "Output, 820 tokens, 1.29 cents."
- **Semantics & SR.** Streaming assistant text lives in an `aria-live="polite"` region (announce on completion, not per token). The receipt exposes an `aria-label` summarizing the whole thing: *"Answered by Claude Opus 4.8, strong tier. Cost 1.9 cents. Saved 20.4 cents versus forcing the strong tier."* Cost-cap gate is `role="alert"`. Tier dots and glyph-only icon buttons carry `aria-label`/`sr-only` text.
- **Motion & targets.** Honor `prefers-reduced-motion` (see §6). Hit targets ≥40px; the send button and tier pills meet 24px minimum even when visually small, via padding.
- **Zoom/reflow.** Reading column and composer use `max-w` + `%`, so 200% zoom and 320px viewports reflow without horizontal scroll (the council stacks; code blocks scroll inside their own `overflow-x-auto`).

---

*Tokens are the contract. Build components from §2–§4 values only — if a screen needs a color or size
that isn't a token, that's a signal to add a token here first, not to hardcode. Keep light and dark
in lockstep: every new token is defined in both `:root` and `.dark`.*
