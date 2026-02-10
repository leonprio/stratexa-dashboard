/**
 * Utility for consistent group name formatting across the application.
 * Ensures names are trimmed and uppercase for reliable comparison and database storage.
 */
export const normalizeGroupName = (s: string | undefined | null): string => {
    return (s || "")
        .toString()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // Quitar acentos
        // .replace(/^(DIRECCI[OÓ]N|DIRECTOR|METRO|GRUPO|ZONA|AREA|DEPTO|DEPARTAMENTO)(\s+DE)?\s+/i, "") // 🛡️ v5.1.5: Preservar jerarquía
        .replace(/\s+/g, ' ')
        .trim()
        .toUpperCase();
};

/**
 * Checks if two group names are effectively the same after normalization.
 */
export const isSameGroup = (groupA: string | undefined | null, groupB: string | undefined | null): boolean => {
    return normalizeGroupName(groupA) === normalizeGroupName(groupB);
};
