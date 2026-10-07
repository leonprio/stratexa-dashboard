# Descubrimiento Jest de sondas históricas en `tmp`

Fecha: 2026-10-05

Rama: `main`
HEAD de partida: `41d25788fc55925caf14e7d2e15113e2c39daa8d`

## Archivos encontrados y clasificación

| Archivo | Tests | Clasificación | Resultado diagnóstico aislado |
|---|---:|---|---|
| `tmp/preclose.app-access.test.tsx` | 2 | Probe histórico de auditoría. El caso legacy es válido, pero ya está cubierto por `App.canonicalAccess.test.tsx`; el caso canónico conserva la expectativa H01 antigua de ocultar un tablero autorizado. | 1 pasa, 1 falla |
| `tmp/preclose.probes.test.tsx` | 12 | Paquete de probes H01–H06 y matriz negativa de ActionPlan; es evidencia temporal, no una suite vigente. Incluye expectativas H01 de implementación ya retirada, H02/H03 previas a sus fixes, H04 que etiqueta `COMPLETE`/`CLOSE_UNMET` como `REABIERTO`, y H05 que exige perder `itemId`. Sus casos ActionPlan se cubren en suites actuales. | 6 pasan, 6 fallan |

Los **7 fallos de las 14 pruebas** son expectativas antiguas: tablero canónico indebidamente oculto; expectativas negativas de código/CTA/exportación de H01–H03; etiquetas H04 incorrectas; y pérdida de identidad KPI H05. Los casos que pasan no validan las regresiones corregidas: incluyen comportamiento legacy, expectativas viejas que siguen coincidiendo accidentalmente (el probe H06 observa el cambio de texto del botón mientras persiste) y la matriz negativa ActionPlan cubierta formalmente por suites vigentes.

Otros artefactos de `tmp`, como `final-audit-bulk.probe.tsx`, scripts `.cjs`, logs y JSON, no son descubiertos por el patrón por defecto. El probe `.probe.tsx` solo se ejecutó explícitamente en su microciclo. Se mantienen en el directorio; no se borró ni editó evidencia.

## Causa

`jest.config.cjs` no definía `roots`, `testMatch`, `testRegex` ni `testPathIgnorePatterns`. Jest usaba el `rootDir` predeterminado del repositorio (`C:\APP-TABLERO-LOCAL\stratexa-dashboard`) y `testMatch` predeterminado:

```text
**/__tests__/**/*.[jt]s?(x)
**/?(*.)+(spec|test).[jt]s?(x)
```

Los dos probes terminan en `.test.tsx`, así que satisfacen directamente el segundo patrón. `.gitignore:33` ignora el directorio `tmp` para Git, pero Git ignore no limita el recorrido de Jest. Los ficheros siguen presentes porque son evidencia de auditoría preservada y el alcance anterior prohibía limpiar `tmp`.

Antes del ajuste, `npx jest --listTests` enumeró **113 suites**: 110 suites mantenidas, los dos probes de `tmp` y `firestore.rules.test.ts`. `npm test` ya excluía Rules mediante CLI, pero no `tmp`; el conjunto normal encontraba 112 suites y las 14 aserciones obsoletas contaminaban el resultado.

## Cambio mínimo

- `jest.config.cjs`: agrega `testPathIgnorePatterns` limitado a `<rootDir>/tmp/` y conserva explícitamente el ignore predeterminado de `node_modules`.
- `package.json`: el comando estándar conserva la exclusión previa de Firestore Rules y añade un patrón portable de directorio para `tmp`; vuelve a declarar `node_modules/` porque Jest CLI reemplaza el array de ignores configurado al recibir `--testPathIgnorePatterns`.
- No se cambiaron los probes, pruebas vigentes ni código de producción.

La lista posterior a `npm test -- --listTests` contiene **110 suites**, cero rutas de `tmp`, cero Rules y mantiene, entre otras, `App.canonicalAccess.test.tsx`, `components/DataEditor.test.tsx`, `components/ActivityManager.test.tsx` y `components/RelatedActionPlans.delete.test.tsx`.

## Validación

- Suite estándar `npm test -- --runInBand`: **110 suites, 924 pruebas PASS**.
- TypeScript `npx tsc --noEmit --pretty false`: **66 baseline / 66 actual / 0 nuevos / 0 removidos** (comparación por archivo, código, mensaje y multiplicidad).
- `npm run build`: **PASS**, 2048 módulos; permanecen avisos existentes de chunks grandes e imports Firebase estáticos/dinámicos.
- `git diff --check`: **PASS**; solo las advertencias conocidas de conversión LF/CRLF.
- Integridad: los dos probes siguen en `tmp`; los otros 467 archivos del inventario de preservación permanecen iguales (cinco rutas previas deliberadamente editadas: tres por H08 y las dos configuraciones Jest/paquete).

## Certificación

| Comprobación | Estado |
|---|---|
| `TMP_PROBES_EXCLUDED_FROM_STANDARD_JEST` | PASS |
| `LEGITIMATE_TESTS_PRESERVED` | PASS |
| `ACTIONPLAN_AND_H01_H08_PRESERVED` | PASS |

**Estado: `TMP_JEST_DISCOVERY_CORREGIDO_VALIDADO`.**

**NO COMMIT · NO PUSH · NO DEPLOY · NO RELEASE.**
