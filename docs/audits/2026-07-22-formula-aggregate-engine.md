# Auditoría de Motor de Fórmulas e Indicadores Compuestos (v9.4.6)

## 1. Causa Raíz Comprobada y Solución de ReferenceError

### Causa del ReferenceError: gap is not defined
- **Ubicación**: [components/CurrentPeriodFocus.tsx](file:///C:/APP-TABLERO-WORKTREES/fix-formula-engine-composite-indicators-v9.4.6/components/CurrentPeriodFocus.tsx).
- **Fallo**: En refactorizaciones previas de deshabilitación de inputs, se evaluaba `isPositiveGap` haciendo referencia a la variable `gap` antes de que `const gap` fuera instanciada en la función del componente.
- **Solución Aplicada**: Se declaró explícitamente `const gap = (parseFormattedNumber(localActual) || 0) - (parseFormattedNumber(localGoal) || 0);` antes de su dereferenciación en `isPositiveGap`, resolviendo permanentemente la excepción en todos los indicadores (SIMPLE, FÓRMULA y AGREGADO).

---

## 2. Definición Semántica de Motores

- **SIMPLE** (`indicatorType === 'simple'`): Indicador directo cuyos valores mensuales y semanales son capturados manualmente o mediante listas de actividades/checklist.
- **AGREGADO** (`indicatorType === 'compound'`): Consolidación de indicadores idénticos/equivalentes provenientes de tableros hijos, áreas o regiones (`componentIds`). No realiza operaciones arbitrarias entre indicadores de distinta naturaleza.
- **FÓRMULA** (`indicatorType === 'formula'`): Operación matemática explícita entre indicadores fuente específicos del mismo tablero (`{id:A} / {id:B}` o nombres naturales), donde el avance derivado resulta de aplicar la expresión mes a mes a los avances fuente.

---

## 3. Contrato Matemático v9.4.5

1. **Avance Derivado**: $\text{Avance}_{\text{derivado}} = \text{fórmula}(\text{avances}_{\text{fuente\_i}})$.
2. **Meta Derivada**: 
   - Si existe una meta explícita configurada para el indicador derivado (ej. 80%), se respeta dicha meta.
   - Si no hay meta explícita, se calcula aplicando la misma fórmula a las metas fuente.
3. **Cumplimiento Derivado**: $\text{Cumplimiento} = \frac{\text{Avance}_{\text{derivado}}}{\text{Meta}_{\text{derivada}}} \times 100$.
4. **Manejo de Cero / SIN_DATOS**: Si el denominador $B = 0$ o faltan datos fuente, el motor devuelve `SIN_DATOS` / `Neutral` (0%), evitando falsos 100%.

---

## 4. Constructor Visual Guiado (UX)

Se implementó el componente `components/FormulaBuilder.tsx` integrado en `components/IndicatorManager.tsx`:
- **Biblioteca Lateral de Indicadores**: Muestra los KPIs disponibles con ID y valor actual para arrastrar (**Drag & Drop**).
- **Slots Operando A y Operando B**: Zonas receptoras para el numerador/denominador o primer/segundo operando.
- **Selector de Operador**: $(\div, \times, +, -)$.
- **Fallback por Selección**: Dropdowns de selección estándar compatibles sin necesidad de arrastrar.
- **Vista Previa en Tiempo Real**: Visualización inmediata del avance derivado, meta derivada, porcentaje de cumplimiento y expresión persistida por ID.
- **Modo Avanzado (Texto)**: Permite edición textual manual bajo botón toggle explícito.

---

## 5. Reglas de Edición y Bloqueo Manual (Read-Only)

- En `components/CurrentPeriodFocus.tsx`, los indicadores con `indicatorType === 'formula'` o `indicatorType === 'compound'` deshabilitan automáticamente los campos de captura manual `Real` y `Meta`.
- Se muestra el distintivo visual `⚡ CALCULADO AUTOMÁTICAMENTE`.

---

## 6. Tratamiento de Evidencias

- Para razones compuestas o fórmulas, no se duplican archivos ni registros de evidencia.
- Las evidencias se consultan del indicador fuente (numerador / Operando A) por referencia determinista sin generar almacenamiento redundante.

---

## 7. Validación y Cobertura de Pruebas

- **Test Suite**: 15 suites pasadas, 66 pruebas pasadas.
- **Auditoría de Fórmulas**: `utils/formula_audit.test.ts` verifica el caso 3/6 ($0.5 = 50\%$) y la separación de avance derivado, meta y cumplimiento.
- **Build & Predeploy**: `npm run build` y `npm run predeploy` ejecutados limpiamente.
