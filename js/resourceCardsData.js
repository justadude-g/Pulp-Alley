// resourceCardsData.js
// Data tables for the Resources & Assets chapter (Core Rules p. 93-100):
// Contacts, Gear, Backup, and — gated by the Dominion perk in the actual
// rules — Minions, Cult, and Gifts. Tips (p. 93) has no discrete per-item
// table of its own (just 3 always-available bullet rules, not something you
// pick from a list), so it isn't a pickable Card Type here.
//
// Each entry is { name, cost, description }. Gear's "Gadgets" sub-table
// (p. 96) is folded directly into GEAR_ITEMS rather than kept as a separate
// Card Type — each Gadget's own description leads with "Gadget." and ends
// with the shared Mishap rule, so the card itself stays self-explanatory
// without needing a separate data field or on-card icon. Backup and
// Minions' rulebook tables are shaped Level/Cost/Health/Skills & Abilities
// rather than a flat Asset/Cost/Description — their Health and Skills &
// Abilities columns are folded into `description` as plain text, so every
// Resource Card Type can share one rendering + picking pipeline (see
// renderAssetCard in cardRenderer.js and the Asset Library modal in
// app.js).

const RESOURCE_CARD_TYPES = ['Contacts', 'Gear', 'Backup', 'Minions', 'Cult', 'Gifts'];

// Shared Mishap explanation appended to every Gadget's own description
// (p. 96): "Each time you draw to determine the X number for a Gadget,
// check the story-icon in the bottom-right corner of the card. A mishap
// occurs when you draw the Alarm icon — the gadget does not function and
// is removed from play, and you must immediately roll for the peril
// challenge on the same card."
const GADGET_MISHAP_NOTE = 'Mishap: Each time you draw to determine the X number for this Gadget, check the story-icon in the bottom-right corner of the card. An Alarm icon means a mishap — the Gadget does not function and is removed from play, and you must immediately roll for the peril challenge on the same card.';

// A character with an asterisk next to their Health die-type is knocked
// out when they fail a Health check — instead of going Down (p. 97/98).
const BACKUP_ASTERISK_NOTE = '*Knocked out instead of going Down on a failed Health check.';

const CONTACTS_ITEMS = [
  { name: 'Friendly Local', cost: 1, description: 'You gain one random level 1 Backup character.' },
  { name: 'Good Rumors', cost: 1, description: 'You may draw one extra Fortune card on turn #1.' },
  { name: 'Snitch', cost: 1, description: 'Shift your die-type up when rolling for starting Director.' },
  { name: 'A Few Maneuvers', cost: 2, description: "Your Leader gains the following ability:\n\nMindgame: This action may be used once per scenario. Roll an opposed Finesse check against the Director's Leader. If you win, you immediately become Director." },
  { name: 'Unexpected Ally', cost: 2, description: 'You gain one random level 2 Backup character.' },
  { name: 'Savoir-Faire', cost: 2, description: '(one use) Your Leader may pass one challenge automatically — instead of rolling.' },
  { name: 'Informant', cost: 3, description: 'Draw one Fortune card each time you become Director.' },
  { name: 'Quick Travel', cost: 3, description: 'You may pick a Random Event — instead of rolling.' },
  { name: 'One Step Ahead', cost: 3, description: 'Pick one of the following abilities for your Leader: Lucky Devil, Danger Sense, or Master of Disguise.' },
  { name: 'Disguise', cost: 3, description: 'Your Leader starts in hiding. While you are hiding, you may discard one Fortune card to automatically win an opposed spotting check — instead of rolling. You cannot use this effect when you attempt an ambush.' },
  { name: 'Double-Cross!', cost: 4, description: 'Your Leader gains the following one-use ability:\n\nBetrayal: Roll an opposed Finesse check against a Level 1 or Level 2 enemy. If you win, the target immediately joins your league for the remainder of this scenario.' },
];

