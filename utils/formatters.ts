/**
 * Utility for consistent group name formatting across the application.
 * Ensures names are trimmed and uppercase for reliable comparison and database storage.
 */
export const normalizeGroupName = (s: string | undefined | null): string => {
    // 🛡️ REGLA v9.1.0-PRO-FINAL-SHIELDED: Corregir nombres antes de limpiar jerarquías
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

    // 🛡️ REGLA v9.1.0-PRO-FINAL-SHIELDED: Eliminación RECURSIVA de prefijos (Fix "DIRECTOR DIRECCIÓN")
    // El orden de las preposiciones es CRÍTICO: DE LA/DE LOS antes de DE para evitar matches parciales.
    const prefixRegex = new RegExp(`^(EL\\s+|LA\\s+|LOS\\s+|LAS\\s+)?(DIRECTOR|DIRECCION|GERENTE|GERENCIA|COORDINADOR|COORDINACION|DEPTO|DEPARTAMENTO)(\\s+(DE\\s+LA|DE\\s+LOS|DE\\s+LAS|DEL|DE))?(?:\\s+|$)`, 'i');

    let prevName = "";
    let iterations = 0;
    while (name !== prevName && iterations < 10) {
        prevName = name;
        const nextName = name.replace(prefixRegex, "").trim();
        // 🛡️ REGLA v9.1.0-PRO-FINAL-SHIELDED: Si al quitar el prefijo el nombre queda vacío (ej. "DIRECCION"), 
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

/**
 * Formats a number with comma as thousand separator.
 * Displays decimals only if they are present in the original number, up to specified precision.
 */
export const formatNumberWithCommas = (value: number | string | null | undefined, precision: number = 2): string => {
    if (value === null || value === undefined || value === "") return "";
    
    // Convert to number if it's a string, removing existing commas
    const num = typeof value === 'string' ? parseFloat(value.replace(/,/g, '')) : value;
    
    if (isNaN(num)) return value.toString();

    // Use en-US for comma thousands (1,250.50)
    // 🛡️ REGLA v10.9.6-UX: Respetar precisión seleccionada por el usuario (Default: 2)
    return num.toLocaleString('en-US', {
        minimumFractionDigits: precision,
        maximumFractionDigits: precision
    });
};

/**
 * Parses a string value with thousands separators back to a number.
 */
export const parseFormattedNumber = (value: string): number | null => {
    if (!value) return null;
    const clean = value.replace(/,/g, '');
    const num = parseFloat(clean);
    return isNaN(num) ? null : num;
};
