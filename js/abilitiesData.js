// abilitiesData.js
// Full ability catalog transcribed from the Pulp Alley 2nd Edition Core
// Rules (2019), "Abilities" chapter (Level 1-4) and "Epic Characters"
// chapter (Epic abilities). League Perks are not included here since
// they're a League Roster field, not a per-character card field — see
// perksData.js.
//
// Gangs (Card Type = "Gang") can only take the six Gang-only abilities
// below (GANG_ABILITIES) plus a specific subset of Level 1/2 abilities —
// those are flagged `gangEligible: true` on the entries below, matching
// the "Other Abilities" list on Gang Abilities (Core Rules p. 22).
//
// Used to power autocomplete in the Card Designer: pick a name, the
// official ability text fills in automatically. You can still type any
// custom ability that isn't in this list — it just won't autocomplete.

export const ABILITIES = [
  // ---- Level 1 ----
  { name: 'Agile', level: 1, text: 'Add +1 die to Dodge.' },
  { name: 'Animal', level: 1, text: 'Add +1 die to two skills. Reduce Shoot to no-dice.', gangEligible: true },
  { name: 'Aquatic', level: 1, text: 'You automatically pass the perils for difficult and perilous areas in deep water. In the deep, your line-of-sight is up to 12” and you ignore the –1 fight penalties.', gangEligible: true },
  { name: 'Armored', level: 1, text: 'You cannot move over 6” except to rush. You roll one bonus die for all Health checks.' },
  { name: 'Beast', level: 1, text: 'You cannot perform actions. Select two of the following abilities at no cost: Animal, Aquatic, Big, Fierce, Mindless, Reanimated, Speedy, Swarm, Winged.', gangEligible: true },
  { name: 'Brainy', level: 1, text: 'Add +1 die to Dodge and Cunning. Reduce Brawl to no-dice.' },
  { name: 'Brute', level: 1, text: 'Once per turn, you may re-roll one Brawl or Might die.', gangEligible: true },
  { name: 'Clever', level: 1, text: 'Add +1 die to Cunning.' },
  { name: 'Covert', level: 1, text: 'When you are hidden, an opponent must win the opposed spotting check to spot you.' },
  { name: 'Crafty', level: 1, text: 'Once per turn, you may re-roll one Dodge or Cunning die.', gangEligible: true },
  { name: 'Fierce', level: 1, text: 'Add +1 die to Brawl.', gangEligible: true },
  { name: 'Goon', level: 1, text: 'You cannot perform actions. Select two of the following abilities at no cost: Aquatic, Brute, Fierce, Marksman, Sharp, Slam, Trick, Winged.', gangEligible: true },
  { name: 'Hard-Nosed', level: 1, text: 'Once per turn, you may re-roll one Might, Finesse, or Cunning die.' },
  { name: 'Marksman', level: 1, text: 'Add +1 die to Shoot.', gangEligible: true },
  { name: 'Mighty', level: 1, text: 'Add +1 die to Might.' },
  { name: 'Mindless', level: 1, text: 'Raise Brawl and Might one dice-type. Reduce Cunning and Finesse one dice-type. Note, if a d6 skill is reduced then it drops to no-dice.', gangEligible: true },
  { name: 'Monster', level: 1, text: 'You are horrific (see Horror).' },
  { name: 'Mounted', level: 1, text: 'You may start each scenario riding a basic mount.' },
  { name: 'Plan', level: 1, text: 'Once per turn, you may discard to gain a +1 bonus to Dodge or Cunning.' },
  { name: 'Reanimated', level: 1, text: 'You automatically pass all 1d Health checks. Reduce Dodge to no-dice. You cannot block. You cannot move over 6” except to rush.', gangEligible: true },
  { name: 'Savvy', level: 1, text: 'Add +1 die to Finesse.' },
  { name: 'Shadowy', level: 1, text: 'You gain a +1 bonus to all opposed spotting checks.' },
  { name: 'Sharp', level: 1, text: 'Once per turn, you may re-roll one Shoot or Finesse die.', gangEligible: true },
  { name: 'Short Burst', level: 1, text: 'Action: Place the Short Burst (see Burst rules).' },
  { name: 'Slam', level: 1, text: 'Once per turn, you may discard to gain a +1 bonus to Brawl or Might.', gangEligible: true },
  { name: 'Sly', level: 1, text: 'Add +1 die to Dodge and Finesse. Reduce Brawl to no-dice.' },
  { name: 'Speedy', level: 1, text: 'You may move up to 16” — instead of 12”.', gangEligible: true },
  { name: 'Swarm', level: 1, text: 'You may play a peril from your Fortune hand on an enemy when they come into contact or activate in contact with you.', gangEligible: true },
  { name: 'Trick', level: 1, text: 'Once per turn, you may discard to gain a +1 bonus to Shoot or Finesse.', gangEligible: true },
  // Note: the Gang Abilities table (p. 22) lists True Believer under its
  // "Level 2" gang-eligible list, but its actual definition lives in this
  // Level 1 chapter — kept as level 1 here to match the ability's real text.
  { name: 'True Believer', level: 1, text: '(Followers, Allies, and Sidekicks only) Reduce Shoot to no-dice. When rolling for any other skill, you roll a number of dice equal to your character level. You ignore all modifiers except Fortune card effects. You can never have any other abilities.', gangEligible: true },
  { name: 'Two-Fisted', level: 1, text: 'Add +1 die to two skills. Reduce Shoot to no-dice.' },
  { name: 'Winged', level: 1, text: 'You may fly up to 16” and ignore the intervening terrain and characters. You cannot fly shoot during the same activation when you are at ground level.', gangEligible: true },

  // ---- Level 2 ----
  { name: 'Big', level: 2, text: 'Raise Health and Might one dice-type. Reduce Dodge and Finesse one dice-type. Note, if a d6 skill is reduced then it drops to no-dice.', gangEligible: true },
  { name: 'Long Burst', level: 2, text: 'Action: Place the Long Burst (see Burst rules).' },
  { name: 'Burst Fire', level: 2, text: 'Action: Place the 3” Burst (see Burst rules).' },
  { name: 'Close Combat', level: 2, text: 'You cannot shoot over 12”. Once per turn, you may discard to gain a +1 bonus to Brawl or Shoot.' },
  { name: 'Daredevil', level: 2, text: 'Once per turn, you gain a +1 bonus for a peril challenge.' },
  { name: 'Dithering', level: 2, text: 'Select two level 1 abilities at no additional cost. Your actions are impaired. Dithering is incompatible with abilities that prevent actions or reduce any skill to no-dice.' },
  { name: 'Doc', level: 2, text: 'Action: Target one down colleague that is in contact with your base and roll your Cunning dice. If you roll at least one success (4+), the colleague may re-roll their next Recovery check.' },
  { name: 'Drag', level: 2, text: 'You cannot shoot over 12”. After a shootout, if you scored 2 or more hits then you may immediately move the enemy into contact with you. Do not resolve another fight in this activation.' },
  { name: 'Eagle-Eyed', level: 2, text: 'Your close range goes up to 12", and long range is over 48".', gangEligible: true },
  { name: 'Faint of Heart', level: 2, text: 'Select two level 1 abilities at no additional cost. Your Recovery checks are impaired. Faint of Heart is incompatible with abilities that prevent actions or reduce any skill to no-dice.' },
  { name: 'Harmless', level: 2, text: 'An enemy that is over 6” away cannot target, attack, or rush you. You can never target or attack an enemy. Reduce your Brawl and Shoot to no-dice.' },
  { name: 'Hindrance', level: 2, text: 'Select two level 1 abilities at no additional cost. Select two of your skills to be hindered. Hindrance is incompatible with abilities that prevent actions or reduce any skill to no-dice.' },
  { name: 'Insight', level: 2, text: 'Once per turn, after a challenge is revealed for this character, you may replace it with a challenge from your Fortune hand.' },
  { name: 'Intrepid', level: 2, text: 'When you disengage, you may move 1” to 3”.' },
  { name: 'Impetuous', level: 2, text: 'Select two level 1 abilities at no additional cost. You cannot play any Fortune card effects during this character’s activations. Impetuous is incompatible with abilities that prevent actions or reduce any skill to no-dice.' },
  { name: 'Inventor', level: 2, text: 'During set-up, roll your Cunning. You equip one asset with a Gear cost equal or lower than the number of successes you roll.' },
  { name: 'Noblesse', level: 2, text: 'You cannot be knocked out by failing a Recovery check. While you are down, an enemy in contact with you may knock you out as an action if they pass a random challenge.' },
  { name: 'Relentless', level: 2, text: 'Once per turn, when you knock an enemy down or out during a brawl, you may immediately move up to 3” towards the closest enemy. Do not resolve another fight during this activation.', gangEligible: true },
  { name: 'Shapeshifter', level: 2, text: 'When you take this ability create one alternate profile of the same character type. If the starting profile includes abilities that affect your roster or resources (Commander, Wealthy, and so on), the same abilities must be on the alternate profile. Action: You may transform into your alternate profile. Automatic: You may instantly transform into your alternate profile at the start of your activation if you are engaged. Note, if you are injured when you transform, your Health remains at the same dice-type.' },
  { name: 'Shock', level: 2, text: 'Action: All lower level enemies within 12” must roll a 1d Health check. If failed, instead of being injured, you may immediately move the enemy 3”+ X” away.' },
  { name: 'Smoke', level: 2, text: 'Action: Place a 3” (dia.) area within 12”. This area is difficult and blocks line-of-sight. Remove the area at the end of turn.' },
  { name: 'Unearthly', level: 2, text: 'When an enemy fights you, they must substitute their Brawl and Shooting dice with their Cunning or Finesse dice (their choice). Otherwise, the fight is resolved as normal. You cannot shoot over 12”. You cannot move over 6” except to rush.', gangEligible: true },
  { name: 'Unlucky', level: 2, text: 'Select two level 1 abilities at no additional cost. When an opponent plays a Fortune card effect during this character’s activation, they draw 1 Fortune card. Unlucky is incompatible with abilities that prevent actions or reduce a skill to no-dice.' },

  // ---- Level 3 ----
  { name: 'Aid', level: 3, text: 'Once per turn, a colleague within 6" gains a +1 bonus for a challenge. The character cannot apply this bonus to themselves.' },
  { name: 'Bodyguard', level: 3, text: '(Sidekick only) Once per turn, when your Leader is attacked and you are within 3”, you may immediately swap locations with the Leader. Resolve the attack against you — instead of the Leader.' },
  { name: 'Brash', level: 3, text: 'You are not limited to rushing the nearest enemy.' },
  { name: 'Captain', level: 3, text: 'During set-up, you gain +1 Gear point for selecting vehicles. This point may not be saved for other scenarios.' },
  { name: 'Crackshot', level: 3, text: 'Your targets cannot roll cover saves.' },
  { name: 'Dashing', level: 3, text: 'Your Shoot and Finesse dice-type are not affected by injuries.' },
  { name: 'Deadeye', level: 3, text: 'You are not limited to shooting the nearest enemy.' },
  { name: 'Deductive', level: 3, text: 'Action: Draw one Fortune card.' },
  { name: 'Dread Gaze', level: 3, text: 'Action: Target one enemy anywhere on the table and roll an opposed Finesse check. If you win, the target cannot run or shoot this turn. Otherwise, there is no effect.' },
  { name: 'Gadgeteer', level: 3, text: 'When you pass a gadget mishap challenge, the mishap is ignored and your gadget continues to function as normal.' },
  { name: 'Gearhead', level: 3, text: 'During setup, you gain +1 Gear point for selecting gun modifications or vehicle modifications. This point cannot be saved for other scenarios.' },
  { name: 'Indomitable', level: 3, text: 'You may re-roll one Recovery check per turn.' },
  { name: 'Moxie', level: 3, text: 'You ignore the multiple fights penalty when rolling Brawl dice.' },
  { name: 'Muscles of Steel', level: 3, text: 'Your Brawl and Might dice-type are not affected by injuries.' },
  { name: 'Paralyzer', level: 3, text: 'Action: Target one enemy within 12" and line-of-sight, and roll an opposed Might check. If you win, the target cannot move (including disengage) this turn. Otherwise, there is no effect.' },
  { name: 'Quick-Dodge', level: 3, text: 'Once per turn, shift your Dodge dice-type down to gain a +2 Dodge bonus.' },
  { name: 'Quick-Shot', level: 3, text: 'Once per turn, shift your Shoot dice-type down to gain a +2 Shoot bonus against an enemy within close range.' },
  { name: 'Quick-Strike', level: 3, text: 'Once per turn, shift your Brawl dice-type down to gain a +2 Brawl bonus.' },
  { name: 'Quick-Witted', level: 3, text: 'Once per turn, shift your Might, Finesse or Cunning dice-type down to gain a +2 bonus to that skill.' },
  { name: 'Reach', level: 3, text: 'You can use your Brawl skill to shoot (ranged attacks, shootouts, and so on). You cannot shoot over 3”.' },
  { name: 'Ruthless', level: 3, text: 'You may shoot into a brawl involving a friendly character. This is an unopposed attack, and all hits are randomly assigned to the engaged characters—so you may hit your friend.' },
  { name: 'Savage', level: 3, text: 'Once per turn, after resolving a brawl, if you are still engaged then you may immediately start another brawl with the same enemy. Resolve the fight as normal.' },
  { name: 'Shrewd', level: 3, text: 'Your Dodge and Cunning dice-type are not affected by injuries.' },
  { name: 'Two-Guns', level: 3, text: 'Once per turn, after resolving a shootout, if the enemy did not go down or out then you may immediately start another shootout with the same enemy. Resolve the fight as normal.' },
  { name: 'Veteran', level: 3, text: 'You ignore the multiple fights penalty when rolling Shoot dice.' },

  // ---- Level 4 ----
  { name: 'Blaggard', level: 4, text: 'If an enemy goes down in contact with you, that player must discard or the enemy is immediately knocked out.' },
  { name: 'Cloak & Dagger', level: 4, text: 'Once per turn, after rolling an opposed spotting check, you may discard to gain +1 success. You cannot shoot over 12”.' },
  { name: 'Cloud Minds', level: 4, text: 'Action: you may hide even if you are currently in line-of-sight of an enemy.' },
  { name: 'Commander', level: 4, text: 'Add +4 slots to your league roster to use for level 1 and level 2 characters only.' },
  { name: 'Cursed Presence', level: 4, text: 'Action: Target one enemy to encounter a peril played directly from your Fortune hand. Line-of-sight is not required.' },
  { name: 'Danger Sense', level: 4, text: 'You automatically pass the first peril you encounter each turn.' },
  { name: 'Dark Presence', level: 4, text: 'Action: Place a 3” (dia.) area centered on you. This area is perilous and blocks line-of-sight for the remainder of the turn.' },
  { name: 'Disarming', level: 4, text: 'When fighting you, lower level enemies must roll a Finesse check before choosing a skill to use in the fight. If they fail to roll at least one success then they can only Dodge.' },
  { name: 'Drain Life', level: 4, text: 'Roll an immediate Recovery check if you clearly win a brawl.' },
  { name: 'Extraordinary', level: 4, text: 'Raise a d8 skill to d10.' },
  { name: 'Flying Tackle', level: 4, text: 'Once per turn, shift your Brawl dice-type down to give one engaged enemy a -1 penalty to all combat skills.' },
  { name: 'Foul', level: 4, text: 'If you clearly win a fight (brawl or shootout) then the enemy cannot roll any Recovery checks this turn.' },
  { name: 'Grappler', level: 4, text: 'When engaged with you, lower level enemies must roll a Might check before choosing a skill to use in the fight. If they fail to roll at least one success then they can only Dodge.' },
  { name: 'Hardboiled', level: 4, text: 'When fighting you, enemies suffer a –1 Dodge penalty.' },
  { name: 'Impervious', level: 4, text: 'When fighting you, enemies suffer a -1 Shoot penalty. Reduce Dodge one dice-type. Note, if your Dodge is reduced below d6, it drops to no-dice.' },
  { name: 'Inhuman', level: 4, text: 'Raise a d10 skill to d12.' },
  { name: 'Inspiring', level: 4, text: 'Once per turn, a colleague within 12" gains a +1 bonus for a challenge. The character cannot apply this bonus to themselves.' },
  { name: 'Intimidating', level: 4, text: 'When fighting you, lower level enemies must roll a Cunning check before choosing a skill to use in the fight. If they fail to roll at least one success then they can only Dodge.' },
  { name: 'Iron Will', level: 4, text: 'Action: Roll an immediate Recovery check.' },
  { name: 'Lucky Devil', level: 4, text: 'Fortune card effects that are played “When an enemy activates”, cannot be played when you activate.' },
  { name: 'Loyal Following', level: 4, text: 'All temporary characters, including backup, minions, and so on, also benefit from your league perks.' },
  { name: 'Master of Disguise', level: 4, text: 'You may start the scenario in hiding and may sneak up to 6” – instead of 3”.' },
  { name: 'Mindblast', level: 4, text: 'Action: All enemies within 12” must roll a Cunning check. Each enemy that fails to roll at least 1 success suffers a –1 penalty to all skills for the remainder of the turn and is immediately moved 3”+ X” directly away.' },
  { name: 'Nerves of Steel', level: 4, text: 'Once per turn, ignore a -1 penalty that is affecting you.' },
  { name: 'Rally', level: 4, text: 'At the end of each turn, one friendly Gang within 12” of you may roll a 1d6 Recovery check if they are below full strength (models). If passed (4+), return one model to the Gang.' },
  { name: 'Regenerate', level: 4, text: 'You roll 1d8 for all Recovery checks — instead of 1d6.' },
  { name: 'Rugged', level: 4, text: 'If you fail a Health check during a brawl, you may re-roll 1 die.' },
  { name: 'Scoundrel', level: 4, text: 'When an enemy goes down or out while in contact with you, you immediately take control of one random plot point they were holding. You now hold this plot point.' },
  { name: 'Summon', level: 4, text: 'Full Action: You may summon X level 1 Minions. These Minions must be placed within 3” and are ready to activate this turn. Note, during set-up you must identify one type of minion to summon for this scenario and place the models near the table.' },
  { name: 'Tactician', level: 4, text: 'When you deploy on the table, select one of the following Gang abilities: Armed, Dangerous, Disciplined, or Loyal. Your Gangs (except Mobs) count as having this additional ability while they are within 12” of you.' },
  { name: 'Untouchable', level: 4, text: 'You always count as being in cover.' },
  { name: 'Wealthy', level: 4, text: 'During set-up, you receive 1 resource point (Tips, Backup, Gear, or Contacts). This point may be spent on this scenario or saved.' },

  // ---- Epic ----
  { name: 'Blood Frenzy', level: 'Epic', text: 'When you knock an enemy down or out in a brawl, you may immediately move up to 6” towards the nearest enemy. If you engage another enemy, do not fight again this activation.' },
  { name: 'Concentrate', level: 'Epic', text: 'Once per turn, gain a +2 bonus to one skill. Note, this bonus remains in effect for the remainder of this turn.' },
  { name: 'Consume', level: 'Epic', text: 'If an enemy fails a Health check while in contact with you, that player must discard or the enemy is immediately knocked out.' },
  { name: 'Creeper', level: 'Epic', text: 'Select two Epic abilities at no additional cost. You can never move over 3” in a turn.' },
  { name: 'Dauntless', level: 'Epic', text: 'Your skill dice (all skills) are not affected by injuries.' },
  { name: 'Double-Dealing', level: 'Epic', text: 'On your activation, if you are engaged, you may perform an action or full action before fighting the enemy. After the action is resolved, continue the fight as normal.' },
  { name: 'Immolate', level: 'Epic', text: 'Action: Place a Heavy Burst (5” dia.). The center of this burst must be placed within 24” and in line-of-sight.' },
  { name: 'Giant', level: 'Epic', text: 'Raise your starting Health, Brawl, and Might up one dice-type (max d12). Reduce your Dodge and Finesse down one dice type. If a skill is reduced below d6, it drops to no-dice. You may be targeted by direct fire from guns.' },
  { name: 'Insidious', level: 'Epic', text: 'All enemies within 3” of you have their Recovery checks impaired (see Conditions).' },
  { name: 'Juggernaut', level: 'Epic', text: 'Your move is never restricted by enemy characters or card effects. Even if you are engaged you may move as normal.' },
  { name: 'Long Reach', level: 'Epic', text: 'You can use your Brawl skill to shoot (ranged attacks, shootouts, and so on). You cannot shoot over 12”.' },
  { name: 'Mend', level: 'Epic', text: 'When you pass a Recovery check, your Health improves by two dice-types — but cannot exceed your starting level.' },
  { name: 'Mesmerize', level: 'Epic', text: 'Full Action: Target one enemy within 12” and roll an opposed Cunning check. If you win, you control the target during their next activation. Note, you cannot have the character retreat.' },
  { name: 'Monstrous', level: 'Epic', text: 'Before you roll a Health check, the number of hits is reduced by 1. Your Dodge is reduced one dice-type. If a skill is reduced below d6, it drops to no-dice.' },
  { name: 'Predator', level: 'Epic', text: 'You begin each scenario in hiding and may sneak up to 12". You receive a +1 bonus to all opposed spotting rolls.' },
  { name: 'Protection', level: 'Epic', text: 'You automatically pass all perils and may move normally through all perilous areas.' },
  { name: 'Rampage', level: 'Epic', text: 'The area within 3" of your base is perilous for all enemies.' },
  { name: 'Revive', level: 'Epic', text: 'Once per turn, you may discard to automatically pass a Recovery check — instead of rolling.' },
  { name: 'Unspeakable', level: 'Epic', text: 'Lower level enemies suffer a -1 penalty to all skills when they are within 6".' },
];

