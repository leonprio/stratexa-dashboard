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

    if (precision === 0) {
        const rounded = Math.round(num);
        const safeRounded = Object.is(rounded, -0) || rounded === 0 ? 0 : rounded;
        return safeRounded.toLocaleString('en-US');
    }

    // Use en-US for comma thousands (1,250.50)
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
 * - precision === 0 → redondeo a entero con Math.round() y separadores de miles (normalizando -0 a 0)
 * - isPercentage && (isDerived || 0 < val ≤ 1) → escalar ×100
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
        if (precision === 0) {
            const rounded = Math.round(scaled);
            const safeRounded = Object.is(rounded, -0) || rounded === 0 ? 0 : rounded;
            return `${safeRounded.toLocaleString('en-US')}%`;
        }
        return `${scaled.toLocaleString('en-US', {
            minimumFractionDigits: precision,
            maximumFractionDigits: precision
        })}%`;
    }

    // 🛡️ REGLA v9.4.22-NUMERIC-CLARITY:
    // Si precision === 0, SIEMPRE redondear a entero (incluyendo |val| < 1: 0.8 → 1, 0.4 → 0, -0.8 → -1)
    if (precision === 0) {
        const rounded = Math.round(num);
        const safeRounded = Object.is(rounded, -0) || rounded === 0 ? 0 : rounded;
        const formatted = safeRounded.toLocaleString('en-US');
        return isPercentage ? `${formatted}%` : (trimmedUnit ? `${formatted} ${trimmedUnit}` : formatted);
    }

    const absNum = Math.abs(num);

    // Valores finitos no nulos con |val| < 1 (SOLO cuando precision > 0)
    if (num !== 0 && absNum < 1) {
        const effectivePrecision = Math.max(1, precision);
        const absFormatted = absNum.toLocaleString('en-US', {
            minimumFractionDigits: effectivePrecision,
            maximumFractionDigits: effectivePrecision
        });
        const withoutLeadingZero = absFormatted.replace(/^0\./, '.');
        const signed = num < 0 ? `-${withoutLeadingZero}` : withoutLeadingZero;
        return isPercentage ? `${signed}%` : (trimmedUnit ? `${signed} ${trimmedUnit}` : signed);
    }

    // Valores |val| >= 1 o val === 0 (cuando precision > 0)
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
export const getCleanIndicatorName = (name: string | null | undefined, area?: string | null): string => {
    if (!name) return "";
    const normalizedArea = String(area || '').trim();
    const areaSuffix = normalizedArea
        ? new RegExp(`\\s*\\(${normalizedArea.replace(/[.*+?^${}()|[\\]\\]/g, '\\\\$&')}\\)$`, 'i')
        : null;
    const withoutArea = areaSuffix ? name.replace(areaSuffix, '') : name;
    const withoutCategory = withoutArea.replace(/\s*\((SOSTENIBILIDAD|CAPACIDADES|PROCESOS|IMPACTO\s+Y\s+VALOR|IMPACTO|VALOR|ESTRATEGIA|FINANCIERO|OPERACIONAL|CALIDAD|APRENDIZAJE|RESULTADOS)\)$/i, "").trim();
    const trailing = withoutCategory.match(/\s*\(([^()]*)\)\s*$/);
    if (!trailing) return withoutCategory;
    const label = trailing[1].trim();
    const isTechnicalSuffix = /^(?:\d{4}|%|USD|MXN|EUR|GBP|JPY)$/i.test(label);
    return isTechnicalSuffix ? withoutCategory : withoutCategory.slice(0, trailing.index).trim();
};

/**
 * 🛡️ CONTRATO DE IDENTIDAD TÉCNICA DE TENANT (v9.5.2)
 * Genera un clientId técnico seguro cumpliendo con ^[a-zA-Z0-9_-]+$ (máx 64 caracteres).
 * Elimina diacríticos/acentos, reemplaza espacios por guiones bajos y remueve caracteres especiales.
 * Soporta resolución determinista de colisiones comparando con IDs existentes.
 */
export const generateSafeClientId = (displayName: string, existingClientIds: string[] = []): string => {
    if (!displayName || !displayName.trim()) return "CLIENT_NEW";

    const normalized = displayName
        .trim()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // Remueve acentos / diacríticos
        .replace(/[\u200B-\u200D\uFEFF]/g, "") // Zero-width spaces
        .toUpperCase()
        .replace(/\s+/g, "_") // Espacios a guión bajo
        .replace(/[^A-Z0-9_-]/g, "") // Solo A-Z, 0-9, _, -
        .replace(/_+/g, "_") // Colapsar guiones bajos repetidos
        .replace(/^_+|_+$/g, ""); // Recortar guiones bajos en extremos

    let baseId = normalized || "CLIENT";
    if (baseId.length > 50) {
        baseId = baseId.substring(0, 50).replace(/_+$/, "");
    }

    const existingUpperSet = new Set(existingClientIds.map(id => id.trim().toUpperCase()));

    if (!existingUpperSet.has(baseId)) {
        return baseId;
    }

    // Resolución determinista de colisiones
    let counter = 2;
    while (existingUpperSet.has(`${baseId}_${counter}`)) {
        counter++;
    }

    return `${baseId}_${counter}`;
};
