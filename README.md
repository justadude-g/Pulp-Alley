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
  to frame it. Zoom runs from 0.3x up to 3x: 1x (the default) crops the
  image just enough to fill the portrait box edge-to-edge, same as before;
  below 1x shrinks the image so more of it fits — handy for a miniature
  photo with a lot of surrounding space — and the card's own background
  fills in as padding around it instead of forcing a crop.
- **Portraits are cropped to size on save** — hitting Save crops the
  stored portrait down to exactly what's framed at your current zoom/pan,
  instead of keeping the full uploaded photo around. This keeps your
  backup file small as you build up more cards, at the cost of the crop
  being permanent: re-zooming or re-panning further than what was saved
  needs the photo re-uploaded.
- **Duplicate** — "⧉ Duplicate" next to "New Card" makes a variation of
  the character you're currently editing: every field (Stats, Abilities,
  Quote, Theme, Card Background, the portrait art and its pan/zoom framing)
  carries over as-is, the name gets " (copy)" appended, and it's staged as
  a new, unsaved card — hit Save to keep both the original and the
  variation as separate cards in My Cards. Handy for a squad of similar
  Gang members, or a Leader's alternate-Level/alternate-loadout version.
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
- **No specific skill in a stat** — each stat's dice-type dropdown now
  offers 0 alongside the normal 6/8/10/12. Set a skill to 0 dice of 0 faces
  ("0" and "0") for a character who has no rating in it at all, and the
  card prints "–d–" in that row instead of the literal "0d0" — a clear,
  deliberate "nothing here" mark rather than something that reads as a
  data-entry mistake.
