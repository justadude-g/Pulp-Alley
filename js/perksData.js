// perksData.js
// Background/League Perks transcribed from the Pulp Alley 2nd Edition Core
// Rules (2019), "Background Perks" chapter (page 22-26). Perks permanently
// consume league roster slots — see js/rosterRules.js for the roster math.
//
// Associates (a separate, non-scenario support mechanic) are not included
// here since the League Roster page models colleagues + perks, matching
// what the rulebook calls out on page 8.

export const PERKS = [
  { name: 'Dominion', slots: 0, text: 'This perk grants access to the Minions, Gifts, and Cult assets. You cannot use your Resource points to select Backup, Contacts, or Gear assets.' },

  { name: 'Altar', slots: 1, text: 'During set-up roll 1d6. On a 4+ you may select two Level 1 Minions or one Level 2 Minion to join your league for this scenario.' },
  { name: 'Amphibians', slots: 1, text: 'One or more characters on this roster may include the Aquatic ability in addition to their starting abilities.' },
  { name: 'Base', slots: 1, text: 'During set-up roll 1d6. On a 4+ you gain +1 Resource point (Backup, Contacts, or Gear) for an asset, vehicle, or mount. This point cannot be saved.' },
  { name: 'Companions', slots: 1, text: 'Each Ally on your league roster starts with one additional ability. This league roster can never include a Sidekick (level 3) character.' },
  { name: 'Garage', slots: 1, text: 'During set-up, your league receives +1 Gear point for a vehicle or modifications. This point cannot be saved.' },
  { name: 'Jack of All Trades', slots: 1, text: 'During set-up, you may spend one Tips, Contacts, Gear, or Backup point to select a level 1 ability for your Leader. This ability lasts for the duration of this scenario.' },
  { name: 'Keen Senses', slots: 1, text: 'Once per turn, you may give one of your characters a +1 bonus to dodge a peril.' },
  { name: 'Long Range', slots: 1, text: 'Characters in this league ignore the –1 penalty for long range. Characters in this league may re-roll 1 Shoot die during their activation if they do not move.' },
  { name: 'Mastermind', slots: 1, text: 'Your league roster does not include a Leader (Level 4) character. Instead, select a free (0 slot) Sidekick to fill the Leader role for scenarios. Additionally, your league receives 6 extra roster slots to select level 1 and level 2 characters only.' },
  { name: 'On the Run', slots: 1, text: 'At the end of set-up, all your unused Tips, Contacts, Gear, and Backup points are lost. Once per turn, after a challenge is revealed for one of your characters, you may replace it with a new challenge drawn from the deck.' },
  { name: 'Reanimated', slots: 1, text: 'One or more characters on this roster may include the Reanimated ability in addition to their starting abilities.' },
  { name: 'Resourceful', slots: 1, text: 'Once per turn, as an action for one of your characters, you may discard and then draw 1 Fortune card.' },
  { name: 'Short Range', slots: 1, text: 'Characters in this league cannot shoot over 12”. Characters in this league may re-roll one Brawl die during their own activation.' },
  { name: 'Specialists', slots: 1, text: 'Reduce three of your leader’s skills by one dice-type. All other colleagues raise one skill to the next higher dice-type. Note, your Leader cannot have any no-dice skills.' },
  { name: 'Stable', slots: 1, text: 'During set-up, your league receives +1 Gear point for a mount or mount abilities. This point cannot be saved.' },
  { name: 'Well Armed', slots: 1, text: 'Once per turn, before you roll Shoot or Brawl for one of your characters, you may cancel a –1 penalty.' },
  { name: 'Workshop', slots: 1, text: 'During set-up, your league receives +1 Gear point for a gun or modifications. This point cannot be saved.' },

  { name: 'Ancient Sect', slots: 2, text: 'Dominion required. During set-up, roll your Leader’s Finesse dice. Each success (4+) adds a +1 Contacts point for selecting Cult assets. These points cannot be saved.' },
  { name: 'Animals', slots: 2, text: 'One or more characters on this roster may include the Animal ability in addition to their starting abilities.' },
  { name: 'Bastion of Science', slots: 2, text: 'During set-up, roll your Leader’s Cunning dice. Each success (4+) adds +1 Gear point for selecting assets. These points cannot be saved.' },
  { name: 'Call to Arms', slots: 2, text: 'During set-up, roll your Leader’s Might dice. Each success (4+) adds +1 Backup point for selecting level 1 or level 2 Backup characters. These points cannot be saved.' },
  { name: 'Company of Heroes', slots: 2, text: 'Your league may include a second Sidekick. In addition to the cost of this perk, this second Sidekick also requires 3 roster slots.' },
  { name: 'Dark Pact', slots: 2, text: 'Dominion required. During set-up, roll your Leader’s Cunning dice. Each success (4+) adds +1 Gear point for selecting Gifts assets. These points cannot be saved.' },
  { name: 'Flyers', slots: 2, text: 'One or more characters on this roster may include the Winged ability in addition to their starting abilities.' },
  { name: 'Greater Purpose', slots: 2, text: 'Opponents do not become Director by clearly winning a fight against your level 1 and 2 characters.' },
  { name: 'Nefarious', slots: 2, text: 'Characters in your league may shoot into a brawl which includes a colleague. Shooting into a brawl is an unopposed attack and all hits are assigned randomly to the engaged characters.' },
  { name: 'Network of Supporters', slots: 2, text: 'During set-up, roll your Leader’s Finesse dice. Each success (4+) adds a +1 Contacts point for selecting assets. These points cannot be saved.' },
  { name: 'Noblesse', slots: 2, text: 'One or more characters on this roster may include the Noblesse ability in addition to their starting abilities.' },
  { name: 'Overlord', slots: 2, text: 'Dominion required. During set-up, roll your Leader’s Might dice. Each success (4+) adds +1 Backup point for selecting level 1 and level 2 Minions. These points cannot be saved.' },
  { name: 'Riders', slots: 2, text: 'One or more characters on this roster may include the Mounted ability in addition to their starting abilities.' },
  { name: 'Shapeshifters', slots: 2, text: 'One or more characters on this roster may include the Shapeshifter ability in addition to their starting abilities.' },
  { name: 'Skilled', slots: 2, text: 'Characters in this league may re-roll one Might, Finesse, or Cunning die during their activation.' },
  { name: 'Tenacious', slots: 2, text: 'Once per turn, when an enemy activates within 6” of one of your injured (including down) characters, you may discard to roll an immediate Recovery check for that character.' },

  { name: 'Daredevil Adventurers', slots: 3, text: 'One or more characters on this roster may include the Daredevil ability in addition to their starting abilities.' },
  { name: 'Eagle-Eyed Troopers', slots: 3, text: 'One or more characters on this roster may include the Eagle-Eyed ability in addition to their starting abilities.' },
  { name: 'Intrepid Explorers', slots: 3, text: 'One or more characters on this roster may include the Intrepid ability in addition to their starting abilities.' },
  { name: 'Shadowy Agents', slots: 3, text: 'One or more characters on this roster may include the Shadowy ability in addition to their starting abilities.' },

  { name: 'Duo', slots: 4, text: 'Your Sidekick starts with one additional ability and a Health of d10. Your league can only include one Leader, one Sidekick, perks, and Associates. This roster can never include any Level 1 or Level 2 characters. The cost of this perk does not include the Sidekick.' },

  { name: 'League of Legends', slots: 10, text: 'Your league includes four Sidekicks (included in the cost of this perk), but does not include a Leader level character. Instead, select one of these Sidekicks to fill the role of Leader for the scenarios.' },
];

export const SLOT_ORDER = [0, 1, 2, 3, 4, 10];

export function findPerkByName(name) {
  const n = (name || '').trim().toLowerCase();
  if (!n) return null;
  return PERKS.find(p => p.name.toLowerCase() === n) || null;
}

export function searchPerks(query, limit = 8) {
  const q = (query || '').trim().toLowerCase();
  if (!q) return [];
  const starts = [];
  const contains = [];
  for (const p of PERKS) {
    const n = p.name.toLowerCase();
    if (n.startsWith(q)) starts.push(p);
    else if (n.includes(q)) contains.push(p);
  }
  return [...starts, ...contains].slice(0, limit);
}