const GEAR_ITEMS = [
  { name: 'Diving Suit', cost: 1, description: 'You gain the Aquatic ability.' },
  { name: 'Gadget X', cost: 1, description: '(one use) You automatically pass one Plot Point — instead of rolling.' },
  { name: 'Smoke Grenades', cost: 1, description: '(one use) As an action, place a 3" (dia.) area within 6". This area blocks line-of-sight until the end of the turn.' },
  { name: 'Utility Belt', cost: 1, description: '(one use) You automatically pass one Peril — instead of rolling.' },
  { name: 'Bulletproof Vest', cost: 2, description: 'You always count as in cover.' },
  { name: 'Chemical X', cost: 2, description: 'You gain one ability: Speedy, Eagle-Eyed, or Shadowy.' },
  { name: 'Explosives', cost: 2, description: 'You gain the following actions:\n\nPlant Charge: Place a charge counter next to your base.\n\nDetonate: Place a 3" burst centered on each of your charges, resolve as normal then remove your charges.' },
  { name: 'Flight Pack', cost: 2, description: 'You gain the Winged ability.' },
  { name: 'Deflector', cost: 2, description: 'You gain the Agile ability.' },
  { name: 'Body Armor', cost: 3, description: 'You gain the Armored ability.' },
  { name: 'Microgrenades', cost: 3, description: 'You gain the Burst Fire ability.' },
  { name: 'Quick Travel', cost: 3, description: 'You may pick a Random Event — instead of rolling.' },
  { name: 'Weapon X', cost: 3, description: 'You gain one ability: Marksman or Fierce.' },
  { name: 'Experimental Jetpack', cost: 4, description: '(one use) Instead of moving normally, you may move anywhere on the table, ignoring intervening terrain and characters. You encounter a peril at the end of this move.' },
  // Gadgets (p. 96) — folded into Gear rather than split into a separate
  // Card Type; each leads with "Gadget." and ends with the shared Mishap
  // rule so the printed card stays self-explanatory.
  { name: 'Boom-Bot', cost: 1, description: `Gadget. Add one Boom-Bot Backup to your league: Boom-Bot (Level 1) — 1d6 in all skills. Boom-Bot is automatically knocked out if it activates over 12" from its assigned character.\n\nBOOM: When Boom-Bot is knocked out, all characters within X" must roll for the peril on the X card. Note, if a mishap occurs, then there is no BOOM (no peril).\n\n${GADGET_MISHAP_NOTE}` },
  { name: 'Ray Projector', cost: 1, description: `Gadget. Once per turn, gain a +X Shoot bonus.\n\n${GADGET_MISHAP_NOTE}` },
  { name: '7-League Boots', cost: 1, description: `Gadget. During your activation, you may move an extra X" + 3".\n\n${GADGET_MISHAP_NOTE}` },
  { name: 'Shock Gauntlet', cost: 1, description: `Gadget. Once per turn, gain a +X Brawl bonus.\n\n${GADGET_MISHAP_NOTE}` },
  { name: 'Sonic Spanner', cost: 1, description: `Gadget. Instead of rolling for a challenge, you may automatically score X successes.\n\n${GADGET_MISHAP_NOTE}` },
  { name: 'Tesla Shield', cost: 2, description: `Gadget. When you take two or more hits, you may cancel X hits.\n\n${GADGET_MISHAP_NOTE}` },
  { name: 'Phase Vest', cost: 2, description: `Gadget. Instead of moving as normal, remove your character from the table and place a phase counter where the model was removed. On the next turn, when you have the option to activate a character, move the counter up to 16" in any direction and then return the character to the table X" away from their phase counter. Continue their activation as normal — unless a mishap occurs. If there is a mishap, roll for the peril as normal, then your activation ends automatically.\n\n${GADGET_MISHAP_NOTE}` },
  // Added from "Additional Perks & Abilities.pdf" — plain Gear except Pif
  // Gadget, whose own rules text says it does not check for its own
  // failure (so it deliberately omits GADGET_MISHAP_NOTE). "Rocket Pack"
  // from the same PDF was excluded — it's a functional duplicate of the
  // existing "Flight Pack" (both cost 2, both grant Winged).
  { name: 'Boarding Hook', cost: 1, description: 'For this scenario, this character may board a vehicle that is one level directly above or below them.' },
  { name: 'Anti Tank', cost: 2, description: 'For this scenario, this character ignores Size when shooting at a vehicle.' },
  { name: 'Tank Buster', cost: 2, description: 'For this scenario, this character may use their Brawl to make an unopposed attack on a vehicle. This attack ignores Size, but does not ignore Armor.' },
  { name: 'Pif Gadget', cost: 3, description: "Gadget. After you draw a card to determine the X value for one of this character's other gadgets, you may choose to re-draw — if you do, you must keep the results of the second card. Note: a Pif Gadget does not check for failure itself, but may make your other gadgets more prone to failure if used carelessly." },
  // Added from "New Gadgets.pdf" — 3 plain Gear (no mishap check printed)
  // and 6 true Gadgets (Gadget/Gear/Item tag + mishap check), tagged per
  // the same convention as the rest of this array.
  { name: 'Turbo Encabulator', cost: 3, description: 'When an opponent plays a Fortune card effect, you may discard one card from your hand to cancel the effect before it is resolved.' },
  { name: 'Lotus-O-Delta', cost: 1, description: `Gadget. (one use) You gain a +X bonus to Might, Finesse, or Cunning.\n\n${GADGET_MISHAP_NOTE}` },
  { name: 'Sinusoidal Stator', cost: 1, description: `Gadget. (one use) You gain a +X bonus to Shoot or Dodge.\n\n${GADGET_MISHAP_NOTE}` },
  { name: 'Nofer Trunnion', cost: 1, description: `Gadget. (one use) You gain a +X bonus to Brawl or Dodge.\n\n${GADGET_MISHAP_NOTE}` },
  { name: 'Panendermic Boloid', cost: 2, description: '(one use) Instead of rolling a Recovery check for this character, the check is automatically passed.' },
  { name: 'Cardinal Grammeter', cost: 2, description: `Gadget. (one use) Draw X+1 Fortune cards.\n\n${GADGET_MISHAP_NOTE}` },
  { name: 'Barescent Skor', cost: 2, description: `Gadget. (once per fight) When you score 1 or more hits on an enemy, you may add an additional X hits.\n\n${GADGET_MISHAP_NOTE}` },
  { name: 'Fabulated Amulite', cost: 3, description: `Gadget. Whenever you suffer 1 or more hits, you may reduce the number of hits by X.\n\n${GADGET_MISHAP_NOTE}` },
  { name: 'Hydrocoptic Marzlevane', cost: 3, description: 'Whenever a character within 6" of this model encounters a peril, you may subtract 1 from the challenge.' },
];

