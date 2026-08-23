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
  already set. The d6* asterisk means no Down state — a Follower is
  knocked straight to Out on a failed Health check, and the card's Health
  bar reflects that (just D6* → OUT, no DOWN pill).
- **Reset Stats to Card Type** — Leader/Sidekick/Ally/Follower show a
  "↺ Reset to Card Type" button above Stats that fills in a valid starting
  dice allocation for the p. 9 budget (e.g. Leader's 4 skills at 3d10 + 2 at
  2d8) — a one-click starting point you can still hand-edit afterward to
  choose which specific skills got the higher tier. It's a deliberate
  button, not an auto-fill-on-change, so switching Card Type never
  silently overwrites stats you've already customized. Hidden for Gang
  (has its own model-based auto-fill) and Villain/Creature/Custom (no
  rulebook default).
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
  "No Duplicates" rule. Abilities above the current Card Type's level cap are
  shown dimmed and tagged "Above [Type] cap" — you can still add them for a
  homebrew exception, it's just flagged.
- **Ability rules warnings** — picking a Card Type shows the Core Rules p. 9
  skill-dice guideline for it (e.g. "Leader: pick 4 skills to start at 3d10,
  the other 2 at 2d8") above the Stats section, and the Abilities section
  checks your card against the p. 9 "Abilities Rules and Restrictions": too
  many abilities for the Card Type, an ability above the Level Restriction,
  the same ability twice (No Duplicates), two abilities reducing the same
  skill to no-dice (No-Dice), or two abilities that both prevent actions
  (No-Action). Like the League Roster warnings, these are informational only
  — nothing is blocked, since homebrew exceptions are common.
- **Rename an ability** — after picking an ability from autocomplete or the
  library, you can freely edit its displayed name (e.g. call Animal
  "Unarmed" to fit your character's genre) without touching what it actually
  does. The card keeps track of the ability's real rules-text identity
  underneath, shown as "Originally: Animal · reset" under the renamed field
  — rules checks (duplicates, no-dice, no-action, level cap) still key off
  the original ability, not the display name. Its description text is
  locked read-only once picked, so the rules stay exactly as printed —
  only the name is yours to customize. A freeform/homebrew ability (typed
  by hand, never picked from the catalog) keeps a fully editable text box.
- Cards render at true **Gamegenic Standard sleeve size** — 64mm × 89mm at
  300dpi (756×1051px) — so exported PNGs are print-ready and a printed
  card drops straight into a Standard sleeve (Magic/Pokémon-size).
- **Light background by default** — designed for home inkjet/laser printing:
  near-white card face, color used only in thin lines, small fills, and text,
  so a page of 9 cards uses a fraction of the ink a solid dark card would. All
  four corners are clean on Light — no accent lines. A Dark theme is also
  available (Card Background dropdown) if you want the punchier look for
  screen use, and two Classical (aged parchment) variants — with or without
  the background skull watermark — for a period feel.
- **Transparent portrait blending** — upload a character image with a
  transparent background (PNG/WebP/GIF) and the portrait box's fill behind it
  uses the card's own accent tint instead of a mismatched neutral gray, so
  only the character stands out against the card's color scheme. Previously
  transparent areas flattened to solid black; images are now re-encoded to
  preserve alpha instead of forcing JPEG.
- **My Cards** — save cards locally in your browser (IndexedDB), edit or
  delete them later, no server required.
- **League Roster** — build a league following the Core Rules' roster math
  (p. 8): 10 base slots, Leader = 0 slots (1 per league), Sidekick = 3 slots
  (normally 1), Ally = 2, Follower = 1, Gang = 2. Add colleagues straight
  from your saved cards, browse and add any of the 36 official Background
  Perks (p. 22-26) — which permanently cost slots too — and watch the slot
  meter and rule warnings (too many Leaders/Sidekicks, over budget) update
  live. Save multiple named rosters and switch between them. Known perk
  errata is flagged too: Dominion is incompatible with Network of
  Supporters, Bastion of Science, and Call to Arms — the Perk Library shows
  this on Dominion's own entry, and picking it alongside any of the three
  triggers a roster warning.
- **Associates** (p. 27-28) — non-character support cast (a butler, a
  bartender, a mentor, and so on) that cost 1 roster slot each. Give each
  one a name and pick 2 of the 15 official Associate Abilities from the
  dropdowns — the rules text shows underneath each pick. Warnings (again,
  informational only) flag more than the normal 2-Associate starting cap,
  the same ability picked twice on one Associate, or the same Associate
  Ability reused across different Associates in the league.
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
  their true 64mm×89mm (Gamegenic Standard sleeve) size.
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
js/associatesData.js    Full 15-ability catalog (Associate Abilities, p. 27-28)
js/rosterRules.js       League roster slot math (p. 8), incl. Gang + Associate cost
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
