import { collection, doc, getDocs, query, where, runTransaction } from 'firebase/firestore';
import { db } from '../firebase';
import type { Dashboard } from '../types';
import type { ContributionIndicatorAssignment, ContributionObjective, AreaStrategyConfig } from '../strategyTypes';
import { buildLogicalKpiCatalog, canonicalAreaIdentity } from '../strategyKpiOwnership';
import { assignmentFingerprint, isOperationalDashboard, OperationalAssignmentInput, physicalAssignmentKey, planContributionAssignments } from '../contributionConfiguration';

const assignmentsCollection = 'tbl_contributionIndicatorAssignments';
export interface AssignmentSaveContext { expectedAssignments: ContributionIndicatorAssignment[] }

/** Explicit reference correction preserves the existing document and all ownership fields. */
export async function repairOperationalAssignmentReference(
  expected: ContributionIndicatorAssignment, target: Required<Pick<OperationalAssignmentInput,'dashboardId'|'itemId'|'logicalKpiId'|'year'>>,
) {
  const client = expected.clientId;
  if (!client || !expected.contributionObjectiveId || expected.strategicObjectiveId) throw new Error('Se requiere una membresía OC existente.');
  const ref = doc(db,assignmentsCollection,expected.id);
  const read = async () => (await getDocs(query(collection(db,assignmentsCollection),where('clientId','==',client)))).docs.map(d=>({...d.data(),id:d.id} as ContributionIndicatorAssignment));
  const before = await read();
  const stable = (v: object) => JSON.stringify(Object.entries(v).sort(([a],[b])=>a.localeCompare(b)));
  const result = await runTransaction(db,async tx=>{
    const snap=await tx.get(ref);
    if(!snap.exists()) throw new Error('Asignación no encontrada.');
    const current={...snap.data(),id:snap.id} as ContributionIndicatorAssignment;
    if(stable(current)!==stable(expected)) throw new Error('La asignación cambió desde el respaldo.');
    const ocSnap=await tx.get(doc(db,'tbl_contributionObjectives',expected.contributionObjectiveId!));
    if(!ocSnap.exists() || ocSnap.data().clientId!==client) throw new Error('OC fuera del cliente.');
    const oc=ocSnap.data() as ContributionObjective;
    const oeSnap=await tx.get(doc(db,'tbl_strategicObjectives',oc.primaryStrategicObjectiveId));
    if(!oeSnap.exists() || oeSnap.data().clientId!==client) throw new Error('OE fuera del cliente.');
    const boardSnap=await tx.get(doc(db,'tbl_dashboards',String(target.dashboardId)));
    const itemSnap=await tx.get(doc(db,'tbl_dashboards',String(target.dashboardId),'items',String(target.itemId)));
    if(!boardSnap.exists() || !itemSnap.exists()) throw new Error('KPI operativo no encontrado.');
    const board={...boardSnap.data(),id:target.dashboardId,items:[{...itemSnap.data(),id:target.itemId}]} as Dashboard;
    if(!isOperationalDashboard(board) || Number(target.itemId)<0 || board.clientId!==client || Number(board.year)!==target.year || canonicalAreaIdentity(board.area)!==canonicalAreaIdentity(oc.areaName)) throw new Error('Contexto físico incompatible.');
    if(buildLogicalKpiCatalog([board])[0]?.identity!==target.logicalKpiId) throw new Error('Identidad lógica incompatible.');
    for(const a of before){
      const live=await tx.get(doc(db,assignmentsCollection,a.id));
      if(!live.exists() || stable({...live.data(),id:live.id})!==stable(a)) throw new Error('Configuración concurrente.');
      if(a.id!==expected.id && physicalAssignmentKey(a)===physicalAssignmentKey(target)) throw new Error('El destino ya tiene una asignación.');
    }
    const repaired={...snap.data(),dashboardId:target.dashboardId,itemId:target.itemId};
    tx.set(ref,repaired);
    return {...repaired,id:snap.id};
  });
  const after=await read();
  if(stable(after.find(a=>a.id===expected.id) || {})!==stable(result) || after.filter(a=>physicalAssignmentKey(a)===physicalAssignmentKey(target)).length!==1) throw new Error('Lectura posterior incompatible.');
  return result;
}