const BACKUP_ITEMS = [
  { name: 'Level 1: Brawler', cost: 1, description: `Health: d6*. Skills: Brawl 2d6.\n\n${BACKUP_ASTERISK_NOTE}` },
  { name: 'Level 1: Shooter', cost: 1, description: `Health: d6*. Skills: Shoot 2d6.\n\n${BACKUP_ASTERISK_NOTE}` },
  { name: 'Level 1: Scout', cost: 1, description: `Health: d6*. Skills: Dodge 2d6.\n\n${BACKUP_ASTERISK_NOTE}` },
  { name: 'Level 1: Animal', cost: 1, description: `Health: d6*. Skills: Brawl 2d6, Shoot no-dice, Dodge 2d6.\n\n${BACKUP_ASTERISK_NOTE}` },
  { name: 'Level 2: Brawler', cost: 2, description: 'Health: d6. Skills: Brawl 3d6, Dodge 2d6.' },
  { name: 'Level 2: Shooter', cost: 2, description: 'Health: d6. Skills: Shoot 3d6, Dodge 2d6.' },
  { name: 'Level 2: Scout', cost: 2, description: 'Health: d6. Skills: Dodge 3d6, Finesse 2d6.' },
  { name: 'Level 2: Animal', cost: 2, description: 'Health: d6. Skills: Brawl 3d6, Shoot no-dice, Dodge 3d6.' },
  { name: 'Level 2: Gang (Armed)', cost: 2, description: 'Health: as a Gang (see Gangs rules). Ability: Armed.' },
  { name: 'Level 2: Gang (Dangerous)', cost: 2, description: 'Health: as a Gang (see Gangs rules). Ability: Dangerous.' },
  { name: 'Level 3: Brawler', cost: 3, description: 'Health: d8. Skills: Brawl 4d8, Shoot 2d6, Dodge 3d8, Might 4d8, Finesse 2d6, Cunning 2d6.' },
  { name: 'Level 3: Shooter', cost: 3, description: 'Health: d8. Skills: Brawl 2d6, Shoot 4d8, Dodge 3d8, Might 2d6, Finesse 2d6, Cunning 4d8.' },
  { name: 'Level 3: Scout', cost: 3, description: 'Health: d8. Skills: Brawl 2d6, Shoot 2d6, Dodge 4d8, Might 2d6, Finesse 4d8, Cunning 3d8.' },
  { name: 'Level 3: Animal', cost: 3, description: 'Health: d8. Skills: Brawl 5d8, Shoot no-dice, Dodge 4d8, Might 3d8, Finesse 2d6, Cunning 2d6.' },
  { name: 'Level 3: Custom', cost: 4, description: 'Create one Sidekick of your choice.' },
];

