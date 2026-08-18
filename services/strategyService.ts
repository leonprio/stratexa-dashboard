/**
 * Servicio de Persistencia para la Capa de Estrategia (BSC / Matriz de Contribución).
 * Implementa el aislamiento multitenant estricto basado en `clientId` y la convención `tbl_`.
 * 
 * @module strategyService
 * @version v9.4.22
 */

import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  deleteDoc,
  query,
  where,
  writeBatch
} from 'firebase/firestore';

import { db } from '../firebase';

import {
  StrategicPerspective,
  DEFAULT_PERSPECTIVES,
  StrategicObjective,
  AreaStrategyConfig,
  ContributionObjective,
  ContributionIndicatorAssignment,
  validateAreaCodeUniqueness,
  generateNextOCSequence,
  formatOCCode,
  deriveAreaCodeSuggestion
} from '../strategyTypes';

const COLLECTION_PREFIX = 'tbl_';
const PERSPECTIVES_COLLECTION = `${COLLECTION_PREFIX}strategicPerspectives`;
const OBJECTIVES_COLLECTION = `${COLLECTION_PREFIX}strategicObjectives`;
const AREA_CONFIGS_COLLECTION = `${COLLECTION_PREFIX}areaStrategyConfigs`;
const CONTRIBUTION_OBJECTIVES_COLLECTION = `${COLLECTION_PREFIX}contributionObjectives`;
const ASSIGNMENTS_COLLECTION = `${COLLECTION_PREFIX}contributionIndicatorAssignments`;

const cleanClientId = (clientId?: string): string => {
  if (!clientId || clientId === 'all') return 'IPS';
  return clientId.trim().toUpperCase();
};

