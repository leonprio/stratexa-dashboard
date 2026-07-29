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
 * 🛡️ FORMATEADOR CENTRAL DE VALORES (v9.4.16)
 * Convierte un valor raw al texto de presentación según la unidad del indicador.
 *
 * Contrato decimal:
 * - null | undefined | NaN | Infinity → "SIN DATOS"
 * - isPercentage && (isDerived || 0 < val ≤ 1) → escalar ×100, aplicar precision
 * - 0 < |val| < 1 → effectivePrecision = max(1, precision); eliminar cero inicial (.8, -.8)
 * - val === 0 → formatear con precision elegida
 * - |val| >= 1 → formatear con precision
 *
 * Si la unidad es '%', multiplica rawValue×100 ANTES de aplicar precisión decimal.
 */
export const formatIndicatorValue = (
    rawValue: number | null | undefined,
    unit?: string,
    precision: number = 2,
    isDerivedFormula: boolean = false
): string => {
    if (rawValue === null || rawValue === undefined) return "SIN DATOS";
    const num = Number(rawValue);
    if (!Number.isFinite(num) || Number.isNaN(num)) return "SIN DATOS";

    const trimmedUnit = (unit || "").trim();
    const isPercentage = trimmedUnit === "%";

    // Porcentajes: escalar ×100 cuando el valor raw es una razón normalizada
    if (isPercentage && (isDerivedFormula || (num > 0 && num <= 1.0))) {
        const scaled = num * 100;
        return `${scaled.toLocaleString('en-US', {
            minimumFractionDigits: precision,
            maximumFractionDigits: precision
        })}%`;
    }

    const absNum = Math.abs(num);

    // Valores finitos no nulos con |val| < 1: mínimo 1 decimal y sin cero inicial
    if (num !== 0 && absNum < 1) {
        const effectivePrecision = Math.max(1, precision);
        // Formateamos el valor absoluto y reponemos el signo manualmente para eliminar el "0" inicial
        const absFormatted = absNum.toLocaleString('en-US', {
            minimumFractionDigits: effectivePrecision,
            maximumFractionDigits: effectivePrecision
        });
        // absFormatted será "0.8" → quitamos el "0" inicial → ".8"
        const withoutLeadingZero = absFormatted.replace(/^0\./, '.');
        const signed = num < 0 ? `-${withoutLeadingZero}` : withoutLeadingZero;
        return isPercentage ? `${signed}%` : (trimmedUnit ? `${signed} ${trimmedUnit}` : signed);
    }

    // Valores |val| >= 1 o val === 0
    const formatted = num.toLocaleString('en-US', {
        minimumFractionDigits: precision,
        maximumFractionDigits: precision
    });

    return isPercentage ? `${formatted}%` : (trimmedUnit ? `${formatted} ${trimmedUnit}` : formatted);
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

/**
 * 🏷️ LIMPIEZA DE ETIQUETA VISIBLE DEL INDICADOR (Part A)
 * Remueve sufijos de categoría entre paréntesis al final del string en las tarjetas principales del tablero
 * (ej. "(SOSTENIBILIDAD)", "(CAPACIDADES)", "(PROCESOS)", "(IMPACTO Y VALOR)").
 * Preserva paréntesis legítimos de unidades o código técnico.
 */
export const getCleanIndicatorName = (name: string | null | undefined): string => {
    if (!name) return "";
    return name.replace(/\s*\((SOSTENIBILIDAD|CAPACIDADES|PROCESOS|IMPACTO\s+Y\s+VALOR|IMPACTO|VALOR|ESTRATEGIA|FINANCIERO|OPERACIONAL|CALIDAD|APRENDIZAJE|RESULTADOS)\)$/i, "").trim();
};
