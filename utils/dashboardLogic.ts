
import { normalizeGroupName } from './formatters';

interface User {
    id: string;
    globalRole: string;
    clientId?: string;
    directorTitle?: string;
    subGroups?: string[];
    group?: string;
    dashboardAccess?: Record<string, string>;
}

interface Dashboard {
    id: number | string;
    title: string;
    group?: string;
    clientId?: string;
    originalId?: number;
}

export const calculateOfficialGroups = (
    allUsers: User[],
    allRawDashboards: Dashboard[],
    userProfile: User | null,
    isGlobalAdmin: boolean,
    selectedClientId: string | null
): string[] => {
    const targetClient = (selectedClientId || userProfile?.clientId || "IPS").trim().toUpperCase();

    // 1. Obtener títulos de Directores + SubGrupos
    const rawDirectors = allUsers
        .filter(u => (u.clientId || "").trim().toUpperCase() === targetClient && u.globalRole === 'Director')
        .flatMap(u => {
            const groups: string[] = [];

            // a) Agregar el título del director
            if (u.directorTitle) {
                groups.push(u.directorTitle.replace(/\s+/g, ' ').trim().toUpperCase());
            }

            // b) Agregar todos sus subgrupos
            if (u.subGroups && u.subGroups.length > 0) {
                u.subGroups.forEach(sg => {
                    if (sg && sg.trim()) {
                        groups.push(sg.replace(/\s+/g, ' ').trim().toUpperCase());
                    }
                });
            }

            return groups;
        })
        .filter(Boolean) as string[];

    // 2. De-duplicar por normalización
    const seenMap = new Map<string, string>();

    // Regla Director Priority
    if (userProfile?.directorTitle) {
        const title = userProfile.directorTitle.replace(/\s+/g, ' ').trim().toUpperCase();
        const norm = normalizeGroupName(title);
        seenMap.set(norm, title);
    }

    rawDirectors.forEach(title => {
        const norm = normalizeGroupName(title);
        let prettyTitle = title.trim().toUpperCase();
        if (norm === "DIRECTOR") prettyTitle = "DIRECTOR";
        if (prettyTitle.includes("DIRECTORF")) prettyTitle = prettyTitle.replace("DIRECTORF", "DIRECTOR");

        // 🛡️ FIX CRÍTICO DUPLICADOS logic from App.tsx
        if (!seenMap.has(norm)) {
            seenMap.set(norm, prettyTitle);
        }
    });

    // 3. Agregar grupos encontrados en tableros reales
    allRawDashboards.forEach(d => {
        if (d.group && d.group.trim()) {
            const title = d.group.replace(/\s+/g, ' ').trim().toUpperCase();
            const norm = normalizeGroupName(title);
            if (!seenMap.has(norm)) {
                seenMap.set(norm, title);
            }
        }
    });

    let localOfficialGroups = Array.from(seenMap.values());

    // 4. Filtering visibility based on role (Simulation of App.tsx logic)
    if (!isGlobalAdmin && userProfile) {
        const myOfficialGroupNorm = normalizeGroupName(userProfile.directorTitle || userProfile.group || "");
        const mySubGroupsNorms = (userProfile.subGroups || []).map(sg => normalizeGroupName(sg));

        const accessibleBoardGroups = allRawDashboards
            .filter(d => userProfile.dashboardAccess?.[d.id] || (d.originalId && userProfile.dashboardAccess?.[d.originalId]))
            .map(d => d.group ? d.group.trim().toUpperCase() : null)
            .filter(Boolean) as string[];

        const accessibleNorms = accessibleBoardGroups.map(g => normalizeGroupName(g));

        localOfficialGroups = localOfficialGroups.filter(gName => {
            const gNorm = normalizeGroupName(gName);
            if (gNorm === myOfficialGroupNorm) return true;
            if (mySubGroupsNorms.includes(gNorm)) return true;
            if (accessibleNorms.includes(gNorm)) return true;

            return false;
        });

        // Ensure accessible board groups are present
        accessibleBoardGroups.forEach(g => {
            if (!localOfficialGroups.some(og => normalizeGroupName(og) === normalizeGroupName(g))) {
                localOfficialGroups.push(g);
            }
        });

        // 🛡️ REGLA v8.0.1 (EMERGENCY VISIBILITY): Si soy Director de Operaciones, DEBO ver mi grupo
        const forcedGroup = "DIRECCIÓN OPERACIONES";
        const userIsOps = userProfile.directorTitle?.toUpperCase().includes("OPERACIONES")
            || userProfile.group?.toUpperCase().includes("OPERACIONES")
            || userProfile.subGroups?.some(sg => sg.toUpperCase().includes("OPERACIONES"));

        if (userIsOps && !localOfficialGroups.some(g => normalizeGroupName(g) === normalizeGroupName(forcedGroup))) {
            localOfficialGroups.push(forcedGroup);
        }
    }

    // 🛡️ REGLA v6.2.4-Fix10 (NUCLEAR DE-DUPLICATION):
    const finalSeen = new Map<string, string>();
    localOfficialGroups.forEach(g => {
        const norm = normalizeGroupName(g);
        const current = finalSeen.get(norm);
        
        // PRIORIDAD: Preferimos la versión que contiene DIRECCION/DIRECTOR o la más larga
        const gUpper = g.trim().toUpperCase();
        const isBetter = !current || 
                        gUpper.includes("DIRECCION") || 
                        gUpper.includes("DIRECCIÓN") || 
                        gUpper.includes("DIRECTOR") ||
                        gUpper.length > current.length;

        if (isBetter) {
            finalSeen.set(norm, gUpper);
        }
    });

    return Array.from(finalSeen.values()).sort();
};
