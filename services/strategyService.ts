/**
 * Servicio de Persistencia para la Capa de Estrategia (BSC / Matriz de Contribución).
 * Implementa seguridad defensiva en profundidad, aislamiento multitenant estricto por `clientId`,
 * transacciones atómicas para reservas de código de área y contadores atómicos de secuencia por OC.
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
  writeBatch,
  runTransaction
} from 'firebase/firestore';

import { db } from '../firebase';

import {
  StrategicPerspective,
  DEFAULT_PERSPECTIVES,
  StrategicObjective,
  AreaStrategyConfig,
  ContributionObjective,
  ContributionIndicatorAssignment,
  StrategyCounter,
  AreaCodeReservation,
  StrategicObjectiveRelationship,
  validateAreaCodeUniqueness,
  resolveAreaStrategyConfig,
  formatOCCode,
  deriveAreaCodeSuggestion,
  getCanonicalRelationshipId,
  formatOECode
} from '../strategyTypes';

const COLLECTION_PREFIX = 'tbl_';
const PERSPECTIVES_COLLECTION = `${COLLECTION_PREFIX}strategicPerspectives`;
const OBJECTIVES_COLLECTION = `${COLLECTION_PREFIX}strategicObjectives`;
const AREA_CONFIGS_COLLECTION = `${COLLECTION_PREFIX}areaStrategyConfigs`;
const CONTRIBUTION_OBJECTIVES_COLLECTION = `${COLLECTION_PREFIX}contributionObjectives`;
const ASSIGNMENTS_COLLECTION = `${COLLECTION_PREFIX}contributionIndicatorAssignments`;
const COUNTERS_COLLECTION = `${COLLECTION_PREFIX}strategyCounters`;
const CODE_RESERVATIONS_COLLECTION = `${COLLECTION_PREFIX}areaCodeReservations`;
const RELATIONSHIPS_COLLECTION = `${COLLECTION_PREFIX}strategicObjectiveRelationships`;

const normalizeClientId = (clientId?: string): string => {
  if (!clientId || clientId === 'all') return 'IPS';
  return clientId.trim().toUpperCase();
};

const parseOESequence = (code?: string): number | null => {
  const match = /^OE-?(\d+)$/.exec((code || '').trim().toUpperCase());
  return match ? Number(match[1]) : null;
};

const canReleaseSequence = (deletedSequence: number | null, counter?: StrategyCounter): boolean =>
  deletedSequence !== null &&
  Number.isInteger(deletedSequence) &&
  deletedSequence > 0 &&
  counter?.lastIssuedSequence === deletedSequence;

export const strategyService = {
  // -----------------------------
  // 1. Perspectivas Estratégicas (4 Slots Configurables)
  // -----------------------------
  getPerspectives: async (clientId?: string): Promise<StrategicPerspective[]> => {
    const targetClient = normalizeClientId(clientId);
    const ref = collection(db, PERSPECTIVES_COLLECTION);
    const q = query(ref, where('clientId', '==', targetClient));
    const snap = await getDocs(q);

    if (snap.empty) {
      return DEFAULT_PERSPECTIVES;
    }

    const perspectives = snap.docs.map(d => ({ id: d.id, ...d.data() } as StrategicPerspective));
    return perspectives.sort((a, b) => a.order - b.order);
  },

  savePerspective: async (perspective: StrategicPerspective, clientId?: string): Promise<StrategicPerspective> => {
    const targetClient = normalizeClientId(clientId || perspective.clientId);
    const ref = doc(db, PERSPECTIVES_COLLECTION, `${targetClient}_${perspective.id}`);

    const data: StrategicPerspective = {
      ...perspective,
      clientId: targetClient
    };

    await setDoc(ref, JSON.parse(JSON.stringify(data)), { merge: true });
    return data;
  },

  saveAllPerspectives: async (perspectives: StrategicPerspective[], clientId?: string): Promise<boolean> => {
    const targetClient = normalizeClientId(clientId);
    const batch = writeBatch(db);

    perspectives.forEach(p => {
      const ref = doc(db, PERSPECTIVES_COLLECTION, `${targetClient}_${p.id}`);
      const data: StrategicPerspective = { ...p, clientId: targetClient };
      batch.set(ref, JSON.parse(JSON.stringify(data)), { merge: true });
    });

    await batch.commit();
    return true;
  },

  // -----------------------------
  // 2. Objetivos Estratégicos (OE)
  // -----------------------------
  getStrategicObjectives: async (clientId?: string): Promise<StrategicObjective[]> => {
    const targetClient = normalizeClientId(clientId);
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
    const targetClient = normalizeClientId(objective.clientId);
    if (objective.id) {
      const ref = doc(db, OBJECTIVES_COLLECTION, objective.id);
      const snap = await getDoc(ref);
      if (!snap.exists()) throw new Error(`Objetivo estratégico "${objective.id}" no encontrado.`);
      const existing = snap.data() as StrategicObjective;
      const now = new Date().toISOString();
      const updated = { ...existing, ...objective, id: objective.id, code: existing.code, clientId: targetClient, updatedAt: now };
      await setDoc(ref, JSON.parse(JSON.stringify(updated)), { merge: true });
      return updated;
    }
    return runTransaction(db, async transaction => {
      const counterRef = doc(db, COUNTERS_COLLECTION, `cnt_${targetClient}_OE`);
      const counterSnap = await transaction.get(counterRef);
      const nextSeq = ((counterSnap.exists() ? (counterSnap.data() as StrategyCounter).lastIssuedSequence : 0) || 0) + 1;
      const docId = `oe_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
      const ref = doc(db, OBJECTIVES_COLLECTION, docId);
      const now = new Date().toISOString();
      const finalData: StrategicObjective = { ...objective, id: docId, code: formatOECode(nextSeq), clientId: targetClient, updatedAt: now, createdAt: now };
      transaction.set(counterRef, { id: `cnt_${targetClient}_OE`, scope: 'OE', lastIssuedSequence: nextSeq, clientId: targetClient, updatedAt: now }, { merge: true });
      transaction.set(ref, JSON.parse(JSON.stringify(finalData)), { merge: true });
      return finalData;
    });
  },

  deleteStrategicObjective: async (objectiveId: string, clientId?: string): Promise<boolean> => {
    const targetClient = normalizeClientId(clientId);
    const ref = doc(db, OBJECTIVES_COLLECTION, objectiveId);
    // Defensa en profundidad: Verificar pertenencia al tenant
    const snap = await getDoc(ref);
    if (!snap.exists()) return true;

    const existing = snap.data() as StrategicObjective;
    if (existing.clientId && normalizeClientId(existing.clientId) !== targetClient) {
      throw new Error(`Acceso denegado: El objetivo pertenece al cliente "${existing.clientId}" y no a "${targetClient}".`);
    }

    // 🛡️ GUARDA DE INTEGRIDAD / ORPHAN GUARD: Bloquear si el OE participa en relaciones activas
    const [relSnap, contributionSnap] = await Promise.all([
      getDocs(query(collection(db, RELATIONSHIPS_COLLECTION), where('clientId', '==', targetClient))),
      getDocs(query(collection(db, CONTRIBUTION_OBJECTIVES_COLLECTION), where('clientId', '==', targetClient)))
    ]);
    const hasActiveRelationships = relSnap.docs.some(d => {
      const r = d.data() as StrategicObjectiveRelationship;
      return r.sourceStrategicObjectiveId === objectiveId || r.targetStrategicObjectiveId === objectiveId;
    });

    const hasContributionObjectives = contributionSnap.docs.some(d =>
      (d.data() as ContributionObjective).primaryStrategicObjectiveId === objectiveId
    );

    if (hasActiveRelationships) {
      throw new Error('No es posible eliminar el objetivo estratégico porque participa en relaciones de causa y efecto activas. Elimine las relaciones primero.');
    }

    if (hasContributionObjectives) {
      throw new Error('No es posible eliminar el objetivo estratégico porque tiene objetivos de contribución vinculados. Reasigne o elimine esas dependencias primero.');
    }

    await runTransaction(db, async transaction => {
      const currentSnap = await transaction.get(ref);
      if (!currentSnap.exists()) return;

      const current = currentSnap.data() as StrategicObjective;
      if (current.clientId && normalizeClientId(current.clientId) !== targetClient) {
        throw new Error(`Acceso denegado: El objetivo pertenece al cliente "${current.clientId}" y no a "${targetClient}".`);
      }

      const sequence = parseOESequence(current.code);
      const counterRef = doc(db, COUNTERS_COLLECTION, `cnt_${targetClient}_OE`);
      const counterSnap = await transaction.get(counterRef);
      const counter = counterSnap.exists() ? counterSnap.data() as StrategyCounter : undefined;

      if (canReleaseSequence(sequence, counter)) {
        transaction.set(counterRef, {
          ...counter,
          lastIssuedSequence: sequence! - 1,
          updatedAt: new Date().toISOString()
        }, { merge: true });
      }
      transaction.delete(ref);
    });
    return true;
  },

  repairLatestStrategicObjectiveGap: async (
    objectiveId: string,
    fromSequence: number,
    toSequence: number,
    clientId?: string
  ): Promise<StrategicObjective> => {
    const targetClient = normalizeClientId(clientId);
    if (fromSequence !== toSequence + 1 || toSequence < 1) {
      throw new Error('La reparación sólo permite cerrar el hueco inmediatamente anterior al último código emitido.');
    }

    const [objectivesSnap, contributionsSnap, relationshipsSnap] = await Promise.all([
      getDocs(query(collection(db, OBJECTIVES_COLLECTION), where('clientId', '==', targetClient))),
      getDocs(query(collection(db, CONTRIBUTION_OBJECTIVES_COLLECTION), where('clientId', '==', targetClient))),
      getDocs(query(collection(db, RELATIONSHIPS_COLLECTION), where('clientId', '==', targetClient)))
    ]);
    const targetCode = formatOECode(toSequence);
    if (objectivesSnap.docs.some(d => d.id !== objectiveId && (d.data() as StrategicObjective).code === targetCode)) {
      throw new Error(`No es posible reparar: el código ${targetCode} ya existe.`);
    }
    if (contributionsSnap.docs.some(d => (d.data() as ContributionObjective).primaryStrategicObjectiveId === objectiveId)) {
      throw new Error('No es posible reparar: el objetivo tiene objetivos de contribución vinculados.');
    }
    if (relationshipsSnap.docs.some(d => {
      const rel = d.data() as StrategicObjectiveRelationship;
      return rel.sourceStrategicObjectiveId === objectiveId || rel.targetStrategicObjectiveId === objectiveId;
    })) {
      throw new Error('No es posible reparar: el objetivo participa en relaciones estratégicas.');
    }

    return runTransaction(db, async transaction => {
      const objectiveRef = doc(db, OBJECTIVES_COLLECTION, objectiveId);
      const counterRef = doc(db, COUNTERS_COLLECTION, `cnt_${targetClient}_OE`);
      const [objectiveSnap, counterSnap] = await Promise.all([
        transaction.get(objectiveRef),
        transaction.get(counterRef)
      ]);
      if (!objectiveSnap.exists()) throw new Error('No es posible reparar: el objetivo no existe.');
      if (!counterSnap.exists()) throw new Error('No es posible reparar: el contador no existe.');

      const objective = objectiveSnap.data() as StrategicObjective;
      const counter = counterSnap.data() as StrategyCounter;
      if (normalizeClientId(objective.clientId) !== targetClient || parseOESequence(objective.code) !== fromSequence) {
        throw new Error('No es posible reparar: el objetivo ya no coincide con el último código esperado.');
      }
      if (counter.lastIssuedSequence !== fromSequence) {
        throw new Error('No es posible reparar: el objetivo no es la última secuencia emitida.');
      }

      const updatedAt = new Date().toISOString();
      const repaired = { ...objective, id: objectiveId, code: targetCode, updatedAt };
      transaction.set(objectiveRef, repaired, { merge: true });
      transaction.set(counterRef, { ...counter, lastIssuedSequence: toSequence, updatedAt }, { merge: true });
      return repaired;
    });
  },

  // -----------------------------
  // 3. Configuración y Reserva Atómica de Código de Área (con Auto-ID nativo de Firestore)
  // -----------------------------
  getAreaConfigs: async (clientId?: string): Promise<AreaStrategyConfig[]> => {
    const targetClient = normalizeClientId(clientId);
    const ref = collection(db, AREA_CONFIGS_COLLECTION);
    const q = query(ref, where('clientId', '==', targetClient));
    const snap = await getDocs(q);

    return snap.docs.map(d => ({ id: d.id, ...d.data() } as AreaStrategyConfig));
  },

  saveAreaConfig: async (
    areaName: string,
    code: string,
    clientId?: string,
    areaConfigId?: string
  ): Promise<AreaStrategyConfig> => {
    const targetClient = normalizeClientId(clientId);
    const normArea = areaName.trim().toUpperCase();
    const normCode = code.trim().toUpperCase();

    // 🛡️ Mapeo centralizado por nombre directo o histórico de aliases
    const areaConfigs = await strategyService.getAreaConfigs(targetClient);
    const existing = resolveAreaStrategyConfig(normArea, areaConfigs) ||
                     (areaConfigId ? areaConfigs.find(c => c.id === areaConfigId) : undefined);

    // 🛡️ AUTO-ID NATIVO DE FIRESTORE: Usar referencia de colección para autogeneración limpia y libre de colisiones
    let areaConfigRef;
    if (areaConfigId || existing?.id) {
      const resolvedId = areaConfigId || existing!.id;
      areaConfigRef = doc(db, AREA_CONFIGS_COLLECTION, resolvedId);
    } else {
      areaConfigRef = doc(collection(db, AREA_CONFIGS_COLLECTION));
    }

    const targetAreaConfigId = areaConfigRef.id;

    // Ejecutar la reserva y guardado dentro de una Transacción Atómica de Firestore
    const result = await runTransaction(db, async (transaction) => {
      const reservationRef = doc(db, CODE_RESERVATIONS_COLLECTION, `res_${targetClient}_${normCode}`);

      const [areaConfigSnap, reservationSnap] = await Promise.all([
        transaction.get(areaConfigRef),
        transaction.get(reservationRef)
      ]);

      // Verificar si el código ya está reservado por OTRA área del mismo cliente
      if (reservationSnap.exists()) {
        const resData = reservationSnap.data() as AreaCodeReservation;
        if (resData.areaConfigId !== targetAreaConfigId) {
          throw new Error(`El código de área "${normCode}" ya está reservado por otra área.`);
        }
      }

      // Manejar actualización de aliases y liberación de código antiguo
      let oldCodeToRelease: string | null = null;
      let existingAliases: string[] = [];

      if (areaConfigSnap.exists()) {
        const currentData = areaConfigSnap.data() as AreaStrategyConfig;
        if (currentData.code && currentData.code !== normCode) {
          oldCodeToRelease = currentData.code;
        }
        existingAliases = currentData.aliases || [];
        if (currentData.areaName && currentData.areaName !== normArea && !existingAliases.includes(currentData.areaName)) {
          existingAliases.push(currentData.areaName);
        }
      }

      if (oldCodeToRelease) {
        const oldReservationRef = doc(db, CODE_RESERVATIONS_COLLECTION, `res_${targetClient}_${oldCodeToRelease}`);
        transaction.delete(oldReservationRef);
      }

      const now = new Date().toISOString();
      const finalConfig: AreaStrategyConfig = {
        id: targetAreaConfigId,
        areaName: normArea,
        code: normCode,
        aliases: existingAliases,
        clientId: targetClient,
        updatedAt: now,
        createdAt: areaConfigSnap.exists() ? (areaConfigSnap.data() as AreaStrategyConfig).createdAt : now
      };

      const newReservation: AreaCodeReservation = {
        id: `res_${targetClient}_${normCode}`,
        areaConfigId: targetAreaConfigId,
        code: normCode,
        clientId: targetClient,
        updatedAt: now
      };

      transaction.set(areaConfigRef, JSON.parse(JSON.stringify(finalConfig)), { merge: true });
      transaction.set(reservationRef, JSON.parse(JSON.stringify(newReservation)), { merge: true });

      return finalConfig;
    });

    return result;
  },

  // -----------------------------
  // 4. Objetivos de Contribución (OC) con Contador Atómico Transaccional Estricto
  // -----------------------------
  getContributionObjectives: async (clientId?: string): Promise<ContributionObjective[]> => {
    const targetClient = normalizeClientId(clientId);
    const ref = collection(db, CONTRIBUTION_OBJECTIVES_COLLECTION);
    const q = query(ref, where('clientId', '==', targetClient));
    const snap = await getDocs(q);

    const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as ContributionObjective));
    return list.sort((a, b) => a.displayCode.localeCompare(b.displayCode));
  },

  saveContributionObjective: async (
    data: Omit<ContributionObjective, 'id' | 'sequenceNumber' | 'displayCode' | 'areaCode'> & {
      id?: string;
      areaConfigId?: string;
      areaCode?: string;
    }
  ): Promise<ContributionObjective> => {
    const targetClient = normalizeClientId(data.clientId);
    const normArea = (data.areaName || 'GENERAL').trim().toUpperCase();

    // 1. Asegurar la existencia y obtener la configuración de área relacional
    const areaConfigs = await strategyService.getAreaConfigs(targetClient);
    let areaConfig = resolveAreaStrategyConfig(normArea, areaConfigs) ||
                     (data.areaConfigId ? areaConfigs.find(c => c.id === data.areaConfigId) : undefined);

    if (!areaConfig && normArea !== 'GENERAL') throw new Error('Configure primero el código estable del área.');

    const resolvedAreaConfigId = areaConfig?.id;
    const resolvedAreaCode = areaConfig?.code || '';

    // Si es edición de un OC existente, actualizar metadatos sin alterar su secuencia monótona
    if (data.id) {
      const ocRef = doc(db, CONTRIBUTION_OBJECTIVES_COLLECTION, data.id);
      const snap = await getDoc(ocRef);
      if (!snap.exists()) throw new Error(`Objetivo de contribución "${data.id}" no encontrado.`);

      const existing = snap.data() as ContributionObjective;
      if (existing.clientId !== targetClient) {
        throw new Error(`Acceso denegado: El objetivo de contribución pertenece al cliente "${existing.clientId}".`);
      }

      const now = new Date().toISOString();
      const updatedOC: ContributionObjective = {
        ...existing,
        ...data,
        id: data.id,
        areaConfigId: resolvedAreaConfigId,
        areaName: normArea,
        areaCode: resolvedAreaCode,
        displayCode: formatOCCode(resolvedAreaCode, existing.sequenceNumber),
        clientId: targetClient,
        updatedAt: now
      };

      await setDoc(ocRef, JSON.parse(JSON.stringify(updatedOC)), { merge: true });
      return updatedOC;
    }

    // 🛡️ REGLA DE CONCURRENCIA ESTRICTA: Transacción 100% interna sin getDocs externo previo
    const result = await runTransaction(db, async (transaction) => {
      const scope = resolvedAreaConfigId || 'GENERAL';
      const counterRef = doc(db, COUNTERS_COLLECTION, `cnt_${targetClient}_OC_${scope}`);
      const counterSnap = await transaction.get(counterRef);

      let lastSeq = 0;
      if (counterSnap.exists()) {
        lastSeq = (counterSnap.data() as StrategyCounter).lastIssuedSequence || 0;
      }

      const nextSeq = lastSeq + 1;
      const displayCode = formatOCCode(resolvedAreaCode, nextSeq);
      const newDocId = `oc_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
      const ocRef = doc(db, CONTRIBUTION_OBJECTIVES_COLLECTION, newDocId);

      const now = new Date().toISOString();
      const finalOC: ContributionObjective = {
        ...data,
        id: newDocId,
        areaConfigId: resolvedAreaConfigId,
        areaName: normArea,
        areaCode: resolvedAreaCode,
        sequenceNumber: nextSeq,
        displayCode,
        clientId: targetClient,
        status: data.status || 'active',
        updatedAt: now,
        createdAt: now
      };

      const updatedCounter: StrategyCounter = {
        id: `cnt_${targetClient}_OC_${scope}`,
        lastIssuedSequence: nextSeq,
        areaConfigId: resolvedAreaConfigId,
        scope,
        clientId: targetClient,
        updatedAt: now
      };

      transaction.set(counterRef, JSON.parse(JSON.stringify(updatedCounter)), { merge: true });
      transaction.set(ocRef, JSON.parse(JSON.stringify(finalOC)), { merge: true });

      return finalOC;
    });

    return result;
  },

  deleteContributionObjective: async (ocId: string, clientId?: string): Promise<boolean> => {
    const targetClient = normalizeClientId(clientId);
    const ref = doc(db, CONTRIBUTION_OBJECTIVES_COLLECTION, ocId);
    // Defensa en profundidad: Verificar pertenencia al tenant
    const snap = await getDoc(ref);
    if (!snap.exists()) return true;

    const existing = snap.data() as ContributionObjective;
    if (existing.clientId && existing.clientId !== targetClient) {
      throw new Error(`Acceso denegado: El objetivo de contribución pertenece al cliente "${existing.clientId}".`);
    }

    const assignmentsRef = collection(db, ASSIGNMENTS_COLLECTION);
    const q = query(assignmentsRef, where('contributionObjectiveId', '==', ocId), where('clientId', '==', targetClient));
    const asgnSnap = await getDocs(q);
    if (!asgnSnap.empty) {
      throw new Error('No es posible eliminar el objetivo de contribución porque tiene indicadores asignados. Elimine las asignaciones primero.');
    }

    await runTransaction(db, async transaction => {
      const currentSnap = await transaction.get(ref);
      if (!currentSnap.exists()) return;

      const current = currentSnap.data() as ContributionObjective;
      if (current.clientId && normalizeClientId(current.clientId) !== targetClient) {
        throw new Error(`Acceso denegado: El objetivo de contribución pertenece al cliente "${current.clientId}".`);
      }

      const scope = current.areaConfigId || 'GENERAL';
      const counterRef = doc(db, COUNTERS_COLLECTION, `cnt_${targetClient}_OC_${scope}`);
      const counterSnap = await transaction.get(counterRef);
      const counter = counterSnap.exists() ? counterSnap.data() as StrategyCounter : undefined;
      if (canReleaseSequence(current.sequenceNumber, counter)) {
        transaction.set(counterRef, {
          ...counter,
          lastIssuedSequence: current.sequenceNumber - 1,
          updatedAt: new Date().toISOString()
        }, { merge: true });
      }
      transaction.delete(ref);
    });

    return true;
  },

  // -----------------------------
  // 5. Asignaciones de Indicadores
  // -----------------------------
  getAssignments: async (clientId?: string): Promise<ContributionIndicatorAssignment[]> => {
    const targetClient = normalizeClientId(clientId);
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
    const targetClient = normalizeClientId(clientId);
    // Defensa en profundidad: Verificar que el OC existe y pertenece al tenant
    const ocRef = doc(db, CONTRIBUTION_OBJECTIVES_COLLECTION, ocId);
    const ocSnap = await getDoc(ocRef);
    if (!ocSnap.exists()) {
      throw new Error(`Objetivo de contribución "${ocId}" no encontrado.`);
    }

    const ocData = ocSnap.data() as ContributionObjective;
    if (ocData.clientId !== targetClient) {
      throw new Error(`Acceso denegado: El objetivo de contribución pertenece al cliente "${ocData.clientId}".`);
    }

    const assignmentsRef = collection(db, ASSIGNMENTS_COLLECTION);
    const q = query(assignmentsRef, where('contributionObjectiveId', '==', ocId), where('clientId', '==', targetClient));
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
  },

  // -----------------------------
  // 6. Relaciones de Causa y Efecto entre Objetivos Estratégicos (Mapa Estratégico)
  // -----------------------------
  getStrategicObjectiveRelationships: async (clientId?: string): Promise<StrategicObjectiveRelationship[]> => {
    const targetClient = normalizeClientId(clientId);
    const ref = collection(db, RELATIONSHIPS_COLLECTION);
    const q = query(ref, where('clientId', '==', targetClient));
    const snap = await getDocs(q);

    const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as StrategicObjectiveRelationship));
    return list.sort((a, b) => (a.order || 0) - (b.order || 0));
  },

  saveStrategicObjectiveRelationship: async (
    rel: Omit<StrategicObjectiveRelationship, 'id'> & { id?: string }
  ): Promise<StrategicObjectiveRelationship> => {
    const targetClient = normalizeClientId(rel.clientId);
    const sourceId = (rel.sourceStrategicObjectiveId || '').trim();
    const targetId = (rel.targetStrategicObjectiveId || '').trim();

    if (!sourceId || !targetId) {
      throw new Error('Debe especificar un objetivo estratégico de origen y uno de destino.');
    }
    if (sourceId === targetId) {
      throw new Error('Un objetivo estratégico no puede relacionarse consigo mismo.');
    }

    const canonicalDocId = getCanonicalRelationshipId(targetClient, sourceId, targetId);
    const relRef = doc(db, RELATIONSHIPS_COLLECTION, canonicalDocId);
    const sourceRef = doc(db, OBJECTIVES_COLLECTION, sourceId);
    const targetRef = doc(db, OBJECTIVES_COLLECTION, targetId);

    const result = await runTransaction(db, async transaction => {
      const sourceSnap = await transaction.get(sourceRef);
      if (!sourceSnap.exists()) {
        throw new Error(`El objetivo estratégico de origen "${sourceId}" no existe.`);
      }
      const sourceData = sourceSnap.data() as StrategicObjective;
      if (normalizeClientId(sourceData.clientId) !== targetClient) {
        throw new Error(`El objetivo de origen pertenece a otro tenant.`);
      }

      const targetSnap = await transaction.get(targetRef);
      if (!targetSnap.exists()) {
        throw new Error(`El objetivo estratégico de destino "${targetId}" no existe.`);
      }
      const targetData = targetSnap.data() as StrategicObjective;
      if (normalizeClientId(targetData.clientId) !== targetClient) {
        throw new Error(`El objetivo de destino pertenece a otro tenant.`);
      }

      const relSnap = await transaction.get(relRef);
      const now = new Date().toISOString();

      const finalData: StrategicObjectiveRelationship = {
        ...rel,
        id: canonicalDocId,
        clientId: targetClient,
        sourceStrategicObjectiveId: sourceId,
        targetStrategicObjectiveId: targetId,
        description: rel.description !== undefined ? rel.description : (relSnap.exists() ? (relSnap.data() as StrategicObjectiveRelationship).description : undefined),
        order: rel.order !== undefined ? rel.order : (relSnap.exists() ? (relSnap.data() as StrategicObjectiveRelationship).order : undefined),
        updatedAt: now,
        createdAt: relSnap.exists() ? ((relSnap.data() as StrategicObjectiveRelationship).createdAt || now) : (rel.createdAt || now)
      };

      transaction.set(relRef, JSON.parse(JSON.stringify(finalData)), { merge: true });
      return finalData;
    });

    return result;
  },

  deleteStrategicObjectiveRelationship: async (relationshipId: string, clientId?: string): Promise<boolean> => {
    const targetClient = normalizeClientId(clientId);
    const ref = doc(db, RELATIONSHIPS_COLLECTION, relationshipId);

    const snap = await getDoc(ref);
    if (!snap.exists()) return true;

    const existing = snap.data() as StrategicObjectiveRelationship;
    if (existing.clientId && normalizeClientId(existing.clientId) !== targetClient) {
      throw new Error(`Acceso denegado: La relación pertenece al cliente "${existing.clientId}" y no a "${targetClient}".`);
    }

    await deleteDoc(ref);
    return true;
  }
};