const MINIONS_ITEMS = [
  { name: 'Level 1: Living Dead', cost: 1, description: `Health: d6*. Skills: Dodge no-dice. Ability: Reanimated.\n\n${BACKUP_ASTERISK_NOTE}` },
  { name: 'Level 1: Mindless', cost: 1, description: `Health: d6*. Skills: Brawl 1d8, Might 1d8, Finesse no-dice, Cunning no-dice.\n\n${BACKUP_ASTERISK_NOTE}` },
  { name: 'Level 1: Swarm', cost: 1, description: `Health: d6*. Ability: Swarm.\n\n${BACKUP_ASTERISK_NOTE}` },
  { name: 'Level 1: Flyer', cost: 1, description: `Health: d6*. Ability: Winged.\n\n${BACKUP_ASTERISK_NOTE}` },
  { name: 'Level 2: Guardian', cost: 2, description: 'Health: d8. Skills: Brawl 2d6, Dodge no-dice, Might 2d8, Finesse no-dice.' },
  { name: 'Level 2: Cultist', cost: 2, description: 'Health: d6. Skills: Shoot 3d6, Dodge 2d6.' },
  { name: 'Level 2: Fanatic', cost: 2, description: 'Health: d6. Skills: Brawl 3d6, Dodge 2d6.' },
  { name: 'Level 2: Mob', cost: 1, description: 'Health: as a Gang (see Gangs rules). Ability: Mob.' },
  { name: 'Level 2: Fiends', cost: 2, description: 'Health: as a Gang (see Gangs rules). Ability: Swarm.' },
  { name: 'Level 3: Skin-Walker', cost: 3, description: 'Health: d8. Skills: Brawl 2d6, Shoot 2d8, Dodge 3d8, Might 2d6, Finesse 3d6, Cunning 4d8. Ability: Shapeshifter — choose Spawn, Mutant, or Spectre.' },
  { name: 'Level 3: Spawn', cost: 3, description: 'Health: d8. Skills: Brawl 4d8, Shoot no-dice, Dodge 3d8, Might 3d6, Finesse 3d8, Cunning 2d6. Ability: Indomitable.' },
  { name: 'Level 3: Mutant', cost: 3, description: 'Health: d10. Skills: Brawl 3d8, Shoot 2d6, Dodge 3d6, Might 3d10, Finesse no-dice, Cunning 2d6. Ability: Savage.' },
  { name: 'Level 3: Spectre', cost: 3, description: 'Health: d8. Skills: Brawl 2d6, Shoot 2d6, Dodge 4d8, Might 2d6, Finesse 3d8, Cunning 3d8. Ability: Shock.' },
];

const CULT_ITEMS = [
  { name: 'Eyes and Ears', cost: 1, description: 'You may draw one extra Fortune card on turn #1.' },
  { name: 'The Following', cost: 1, description: 'During set-up, select one type of level 1 Minion for your Following. At the start of each turn, if you are the Director, roll 1d6. On a 4+, deploy one of your Following.' },
  { name: 'Receive Dreams', cost: 1, description: 'Shift your die-type up when rolling for starting Director.' },
  { name: 'The Brethren', cost: 2, description: 'During set-up, select one type of level 2 Minion for your Brethren. At the start of each turn, if you are the Director, roll 1d6. On a 4+, deploy one of your Brethren.' },
  { name: 'Dark Oath', cost: 2, description: 'Draw one Fortune card each time you become Director.' },
  { name: 'Send Dreams', cost: 2, description: "Your Leader gains the following ability:\n\nMindgame: Roll an opposed Finesse check against the enemy Director's Leader. If you win, you immediately become Director. May be used once per scenario." },
  { name: 'Blood Oath', cost: 3, description: 'During set-up, remove one Ally or Follower from your roster to gain an additional ability for your Leader: Savage, Regenerate, or Inhuman.' },
  { name: 'Hearts and Minds', cost: 3, description: 'Instead of rolling a Recovery check for your Leader, remove a colleague from play within 6" of your Leader. Your Leader automatically passes this Recovery check.' },
  { name: 'Unspeakable Oath', cost: 3, description: 'Your Leader gains one of the following abilities: Dread Gaze, Aquatic, or Winged.' },
  { name: 'Possession', cost: 4, description: 'Your Leader gains the following one-use ability:\n\nControl: Roll an opposed Finesse check against a Level 1 or Level 2 enemy. If you win, the target immediately joins your league for the remainder of this scenario.' },
];

