import { normalizeGroupName } from "./formatters";

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
