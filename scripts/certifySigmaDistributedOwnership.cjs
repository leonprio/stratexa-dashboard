const admin = require('firebase-admin');
const fs = require('node:fs');
const path = require('node:path');

const CLIENT = 'CEMENTOS_SIGMA';
const ROOT = path.resolve(__dirname, '..');
const BACKUP_DIR = path.join(ROOT, 'docs', 'backups');
const KEY = process.env.FIREBASE_ADMIN_KEY_PATH;
const IDS = [
  'asgn_oe_seed_sigma_oe01_agg-GENERAL-2026_-101', 'asgn_oe_seed_sigma_oe01_agg-GENERAL-2026_-104',
  'asgn_oe_seed_sigma_oe02_agg-GENERAL-2026_-103', 'asgn_oe_seed_sigma_oe02_agg-GENERAL-2026_-105',
  'asgn_oe_seed_sigma_oe03_agg-GENERAL-2026_-100', 'asgn_oe_seed_sigma_oe03_agg-GENERAL-2026_-102',
  'asgn_oe_seed_sigma_oe04_agg-GENERAL-2026_-106', 'asgn_oe_seed_sigma_oe04_agg-GENERAL-2026_-107',
  'asgn_oe_seed_sigma_oe05_agg-GENERAL-2026_-108'
];
if (!KEY || !fs.existsSync(KEY)) throw new Error('FIREBASE_ADMIN_KEY_PATH missing');
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(fs.readFileSync(KEY, 'utf8'))) });
const db = admin.firestore();
const writeJson = (file, value) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n'); };
const get = async (collection, id) => db.collection(collection).doc(id).get();

async function main() {
  const ref = db.collection('tbl_contributionIndicatorAssignments');
  const docs = await Promise.all(IDS.map(id => ref.doc(id).get()));
  if (docs.some(d => !d.exists)) throw new Error('BACKUP_GATE_MISSING_ASSIGNMENT');
  if (docs.some(d => d.data().clientId !== CLIENT || d.data().dashboardId !== 'agg-GENERAL-2026')) throw new Error('BACKUP_GATE_SCOPE_MISMATCH');
  const extractedAt = new Date().toISOString();
  const backupFile = path.join(BACKUP_DIR, `CEMENTOS_SIGMA_SEED_ASSIGNMENTS_2026_${extractedAt.replace(/[:.]/g, '-')}.json`);
  writeJson(backupFile, { collection: ref.path, extractedAt, assignments: docs.map(d => ({ id: d.id, payload: d.data() })) });
  if (docs.length !== 9) throw new Error('BACKUP_COUNT_FAILED');

  const before = await operationalSnapshot();
  const deleteBatch = db.batch(); docs.forEach(d => deleteBatch.delete(d.ref)); await deleteBatch.commit();
  const afterDelete = await ref.where('clientId', '==', CLIENT).get();
  if (afterDelete.size !== 0) throw new Error(`POST_DELETE_ASSIGNMENTS_NOT_ZERO:${afterDelete.size}`);

  const assignments = [
    ['sigma_test_direct_sales', { id: 'sigma_test_direct_sales', clientId: CLIENT, strategicObjectiveId: 'seed_sigma_oe01', dashboardId: '1769440535445', itemId: '1' }],
    ['sigma_test_oc_commercial', { id: 'sigma_test_oc_commercial', clientId: CLIENT, contributionObjectiveId: 'seed_sigma_oc01', dashboardId: '1769440535445', itemId: '2' }],
    ['sigma_test_oc_logistics', { id: 'sigma_test_oc_logistics', clientId: CLIENT, contributionObjectiveId: 'seed_sigma_oc03', dashboardId: '1769440535444', itemId: '1' }],
    ['sigma_test_oc_operations', { id: 'sigma_test_oc_operations', clientId: CLIENT, contributionObjectiveId: 'seed_sigma_oc05', dashboardId: '1769440535446', itemId: '1' }]
  ];
  const createBatch = db.batch(); assignments.forEach(([id, data]) => createBatch.set(ref.doc(id), data)); await createBatch.commit();
  const unassignBatch = db.batch(); unassignBatch.delete(ref.doc('sigma_test_oc_commercial')); await unassignBatch.commit();
  await ref.doc('sigma_test_oc_commercial').set(assignments[1][1]);
  const final = await ref.where('clientId', '==', CLIENT).get();
  if (final.size !== 4) throw new Error(`FINAL_ASSIGNMENTS_FAILED:${final.size}`);
  const after = await operationalSnapshot();
  writeJson(path.join(BACKUP_DIR, `CEMENTOS_SIGMA_DISTRIBUTED_OWNERSHIP_SNAPSHOT_${extractedAt.replace(/[:.]/g, '-')}.json`), { before, after, backupFile, finalAssignments: final.docs.map(d => ({ id: d.id, payload: d.data() })) });
  console.log(JSON.stringify({ backupFile, backupCount: 9, seedDeletes: 9, assignmentCreates: 5, assignmentDeletes: 10, finalAssignments: 4, operationalWrites: 0, before, after }, null, 2));
}
async function operationalSnapshot() {
  const ds = await db.collection('tbl_dashboards').where('clientId', '==', CLIENT).get();
  const dashboards = [];
  for (const d of ds.docs) { const items = await d.ref.collection('items').get(); dashboards.push({ id: d.id, data: d.data(), items: items.docs.map(i => ({ id: i.id, data: i.data() })) }); }
  const count = async c => (await db.collection(c).where('clientId', '==', CLIENT).get()).size;
  return { dashboards, strategicObjectives: await count('tbl_strategicObjectives'), contributionObjectives: await count('tbl_contributionObjectives'), relationships: await count('tbl_strategicObjectiveRelationships') };
}
main().catch(e => { console.error(e.stack || e); process.exitCode = 1; });
