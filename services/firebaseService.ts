// services/firebaseService.ts

import {
    collection,
    doc,
    getDocs,
    getDoc,
    setDoc,
    updateDoc,
    deleteDoc,
    writeBatch,
    query,
    where,
    DocumentReference,
    DocumentData,
} from "firebase/firestore";
import {
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    sendPasswordResetEmail,
    signOut,
    onAuthStateChanged,
    getAuth,
} from "firebase/auth";

import { db, auth } from "../firebase";

import type {
    User,
    Dashboard as DashboardType,
    DashboardItem,
    SystemSettings,
} from "../types";

const DASHBOARDS_COLLECTION = "dashboards";
const USERS_COLLECTION = "users";
const SYSTEM_SETTINGS_COLLECTION = "systemSettings";
const SYSTEM_SETTINGS_DOC_ID = "main";
const CLIENTS_COLLECTION = "managedClients";

// -----------------------------
// Helpers
// -----------------------------
const normalizeDashboardId = (value: unknown, fallback: number | string): number | string => {
    if (value === null || value === undefined) return fallback;
    const n = Number(value);
    if (!isNaN(n) && String(value).trim() !== "") return n;
    return String(value);
};

// Firestore: dashboards/{dashboardId}/items (subcolección)
const itemsCollectionRef = (dashboardId: number | string) =>
    collection(db, DASHBOARDS_COLLECTION, String(dashboardId), "items");

