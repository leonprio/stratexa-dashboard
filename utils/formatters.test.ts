import { normalizeGroupName, formatIndicatorValue, formatNumberWithCommas } from "./formatters";

describe("normalizeGroupName", () => {
    test("should handle basic normalization (accents and case)", () => {
        expect(normalizeGroupName("Dirección")).toBe("DIRECCION");
        expect(normalizeGroupName("  gestión  ")).toBe("GESTION");
    });

    test("should handle 'Frontera Norte' edge cases (v6.2.4-Fix6)", () => {
        expect(normalizeGroupName("FRONTERA NO.")).toBe("FRONTERA NORTE");
        expect(normalizeGroupName("FRONTERA NO")).toBe("FRONTERA NORTE");
        expect(normalizeGroupName("Frontera No")).toBe("FRONTERA NORTE");
        expect(normalizeGroupName("NORTE")).toBe("FRONTERA NORTE");
    });

    test("should recursively remove hierarchy prefixes (v6.2.2)", () => {
        expect(normalizeGroupName("DIRECTOR DIRECCION OPERACIONES")).toBe("OPERACIONES");
        expect(normalizeGroupName("GERENTE DE OPERACIONES")).toBe("OPERACIONES");
        expect(normalizeGroupName("COORDINADOR DE LA ZONA")).toBe("ZONA");
        expect(normalizeGroupName("DIRECTOR FRONTERA NO.")).toBe("FRONTERA NORTE");
    });

    test("should handle 'DE LA', 'DEL', 'DE LOS' in prefixes", () => {
        expect(normalizeGroupName("DIRECCION DE LA FRONTERA")).toBe("FRONTERA");
        expect(normalizeGroupName("GERENCIA DEL VALLE")).toBe("VALLE");
        expect(normalizeGroupName("DEPTO DE LOS SERVICIOS")).toBe("SERVICIOS");
    });

    test("should fallback to 'GENERAL' for empty strings", () => {
        expect(normalizeGroupName("")).toBe("GENERAL");
        expect(normalizeGroupName(null)).toBe("GENERAL");
        expect(normalizeGroupName(undefined)).toBe("GENERAL");
    });

    test("should handle zero-width characters and extra spaces", () => {
        // Zero-width space \u200B
        expect(normalizeGroupName("PROYECTOS\u200B")).toBe("PROYECTOS");
        expect(normalizeGroupName("  SISTEMAS   ")).toBe("SISTEMAS");
    });
});

