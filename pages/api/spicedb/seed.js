const { token, app_token, spicedbUrl } = require("./env");

const schema = `
definition user {}

definition plan {
  relation subscriber: user
  permission entitled = subscriber
}

definition org {
  relation owner: user
  relation admin: user
  relation clinician: user
  relation student: user

  permission manage = owner + admin
  permission teach = owner + admin + clinician
  permission learn = student
}

definition feature {
  relation required_plan: plan
  permission use = required_plan->entitled
}

definition flashcarddeck {
  relation owner_user: user
  relation owner_org: org
  permission edit = owner_user + owner_org->manage
  permission view = edit
}

definition repetitiondeck {
  relation owner_user: user
  relation owner_org: org
  permission edit = owner_user + owner_org->manage
  permission view = edit
}

definition post {
  relation author_user: user
  relation author_org: org
  relation shared_with_user: user
  relation shared_with_org: org

  permission manage = author_user + author_org->manage
  permission view = manage + shared_with_user + shared_with_org->learn + shared_with_org->teach
}
`.trim();

async function call(path, payload) {
  const r = await fetch(spicedbUrl + path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'X-App-Token': app_token
    },
    body: JSON.stringify(payload),
  });
  const text = await r.text();
  if (!r.ok) {
    throw new Error(`${path} ${r.status} ${text}`);
  }
  try { return JSON.parse(text); } catch { return text; }
}

// ---- Your data -------------------------------------------------------------

const users = [
  { uid: 'DUHKdqPmiPbUAlAIozDjGOiCTWz2', plan: 'ultimate' },
  { uid: 'sqQVWTnn3EejWrV1KQfxLrb9bTK2', plan: 'free' },
  { uid: 'xYLzcq9FkzNnpa59TiSfiG1Unim1', plan: 'pro' },
];

const repetitionDecks = [
  { id: 'AFMinMrZLtLhe0tXjWvt', ownerId: 'DUHKdqPmiPbUAlAIozDjGOiCTWz2' },
  { id: 'By2cyjiK2Wj0rgg12eD9', ownerId: 'DUHKdqPmiPbUAlAIozDjGOiCTWz2' },
];

const flashcardDecks = [
  { id: 'GFl9xjMUbCZQkiXNoDCP', ownerId: 'xYLzcq9FkzNnpa59TiSfiG1Unim1' },
];

const posts = [
  { id: '1JUwMwHW9AhXarLsYarm', authorId: 'DUHKdqPmiPbUAlAIozDjGOiCTWz2', published: true },
  { id: 'JwN8KY8b3ga8TAcxe9GG', authorId: 'DUHKdqPmiPbUAlAIozDjGOiCTWz2', published: true },
  { id: 'ORgEQW1h8z3k3S4Vz4Eq', authorId: 'DUHKdqPmiPbUAlAIozDjGOiCTWz2', published: true },
  { id: 'SRJS0ZP2ywNVBPCXi74i', authorId: 'DUHKdqPmiPbUAlAIozDjGOiCTWz2', published: true },
  { id: 'bq6tdwMMm7TpDxifYRjZ', authorId: 'DUHKdqPmiPbUAlAIozDjGOiCTWz2', published: true },
  { id: 'fMKbcGi8CYKQw51rErZ6', authorId: 'DUHKdqPmiPbUAlAIozDjGOiCTWz2', published: false }, // draft
  { id: 'pt9lGEMOjYpy7cy9is0K', authorId: 'DUHKdqPmiPbUAlAIozDjGOiCTWz2', published: true },
];

// Plans we support
const plans = ['free', 'pro', 'ultimate'];

// Features that are plan-gated
// flashcards & spaced_repetition require pro/ultimate (set below)
const features = [
  { id: 'flashcards', requiredPlan: 'pro' },          // pro+ can use
  { id: 'spaced_repetition', requiredPlan: 'pro' },   // pro+ can use
];

// ---- Build relationship updates -------------------------------------------

function obj(objectType, objectId) {
  return { objectType, objectId };
}
function subj(objectType, objectId) {
  return { object: { objectType, objectId } };
}
function rel(resource, relation, subject) {
  return { resource, relation, subject };
}
function touch(resource, relation, subject) {
  return { operation: 'OPERATION_TOUCH', relationship: rel(resource, relation, subject) };
}
function create(resource, relation, subject) {
  return { operation: 'OPERATION_CREATE', relationship: rel(resource, relation, subject) };
}

async function main() {
  console.log('Writing schema…');
  await call('/v1/schema/write', { schema });

  const updates = [];

  // Ensure plan objects exist and subscribe users
  for (const p of plans) {
    // Touch the plan object by touching a dummy relation with a dummy subject that we'll never use
    updates.push(touch(obj('plan', p), 'subscriber', subj('user', '__seed__')));
  }
  for (const u of users) {
    updates.push(create(obj('plan', u.plan), 'subscriber', subj('user', u.uid)));
  }

  // Create features and attach required plans
 for (const f of features) {
    updates.push(create(obj('feature', f.id), 'required_plan', subj('plan', f.requiredPlan)));
  }

  // Flashcard decks: owner-only
  for (const d of flashcardDecks) {
    updates.push(create(obj('flashcarddeck', d.id), 'owner_user', subj('user', d.ownerId)));
  }

  // Repetition decks: owner-only
  for (const d of repetitionDecks) {
    updates.push(create(obj('repetitiondeck', d.id), 'owner_user', subj('user', d.ownerId)));
  }

  // Posts: set author (published handled in app)
  for (const p of posts) {
    updates.push(create(obj('post', p.id), 'author_user', subj('user', p.authorId)));
  }

  console.log(`Writing ${updates.length} relationships…`);
  await call('/v1/relationships/write', { updates });

  console.log('Done ✅');
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
