# Pulp Alley Card Maker

A free, static web app for designing custom **Pulp Alley 2nd Edition** character
cards and printing them as a ready-to-cut A4 roster sheet. No installs, no
accounts, no build step — open `index.html` (or host it on GitHub Pages) and go.

## Features

- **Card Designer** — enter Name, Level, the six stats (Brawl, Shoot, Dodge,
  Might, Finesse, Cunning as dice pools), any number of Abilities, an optional
  flavor quote, and a starting Health die. The Portrait Image control sits
  right under the live card preview (next to Save/Download/New) rather than
  buried at the bottom of the form, so it's always in view. Upload your own
  character artwork with the file picker, or just drop an image file
  anywhere on the card preview — then zoom/drag it directly on the preview
  to frame it.
- **Level, Health & Stats auto-fill by Card Type** — Leader, Sidekick, Ally,
  Follower, and Gang each have a rules-fixed Level, starting Health die, and
  starting stat-dice budget (Core Rules p. 8-9: Leader = Level 4/d10 with 4
  skills at 3d10 + 2 at 2d8, Sidekick = Level 3/d8, Ally = Level 2/d6,
  Follower = Level 1/d6*, Gang = Level 2 with its own model-based stats).
  Picking one of these as Card Type fills in Level, Health, and Stats
  immediately — all stay normal, editable fields afterward, so you can still
  hand-edit which specific skills got the higher tier, or make a homebrew
  exception. Villain/Creature/Custom aren't part of that table, so picking
  them never overrides values you already set. The d6* asterisk means no
  Down state — a Follower is knocked straight to Out on a failed Health
  check, and the card's Health bar reflects that (just D6* → OUT, no DOWN
  pill). Level itself is a dropdown limited to 0-4 — 4 is the rulebook
  maximum, so there's no reason to allow anything higher. A card saved
  before this change with a higher level (Level used to be a free-typed
  number) clamps to 4 the next time it's opened for editing.
- **Accent Color by Card Type (Gamegenic Prime Sleeves palette)** — each
  Card Type also defaults Accent Color to the matching Gamegenic Prime
  Sleeves color, so a card's look corresponds to the sleeve color you'd
  actually use for that role: Leader = Orange, Sidekick = Green, Ally =
  Blue, Follower = Black, Gang = Dark Gray, Villain = Red, Creature =
  Purple, Custom = Lime. Leader's orange is tuned toward yellow rather than
  red — a more red-leaning orange reads coral/pink once it's tinted light
  for the Stats/Card Type/Health backgrounds, and this stays unmistakably
  orange even at low opacity. It's a normal, editable color picker afterward —
  picking a Card Type or Card Background re-applies the default (same as
  Level/Health/Stats above), and a manual color choice sticks until the
  next time either of those changes. If Card Background is set to either
  Classical (parchment) variant, every Card Type defaults to plain black
  instead — a bright accent clashes with the aged-parchment look — until
  you pick your own color.
- **Stats and Abilities share one font size** — the Stats label ("Brawl",
  "Finesse", etc.) and dice-pool value (e.g. "3d10") render in Inter, the
  same family used for Abilities text, instead of the Rajdhani display face
  used for headline elements (Level, Card Type tag, Health pills) — and,
  beyond just matching family, all three literally share one font-size
  value. Changing the Ability Text Size dropdown (Small/Medium/Large/Extra
  Large) resizes Stats right along with the Abilities text, and if long
  ability text triggers the auto-shrink-to-fit, Stats shrinks in lockstep
  with it too — there's never a mismatch between how big the two read.
- **Reset Stats to Card Type** — a "↺ Reset to Card Type" button above
  Stats re-applies the current Card Type's p. 9 dice budget on demand — for
  snapping a hand-edited stat back to spec without having to reselect Card
  Type (which would also re-trigger the Level/Health/Accent Color auto-fill).
  Hidden for Gang (has its own model-based auto-fill) and Villain/Creature/
  Custom (no rulebook default).