// Display order matching the rulebook's chapter order.
export const LEVEL_ORDER = [1, 2, 3, 4, 'Epic'];

// The six Gang-only abilities (Core Rules p. 22). Gangs cannot have any
// abilities other than these plus the gangEligible-flagged entries above.
export const GANG_ABILITIES = [
  { name: 'Armed', level: 'Gang', gangOnly: true, gangEligible: true, text: 'This gang ignores the multiple fights penalty when rolling Shoot dice.' },
  { name: 'Dangerous', level: 'Gang', gangOnly: true, gangEligible: true, text: 'This gang ignores the multiple fights penalty when rolling Brawl dice.' },
  { name: 'Disciplined', level: 'Gang', gangOnly: true, gangEligible: true, text: 'This gang always counts as being in cover.' },
  { name: 'Loyal', level: 'Gang', gangOnly: true, gangEligible: true, text: 'This gang is not knocked out until it is down to one model.' },
  { name: 'Mob', level: 'Gang', gangOnly: true, gangEligible: true, text: 'This gang fills only one roster slot. Mobs roll 1d6 for all skills — including fighting. Mobs ignore all modifiers except for Fortune card effects.' },
  { name: 'Sixth-Man', level: 'Gang', gangOnly: true, gangEligible: true, text: 'This Gang includes 6 models — instead of 5.' },
];