/** Atomic conversion: failed validation/commit cannot remove the DIRECT owner. */
export async function saveOperationalAssignmentsForOC(ocId: string, inputs: OperationalAssignmentInput[], clientId: string, context?: AssignmentSaveContext) {
  const client = clientId.trim().toUpperCase();
  if (!client || client.toLowerCase() === 'all') throw new Error('Selecciona un cliente válido.');
  const ref = doc(db, 'tbl_contributionObjectives', ocId);
  const readAssignments = async () => (await getDocs(query(collection(db, assignmentsCollection), where('clientId','==',client)))).docs.map(d=>({...d.data(), id:d.id} as ContributionIndicatorAssignment));
  const before = await readAssignments();
  if (context && assignmentFingerprint(before.filter(a=>a.contributionObjectiveId===ocId)) !== assignmentFingerprint(context.expectedAssignments)) throw new Error('La configuración cambió desde que abriste el formulario. Reabre el OC antes de guardar.');

  const result = await runTransaction(db, async tx => {
    const ocSnap = await tx.get(ref);
    if (!ocSnap.exists()) throw new Error('Objetivo de contribución no encontrado.');
    const oc = {...ocSnap.data(), id:ocSnap.id} as ContributionObjective;
    if (oc.clientId !== client) throw new Error('OC fuera del cliente seleccionado.');
    const oeSnap = await tx.get(doc(db,'tbl_strategicObjectives',oc.primaryStrategicObjectiveId));
    if(!oeSnap.exists() || oeSnap.data().clientId !== client) throw new Error('OE no válido para el cliente.');
    const areas: AreaStrategyConfig[] = [];
    if (oc.areaConfigId) {
      const areaSnap = await tx.get(doc(db,'tbl_areaStrategyConfigs',oc.areaConfigId));
      if(!areaSnap.exists() || areaSnap.data().clientId !== client) throw new Error('Área no válida para el cliente.');
      areas.push({...areaSnap.data(),id:areaSnap.id} as AreaStrategyConfig);
    }
    const verified: OperationalAssignmentInput[] = [];
    for (const input of inputs) {
      let identity: string | undefined;
      let year: number | undefined;
      const aliasPairs = [...new Map([input,...(input.physicalAliases || [])].map(a=>[physicalAssignmentKey(a),a])).values()];
      for (const alias of aliasPairs) {
        if (String(alias.dashboardId).startsWith('agg-') || Number(alias.dashboardId)<0 || Number(alias.itemId)<0) throw new Error('Referencia virtual: selecciona un KPI operativo.');
        const boardSnap = await tx.get(doc(db,'tbl_dashboards',String(alias.dashboardId)));
        const itemSnap = await tx.get(doc(db,'tbl_dashboards',String(alias.dashboardId),'items',String(alias.itemId)));
        if(!boardSnap.exists() || !itemSnap.exists()) throw new Error('El KPI operativo ya no existe.');
        const board = {...boardSnap.data(),id:alias.dashboardId,items:[{...itemSnap.data(),id:alias.itemId}]} as Dashboard;
        if (!isOperationalDashboard(board) || board.clientId !== client) throw new Error('KPI fuera del cliente operativo.');
        if (canonicalAreaIdentity(board.area,areas) !== canonicalAreaIdentity(oc.areaName,areas)) throw new Error('KPI fuera del área del OC.');
        if (input.year !== undefined && Number(board.year)!==Number(input.year)) throw new Error('KPI fuera del año seleccionado.');
        const candidate = buildLogicalKpiCatalog([board])[0];
        if (!candidate || (identity && candidate.identity!==identity)) throw new Error('Alias de KPI inconsistente.');
        if (year !== undefined && Number(board.year)!==year) throw new Error('Alias de otro año.');
        identity=candidate.identity; year=board.year;
      }
      if(input.logicalKpiId && input.logicalKpiId!==identity) throw new Error('La identidad lógica cambió. Reabre el formulario.');
      verified.push({...input,logicalKpiId:identity,year});
    }
    // Read all observed assignment documents inside the transaction before writes.
    const current: ContributionIndicatorAssignment[] = [];
    for(const assignment of before) {
      const snap=await tx.get(doc(db,assignmentsCollection,assignment.id));
      if(!snap.exists()) throw new Error('La configuración cambió. Reabre el OC.');
      current.push({...snap.data(),id:snap.id} as ContributionIndicatorAssignment);
    }
    if(assignmentFingerprint(current)!==assignmentFingerprint(before)) throw new Error('La configuración cambió. Reabre el OC.');
    const plan=planContributionAssignments(oc,verified,current);
    for(const assignment of plan.create) {
      const target=await tx.get(doc(db,assignmentsCollection,assignment.id));
      if(target.exists()) throw new Error('Asignación concurrente detectada. Reabre el OC.');
    }
    // Creation and obsolete DIRECT removal commit together, never delete-first.
    for(const assignment of plan.create) tx.set(doc(db,assignmentsCollection,assignment.id),JSON.parse(JSON.stringify({...assignment,createdAt:new Date().toISOString()})));
    for(const assignment of plan.remove) tx.delete(doc(db,assignmentsCollection,assignment.id));
    return plan;
  });
  const after=await readAssignments();
  const actual=after.filter(a=>a.contributionObjectiveId===ocId);
  const expectedKeys=new Set(result.selected.map(physicalAssignmentKey));
  if(actual.length!==expectedKeys.size || actual.some(a=>!expectedKeys.has(physicalAssignmentKey(a))) || after.some(a=>!a.contributionObjectiveId && result.selected.some(i=>[i,...(i.physicalAliases || [])].some(alias=>physicalAssignmentKey(alias)===physicalAssignmentKey(a))))) throw new Error('El guardado no coincide con la lectura persistida. Reabre la configuración.');
  return true;
}
