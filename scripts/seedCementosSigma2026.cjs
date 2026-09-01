/* CEMENTOS SIGMA 2026 scenario. Dry-run by default; --execute is required for writes. */
const admin = require('firebase-admin');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const CLIENT_ID = 'CEMENTOS_SIGMA';
const SOURCE_YEAR = 2025;
const TARGET_YEAR = 2026;
const SCENARIO = 'CEMENTOS_SIGMA_2026_TEST_SCENARIO';
const ROOT = path.resolve(__dirname, '..');
const BACKUP_DIR = path.join(ROOT, 'docs', 'backups');
const KEY_PATH = process.env.FIREBASE_ADMIN_KEY_PATH;

if (!KEY_PATH || !fs.existsSync(KEY_PATH)) throw new Error('FIREBASE_ADMIN_KEY_PATH debe apuntar a una credencial local válida.');
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(fs.readFileSync(KEY_PATH, 'utf8'))) });
const db = admin.firestore();

const stable = value => {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value).sort().reduce((o, k) => { o[k] = stable(value[k]); return o; }, {});
};
const hash = value => crypto.createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
const norm = value => String(value || '').trim().toUpperCase();
const docsFor = async collection => (await db.collection(collection).where('clientId', '==', CLIENT_ID).get()).docs;
const payload = d => ({ id: d.id, payload: d.data() });
const writeJson = (file, value) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', 'utf8'); };

async function dashboardsFor(year) {
  const all = await db.collection('tbl_dashboards').get();
  const result = [];
  for (const d of all.docs) {
    const data = d.data();
    if (norm(data.clientId) !== CLIENT_ID || Number(data.year) !== year) continue;
    const items = await d.ref.collection('items').get();
    result.push({ ref: d.ref, id: d.id, data, items: items.docs.map(i => ({ id: i.id, ref: i.ref, data: i.data() })) });
  }
  return result.sort((a, b) => (Number(a.data.orderNumber) || 0) - (Number(b.data.orderNumber) || 0));
}

async function strategyBackup() {
  const collections = [
    'tbl_strategicPerspectives', 'tbl_strategicObjectives', 'tbl_contributionObjectives',
    'tbl_contributionIndicatorAssignments', 'tbl_strategyCounters', 'tbl_areaStrategyConfigs',
    'tbl_areaCodeReservations', 'tbl_strategicObjectiveRelationships'
  ];
  const extractedAt = new Date().toISOString();
  const result = { scenario: SCENARIO, clientId: CLIENT_ID, extractedAt, collections: {} };
  for (const collection of collections) result.collections[collection] = (await docsFor(collection)).map(payload);
  const file = path.join(BACKUP_DIR, `CEMENTOS_SIGMA_STRATEGY_LEGACY_${extractedAt.replace(/[:.]/g, '-')}.json`);
  writeJson(file, result);
  return { file, result };
}

async function operationalSnapshot() {
  const dashboards = await dashboardsFor(SOURCE_YEAR);
  return {
    scenario: SCENARIO, clientId: CLIENT_ID, year: SOURCE_YEAR, capturedAt: new Date().toISOString(),
    dashboards: dashboards.map(d => ({
      id: d.id, payload: d.data, payloadHash: hash(d.data),
      items: d.items.map(i => ({ id: i.id, payload: i.data, payloadHash: hash(i.data) }))
    }))
  };
}

function targetOf(item) {
  const goals = item.monthlyGoals || [];
  const candidate = [...goals].reverse().find(v => Number(v) > 0);
  return Number(candidate || 1);
}
const ratios = {
  'COSTO DE FLETE POR TONELADA': [78, 82, 85, 89, 93, 96, 99, 102],
  'MARGEN DE CONTRIBUCIÓN NETO': [85, 88, 90, 93, 95, 97, 98, 100],
  'VENTAS': [80, 84, 88, 91, 94, 97, 100, 102],
  'TASA DE RETENCIÓN DE CLIENTES': [100, 98, 96, 94, 92, 90, 88, 86],
  'CUMPLIMIENTO DE ENTREGAS': [95, 90, 85, 80, 75, 70, 67, 63],
  'ÍNDICE DE MERMAS EN TRÁNSITO': [60, 66, 71, 76, 81, 86, 91, 96],
  'ROTACIÓN DE INVENTARIO': [100, 95, 90, 85, 80, 75, 70, 65],
  'EXACTITUD DE INVENTARIO': [88, 90, 92, 94, 96, 98, 100, 101],
  'DÍAS SIN ACCIDENTES INCIDENTES': [100, 100, null, 100, 100, null, 100, 100]
};

