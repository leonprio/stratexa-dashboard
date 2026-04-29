
const normalizeGroupName = (name: string): string => {
    if (!name) return "";

    // 1. Normalización básica
    let clean = name.trim().toUpperCase();

    // 2. Quitamos acentos (NFD)
    clean = clean.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    // 3. LOGIC FROM THE CURRENT CODE (UPDATED v6.2.3)
    clean = clean
        .replace(/\bDIRECTORF\b/g, "DIRECTOR")
        .replace(/\bDIRECION\b/g, "DIRECCION")
        .replace(/\bFRONTERA NORTE\b/g, "NORTE");

    // 🛡️ REGLA v6.2.2: Eliminación RECURSIVA de prefijos (Fix "DIRECTOR DIRECCIÓN")
    const prefixRegex = new RegExp(`^(DIRECTOR|DIRECCION|DIRECCIÓN|GERENTE|GERENCIA|COORDINADOR|COORDINACION|METRO|ZONA|DEPTO|DEPARTAMENTO)(?:\\s+DE)?(?:\\s+|$)`, 'i');

    let prevName = "";
    while (clean !== prevName) {
        prevName = clean;
        clean = clean.replace(prefixRegex, "").trim();
    }

    return clean || "GENERAL";
};

const testCases = [
    "FRONTERA NORTE",
    "DIRECCIÓN FRONTERA NORTE",
    "DIRECCION FRONTERA NORTE",
    "DIRECCIÓN DE FRONTERA NORTE",
    "DIRECTOR DIRECCIÓN FRONTERA NORTE", // The suspected double prefix
    "DIRECCIÓN DE OPERACIONES",
    "OPERACIONES",
    "GERENCIA OPERACIONES"
];

testCases.forEach(tc => {
    console.log(`"${tc}" -> "${normalizeGroupName(tc)}"`);
});
