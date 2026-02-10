/**
 * Utility for consistent group name formatting across the application.
 * Ensures names are trimmed and uppercase for reliable comparison and database storage.
 */
export const normalizeGroupName = (s: string | undefined | null): string => {
    let name = (s || "")
        .toString()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // Quitar acentos
        .replace(/\s+/g, ' ')
        .trim()
        .toUpperCase();

    // 🛡️ REGLA v5.9.9: Limpieza de prefijos jerárquicos para de-duplicar
    // Esto hace que "DIRECTOR SUR" y "DIRECCIÓN SUR" colapsen en "SUR"
    // También corrige typos como "DIRECTORF"
    name = name
        .replace(/^(DIRECCION|DIRECTORF?|METRO|GRUPO|ZONA|AREA|DEPTO|DEPARTAMENTO)(\s+DE)?\s+/i, "")
        .trim();

    return name || "GENERAL";
};

/**
 * Checks if two group names are effectively the same after normalization.
 */
export const isSameGroup = (groupA: string | undefined | null, groupB: string | undefined | null): boolean => {
    return normalizeGroupName(groupA) === normalizeGroupName(groupB);
};