- **Ability autocomplete** — start typing an ability name and pick from all
  153 official abilities (Level 1–4 + Epic, transcribed from the Core Rules,
  plus the "New Special Burst Abilities" and "Non-Player Characters: Advanced
  Abilities" supplements) to fill in its exact rules text automatically. That
  text is a starting point, not locked in — edit it freely afterward to tweak
  wording or write a homebrew variant, same as the name. You can still type
  any custom/homebrew ability name from scratch — it just won't autocomplete.
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
  delete them later, no server required. Saving requires no confirmation
  unless the Name field is blank, in which case a quick "save it anyway as
  'Unnamed Character'?" prompt catches an accidental empty save before it
  becomes a nameless card buried in the list. Click cards to select as many
  as you want for the Print Sheet — selection isn't capped at 9 — or use
  "Select All" next to the counter to grab all of them in one click instead
  of one at a time — it's a toggle, so pressing it again clears the
  selection back to zero. A search box finds a card by (partial,
  case-insensitive) name, and Select All only grabs whatever's currently
  shown — handy once you've got more cards than fit on one screen. A
  "Card Type" filter dropdown next to the search box narrows My Cards down
  to a single type (Leader, Sidekick, Ally, Follower, Villain, Creature,
  Gang, Custom) and combines with the Theme filter below, so e.g. "Leaders
  only from the Star Wars Theme" is one dropdown pick each. A "Sort"
  dropdown controls the display order: "Name" (the default) sorts
  alphabetically, and "Latest" sorts by most-recently saved or edited
  first — pick "Latest" to find the card you were just working on.
- **Recently Deleted (undo)** — deleting a card or roster no longer erases
  it on the spot. It moves to "Recently Deleted" (top bar, next to Export/
  Import Backup, with a "(N)" badge while anything's in there), where you
  can Restore it back to My Cards/your roster list or Delete Forever it for
  real. Anything left untouched for 30 days is purged automatically the
  next time the app loads — long enough to catch a mistake, not a permanent
  second copy of everything you delete.
- **Themes — organize cards into your own collections** — the Card
  Designer has an optional "Theme" field where you can type any category
  you like ("Die Hard", "Star Wars", "Cyberpunk" — anything) to group
  related cards. Once you've used a Theme on one card, it shows up in the
  field's autocomplete so you can reuse it on the next one instead of
  retyping it, and a "Filter by Theme" dropdown appears in both My Cards
  and the League Roster's "Add from My Cards" picker, so you can narrow
  either list down to just one Theme's cards. Leave it blank on any card
  that doesn't need one — Theme is entirely optional and has no effect on
  how the card itself renders. My Cards' Theme filter also offers a "No
  Theme" option (right after "All Themes") that shows only the cards you
  haven't assigned a Theme to yet — handy for catching stragglers before
  you tidy everything into Themes. To fix a typo or reorganize without
  opening every card, pick a Theme in the filter and hit "Rename Theme"
  (it's disabled until a real Theme is selected): every card currently in
  that Theme is bulk-updated to the new name in one go. Renaming to an
  existing Theme's name merges the two.
- **Affiliation — an optional sub-group within a Theme** — a second,
  independent grouping field for when a Theme has natural sub-groups (e.g.
  "Rebel", "Empire", "Mercenaries" within a "Star Wars" Theme, or
  "Protagonist"/"Antagonist" within "Die Hard"), instead of baking the
  sub-group into the Theme name itself (which would turn "Star Wars" into
  several unrelated Theme entries and break filtering/renaming "every Star
  Wars card" as one group). Works like Theme — same free-text field with
  autocomplete in the Card Designer, its own "Filter by Affiliation"
  dropdown (with a "No Affiliation" option) in My Cards and the League
  Roster's "Add from My Cards" picker, and its own "Rename Affiliation"
  button that bulk-renames every card carrying it. The two filters combine
  (e.g. Theme "Star Wars" + Affiliation "Rebel" together). Unlike Theme,
  Affiliation suggestions/options are always scoped to a Theme, since the
  same Affiliation name can be reused across unrelated Themes (e.g.
  "Protagonist"/"Antagonist" under both "Die Hard" and some other movie):
  the Designer's autocomplete only offers Affiliations already used with
  whatever Theme is currently typed there, and each filter dropdown only
  offers Affiliations already used within whatever Theme its own paired
  Theme filter is set to — so picking "Die Hard" never suggests/offers
  "Rebel", "Empire", or "Mercenaries". No Theme selected yet (a blank
  Designer Theme field, or "All Themes" in a filter) falls back to every
  Affiliation in use, since there's no Theme yet to scope by. Like Theme,
  Affiliation is purely for organizing and filtering on this site — it's
  optional, has no effect on how the card renders, and never appears on the
  printed card.
- **League Roster** — build a league following the Core Rules' roster math
  (p. 8): 10 base slots, Leader = 0 slots (1 per league), Sidekick = 3 slots
  (normally 1), Ally = 2, Follower = 1, Gang = 2. Add colleagues straight
  from your saved cards — every Card Type except Gang is one-copy-only in
  the picker (add it once and it drops off the list, same as a unique named
  character), but since a Gang (p. 21) represents a generic group of
  similar mooks rather than one unique character, the same saved Gang card
  can be added more than once — the picker keeps offering it (showing a
  running "N already on this roster" count) and each copy costs its own 2
  slots. Any other Card Type can opt into the same behaviour with the
  Card Designer's "Non-Unique" checkbox — check it for a card that
  represents a type rather than a single named individual (e.g. a generic
  Rebel Commando or Scout Trooper Ally/Follower, as opposed to a named
  hero or villain), and it's then added and re-offered by the picker the
  same way a Gang is, still costing its own slots each time. Leave it
  unchecked (the default) for the usual one-copy-only unique character.
  The checkbox is hidden for Gang cards since they're already repeatable
  without it, and — like Theme and Affiliation — it's purely a roster-
  building convenience with no effect on how the card renders or prints.
  Colleagues are kept sorted automatically, highest Level first (Leader 4,
  Sidekick 3, Ally 2, Follower 1, per p. 8-9) — add them in any order and
  the list re-sorts itself, so you don't have to manually shuffle a Leader
  back to the top after adding an Ally first. Colleagues that share a
  Level keep whatever order you added them in. Browse and add any of the 41 official Background
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
- **Print Sheet (A4)** — pick any number of saved cards and lay them out on
  A4 page(s) at true size with crop marks, 9 per page (3x3 grid). More than
  9 selected spills onto as many pages as needed — each one labeled "Page N
  of M" and the heading summarizing the card/page counts — instead of being
  capped. Download as PDF (one file, all pages) or print directly from the
  browser either way; Download PNG stays available for a single page but is
  disabled once a sheet spans more than one, since a PNG can only hold one
  page's worth of image (Download PDF is the multi-page path).
- **Export / Import Backup** — every saved card and roster lives only in
  this browser's IndexedDB (see Data & privacy below), so "Export Backup" in
  the top bar bundles all of it — including portrait images and rendered
  card art, already embedded as data URLs on each record — into one JSON
  file, named `pulp-alley-backup-YYYY-MM-DD.json` using your computer's own
  local date (not UTC) — so it always matches whatever date it actually is
  where you are, even late in the evening when UTC has already rolled over
  to the next day. A Theme dropdown next to the button defaults to "All
  Themes" (everything, as above); picking a specific Theme instead exports
  only that Theme's cards, named e.g. `pulp-alley-backup-star-wars-YYYY-MM-DD.json`
  — handy for keeping exports small and self-contained once you've got a lot
  of cards across several Themes. A Theme-filtered export leaves rosters out
  entirely, since a roster can mix colleagues from more than one Theme, so
  there's no single Theme a roster itself belongs to. "Import Backup" reads
  any backup file back in — full or Theme-filtered — on this browser, a
  different browser, or a different device. Import merges by ID: anything
  in the backup overwrites a local card/roster with the same ID, but
  nothing already saved locally is deleted. Since everything lives only in
  this browser with no server copy, a dismissible reminder banner appears
  once 5 or more cards/rosters have changed since your last full (non-Theme-
  filtered) export — a nudge to back up before a cleared profile or a
  browser reinstall silently takes everything with it. It resets the clock
  on its own "Export Backup" button, or on the header one; dismissing it
  (✕) clears it for the rest of the session, and it reappears next time you
  reload if 5 more changes have piled up since.
- **Quick Reference** — a two-page cheat sheet distilled from the Core
  Rules, Terms & Flow v1.2, and the official Action Sequence reference,
  each page laid out in two columns. Page 1 covers the turn/health basics:
  the Director, key terms, the Direct & Act sequence, Health/Recovery, and
  Engagement/Dodge on the left; blocking Hits, dice modifiers, the Shooting
  and Brawling sequences, Fortune Cards — Peril and Challenge, and
  Competitive Rolls on the right. Page 2 (Core Rules p. 57-73) goes deeper
  on fights: Dodging, Disengage, Basic Modifiers (Close/Long Range,
  Multiple Fights, Moving Fast), and Defensive Fire on the left; Splitting
  Dice across multiple enemies, Cover Save, Shooting Engaged Characters,
  Bursts, and Stealth (Hide & Sneak, Spotting, Ambush) on the right.
  Viewable right in the tab, or "Save as PDF" downloads a real two-page PDF
  (drawn directly, not a screenshot of the page) sized to print on two
  sheets of A4 — no double-siding needed.
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
- Quick Reference's "Save as PDF" produces exactly 2 pages — the whole
  cheat sheet across two sheets of A4, no double-siding needed.

## Project structure

```
index.html          Single-page app (Card Designer / My Cards / League Roster / Print Sheet / Quick Reference)
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
