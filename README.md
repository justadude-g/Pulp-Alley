# Pulp Alley Card Maker

A free, static web app for designing custom **Pulp Alley 2nd Edition** character
cards and printing them as a ready-to-cut A4 roster sheet. No installs, no
accounts, no build step — open `index.html` (or host it on GitHub Pages) and go.

## Features

- **Card Designer** — enter Name, Level, the six stats (Brawl, Shoot, Dodge,
  Might, Finesse, Cunning as dice pools), any number of Abilities, an optional
  flavor quote, and a starting Health die. Upload your own character artwork,
  then zoom/drag it directly on the live preview to frame it.
- **Level & Health auto-fill by Card Type** — Leader, Sidekick, Ally,
  Follower, and Gang each have a rules-fixed Level and starting Health die
  (Core Rules p. 8-9: Leader = Level 4/d10, Sidekick = Level 3/d8, Ally =
  Level 2/d6, Follower = Level 1/d6*, Gang = Level 2). Picking one of these
  as Card Type fills in Level and Health automatically — both stay normal,
  editable fields afterward for homebrew exceptions. Villain/Creature/Custom
  aren't part of that table, so picking them never overrides a level you
  already set.
- **Ability autocomplete** — start typing an ability name and pick from all
  131 official abilities (Level 1–4 + Epic, transcribed from the Core Rules)
  to fill in its exact rules text automatically. You can still type any
  custom/homebrew ability name — it just won't autocomplete.
- **Ability Library** — "Browse Ability Library" opens a searchable, filterable
  catalog of all 131 abilities sorted by level exactly as in the rulebook
  (Level 1 → 2 → 3 → 4 → Epic). Filter to one level or search by name/text,
  then hit + on any ability to add it straight to the character card you're
  building — the library stays open so you can add several in a row. It also
  won't let you add the same ability to a card twice, matching the rulebook's
  "No Duplicates" rule.
- Cards render at true **Standard Playing Card size** — 2.5″ × 3.5″ at 300dpi
  (750×1050px) — so exported PNGs are print-ready.
- **Light background by default** — designed for home inkjet/laser printing:
  near-white card face, color used only in thin lines, small fills, and text,
  so a page of 9 cards uses a fraction of the ink a solid dark card would. A
  Dark theme is also available (Card Background dropdown) if you want the
  punchier look for screen use.
- **My Cards** — save cards locally in your browser (IndexedDB), edit or
  delete them later, no server required.
- **League Roster** — build a league following the Core Rules' roster math
  (p. 8): 10 base slots, Leader = 0 slots (1 per league), Sidekick = 3 slots
  (normally 1), Ally = 2, Follower = 1, Gang = 2. Add colleagues straight
  from your saved cards, browse and add any of the 36 official Background
  Perks (p. 22-26) — which permanently cost slots too — and watch the slot
  meter and rule warnings (too many Leaders/Sidekicks, over budget) update
  live. Save multiple named rosters and switch between them.
- **Gangs** — pick "Gang" as the Card Type and the Stats section becomes a
  "Current Models" field (default 5) that auto-fills Brawl/Shoot/Might as
  1d6 per 2 models and Dodge/Cunning/Finesse as a flat 1d6, matching the
  Gang rules (p. 21) — the auto-filled numbers stay normal, editable fields
  in case a perk or homebrew rule changes the math. The Health section
  switches to a model-count track (e.g. 5 → 4 → 3 → Out) instead of a
  die-based track, since gangs never roll Health checks. The Ability
  Library and autocomplete automatically filter to the 6 Gang-only
  abilities (Armed, Dangerous, Disciplined, Loyal, Mob, Sixth-Man) plus the
  specific Level 1-2 abilities Gangs are allowed to take (p. 22).
- **Print Sheet (A4)** — pick up to 9 saved cards and lay them out on an A4
  page at true size with crop marks. Download as PNG, download as PDF, or
  print directly from the browser.
- **Export / Import Backup** — every saved card and roster lives only in
  this browser's IndexedDB (see Data & privacy below), so "Export Backup" in
  the top bar bundles all of it — including portrait images and rendered
  card art, already embedded as data URLs on each record — into one JSON
  file. "Import Backup" reads that file back in on this browser, a
  different browser, or a different device. Import merges by ID: anything
  in the backup overwrites a local card/roster with the same ID, but
  nothing already saved locally is deleted.
- Fully offline-capable: fonts and the PDF library are bundled in the repo,
  no third-party CDN calls at runtime.

## Using it locally

No build step, and no `type="module"` scripts — every script is a plain
`<script src="...">`, loaded in dependency order, specifically so the app
works the same whether it's served or opened directly. Any static file
server works:

```bash
npm run start        # python3 -m http.server 8000
# then open http://localhost:8000
```

or just open `index.html` directly in a browser by double-clicking it —
file uploads, canvas rendering, IndexedDB, and the PDF download button
(`window.jspdf`, bundled at `js/vendor/jspdf.umd.min.js`) all work fine
from `file://`.

## Deploying to GitHub Pages

1. Create a new GitHub repo and push this folder's contents to it.
2. In the repo, go to **Settings → Pages**, set **Source** to the `main`
   branch (root), and save.
3. Your app will be live at `https://<your-username>.github.io/<repo-name>/`.

## Printing tips

- When printing the A4 sheet, set your print dialog to **100% / Actual
  size**. Do **not** use "Fit to page" — that will scale the cards away from
  their true 2.5″×3.5″ size.
- The crop marks sit just outside each card edge so you can trim with a
  straight edge or guillotine cutter.
- For the crispest results, use "Download PDF" and print that file rather
  than printing straight from the browser tab.

## Project structure

```
index.html          Single-page app (Card Designer / My Cards / Print Sheet)
css/styles.css       App UI styling
css/fonts.css         Self-hosted Inter + Rajdhani font faces
js/cardRenderer.js    Canvas renderer for a single card (750x1050px)
js/roster.js          A4 sheet layout (3x3 grid + crop marks)
js/db.js               IndexedDB wrapper for saved cards + rosters, backup export/import
js/app.js               Form wiring, portrait drag/zoom, gallery, exports, roster logic
js/abilitiesData.js     Full 131-ability catalog (Level 1-4 + Epic) + 6 Gang-only abilities
js/perksData.js         Full 36-perk catalog (Background Perks, p. 22-26)
js/rosterRules.js       League roster slot math (p. 8), incl. Gang cost
js/vendor/jspdf.umd.min.js   Bundled PDF export library
assets/fonts/           Self-hosted woff2 font files
test/verify.js, verify2.js   Playwright smoke tests (dev-only)
```

## Data & privacy

Everything happens in your browser. Saved cards and uploaded portraits are
stored in your browser's IndexedDB and never leave your machine — there's no
backend, no accounts, and nothing is uploaded anywhere. That also means
storage is local to one browser on one device: it won't follow you to a
different browser or a new computer, and clearing that browser's site data
wipes it. Use Export Backup periodically, or before switching browsers/
devices, to avoid losing your work.

## Rules reference

Card fields follow the *Pulp Alley 2nd Edition Core Rules* character profile
(Brawl, Shoot, Dodge, Might, Finesse, Cunning, Abilities, Health) and the
Health track (starting die → ... → d6 → Down → Out).
