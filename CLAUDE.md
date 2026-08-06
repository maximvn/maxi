# PoliRaster Studio — CLAUDE.md

## What this project is

**PoliRaster Studio 2.1** is a single-file React scheduling tool for Dutch outpatient clinics (*poli*). It turns raw appointment demand (codes, durations, modalities, urgency) into a visual weekly schedule grid, filling examination rooms across morning/afternoon sessions while respecting configurable planning rules.

Everything runs in the browser — no server, no database. The distributable is a single self-contained HTML file at `dist/polimodel.html`.

## Build

```bash
npm install        # installs esbuild, react, react-dom, xlsx
npm run build      # writes dist/polimodel.html
```

`build.js` uses esbuild to bundle `entry.jsx` (which imports `raster_model_2.jsx`) and injects the minified bundle into `html-shell.html`. The output is one portable HTML file.

**Open** `dist/polimodel.html` directly in any browser — no dev server needed.

## Source layout

| File | Purpose |
|---|---|
| `raster_model_2.jsx` | Entire application (React component + scheduling engine) |
| `entry.jsx` | Thin esbuild entry point that mounts the component |
| `html-shell.html` | HTML skeleton; `__BUNDLE__` placeholder is replaced at build time |
| `build.js` | esbuild bundler script |
| `dist/polimodel.html` | Built distributable — commit after `npm run build` |

## Architecture inside `raster_model_2.jsx`

The file is one React component. Key sections (in order):

1. **Design tokens** — `C`, `NEW_PALETTE`, `CTRL_PALETTE`, `FLEX_COLOR` constants at the top.
2. **Config constants** — `DAYS`, `MODULES`, `PX_PER_MIN`, `DEF_DD_DAGEN`.
3. **`PLAN_INFO`** — declarative metadata for all planning rules (label, type, description). This drives the Planregels UI and the engine.
4. **Scheduling engine** — pure functions that take the form state and return a weekly grid. Core pipeline:
   - Structural fill (which room/session gets how many appointments)
   - Selection solver (`shortFirst`, `spoedFirst` rules select which appointments go in vs. onto the "nog te plannen" list)
   - Ordering pass (`applyPlanRules`) — sorts within each session
   - Time layout — assigns pixel positions for the calendar view
5. **React UI** — four tabbed modules: *Spreekuurtijden* (session times), *Gegevens invoer* (appointment codes), *Planregels* (rule configuration), *Rasterproces* (the live grid).

The engine is **deterministic**: same inputs → same grid. No randomness.

## Higgsfield reference images

During development, Higgsfield AI was used to generate five reference images (`g1.png` – `g5.png`) and one thumbnail (`r1.png`). These are committed to the repo root.

**What they are:** visual mockups / rendered UI concepts illustrating target states of the scheduling interface — used as a design brief when implementing new layout features and as a before/after record of visual changes.

**How they were made:** via the Higgsfield `generate_image` MCP tool, prompting for a clean Dutch medical scheduling UI with the blue/white Slingeland-style palette matching `C.primary` (`#1C6EA4`). The five `g*.png` files are the main layout references; `r1.png` is a small raster-icon crop used as a thumbnail reference.

**When to regenerate:** only when the UI design direction changes significantly. Use `generate_image` via the Higgsfield MCP with a prompt that matches the current palette and component structure.

## Planning rules (engine concepts)

| Rule | Effect |
|---|---|
| `shortFirst` | (1) orders the 3 shortest physical appointments first within a session; (2) prefers scheduling short appointments when capacity is tight |
| `spoedFirst` | urgent appointments are never dropped to "nog te plannen" while they fit |
| `certainFirst` | low-uncertainty appointments early; uncertain ones just before flex buffers |
| `digitalMode` | `spread` / `cluster` / `end` — placement of remote consultations |
| `kamerVerdeling` | `dagdeel` (sequential fill) vs. `gelijk` (balanced across rooms) |
| `groupMode` | `spread` (interleave codes) vs. `wave` (group by code block) |

## Development workflow

1. Edit `raster_model_2.jsx`.
2. Run `npm run build` to regenerate `dist/polimodel.html`.
3. Open the HTML file in a browser to verify the change visually.
4. Commit both `raster_model_2.jsx` **and** `dist/polimodel.html` together.

There are no automated tests. Correctness is verified manually by checking the calendar grid, the KPI dashboard, and the "nog te plannen" list against expected outcomes.

## Commit style

Commits are written in Dutch, describing *what changed in the engine or UI* and *why*. Prefix with the subsystem when relevant (e.g. `Selectie-solver:`, `Regels-engine:`, `Fix:`).
