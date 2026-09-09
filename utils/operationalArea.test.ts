import { resolveOperationalArea } from "./operationalArea";

const dashboard = (clientId: string, title: string, area?: string) => ({ clientId, title, area });

test.each(["Sostenibilidad", "Capacidades", "Procesos", "Impacto y Valor"])(
  "resolves legacy LVP dashboard %s as its operational area",
  (title) => expect(resolveOperationalArea(dashboard("LVP", title))).toBe(title),
);

test("explicit area wins over legacy compatibility", () => {
  expect(resolveOperationalArea(dashboard("LVP", "Sostenibilidad", "COMERCIAL"))).toBe("COMERCIAL");
});

test("separate perspective-like title does not become an area for other clients", () => {
  expect(resolveOperationalArea(dashboard("FONDA CARMELA", "Sostenibilidad"))).toBeUndefined();
});

test("area-only clients work without strategy configuration", () => {
  expect(resolveOperationalArea(dashboard("CLIENTE", "Operaciones", "OPERACIONES"))).toBe("OPERACIONES");
});