export const strategyService = {
  // -----------------------------
  // 1. Perspectivas Estratégicas
  // -----------------------------
  getPerspectives: async (clientId?: string): Promise<StrategicPerspective[]> => {
    const targetClient = cleanClientId(clientId);
    const ref = collection(db, PERSPECTIVES_COLLECTION);
    const q = query(ref, where('clientId', '==', targetClient));
    const snap = await getDocs(q);

    if (snap.empty) {
      return DEFAULT_PERSPECTIVES;
    }

    const perspectives = snap.docs.map(d => ({ id: d.id, ...d.data() } as StrategicPerspective));
    return perspectives.sort((a, b) => a.order - b.order);
  },

  // -----------------------------
  // 2. Objetivos Estratégicos (OE)
  // -----------------------------
  getStrategicObjectives: async (clientId?: string): Promise<StrategicObjective[]> => {
    const targetClient = cleanClientId(clientId);
    const ref = collection(db, OBJECTIVES_COLLECTION);
    const q = query(ref, where('clientId', '==', targetClient));
    const snap = await getDocs(q);

    const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as StrategicObjective));
    return list.sort((a, b) => {
      if (a.perspectiveId !== b.perspectiveId) {
        return a.perspectiveId.localeCompare(b.perspectiveId);
      }
      return (a.order || 0) - (b.order || 0);
    });
  },

  saveStrategicObjective: async (objective: Omit<StrategicObjective, 'id'> & { id?: string }): Promise<StrategicObjective> => {
    const targetClient = cleanClientId(objective.clientId);
    const docId = objective.id || `oe_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const ref = doc(db, OBJECTIVES_COLLECTION, docId);

    const now = new Date().toISOString();
    const finalData: StrategicObjective = {
      ...objective,
      id: docId,
      clientId: targetClient,
      updatedAt: now,
      createdAt: objective.createdAt || now
    };

    await setDoc(ref, JSON.parse(JSON.stringify(finalData)), { merge: true });
    return finalData;
  },

  deleteStrategicObjective: async (objectiveId: string): Promise<boolean> => {
    const ref = doc(db, OBJECTIVES_COLLECTION, objectiveId);
    await deleteDoc(ref);
    return true;
  },

  // -----------------------------
  // 3. Configuración de Código de Área Estable
  // -----------------------------
  getAreaConfigs: async (clientId?: string): Promise<AreaStrategyConfig[]> => {
    const targetClient = cleanClientId(clientId);
    const ref = collection(db, AREA_CONFIGS_COLLECTION);
    const q = query(ref, where('clientId', '==', targetClient));
    const snap = await getDocs(q);

    return snap.docs.map(d => ({ id: d.id, ...d.data() } as AreaStrategyConfig));
  },

  saveAreaConfig: async (
    areaName: string,
    code: string,
    clientId?: string
  ): Promise<AreaStrategyConfig> => {
    const targetClient = cleanClientId(clientId);
    const normArea = areaName.trim().toUpperCase();
    const normCode = code.trim().toUpperCase();

    // Validar unicidad de código entre áreas del mismo cliente
    const existingConfigs = await strategyService.getAreaConfigs(targetClient);
    const isUnique = validateAreaCodeUniqueness(existingConfigs, normCode, normArea);
    if (!isUnique) {
      throw new Error(`El código de área "${normCode}" ya está en uso por otra área.`);
    }

    const existingForArea = existingConfigs.find(
      c => c.areaName.trim().toUpperCase() === normArea
    );

    const docId = existingForArea?.id || `areacfg_${targetClient}_${normArea.replace(/[^A-Z0-9]/g, '_')}`;
    const ref = doc(db, AREA_CONFIGS_COLLECTION, docId);

    const now = new Date().toISOString();
    const finalData: AreaStrategyConfig = {
      id: docId,
      areaName: normArea,
      code: normCode,
      clientId: targetClient,
      updatedAt: now,
      createdAt: existingForArea?.createdAt || now
    };

    await setDoc(ref, JSON.parse(JSON.stringify(finalData)), { merge: true });
    return finalData;
  },

  // -----------------------------
  // 4. Objetivos de Contribución (OC)
  // -----------------------------
  getContributionObjectives: async (clientId?: string): Promise<ContributionObjective[]> => {
    const targetClient = cleanClientId(clientId);
    const ref = collection(db, CONTRIBUTION_OBJECTIVES_COLLECTION);
    const q = query(ref, where('clientId', '==', targetClient));
    const snap = await getDocs(q);

    const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as ContributionObjective));
    return list.sort((a, b) => a.displayCode.localeCompare(b.displayCode));
  },

  saveContributionObjective: async (
    data: Omit<ContributionObjective, 'id' | 'sequenceNumber' | 'displayCode' | 'areaCode'> & {
      id?: string;
      areaCode?: string;
    }
  ): Promise<ContributionObjective> => {
    const targetClient = cleanClientId(data.clientId);
    const normArea = data.areaName.trim().toUpperCase();

    // Resolver código estable del área
    const areaConfigs = await strategyService.getAreaConfigs(targetClient);
    const existingCfg = areaConfigs.find(c => c.areaName.trim().toUpperCase() === normArea);

    let areaCode = data.areaCode || existingCfg?.code;
    if (!areaCode) {
      // Sugerencia inicial si no ha sido guardada explícitamente
      areaCode = deriveAreaCodeSuggestion(normArea);
      await strategyService.saveAreaConfig(normArea, areaCode, targetClient);
    }

    const existingOCs = await strategyService.getContributionObjectives(targetClient);

    let seqNumber: number;
    let docId: string;

    if (data.id) {
      // Edición existente: preservar número de secuencia monótono
      docId = data.id;
      const currentOC = existingOCs.find(o => o.id === data.id);
      seqNumber = currentOC?.sequenceNumber || generateNextOCSequence(existingOCs, normArea);
    } else {
      // Nuevo OC: generar siguiente número de secuencia monótona para el área
      docId = `oc_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
      seqNumber = generateNextOCSequence(existingOCs, normArea);
    }

    const displayCode = formatOCCode(areaCode, seqNumber);

    const now = new Date().toISOString();
    const finalOC: ContributionObjective = {
      ...data,
      id: docId,
      areaName: normArea,
      areaCode,
      sequenceNumber: seqNumber,
      displayCode,
      clientId: targetClient,
      status: data.status || 'active',
      updatedAt: now,
      createdAt: now
    };

    const ref = doc(db, CONTRIBUTION_OBJECTIVES_COLLECTION, docId);
    await setDoc(ref, JSON.parse(JSON.stringify(finalOC)), { merge: true });
    return finalOC;
  },

  deleteContributionObjective: async (ocId: string): Promise<boolean> => {
    const ref = doc(db, CONTRIBUTION_OBJECTIVES_COLLECTION, ocId);
    await deleteDoc(ref);

    // Eliminar también sus asignaciones asociadas
    const assignmentsRef = collection(db, ASSIGNMENTS_COLLECTION);
    const q = query(assignmentsRef, where('contributionObjectiveId', '==', ocId));
    const snap = await getDocs(q);

    if (!snap.empty) {
      const batch = writeBatch(db);
      snap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
    }

    return true;
  },

  // -----------------------------
  // 5. Asignaciones de Indicadores
  // -----------------------------
  getAssignments: async (clientId?: string): Promise<ContributionIndicatorAssignment[]> => {
    const targetClient = cleanClientId(clientId);
    const ref = collection(db, ASSIGNMENTS_COLLECTION);
    const q = query(ref, where('clientId', '==', targetClient));
    const snap = await getDocs(q);

    return snap.docs.map(d => ({ id: d.id, ...d.data() } as ContributionIndicatorAssignment));
  },

  saveAssignmentsForOC: async (
    ocId: string,
    items: { dashboardId: number | string; itemId: number | string }[],
    clientId?: string
  ): Promise<boolean> => {
    const targetClient = cleanClientId(clientId);
    const assignmentsRef = collection(db, ASSIGNMENTS_COLLECTION);
    
    // Obtener asignaciones existentes para este OC
    const q = query(assignmentsRef, where('contributionObjectiveId', '==', ocId));
    const snap = await getDocs(q);

    const batch = writeBatch(db);
    
    // Borrar previas
    snap.docs.forEach(d => batch.delete(d.ref));

    // Agregar nuevas
    const now = new Date().toISOString();
    items.forEach(item => {
      const docId = `asgn_${ocId}_${item.dashboardId}_${item.itemId}`;
      const itemRef = doc(db, ASSIGNMENTS_COLLECTION, docId);
      const data: ContributionIndicatorAssignment = {
        id: docId,
        contributionObjectiveId: ocId,
        dashboardId: item.dashboardId,
        itemId: item.itemId,
        clientId: targetClient,
        createdAt: now
      };
      batch.set(itemRef, JSON.parse(JSON.stringify(data)));
    });

    await batch.commit();
    return true;
  }
};
