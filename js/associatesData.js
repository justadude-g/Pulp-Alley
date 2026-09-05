// associatesData.js
// Associate Abilities transcribed from the Pulp Alley 2nd Edition Core
// Rules (2019), "Associates" chapter (p. 27-28). Associates are a League
// Roster mechanic — non-character supporting cast (a butler, a bartender,
// a mentor, etc.) that cost a roster slot but never appear in scenarios
// themselves. See the League Roster tab in app.js / js/rosterRules.js for
// the roster-slot math (ASSOCIATE_SLOT_COST, ASSOCIATE_LEAGUE_CAP).

const ASSOCIATE_ABILITIES = [
  { name: 'Exploit Weakness', text: "Once during this scenario, at the start of any turn, you may select one enemy's ability. The selected ability has no effect for that character for the duration of the turn." },
  { name: 'Fortune’s Favor', text: 'Once per turn, when one of your characters encounters a challenge you may replace the challenge with one from your own hand.' },
  { name: 'Friend of a Friend', text: 'You gain +1 Contacts point.' },
  { name: 'Got the Goods', text: 'You gain +1 Gear point.' },
  { name: 'Got Your Back', text: 'You gain +1 Backup point.' },
  { name: 'In the Know', text: 'You gain +1 Tips point.' },
  { name: 'Infiltrate', text: 'All your characters may begin the scenario hidden and may sneak up to 6” — instead of 3”.' },
  { name: 'Lucky Charm', text: 'Your Leader gains Lucky Devil or Danger Sense (pick one).' },
  { name: 'Misdirection', text: 'One random enemy is delayed — does not deploy until turn #2.' },
  { name: 'Phantom Hand', text: 'At the end of each turn, you may discard. If you do so, each opponent must discard one random card.' },
  { name: 'Research & Rumors', text: 'Once per turn, you may discard to give one of your characters a +1 bonus for a challenge.' },
  { name: 'Supplies', text: 'Before the start of this scenario, you may select a level 1 ability for your Leader.' },
  { name: 'Tinker', text: 'You gain +2 Resource points to spend on a mount, vehicle, or Gadgets for this scenario. Note, these points cannot be saved for other scenarios.' },
  { name: 'Trickery & Tactics', text: 'You may draw one Fortune card each time your Leader passes a plot point.' },
  { name: 'Twist of Fate', text: 'At the start of any turn, instead of drawing as normal, you may discard any number of cards and then draw the same number of cards that you just discarded.' },
];

// Case-insensitive lookup by exact name.
function findAssociateAbilityByName(name) {
  const n = (name || '').trim().toLowerCase();
  if (!n) return null;
  return ASSOCIATE_ABILITIES.find(a => a.name.toLowerCase() === n) || null;
}

// Display order for the Ability Library when Card Type = Associate — a
// single flat bucket (Associate Abilities aren't leveled like character
// abilities), mirroring GANG_LEVEL_ORDER/LEVEL_ORDER in abilitiesData.js.
const ASSOCIATE_LEVEL_ORDER = ['Associate'];