// Display order for the Ability Library when Card Type = Gang.
export const GANG_LEVEL_ORDER = ['Gang', 1, 2];

// Returns the ability pool a given Card Type is allowed to browse/autocomplete
// from. Gangs get the 6 Gang-only abilities plus the gangEligible-flagged
// subset of Level 1/2 abilities; everyone else gets the normal catalog
// (which never contains Gang-only abilities).
export function abilitiesForCardType(cardType) {
  if (cardType === 'Gang') {
    return [...GANG_ABILITIES, ...ABILITIES.filter(a => a.gangEligible)];
  }
  return ABILITIES;
}

// Case-insensitive lookup by exact name, searching both the standard and
// Gang-only catalogs.
export function findAbilityByName(name) {
  const n = (name || '').trim().toLowerCase();
  if (!n) return null;
  return ABILITIES.find(a => a.name.toLowerCase() === n)
    || GANG_ABILITIES.find(a => a.name.toLowerCase() === n)
    || null;
}

// Substring search across ability names, ranked so names that start with
// the query come first. Capped to `limit` results. Pass `cardType` to
// restrict the search pool (e.g. 'Gang' restricts to gang-eligible
// abilities); omit it for the full standard catalog.
export function searchAbilities(query, limit = 8, cardType) {
  const q = (query || '').trim().toLowerCase();
  if (!q) return [];
  const pool = abilitiesForCardType(cardType);
  const starts = [];
  const contains = [];
  for (const a of pool) {
    const n = a.name.toLowerCase();
    if (n.startsWith(q)) starts.push(a);
    else if (n.includes(q)) contains.push(a);
  }
  return [...starts, ...contains].slice(0, limit);
}