const GIFTS_ITEMS = [
  { name: 'Aura of Night', cost: 1, description: '(one-use) As an action, you cannot be rushed, targeted, or attacked for the remainder of this turn.' },
  { name: 'Glyph of Knowing', cost: 1, description: '(one-use) You automatically pass one challenge — instead of rolling.' },
  { name: 'Shadow Step', cost: 1, description: 'Instead of moving as normal, this character may move anywhere within 12", ignoring all intervening terrain and characters. You may use this effect even if you are currently engaged.' },
  { name: 'Talisman', cost: 2, description: 'You always count as in cover.' },
  { name: 'Ensorcelled Rune', cost: 2, description: 'You gain one of the following abilities: Winged, Shadowy, or Aquatic.' },
  { name: 'Glyph of Defense', cost: 2, description: 'Your Dodge is increased by +1d.' },
  { name: 'Doppelganger (Leader only)', cost: 3, description: "As a full action, target one Level 1 or 2 character (friend or foe) within 12\" to place a Doppelganger within 3\" of your base. The Doppelganger's profile is identical to the target. The Doppelganger is under your control, but does not come into play ready." },
  { name: 'Glyph of Power', cost: 3, description: 'You gain one ability: Marksman or Fierce.' },
  { name: 'Scry', cost: 3, description: 'You may pick a Random Event — instead of rolling.' },
  { name: 'Summoning Circle (Leader only)', cost: 4, description: 'During set-up, select one type of level 1 Minion for your summoning. As a full action, place X + 1 of these Minions within 3" of your base. These Minions are under your control and ready to activate this turn.' },
];

const RESOURCE_ITEMS_BY_TYPE = {
  Contacts: CONTACTS_ITEMS,
  Gear: GEAR_ITEMS,
  Backup: BACKUP_ITEMS,
  Minions: MINIONS_ITEMS,
  Cult: CULT_ITEMS,
  Gifts: GIFTS_ITEMS,
};

// General per-table rule reminders (p. 93-100) shown as a hint under the
// Card Designer's Asset Details fieldset — informational only, same
// "explain the rule, don't enforce it" philosophy as every other rules hint
// in this app.
const RESOURCE_TYPE_NOTES = {
  Contacts: 'All Contacts assets are temporary, purchased for one scenario only. Except where noted, they are not assigned to a specific character. You cannot select a Contacts asset more than once per scenario.',
  Gear: 'All Gear assets are temporary, purchased for one scenario only, and must be assigned to a specific character. You cannot assign an asset more than once to the same character. Gadgets carry a Mishap risk — see their own description.',
  Backup: 'All Backup assets are temporary, purchased for one scenario only. The Skills & Abilities line only lists skills over 1d6 — anything not listed is 1d6.',
  Minions: 'You cannot select Minions assets unless your league has the Dominion perk. All assets are temporary, purchased for one scenario only. Skills & Abilities only lists skills over 1d6.',
  Cult: 'You cannot select Cult assets unless your league has the Dominion perk. All assets are temporary, purchased for one scenario only. You cannot take the same Cult asset more than once per scenario.',
  Gifts: 'You must have the Dominion perk to select Gifts. All assets are temporary, purchased for one scenario only, and each must be assigned to a specific character — never the same Gifts asset twice to the same character.',
};

function resourceItemsForType(cardType) {
  return RESOURCE_ITEMS_BY_TYPE[cardType] || [];
}