function simulatedItem(source) {
  const label = norm(source.indicator || source.name);
  const target = targetOf(source);
  const profile = ratios[label] || [80, 84, 88, 92, 95, 97, 99, 100];
  const minimize = source.goalType === 'minimize';
  const goals = Array(12).fill(null); const progress = Array(12).fill(null);
  for (let i = 0; i < 8; i++) {
    goals[i] = target;
    if (profile[i] === null) continue;
    progress[i] = Number((minimize ? target * 100 / profile[i] : target * profile[i] / 100).toFixed(4));
  }
  return { ...source, monthlyGoals: goals, monthlyProgress: progress, weeklyGoals: Array.isArray(source.weeklyGoals) ? Array(53).fill(null) : source.weeklyGoals, weeklyProgress: Array.isArray(source.weeklyProgress) ? Array(53).fill(null) : source.weeklyProgress, seedScenario: SCENARIO, seedSourceYear: SOURCE_YEAR, seedTargetYear: TARGET_YEAR };
}

async function main() {
  const execute = process.argv.includes('--execute');
  const backup = await strategyBackup();
  const pre2025 = await operationalSnapshot();
  const source = await dashboardsFor(SOURCE_YEAR);
  const target = await dashboardsFor(TARGET_YEAR);
  const strategyCollections = ['tbl_strategicPerspectives', 'tbl_strategicObjectives', 'tbl_contributionObjectives', 'tbl_contributionIndicatorAssignments', 'tbl_strategyCounters', 'tbl_areaStrategyConfigs', 'tbl_areaCodeReservations', 'tbl_strategicObjectiveRelationships'];
  const existingStrategy = {}; for (const c of strategyCollections) existingStrategy[c] = (await docsFor(c)).map(payload);
  if (source.length !== 3 || source.reduce((n, d) => n + d.items.length, 0) !== 9) throw new Error(`SIGMA_2025_EXPECTED_3_DASHBOARDS_9_KPI_FAILED: ${source.length} dashboards / ${source.reduce((n, d) => n + d.items.length, 0)} KPI`);
  if (target.some(d => d.data.seedScenario !== SCENARIO)) throw new Error('SIGMA_2026_NON_SCENARIO_DATA_PRESENT; refusing to overwrite.');
  const maxId = (await db.collection('tbl_dashboards').get()).docs.reduce((m, d) => Math.max(m, Number(d.id || d.id) || 0), 0);
  const plannedDashboards = source.map((d, index) => ({ sourceId: d.id, targetId: target[index]?.id || String(maxId + index + 1), title: d.data.title, itemCount: d.items.length }));
  const oe = [
    ['FINANCIERA', 'Incrementar el crecimiento rentable y la eficiencia económica del negocio.'],
    ['CLIENTE', 'Fortalecer la retención y el cumplimiento de la promesa de servicio al cliente.'],
    ['PROCESOS_INTERNOS', 'Elevar la confiabilidad y eficiencia de la operación logística.'],
    ['PROCESOS_INTERNOS', 'Optimizar la gestión de inventarios para asegurar disponibilidad y exactitud.'],
    ['APRENDIZAJE_CRECIMIENTO', 'Fortalecer una operación segura y disciplinada que sostenga el desempeño.']
  ];
  const areas = [
    ['COMERCIAL Y VENTAS', 'COMV'], ['LOGÍSTICA Y TRANSPORTE', 'LOGT'], ['OPERACIONES Y ALMACÉN', 'OPAL']
  ];
  const ocs = [
    ['COMV', 1, 'Impulsar ventas con mayor contribución rentable.'], ['COMV', 2, 'Elevar la retención y permanencia de clientes.'],
    ['LOGT', 2, 'Asegurar entregas confiables y oportunas al cliente.'], ['LOGT', 3, 'Reducir costos y pérdidas de la operación logística.'],
    ['OPAL', 4, 'Mejorar rotación, disponibilidad y exactitud de inventarios.'], ['OPAL', 5, 'Sostener una operación segura mediante disciplina preventiva.']
  ];
  const plan = { clientId: CLIENT_ID, sourceYear: SOURCE_YEAR, targetYear: TARGET_YEAR, sourceDashboards: source.map(d => ({ id: d.id, title: d.data.title, items: d.items.map(i => ({ id: i.id, indicator: i.data.indicator, unit: i.data.unit, frequency: i.data.frequency, goalType: i.data.goalType, target: targetOf(i.data), order: i.data.order })) })), plannedDashboards, strategyCleanup: Object.fromEntries(strategyCollections.map(c => [c, existingStrategy[c].map(x => x.id)])), perspectives: 4, strategicObjectives: 5, contributionObjectives: 6, strategicAssignments: 0, causeEffectRelationships: 0, operational2025Writes: 0, backupFile: backup.file };
  console.log(JSON.stringify({ mode: execute ? 'EXECUTE' : 'DRY_RUN', plan }, null, 2));
  if (!execute) return;

  const batch = db.batch();
  for (const collection of strategyCollections) for (const d of await docsFor(collection)) batch.delete(d.ref);
  for (const d of target) { for (const item of d.items) batch.delete(item.ref); batch.delete(d.ref); }
  await batch.commit();

  const writeBatch = db.batch();
  const perspectives = [
    ['FINANCIERA', 'Resultados / Financiera', 1, '#10B981', 'DollarSign'], ['CLIENTE', 'Cliente / Mercado', 2, '#3B82F6', 'Users'],
    ['PROCESOS_INTERNOS', 'Procesos internos', 3, '#F59E0B', 'Zap'], ['APRENDIZAJE_CRECIMIENTO', 'Capacidad organizacional', 4, '#8B5CF6', 'BookOpen']
  ];
  for (const [id, name, order, color, icon] of perspectives) writeBatch.set(db.collection('tbl_strategicPerspectives').doc(`${CLIENT_ID}_${id}`), { id, name, order, color, icon, clientId: CLIENT_ID });
  const oeIds = []; for (let i = 0; i < oe.length; i++) { const id = `seed_sigma_oe${String(i + 1).padStart(2, '0')}`; oeIds.push(id); writeBatch.set(db.collection('tbl_strategicObjectives').doc(id), { id, code: `OE${String(i + 1).padStart(2, '0')}`, perspectiveId: oe[i][0], title: oe[i][1], description: '', order: oe[i][0] === 'PROCESOS_INTERNOS' ? i - 1 : 1, clientId: CLIENT_ID, seedScenario: SCENARIO }); }
  const areaIds = {}; for (const [name, code] of areas) { const id = `seed_sigma_area_${code.toLowerCase()}`; areaIds[code] = id; writeBatch.set(db.collection('tbl_areaStrategyConfigs').doc(id), { id, areaName: name, code, aliases: [], clientId: CLIENT_ID, seedScenario: SCENARIO }); writeBatch.set(db.collection('tbl_areaCodeReservations').doc(`res_${CLIENT_ID}_${code}`), { id: `res_${CLIENT_ID}_${code}`, areaConfigId: id, code, clientId: CLIENT_ID, seedScenario: SCENARIO }); }
  for (let i = 0; i < ocs.length; i++) { const [code, parent, title] = ocs[i]; const id = `seed_sigma_oc${String(i + 1).padStart(2, '0')}`; const seq = i < 2 ? i + 1 : i < 4 ? i - 1 : i - 3; writeBatch.set(db.collection('tbl_contributionObjectives').doc(id), { id, areaConfigId: areaIds[code], areaName: areas.find(a => a[1] === code)[0], areaCode: code, sequenceNumber: seq, displayCode: `OC${code}${String(seq).padStart(2, '0')}`, title, description: '', primaryStrategicObjectiveId: oeIds[parent - 1], clientId: CLIENT_ID, status: 'active', seedScenario: SCENARIO }); writeBatch.set(db.collection('tbl_strategyCounters').doc(`cnt_${CLIENT_ID}_OC_${areaIds[code]}`), { id: `cnt_${CLIENT_ID}_OC_${areaIds[code]}`, areaConfigId: areaIds[code], scope: areaIds[code], lastIssuedSequence: 2, clientId: CLIENT_ID, seedScenario: SCENARIO }); }
  writeBatch.set(db.collection('tbl_strategyCounters').doc(`cnt_${CLIENT_ID}_OE`), { id: `cnt_${CLIENT_ID}_OE`, scope: 'OE', lastIssuedSequence: 5, clientId: CLIENT_ID, seedScenario: SCENARIO });
  const maxBatch = db.batch(); for (const [index, d] of source.entries()) { const targetId = plannedDashboards[index].targetId; const dashboard = { ...d.data, area: d.data.area || d.data.title, id: Number(targetId), year: TARGET_YEAR, clientId: CLIENT_ID, seedScenario: SCENARIO, seedSourceDashboardId: d.id }; delete dashboard.monthlyProgress; delete dashboard.monthlyGoals; maxBatch.set(db.collection('tbl_dashboards').doc(targetId), dashboard); for (const item of d.items) maxBatch.set(db.collection('tbl_dashboards').doc(targetId).collection('items').doc(item.id), { ...simulatedItem(item.data), id: item.data.id ?? Number(item.id) }); }
  await Promise.all([writeBatch.commit(), maxBatch.commit()]);
  const post2025 = await operationalSnapshot();
  writeJson(path.join(BACKUP_DIR, `CEMENTOS_SIGMA_2025_OPERATIONAL_SNAPSHOT_PRE_${pre2025.capturedAt.replace(/[:.]/g, '-')}.json`), pre2025);
  writeJson(path.join(BACKUP_DIR, `CEMENTOS_SIGMA_2025_OPERATIONAL_SNAPSHOT_POST_${post2025.capturedAt.replace(/[:.]/g, '-')}.json`), post2025);
  console.log(JSON.stringify({ result: 'EXECUTE_PASS', pre2025Hash: hash(pre2025), post2025Hash: hash(post2025), sigma2025OperationalUnchanged: JSON.stringify(pre2025.dashboards) === JSON.stringify(post2025.dashboards), dashboards2026: plannedDashboards, strategicAssignments: 0, causeEffectRelationships: 0 }, null, 2));
}
main().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