// ============================================================
// formatIndicatorValue — Contrato Decimal v9.4.16
// ============================================================
describe("formatIndicatorValue — contrato decimal v9.4.16", () => {

    // --- Entradas inválidas ---
    describe("entradas inválidas → SIN DATOS", () => {
        test("null → SIN DATOS", () => {
            expect(formatIndicatorValue(null)).toBe("SIN DATOS");
        });
        test("undefined → SIN DATOS", () => {
            expect(formatIndicatorValue(undefined)).toBe("SIN DATOS");
        });
        test("NaN → SIN DATOS", () => {
            expect(formatIndicatorValue(NaN)).toBe("SIN DATOS");
        });
        test("Infinity → SIN DATOS", () => {
            expect(formatIndicatorValue(Infinity)).toBe("SIN DATOS");
        });
        test("-Infinity → SIN DATOS", () => {
            expect(formatIndicatorValue(-Infinity)).toBe("SIN DATOS");
        });
    });

    // --- Valores enteros/decimales sin unidad ---
    describe("valores enteros — precisión 0, 1 y 2", () => {
        test("precision=0, input=6 → '6'", () => {
            expect(formatIndicatorValue(6, "", 0)).toBe("6");
        });
        test("precision=1, input=6 → '6.0'", () => {
            expect(formatIndicatorValue(6, "", 1)).toBe("6.0");
        });
        test("precision=2, input=6 → '6.00'", () => {
            expect(formatIndicatorValue(6, "", 2)).toBe("6.00");
        });
    });

    // --- CONTRATO v9.4.22-NUMERIC-CLARITY: precision=0 siempre redondea a entero y previene -0 ---
    describe("valores con precision=0 — redondeo a entero y prevención de -0 (v9.4.22)", () => {
        test("precision=0, input=-0.4 → '0'", () => {
            expect(formatIndicatorValue(-0.4, "", 0)).toBe("0");
            expect(formatNumberWithCommas(-0.4, 0)).toBe("0");
        });
        test("precision=0, input=-0.49 → '0'", () => {
            expect(formatIndicatorValue(-0.49, "", 0)).toBe("0");
            expect(formatNumberWithCommas(-0.49, 0)).toBe("0");
        });
        test("precision=0, input=-0.5 → '-1' (según Math.round) y jamás '-0'", () => {
            expect(formatIndicatorValue(-0.5, "", 0)).not.toBe("-0");
            expect(formatNumberWithCommas(-0.5, 0)).not.toBe("-0");
        });
        test("precision=0, input=0.8 → '1'", () => {
            expect(formatIndicatorValue(0.8, "", 0)).toBe("1");
        });
        test("precision=0, input=0.4 → '0'", () => {
            expect(formatIndicatorValue(0.4, "", 0)).toBe("0");
        });
        test("precision=0, input=-0.8 → '-1'", () => {
            expect(formatIndicatorValue(-0.8, "", 0)).toBe("-1");
        });
        test("precision=0, input=82.6 → '83'", () => {
            expect(formatIndicatorValue(82.6, "", 0)).toBe("83");
        });
        test("precision=0, input=99050 → '99,050'", () => {
            expect(formatIndicatorValue(99050, "", 0)).toBe("99,050");
        });
        test("precision=0, input=0 → '0'", () => {
            expect(formatIndicatorValue(0, "", 0)).toBe("0");
        });
    });

    // --- RESTAURACIÓN DE PRECISIÓN POR DEFECTO HISTÓRICA (DEFAULT = 2) ---
    describe("restauración de precisión por defecto histórica (precision predeterminada = 2)", () => {
        test("formatNumberWithCommas(1234.567) sin precision predetermina 2 decimales", () => {
            expect(formatNumberWithCommas(1234.567)).toBe("1,234.57");
            expect(formatNumberWithCommas(100)).toBe("100.00");
        });
        test("formatIndicatorValue(1234.567) sin precision predetermina 2 decimales", () => {
            expect(formatIndicatorValue(1234.567)).toBe("1,234.57");
            expect(formatIndicatorValue(100)).toBe("100.00");
        });
    });

    // --- CONTRATO DE PRECISIÓN DECIMAL EXPLÍCITA: precision > 0 ---
    describe("valores con precision > 0 — preserva precisión explícita solcitada", () => {
        test("precision=1, input=0.8 → '.8'", () => {
            expect(formatIndicatorValue(0.8, "", 1)).toBe(".8");
        });
        test("precision=2, input=0.8 → '.80'", () => {
            expect(formatIndicatorValue(0.8, "", 2)).toBe(".80");
        });
        test("precision=1, input=-0.8 → '-.8'", () => {
            expect(formatIndicatorValue(-0.8, "", 1)).toBe("-.8");
        });
        test("precision=2, input=-0.8 → '-.80'", () => {
            expect(formatIndicatorValue(-0.8, "", 2)).toBe("-.80");
        });
        test("precision=2, input=0.5 → '.50'", () => {
            expect(formatIndicatorValue(0.5, "", 2)).toBe(".50");
        });
    });

    // --- Cero exacto ---
    describe("cero exacto — sigue la precisión elegida", () => {
        test("precision=0, input=0 → '0'", () => {
            expect(formatIndicatorValue(0, "", 0)).toBe("0");
        });
        test("precision=1, input=0 → '0.0'", () => {
            expect(formatIndicatorValue(0, "", 1)).toBe("0.0");
        });
        test("precision=2, input=0 → '0.00'", () => {
            expect(formatIndicatorValue(0, "", 2)).toBe("0.00");
        });
    });

    // --- Porcentajes ---
    describe("porcentajes — sufijo % conservado", () => {
        test("precision=0, input=50, unit='%' → '50%'", () => {
            expect(formatIndicatorValue(50, "%", 0)).toBe("50%");
        });
        test("precision=1, input=50, unit='%' → '50.0%'", () => {
            expect(formatIndicatorValue(50, "%", 1)).toBe("50.0%");
        });
        test("precision=2, input=50, unit='%' → '50.00%'", () => {
            expect(formatIndicatorValue(50, "%", 2)).toBe("50.00%");
        });
        test("precision=0, razón normalizada: input=0.5, unit='%' → '50%'", () => {
            expect(formatIndicatorValue(0.5, "%", 0)).toBe("50%");
        });
        test("precision=1, razón normalizada: input=0.5, unit='%' → '50.0%'", () => {
            expect(formatIndicatorValue(0.5, "%", 1)).toBe("50.0%");
        });
        test("precision=2, razón normalizada: input=0.5, unit='%' → '50.00%'", () => {
            expect(formatIndicatorValue(0.5, "%", 2)).toBe("50.00%");
        });
    });

    // --- Unidades personalizadas ---
    describe("unidades personalizadas — sufijo conservado", () => {
        test("precision=2, input=6, unit='kg' → '6.00 kg'", () => {
            expect(formatIndicatorValue(6, "kg", 2)).toBe("6.00 kg");
        });
        test("precision=1, input=0.8, unit='km' → '.8 km'", () => {
            expect(formatIndicatorValue(0.8, "km", 1)).toBe(".8 km");
        });
    });

    // --- Prueba de variación de precision ---
    describe("variación de precision → resultado distinto en el valor principal", () => {
        test("input=6 cambia de '6' a '6.0' a '6.00' según precision", () => {
            expect(formatIndicatorValue(6, "", 0)).toBe("6");
            expect(formatIndicatorValue(6, "", 1)).toBe("6.0");
            expect(formatIndicatorValue(6, "", 2)).toBe("6.00");
        });
        test("input=0.8 cambia de '1' a '.8' a '.80' según precision", () => {
            expect(formatIndicatorValue(0.8, "", 0)).toBe("1");
            expect(formatIndicatorValue(0.8, "", 1)).toBe(".8");
            expect(formatIndicatorValue(0.8, "", 2)).toBe(".80");
        });
    });

    // --- Limpieza de etiquetas visuales del tablero (Part A) ---
    describe("getCleanIndicatorName — remueve sufijos de categoría finales", () => {
        test("remueve (SOSTENIBILIDAD), (CAPACIDADES), (PROCESOS), (IMPACTO Y VALOR)", () => {
            const { getCleanIndicatorName } = require("./formatters");
            expect(getCleanIndicatorName("Alianzas estratégicas (SOSTENIBILIDAD)")).toBe("Alianzas estratégicas");
            expect(getCleanIndicatorName("Capacitación técnica (CAPACIDADES)")).toBe("Capacitación técnica");
            expect(getCleanIndicatorName("Eficiencia en atención (PROCESOS)")).toBe("Eficiencia en atención");
            expect(getCleanIndicatorName("Retorno social (IMPACTO Y VALOR)")).toBe("Retorno social");
        });

        test("preserva paréntesis legítimos de unidades o contexto interno", () => {
            const { getCleanIndicatorName } = require("./formatters");
            expect(getCleanIndicatorName("Monto gastado (USD)")).toBe("Monto gastado (USD)");
            expect(getCleanIndicatorName("% Retención (%)")).toBe("% Retención (%)");
            expect(getCleanIndicatorName("Seguimiento PAI (2024)")).toBe("Seguimiento PAI (2024)");
        });

        test("remueve sólo el área contextual del título visible", () => {
            const { getCleanIndicatorName } = require("./formatters");
            expect(getCleanIndicatorName("VENTAS (COMERCIAL Y VENTAS)", "COMERCIAL Y VENTAS")).toBe("VENTAS");
            expect(getCleanIndicatorName("MARGEN DE CONTRIBUCIÓN NETO (COMERCIAL Y VENTAS)", "COMERCIAL Y VENTAS")).toBe("MARGEN DE CONTRIBUCIÓN NETO");
            expect(getCleanIndicatorName("CUMPLIMIENTO DE ENTREGAS (LOGÍSTICA Y TRANSPORTE)", "LOGÍSTICA Y TRANSPORTE")).toBe("CUMPLIMIENTO DE ENTREGAS");
        expect(getCleanIndicatorName("MARGEN (USD)", "COMERCIAL Y VENTAS")).toBe("MARGEN (USD)");
        expect(getCleanIndicatorName("VENTAS (COMERCIAL Y VENTAS)")).toBe("VENTAS");
        expect(getCleanIndicatorName("MARGEN DE CONTRIBUCIÓN NETO (COMERCIAL Y VENTAS)")).toBe("MARGEN DE CONTRIBUCIÓN NETO");
        expect(getCleanIndicatorName("CUMPLIMIENTO DE ENTREGAS (LOGÍSTICA Y TRANSPORTE)")).toBe("CUMPLIMIENTO DE ENTREGAS");
        });
    });
});