- **Ability autocomplete** — start typing an ability name and pick from all
  153 official abilities (Level 1–4 + Epic, transcribed from the Core Rules,
  plus the "New Special Burst Abilities" and "Non-Player Characters: Advanced
  Abilities" supplements) to fill in its exact rules text automatically. You
  can still type any custom/homebrew ability name — it just won't autocomplete.
- **Ability Library** — "Browse Ability Library" opens a searchable, filterable
  catalog of all 153 abilities sorted by level exactly as in the rulebook
  (Level 1 → 2 → 3 → 4 → Epic). Filter to one level or search by name/text,
  then hit + on any ability to add it straight to the character card you're
  building — the library stays open so you can add several in a row. It also
  won't let you add the same ability to a card twice, matching the rulebook's
  "No Duplicates" rule. Abilities above the current Card Type's level cap are
  shown dimmed and tagged "Above [Type] cap" — you can still add them for a
  homebrew exception, it's just flagged. The 6 abilities from the
  Non-Player-Characters supplement (Crush, Evasive, Occult, Torment, Toxin,
  Vicious) are tagged "NPC only" the same informational way — nothing stops
  adding one to a Villain/Creature card for a homebrew NPC.
- **Non-Player Characters (advanced rules)** — picking Villain or Creature as
  Card Type shows a reference note summarizing the NPC supplement: NPCs are
  Passive (resting, patrolling, or wandering) until an enemy comes within 12"
  or a nearby character attacks or is attacked, then Alert (Brawler, Shooter,
  or Scout) for the rest of the scenario, and normally can't perform actions
  except via an ability that includes one, while driving a vehicle, or when a
  scenario allows it. This is reference text for the tabletop, not a card
  field — the "NPC only" abilities above are the part that actually prints.
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
  card drops straight into a Standard sleeve (Magic/Pokémon-size). The Card
  Type tag (top right) and the Health track pills (bottom) are sized for
  legibility at that print size, not just on screen.
- **Classical (no skull) background by default** — the Card Background
  dropdown defaults to the aged-parchment Classical look (no skull
  watermark), with the skull-watermark Classical variant right below it as
  the second option, then Ivory and Light after that for anyone who wants a
  lighter-ink, less thematic look. A Dark theme used to round out the
  dropdown but has been removed — it wasn't practical to print — though any
  card saved with it before this change still renders correctly. Under
  Classical, the DOWN and OUT health pills render in an opaque grey
  (matching the Might/Finesse/Cunning stat row) instead of a faint dark
  overlay — the Classical health bar itself is a solid olive-khaki color,
  so the old faint fill barely showed up against it and made DOWN/OUT hard
  to read. Ivory (warm off-white, easy on home inkjet/laser ink) and Light
  (pure white, lightest on ink) are both still one dropdown pick away; all
  four options keep clean corners with no accent lines.
- **Level badge** (top-left circle) — the level number is sized to fill the
  badge with much less surrounding empty space, while still staying clear
  of the ring even for an old saved card with a two-digit level from
  before Level became a 0-4 dropdown (see below). Under Classical, the
  badge itself is a bronze/brown medallion (dark ink ring, cream number)
  instead of a near-white cream circle — the white fill drew the eye away
  from the rest of the aged-parchment card.
- **Portrait aligned with Abilities, Stats tightened up to make room** —
  the portrait's left edge lines up with the Abilities text's left margin
  (rather than sitting flush against the card's literal edge) so the two
  columns of content read as aligned, and its right edge stays flush to
  the Stats table with no gap. Stats itself starts further right than it
  used to: its label-to-dice-value spacing is tighter, and its row
  backgrounds now extend all the way to the card's right edge instead of
  stopping short of it — the width that frees up goes to the portrait,
  which is meaningfully wider as a result.
- **Image Frame (off by default)** — a checkbox next to the Portrait Image
  picker controls the bordered look around the portrait. Off (the default)
  drops the accent-colored border entirely, giving the portrait the full
  box, and fills any transparent area of an uploaded PNG with the card's
  own background instead of a tinted box — so a transparent-background
  cutout blends directly into the card rather than sitting in a visible
  frame. On reproduces the original look: an accent-tinted fill behind
  transparent areas plus the bordered box. It's a per-card setting that
  saves and reloads with the card, like every other field.
- **Transparent portrait blending** — upload a character image with a
  transparent background (PNG/WebP/GIF) and, with Image Frame on, the
  portrait box's fill behind it uses the card's own accent tint instead of
  a mismatched neutral gray, so only the character stands out against the
  card's color scheme (with Image Frame off, see above — it blends with
  the card's plain background instead). Previously transparent areas
  flattened to solid black; images are now re-encoded to preserve alpha
  instead of forcing JPEG.
- **My Cards** — save cards locally in your browser (IndexedDB), edit or
  delete them later, no server required. Click cards to select up to 9 for
  the Print Sheet, or use "Select All" next to the counter to grab all of
  them in one click instead of one at a time — it's a toggle, so pressing
  it again clears the selection back to zero. With more than 9 saved
  cards, Select All takes the first 9 and lets you know, matching the
  Print Sheet's own per-page limit.
- **League Roster** — build a league following the Core Rules' roster math
  (p. 8): 10 base slots, Leader = 0 slots (1 per league), Sidekick = 3 slots
  (normally 1), Ally = 2, Follower = 1, Gang = 2. Add colleagues straight
  from your saved cards, browse and add any of the 41 official Background
  Perks (p. 22-26, plus later additions like Crewmates) — which permanently
  cost slots too — and watch the slot meter and rule warnings (too many
  Leaders/Sidekicks, over budget) update live. Save multiple named rosters
  and switch between them. Known perk errata is flagged too: Dominion is
  incompatible with Network of Supporters, Bastion of Science, and Call to
  Arms — the Perk Library shows this on Dominion's own entry, and picking it
  alongside any of the three triggers a roster warning.
- **Associates** (p. 27-28) — non-character support cast (a butler, a
  bartender, a mentor, and so on) that cost 1 roster slot each. Give each
  one a name and pick 2 of the 15 official Associate Abilities from the
  dropdowns — the rules text shows underneath each pick. Warnings (again,
  informational only) flag more than the normal 2-Associate starting cap,
  the same ability picked twice on one Associate, or the same Associate
  Ability reused across different Associates in the league.
- **Print Roster / Copy Roster / Download PDF** — the on-screen roster
  columns only show names and slot costs, which isn't enough at the table.
  These three buttons (top of the League Roster tab) all generate the same
  plain, ink-friendly reference sheet instead: league name and slot
  summary, every colleague with type and slot cost, and — the actual point
  of this — the *full rules text* of every perk and every Associate's
  chosen abilities, not just their names. Print Roster opens the browser's
  print dialog (from which you can also "Save as PDF"); Download PDF
  generates a ready-to-save file directly via the bundled PDF library, with
  real wrapped/paginated text rather than a fixed-size image, so it holds
  up whether the roster has 2 colleagues or 12; Copy Roster puts the same
  sheet on the clipboard (as rich formatted text where the browser
  supports it, so headings and bold survive) for pasting straight into
  Apple Notes, Google Docs, or anywhere else — no printer needed.
- **Gangs** — pick "Gang" as the Card Type and the Stats section becomes a
  "Current Models" field (default 5) that auto-fills Brawl/Shoot/Might as
  1d6 per 2 models and Dodge/Cunning/Finesse as a flat 1d6, matching the
  Gang rules (p. 21) — the auto-filled numbers stay normal, editable fields
  in case a perk or homebrew rule changes the math. The Health section
  switches to a model-count track (e.g. 5 → 4 → 3 → Out) instead of a
  die-based track, since gangs never roll Health checks. The Ability
  Library and autocomplete automatically filter to the 6 Gang-only
  abilities (Armed, Dangerous, Disciplined, Loyal, Mob, Sixth-Man) plus the
  specific Level 1-2 abilities Gangs are allowed to take (p. 22). The Health
  section also notes the Gangs & Horror errata: Gangs roll 1d6 for Horror
  checks, and may roll 1d6 to Recover from Horror cards/effects.
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
js/abilitiesData.js     Full 153-ability catalog (Level 1-4 + Epic, incl. Special Burst and NPC-only abilities) + 6 Gang-only abilities
js/perksData.js         Full 41-perk catalog (Background Perks, p. 22-26 + later additions)
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
