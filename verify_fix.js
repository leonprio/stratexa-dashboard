const normalizeGroupName = (s) => {
    let name = (s || "")
        .toString()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // Quitar acentos
        .replace(/\s+/g, ' ')
        .trim()
        .toUpperCase();

    // 🛡️ REGLA v6.2.1: Agresividad Máxima Anti-Duplicados
    name = name
        .replace(/\bDIRECTORF\b/g, "DIRECTOR") // Corregir typo común
        .replace(/\bDIRECION\b/g, "DIRECCION"); // Corregir typo común

    // 🛡️ REGLA v6.2.2: Eliminación RECURSIVA de prefijos (Fix "DIRECTOR DIRECCIÓN")
    const prefixRegex = new RegExp(`^(DIRECTOR|DIRECCION|DIRECCIÓN|GERENTE|GERENCIA|COORDINADOR|COORDINACION|METRO|ZONA|DEPTO|DEPARTAMENTO)(?:\\s+DE)?(?:\\s+|$)`, 'i');

    let prevName = "";
    while (name !== prevName) {
        prevName = name;
        name = name.replace(prefixRegex, "").trim();
    }

    return name || "GENERAL";
};

const testCases = [
    { input: "Director Frontera Norte", expected: "FRONTERA NORTE" },
    { input: "Dirección Frontera Norte", expected: "FRONTERA NORTE" },
    { input: "Director Dirección Frontera Norte", expected: "FRONTERA NORTE" },
    { input: "GERENTE DE ZONA METRO CENTRO", expected: "CENTRO" }, // Wait, METRO is also a prefix?
    { input: "Coordinación de Zona Norte", expected: "NORTE" },
    { input: "Director Dirección Operaciones", expected: "OPERACIONES" },
    { input: "Dirección Operaciones", expected: "OPERACIONES" },
];

let failed = false;
testCases.forEach(({ input, expected }) => {
    const result = normalizeGroupName(input);
    if (result !== expected) {
        console.error(`❌ FAILED: "${input}" -> Got "${result}", expected "${expected}"`);
        failed = true;
    } else {
        console.log(`✅ PASS: "${input}" -> "${result}"`);
    }
});

if (failed) process.exit(1);
console.log("All tests passed!");
