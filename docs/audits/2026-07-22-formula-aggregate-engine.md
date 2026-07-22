# Auditoría de Motor de Fórmulas e Indicadores Compuestos (v9.4.9)

## 1. Causa del Cumplimiento Incorrecto de 100% y Solución (v9.4.9)

### Causa Raíz Comprobada
- En versiones previas, la función `calculateCompliance` evaluaba `overallPercentage` dividiendo `currentProgress` entre `currentTarget`.
- Para el indicador 4 (`% Compromisos estratégicos cumplidos`), el avance derivado de Junio era `0.5` (50%) y la meta derivada era `0.5` (50%). Al realizar $0.5 / 0.5$, el resultado era `1.0` ($100\%$), creando un **doble porcentaje de cumplimiento**.

### Contrato RESULT_IS_COMPLIANCE
1. **Modo de Salida `RESULT_IS_COMPLIANCE`**: Se configuró por defecto en `types.ts` y `FormulaBuilder.tsx` para indicar que el resultado de la fórmula ya representa el porcentaje de cumplimiento.
2. **Evaluación de Cumplimiento**: En `calculateCompliance` (`utils/compliance.ts`), cuando `indicatorType === 'formula'` y `formulaOutputMode !== 'VALUE_VS_TARGET'`, `overallPercentage` toma directamente el valor derivado ($50\%$), evitando la división redundante.
3. **Modo `VALUE_VS_TARGET`**: Se mantiene reservado para fórmulas cuyo resultado es un valor absoluto (ej. número de entregables) que requiera compararse contra una meta.

---

## 2. Bloqueo Real de Captura y Read-Only Universal
- **DataEditor ([DataEditor.tsx](file:///C:/APP-TABLERO-WORKTREES/fix-formula-engine-composite-indicators-v9.4.9/components/DataEditor.tsx))**:
  - Para indicadores `formula` o `compound`, todos los setters (`setGoalAt`, `setProgressAt`, `setNoteAt`, `handleSave`) retornan inmediatamente sin alterar el estado.
  - Los inputs de Meta Mensual, Avance Real y Textarea de Análisis presentan los atributos `disabled` y clase CSS `disabled:cursor-not-allowed`.
  - El botón **GUARDAR CAMBIOS** se oculta por completo cuando el indicador es derivado, reemplazando las opciones por **Cerrar**.
  - La insignia de modo se muestra de forma permanente como `MODO: AUTOMÁTICO (DERIVADO)`.

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
