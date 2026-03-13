/**
 * Utility for consistent group name formatting across the application.
 * Ensures names are trimmed and uppercase for reliable comparison and database storage.
 */
export const normalizeGroupName = (s: string | undefined | null): string => {
    // 🛡️ REGLA v6.2.4-Fix3: Corregir nombres antes de limpiar jerarquías
    // El orden es CRÍTICO: primero arreglamos el nombre base, luego quitamos cargos.
    let name = (s || "")
        .toString()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // Quitar acentos
        .replace(/[\u200B-\u200D\uFEFF]/g, "") // Zero-width spaces
        .replace(/\s+/g, ' ')
        .trim()
        .toUpperCase()
        .replace(/\b(FRONTERA\s+NORTE|FRONTERA\s+NO\.?|NORTE)(?=\s|$)/g, "FRONTERA NORTE")
        .replace(/\bDIRECTORF\b/g, "DIRECTOR")
        .replace(/\bDIRECION\b/g, "DIRECCION");

    // 🛡️ REGLA v6.2.2: Eliminación RECURSIVA de prefijos (Fix "DIRECTOR DIRECCIÓN")
    // El orden de las preposiciones es CRÍTICO: DE LA/DE LOS antes de DE para evitar matches parciales.
    const prefixRegex = new RegExp(`^(EL\\s+|LA\\s+|LOS\\s+|LAS\\s+)?(DIRECTOR|DIRECCION|GERENTE|GERENCIA|COORDINADOR|COORDINACION|DEPTO|DEPARTAMENTO)(\\s+(DE\\s+LA|DE\\s+LOS|DE\\s+LAS|DEL|DE))?(?:\\s+|$)`, 'i');

    let prevName = "";
    let iterations = 0;
    while (name !== prevName && iterations < 10) {
        prevName = name;
        const nextName = name.replace(prefixRegex, "").trim();
        // 🛡️ REGLA v6.2.4-Fix6: Si al quitar el prefijo el nombre queda vacío (ej. "DIRECCION"), 
        // lo mantenemos si es la última palabra para evitar colapsar todo a GENERAL.
        if (nextName === "" && name !== "") {
            break;
        }
        name = nextName;
        iterations = iterations + 1;
    }

    return name || "GENERAL";
};

/**
 * Checks if two group names are effectively the same after normalization.
 */
export const isSameGroup = (groupA: string | undefined | null, groupB: string | undefined | null): boolean => {
    return normalizeGroupName(groupA) === normalizeGroupName(groupB);
};