// -----------------------------
// firebaseService
// -----------------------------
export const firebaseService = {
    // -----------------------------
    // Auth helpers
    // -----------------------------
    auth: {
        signInWithEmailAndPassword,
        createUserWithEmailAndPassword,
        sendPasswordResetEmail,
        signOut,
        onAuthStateChanged,
        getAuth,
    },

    // -----------------------------
    // Users
    // -----------------------------
    getUsers: async (): Promise<User[]> => {
        const snap = await getDocs(collection(db, USERS_COLLECTION));
        return snap.docs.map((d) => ({ id: d.id, ...d.data() } as User));
    },

    getUser: async (userId: string): Promise<User | null> => {
        const ref = doc(db, USERS_COLLECTION, userId);
        const snap = await getDoc(ref);
        if (!snap.exists()) return null;
        return { id: snap.id, ...snap.data() } as User;
    },

    createAuthUser: async (email: string, password: string, name: string) => {
        const { initializeApp } = await import("firebase/app");
        const { getAuth, createUserWithEmailAndPassword, updateProfile, signOut } = await import("firebase/auth");
        const { firebaseConfig } = await import("../firebase");

        const secondaryApp = initializeApp(firebaseConfig, "SecondaryAuth");
        const secondaryAuth = getAuth(secondaryApp);

        try {
            const credential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
            await updateProfile(credential.user, { displayName: name });
            const uid = credential.user.uid;
            await signOut(secondaryAuth);
            return { uid };
        } finally {
            // cleanup is handled by firebase
        }
    },

    resetDashboardDataOnly: async (clientId: string, year: number, area?: string) => {
        // Obtenemos todos los tableros del cliente y año
        // Nota: getDashboards ya filtra por cliente y año si se pasan, pero hacemos un fetch manual filtrado
        // para asegurarnos de tener la data más cruda y completa posible.
        const all = await firebaseService.getDashboards(clientId, year);
        const batch = writeBatch(db);
        let resetCount = 0;
        const targetArea = area ? area.trim().toUpperCase() : null;

        for (const dash of all) {
            // Solo resetear tableros REALES (no agregados virtuales)
            if (typeof dash.id !== 'number') continue;

            // 🛡️ FILTRO DE ÁREA (v5.2.0)
            if (targetArea) {
                const dashArea = ((dash as any).area || "").trim().toUpperCase();
                if (dashArea !== targetArea) continue; // Si no coincide el área, saltar
            }

            if (dash.items && dash.items.length > 0) {
                for (const item of dash.items) {
                    const itemRef = doc(db, DASHBOARDS_COLLECTION, String(dash.id), "items", String(item.id));
                    batch.update(itemRef, {
                        monthlyProgress: Array(12).fill(0),
                        // monthlyGoals: Array(12).fill(0), // ¿Mantener metas? Probablemente sí.
                        // Dejemos las metas intactas, solo borramos lo operativo que está duplicado.
                    });
                }
                resetCount++;
            }
        }

        if (resetCount > 0) {
            await batch.commit();
        }
        return { resetDashboards: resetCount };
    },

    resetDashboardGoalsOnly: async (clientId: string, year: number) => {
        const all = await firebaseService.getDashboards(clientId, year);
        const batch = writeBatch(db);
        let resetCount = 0;

        for (const dash of all) {
            if (typeof dash.id !== 'number') continue;
            if (dash.items && dash.items.length > 0) {
                for (const item of dash.items) {
                    const itemRef = doc(db, DASHBOARDS_COLLECTION, String(dash.id), "items", String(item.id));
                    batch.update(itemRef, {
                        monthlyGoals: Array(12).fill(0),
                        weeklyGoals: Array(53).fill(0)
                    });
                }
                resetCount++;
            }
        }

        if (resetCount > 0) {
            await batch.commit();
        }
        return { resetDashboards: resetCount };
    },

    saveUser: async (user: User) => {
        const ref = doc(db, USERS_COLLECTION, user.id);
        await setDoc(ref, user);
        return true;
    },

    updateDoc: async (docRef: DocumentReference, data: Partial<DocumentData>) => {
        await updateDoc(docRef, data);
        return true;
    },

    updateUser: async (user: User) => {
        const ref = doc(db, USERS_COLLECTION, user.id);
        await setDoc(ref, { ...user });
        return true;
    },

    deleteUserFromFirestore: async (userId: string) => {
        await deleteDoc(doc(db, USERS_COLLECTION, userId));
        return true;
    },

    sendPasswordResetEmail: async (email: string) => {
        await sendPasswordResetEmail(auth, email);
        return true;
    },

    // -----------------------------
    // System settings (PRO: Scoped by Client)
    // -----------------------------
    getSystemSettings: async (clientId: string = "main"): Promise<SystemSettings | undefined> => {
        const id = clientId.trim().toUpperCase();
        const ref = doc(db, SYSTEM_SETTINGS_COLLECTION, id || SYSTEM_SETTINGS_DOC_ID);
        const snap = await getDoc(ref);

        if (!snap.exists() && id !== SYSTEM_SETTINGS_DOC_ID) {
            // Fallback to global if client settings don't exist
            const globalRef = doc(db, SYSTEM_SETTINGS_COLLECTION, SYSTEM_SETTINGS_DOC_ID);
            const globalSnap = await getDoc(globalRef);
            return globalSnap.exists() ? (globalSnap.data() as SystemSettings) : undefined;
        }

        return snap.exists() ? (snap.data() as SystemSettings) : undefined;
    },

    saveSystemSettings: async (settings: Partial<SystemSettings>, clientId: string = "main") => {
        const id = (clientId === 'all' || !clientId) ? SYSTEM_SETTINGS_DOC_ID : clientId.trim().toUpperCase();
        const ref = doc(db, SYSTEM_SETTINGS_COLLECTION, id);

        // 🛡️ Firestore FIX: Eliminar campos 'undefined' ya que provocan error al guardar
        const cleanSettings = JSON.parse(JSON.stringify(settings));

        await setDoc(ref, cleanSettings, { merge: true });
        return true;
    },

    // -----------------------------
    // Dashboards
    // -----------------------------
    getDashboards: async (clientId?: string, year?: number): Promise<DashboardType[]> => {
        const dRef = collection(db, DASHBOARDS_COLLECTION);

        // 🛡️ MÁXIMA RESILIENCIA: No usar 'where' para evitar errores de índices y de tipos (string vs number)
        // Traemos todo lo del cliente (o todo si es admin) y filtramos en JS
        const q = query(dRef);
        const snap = await getDocs(q);

        const dashboardPromises = snap.docs.map(async (docSnap) => {
            const data = docSnap.data();
            // 🛡️ REGLA DE INTEGRIDAD V4 (FIX CRÍTICO): El nombre del documento en Firestore es la ÚNICA fuente de verdad.
            // Si data.id es diferente, lo ignoramos para evitar colisiones y pérdida de indicadores.
            const dashId = normalizeDashboardId(docSnap.id, docSnap.id);

            // Fetch items
            const itemsSnap = await getDocs(itemsCollectionRef(dashId));
            const items = itemsSnap.docs
                .map((it) => {
                    const itemData = it.data() as DashboardItem;
                    return {
                        ...itemData,
                        id: normalizeDashboardId(itemData.id, it.id) as number,
                    };
                })
                .sort((a, b) => (Number(a.id) || 0) - (Number(b.id) || 0));

            return {
                ...data,
                id: dashId,
                items,
            } as DashboardType;
        });

        let dashboards = await Promise.all(dashboardPromises);

        // 🛡️ FILTRADO EN JAVASCRIPT (Robusto a tipos y formatos)

        // 1. Filtrar por Cliente (Case-Insensitive y Robusto)
        if (clientId && clientId !== 'all') {
            const target = clientId.trim().toUpperCase();
            dashboards = dashboards.filter(d => {
                const dClient = (d.clientId || "IPS").trim().toUpperCase();
                return dClient === target && d.id !== 0 && d.id !== null; // Excluir nulos/basura
            });
        } else {
            // Filtrar documentos corruptos incluso en vista global
            dashboards = dashboards.filter(d => d.id !== 0 && d.id !== null && d.title);
        }

        // 2. Filtrar por Año (Type-Insensitive)
        if (year) {
            const targetYear = String(year);
            dashboards = dashboards.filter(d =>
                String(d.year || 2025) === targetYear
            );
        }

        return dashboards.sort((a, b) => {
            const groupA = (a.group || "").toUpperCase();
            const groupB = (b.group || "").toUpperCase();
            if (groupA < groupB) return -1;
            if (groupA > groupB) return 1;

            const titleA = (a.title || "").toUpperCase();
            const titleB = (b.title || "").toUpperCase();
            if (titleA < titleB) return -1;
            if (titleA > titleB) return 1;

            return 0;
        });
    },

    updateDashboardMetadata: async (dashboardId: number | string, metadata: Partial<DashboardType>) => {
        const ref = doc(db, DASHBOARDS_COLLECTION, String(dashboardId));
        await setDoc(ref, metadata, { merge: true });
        return true;
    },

    saveDashboard: async (dashboard: DashboardType) => {
        const { items, ...rest } = dashboard;
        const dashId = normalizeDashboardId(rest.id, rest.id);

        // Forzar clientId a mayúsculas y asegurar ID final
        const finalData = {
            ...rest,
            clientId: (rest.clientId || "IPS").trim().toUpperCase(),
            id: dashId
        };
        const ref = doc(db, DASHBOARDS_COLLECTION, String(dashId));
        await setDoc(ref, finalData, { merge: true });

        if (items && items.length > 0) {
            await firebaseService.updateDashboardItems(dashId, items, false);
        }
        return true;
    },

    updateDashboardItems: async (dashboardId: number | string, items: DashboardItem[], overwrite: boolean = false) => {
        const itemsRef = collection(db, DASHBOARDS_COLLECTION, String(dashboardId), "items");

        // 1. SOLO BORRAMOS si es un "overwrite" total (desde el módulo de gestión de KPIs)
        if (overwrite) {
            const existingSnap = await getDocs(itemsRef);
            if (existingSnap.size > 0) {
                const deleteBatch = writeBatch(db);
                existingSnap.docs.forEach(d => deleteBatch.delete(d.ref));
                await deleteBatch.commit();
            }
        }

        // 2. Guardar los indicadores proporcionados
        const batch = writeBatch(db);
        for (const item of items) {
            const itemRef = doc(db, DASHBOARDS_COLLECTION, String(dashboardId), "items", String(item.id));

            // 🛡️ SANITIZACIÓN ROBUSTA (v3.8.2): Evitar error de Firestore por campos undefined
            const cleanItem = JSON.parse(JSON.stringify(item));
            batch.set(itemRef, cleanItem); // No usamos merge para asegurar limpieza total por campo
        }
        await batch.commit();
        return true;
    },

    getDashboardItems: async (dashboardId: number | string): Promise<DashboardItem[]> => {
        const itemsSnap = await getDocs(itemsCollectionRef(dashboardId));
        return itemsSnap.docs
            .map((it) => {
                const itemData = it.data() as DashboardItem;
                return {
                    ...itemData,
                    id: normalizeDashboardId(itemData.id, it.id) as number,
                };
            })
            .sort((a, b) => (Number(a.id) || 0) - (Number(b.id) || 0));
    },

    deleteDashboard: async (id: number | string) => {
        const ref = doc(db, DASHBOARDS_COLLECTION, String(id));
        await deleteDoc(ref);
        return true;
    },

    getAllClients: async (): Promise<string[]> => {
        // 1. Get from Dashboards (Discovery)
        const qDash = query(collection(db, DASHBOARDS_COLLECTION));
        const snapDash = await getDocs(qDash);
        const clients = new Set<string>(["IPS"]);
        snapDash.docs.forEach(d => {
            const c = d.data().clientId;
            if (c) clients.add(String(c).trim().toUpperCase());
        });

        // 2. Get from Managed Clients (Persistence)
        const qManaged = query(collection(db, CLIENTS_COLLECTION));
        const snapManaged = await getDocs(qManaged);
        snapManaged.docs.forEach(d => {
            clients.add(d.id.trim().toUpperCase());
        });

        return Array.from(clients).sort();
    },

    ensureClientExists: async (clientId: string) => {
        const id = clientId.trim().toUpperCase();
        if (!id || id === 'IPS') return;
        const ref = doc(db, CLIENTS_COLLECTION, id);
        await setDoc(ref, { id, createdAt: new Date().toISOString() }, { merge: true });
    },

    // -----------------------------
    // Specialized Tools
    // -----------------------------
    createIPSStructure: async (year: number) => {
        const { IPS_DASHBOARDS, createEmptyIPSIndicators } = await import("../utils/standardStructure");
        const clientId = "IPS";

        console.log("🚀 INICIANDO LIMPIEZA NUCLEAR IPS...");

        // 1. Obtener TODOS los documentos de dashboards sin excepción
        const allDocsSnap = await getDocs(collection(db, DASHBOARDS_COLLECTION));
        let deletedCount = 0;

        for (const docSnap of allDocsSnap.docs) {
            const data = docSnap.data();
            const docClientId = (data.clientId || "").toString().trim().toUpperCase();
            const docYear = data.year || 0;

            // CRITERIO DE ELIMINACIÓN: 
            // - Es del cliente IPS para este año
            // - O ES UN FANTASMA (ID corto numérico o sin clientId)
            const isIPSDoc = docClientId === "IPS" && Number(docYear) === year;
            const isGhostDoc = !data.clientId || (docSnap.id.length < 5 && !isNaN(Number(docSnap.id)));

            if (isIPSDoc || isGhostDoc) {
                try {
                    // Borrar subcolección items SIEMPRE
                    const itemsSnap = await getDocs(collection(db, DASHBOARDS_COLLECTION, docSnap.id, "items"));
                    if (itemsSnap.size > 0) {
                        const itBatch = writeBatch(db);
                        itemsSnap.forEach(it => itBatch.delete(it.ref));
                        await itBatch.commit();
                    }
                    await deleteDoc(docSnap.ref);
                    deletedCount++;
                } catch (e) {
                    console.warn(`Error al limpiar ${docSnap.id}:`, e);
                }
            }
        }
        console.log(`✅ Limpieza nuclear completada: ${deletedCount} registros eliminados.`);

        // 2. CREAR LOS 14 TABLEROS CON ESTRUCTURA RED CROP (IDs fijos)
        console.log("🆕 Creando tableros IPS estándar...");
        const standardIndicators = createEmptyIPSIndicators();
        const baseId = 2000 + (year - 2024) * 100; // IDs estables 2100, 2101...

        const mainBatch = writeBatch(db);
        let createdCount = 0;

        for (const std of IPS_DASHBOARDS) {
            const newId = baseId + std.num;
            const dashRef = doc(db, DASHBOARDS_COLLECTION, String(newId));

            const newDash = {
                id: newId,
                title: std.name,
                subtitle: `IPS - ${std.name}`,
                group: std.group.toUpperCase(),
                year: year,
                clientId: clientId,
                orderNumber: std.num,
                thresholds: { onTrack: 90, atRisk: 80 }
            };

            mainBatch.set(dashRef, newDash);

            // Subcolección de ítems
            for (const ind of standardIndicators) {
                const itemRef = doc(db, DASHBOARDS_COLLECTION, String(newId), "items", String(ind.id));
                mainBatch.set(itemRef, ind);
            }
            createdCount++;
        }

        await mainBatch.commit();
        console.log(`🎯 ¡LISTO! 14 tableros creados para IPS/${year}`);

        return {
            createdDashboards: createdCount,
            indicatorsPerDashboard: standardIndicators.length,
            totalIndicators: createdCount * standardIndicators.length,
            clientId,
            year,
        };
    },

    createMultipleEmptyDashboards: async (clientId: string, year: number, count: number) => {
        const targetClient = clientId.trim().toUpperCase();
        const all = await firebaseService.getDashboards();
        const maxId = all.reduce((m, d) => Math.max(m, Number(d.id) || 0), 0);
        let nextId = maxId + 1;

        const batch = writeBatch(db);
        for (let i = 1; i <= count; i++) {
            const newId = nextId++;
            const dashRef = doc(db, DASHBOARDS_COLLECTION, String(newId));
            const newDash = {
                id: newId,
                title: `Tablero ${i}`,
                subtitle: `Tablero - ${targetClient}`,
                group: "GENERAL",
                year: year,
                clientId: targetClient,
                orderNumber: i,
                thresholds: { onTrack: 90, atRisk: 80 },
            };
            batch.set(dashRef, newDash);
        }

        await batch.commit();
        return { createdDashboards: count, clientId, year };
    },

    generateYearForClient: async (clientId: string, fromYear: number, toYear: number) => {
        const all = await firebaseService.getDashboards();
        const sourceDashboards = all.filter(d => d.clientId === clientId && (d.year || 2025) === fromYear);

        const existingInTarget = all.filter(d => d.clientId === clientId && (d.year || 2025) === toYear);
        if (existingInTarget.length > 0) {
            throw new Error(`Ya existen ${existingInTarget.length} tableros en ${clientId}/${toYear}.`);
        }

        const batch = writeBatch(db);
        const maxId = all.reduce((m, d) => Math.max(m, Number(d.id) || 0), 0);
        let nextId = maxId + 100;
        let createdCount = 0;
        let totalIndicators = 0;

        for (const sourceDash of sourceDashboards) {
            const newId = nextId++;
            const dashRef = doc(db, DASHBOARDS_COLLECTION, String(newId));

            const newDash = {
                ...sourceDash,
                id: newId,
                year: toYear,
                originalId: sourceDash.id,
            };
            delete (newDash as any).items;
            batch.set(dashRef, newDash);

            if (sourceDash.items && sourceDash.items.length > 0) {
                for (const item of sourceDash.items) {
                    const newItem = {
                        ...item,
                        monthlyGoals: Array(12).fill(0),
                        monthlyProgress: Array(12).fill(0),
                        monthlyNotes: Array(12).fill(""),
                        paiRows: [],
                    };
                    const itemRef = doc(db, DASHBOARDS_COLLECTION, String(newId), "items", String(item.id));
                    batch.set(itemRef, newItem);
                    totalIndicators++;
                }
            }
            createdCount++;
        }

        await batch.commit();
        return {
            createdDashboards: createdCount,
            totalIndicators,
            indicatorsPerDashboard: createdCount > 0 ? Math.round(totalIndicators / createdCount) : 0
        };
    },

    deleteClientYearData: async (clientId: string, year: number) => {
        const all = await firebaseService.getDashboards();
        const toDelete = all.filter(d => d.clientId === clientId && (d.year || 2025) === year);

        const batch = writeBatch(db);
        for (const dash of toDelete) {
            if (dash.items) {
                for (const item of dash.items) {
                    batch.delete(doc(db, DASHBOARDS_COLLECTION, String(dash.id), "items", String(item.id)));
                }
            }
            batch.delete(doc(db, DASHBOARDS_COLLECTION, String(dash.id)));
        }
        await batch.commit();
        return { deletedCount: toDelete.length };
    },

    deleteIPSStructureFromClient: async (clientId: string, year: number) => {
        const all = await firebaseService.getDashboards();
        const ipsNames = ["METRO CENTRO", "METRO SUR", "METRO NORTE", "TOLUCA", "GTMI", "OCCIDENTE", "BAJIO", "SLP", "SUR", "GOLFO", "PENINSULA", "PACIFICO", "NOROESTE", "NORESTE"];

        const toDelete = all.filter(d =>
            d.clientId?.toLowerCase() === clientId?.toLowerCase() &&
            (d.year || 2025) === year &&
            (
                (ipsNames as string[]).some(name => name.trim().toLowerCase() === d.title?.trim().toLowerCase()) ||
                (d.subtitle && d.subtitle.toLowerCase().includes("ips"))
            )
        );

        const batch = writeBatch(db);
        for (const dash of toDelete) {
            if (dash.items) {
                for (const item of dash.items) {
                    batch.delete(doc(db, DASHBOARDS_COLLECTION, String(dash.id), "items", String(item.id)));
                }
            }
            batch.delete(doc(db, DASHBOARDS_COLLECTION, String(dash.id)));
        }
        await batch.commit();
        return { deletedCount: toDelete.length };
    },

    importCSVForYear: async (rows: string[][], _year: number, clientId: string) => {
        const batch = writeBatch(db);
        const dataRows = rows.slice(1);
        const all = await firebaseService.getDashboards(clientId, _year);

        let updatedCount = 0;
        for (const row of dataRows) {
            const [csvDashNum, csvItemNum, ...months] = row;
            if (!csvDashNum || !csvItemNum) continue;

            const targetDash = all.find(d =>
                (d as any).orderNumber === Number(csvDashNum) ||
                d.subtitle?.includes(`Tablero ${csvDashNum}`)
            );

            if (!targetDash) continue;

            const values = months.map(m => parseFloat(m) || 0);
            const itemRef = doc(db, DASHBOARDS_COLLECTION, String(targetDash.id), "items", String(csvItemNum));

            if (values.length >= 24) {
                const goals = [];
                const progress = [];
                for (let i = 0; i < 24; i += 2) {
                    goals.push(values[i]);
                    progress.push(values[i + 1]);
                }
                batch.update(itemRef, { monthlyGoals: goals, monthlyProgress: progress });
            } else {
                batch.update(itemRef, { monthlyProgress: values });
            }
            updatedCount++;
        }
        await batch.commit();
        return { updatedIndicators: updatedCount };
    },

    resetDashboardNamesOnly: async (clientId: string, year: number) => {
        const { STANDARD_DASHBOARDS } = await import("../utils/standardStructure");

        // 🛡️ GUARDIÁN ANTI-DESTRUCCIÓN: Solo permitir para IPS
        if (clientId.trim().toUpperCase() !== 'IPS') {
            console.error("⛔ BLOQUEADO: Intento de aplicar estructura IPS a cliente " + clientId);
            throw new Error("Esta función solo está disponible para estructura estándar IPS. Para otros clientes, use 'Renombrar' manual.");
        }

        const all = await firebaseService.getDashboards(clientId, year);
        const sorted = all.sort((a, b) => Number(a.id || 0) - Number(b.id || 0));

        const batch = writeBatch(db);
        let updatedCount = 0;

        for (let i = 0; i < Math.min(sorted.length, 14); i++) {
            const dashboard = sorted[i];
            const std = STANDARD_DASHBOARDS[i];

            // 🛡️ PROTECCIÓN ULTRA-DEFENSIVA CONTRA IDs CORRUPTOS
            if (!dashboard || !dashboard.id) {
                console.warn(`⚠️ Saltando tablero ${i}: objeto o ID nulo`);
                continue;
            }

            const dashId = Number(dashboard.id);
            if (!Number.isFinite(dashId) || dashId <= 0) {
                console.warn(`⚠️ Saltando tablero ${i} con ID inválido: ${dashboard.id} (parsea como ${dashId})`);
                continue;
            }

            try {
                const docRef = doc(db, DASHBOARDS_COLLECTION, String(dashId));
                batch.update(docRef, {
                    title: std.name,
                    group: std.group,
                    subtitle: "",
                    orderNumber: std.num,
                    year: year // Force year update
                });
                updatedCount++;
            } catch (error) {
                console.warn(`⚠️ Error al preparar actualización del tablero ${dashId}:`, error);
            }
        }

        if (updatedCount > 0) {
            await batch.commit();
            console.log(`✅ ${updatedCount} tableros actualizados correctamente`);
        } else {
            console.warn("⚠️ No se pudieron actualizar tableros (todos tienen IDs corruptos)");
        }

        return { updatedCount };
    },

    resetDashboardsWithIndicators: async (clientId: string, year: number) => {
        const { STANDARD_DASHBOARDS, createEmptyIndicators } = await import("../utils/standardStructure");

        // 🛡️ GUARDIÁN ANTI-DESTRUCCIÓN
        if (clientId.trim().toUpperCase() !== 'IPS') {
            throw new Error("⛔ ACCIÓN NO PERMITIDA: No se puede aplicar estructura IPS a otros clientes. Use 'Crear Tableros Vacíos'.");
        }

        const all = await firebaseService.getDashboards(clientId, year);
        const sorted = all.sort((a, b) => Number(a.id || 0) - Number(b.id || 0));
        const stdIndics = createEmptyIndicators();

        // 🛡️ AUTO-CREAR: Si no hay tableros y es IPS, crear desde cero
        if (sorted.length === 0 && clientId.toUpperCase() === 'IPS') {
            console.log("📦 No hay tableros, creando estructura IPS...");
            return await firebaseService.createIPSStructure(year);
        }

        const batch = writeBatch(db);
        let updatedCount = 0;

        for (let i = 0; i < Math.min(sorted.length, 14); i++) {
            const dash = sorted[i];
            const std = STANDARD_DASHBOARDS[i];

            // 🛡️ PROTECCIÓN ULTRA-DEFENSIVA: Verificar que el ID sea válido
            if (!dash || !dash.id) continue;
            const dashId = Number(dash.id);
            if (!Number.isFinite(dashId) || dashId <= 0) continue;

            try {
                // Actualizar metadata del dashboard
                const docRef = doc(db, DASHBOARDS_COLLECTION, String(dashId));
                batch.update(docRef, {
                    title: std.name,
                    group: std.group,
                    subtitle: "",
                    orderNumber: std.num
                });

                // Eliminar items existentes
                if (dash.items && dash.items.length > 0) {
                    for (const item of dash.items) {
                        if (item && item.id) {
                            batch.delete(doc(db, DASHBOARDS_COLLECTION, String(dashId), "items", String(item.id)));
                        }
                    }
                }

                // Crear nuevos indicadores estándar
                for (const ind of stdIndics) {
                    batch.set(doc(db, DASHBOARDS_COLLECTION, String(dashId), "items", String(ind.id)), ind);
                }

                updatedCount++;
            } catch (error) {
                console.warn(`⚠️ Error procesando tablero ${dashId}:`, error);
            }
        }

        if (updatedCount > 0) {
            await batch.commit();
        }

        return { updatedCount, indicatorsPerDashboard: stdIndics.length };
    },

    renameClient: async (oldClientId: string, newClientId: string) => {
        const oldId = oldClientId.trim().toUpperCase();
        const newId = newClientId.trim().toUpperCase();

        const q = query(collection(db, DASHBOARDS_COLLECTION), where("clientId", "==", oldId));
        const snap = await getDocs(q);
        const batch = writeBatch(db);

        // Update Dashboards
        snap.docs.forEach(d => {
            batch.update(d.ref, { clientId: newId });
        });

        // Update Managed Client Record
        const oldRef = doc(db, CLIENTS_COLLECTION, oldId);
        const newRef = doc(db, CLIENTS_COLLECTION, newId);
        batch.set(newRef, { id: newId, renamedFrom: oldId, updatedAt: new Date().toISOString() });
        batch.delete(oldRef);

        await batch.commit();
        return true;
    },

    updateDashboardsOrder: async (updates: { id: number | string; orderNumber: number }[]) => {
        const batch = writeBatch(db);
        updates.forEach(upd => {
            const ref = doc(db, DASHBOARDS_COLLECTION, String(upd.id));
            batch.update(ref, { orderNumber: upd.orderNumber });
        });
        await batch.commit();
        return true;
    },

    deleteClientGlobally: async (clientId: string) => {
        const targetId = clientId.trim().toUpperCase();

        // 1. Fetch ALL dashboards to perform a robust cleanup
        const qDas = query(collection(db, DASHBOARDS_COLLECTION));
        const snapDas = await getDocs(qDas);

        // 2. Fetch ALL users for cleanup
        const qUsr = query(collection(db, USERS_COLLECTION));
        const snapUsr = await getDocs(qUsr);

        const batch = writeBatch(db);
        let deletedCount = 0;

        // Limpiar Tableros
        snapDas.docs.forEach(docSnap => {
            const data = docSnap.data();
            const docClientId = String(data.clientId || "").trim().toUpperCase();

            if (docClientId === targetId) {
                // Nota: Firestore no borra subcolecciones automáticamente en el servidor vía delete().
                // Para una aplicación "blindada", deberíamos borrar los items también.
                batch.delete(docSnap.ref);
                deletedCount++;
            }
        });

        // Limpiar Usuarios
        snapUsr.docs.forEach(uSnap => {
            const uData = uSnap.data();
            const uClientId = String(uData.clientId || "").trim().toUpperCase();
            if (uClientId === targetId) {
                batch.delete(uSnap.ref);
            }
        });

        // 3. Delete Managed Client Record
        const clientRef = doc(db, CLIENTS_COLLECTION, targetId);
        batch.delete(clientRef);

        await batch.commit();
        return { deletedCount };
    },

    // 🚑 HERRAMIENTA DE RECUPERACIÓN (v4.1.4)
    sanitizeAllDashboards: async () => {
        const dRef = collection(db, DASHBOARDS_COLLECTION);
        const snap = await getDocs(dRef);
        const batch = writeBatch(db);
        let count = 0;

        for (const docSnap of snap.docs) {
            const data = docSnap.data();
            const docId = docSnap.id;
            const normalizedDocId = normalizeDashboardId(docId, docId);

            let needsUpdate = false;
            const updateObj: any = {};

            // 1. Sincronizar ID interno con nombre de documento
            if (data.id !== normalizedDocId) {
                updateObj.id = normalizedDocId;
                needsUpdate = true;
            }

            // 2. Reparar ClientId y Año si el ID es del nuevo formato (CLIENTE_AÑO_TIMESTAMP)
            if (typeof docId === 'string' && docId.split('_').length >= 3) {
                const parts = docId.split('_');
                const inferredClient = parts[0].toUpperCase();
                const inferredYear = parseInt(parts[1]);

                if (data.clientId !== inferredClient) {
                    updateObj.clientId = inferredClient;
                    needsUpdate = true;
                }
                if (data.year !== inferredYear && !isNaN(inferredYear)) {
                    updateObj.year = inferredYear;
                    needsUpdate = true;
                }
            }

            // 3. Garantizar que tenga clientId (fallback IPS si es numérico)
            if (!data.clientId) {
                updateObj.clientId = "IPS";
                needsUpdate = true;
            }

            // 4. Limpieza de indicadores huérfanos o sin nombre
            const itemsRef = collection(db, DASHBOARDS_COLLECTION, docId, "items"); // Assuming itemsCollectionRef is this
            const itemsSnap = await getDocs(itemsRef);
            for (const itemDoc of itemsSnap.docs) {
                const itemData = itemDoc.data();
                if (!itemData.indicator || itemData.indicator.trim() === "") {
                    batch.delete(itemDoc.ref);
                    count++;
                }
            }

            if (needsUpdate) {
                batch.update(docSnap.ref, updateObj);
                count++;
            }
        }

        if (count > 0) {
            await batch.commit();
        }
        return { fixedCount: count };
    },
};
