// rosterRules.js
// League roster math from the Pulp Alley 2nd Edition Core Rules, page 8:
// "Your league roster starts with 10 slots." Each colleague fills slots
// based on level; perks permanently remove slots from the pool.

const BASE_ROSTER_SLOTS = 10;

// Slot cost + short rule text by character type (Leader is the one
// permanent, 0-slot member; a league normally allows only 1 Leader and
// only 1 Sidekick unless a perk like Company of Heroes says otherwise).
const ROSTER_SLOT_COST = {
  Leader: 0,
  Sidekick: 3,
  Ally: 2,
  Follower: 1,
  Gang: 2,
};

// Card types that aren't native league-roster roles (Villain/Creature are
// normally opposition, Custom is user-defined) default to an Ally-ish cost
// so they can still be tracked if someone adds one on purpose.
const DEFAULT_SLOT_COST = 2;

function slotCostForType(cardType) {
  return ROSTER_SLOT_COST[cardType] ?? DEFAULT_SLOT_COST;
}
