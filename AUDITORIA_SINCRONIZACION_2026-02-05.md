# 🚨 AUDITORÍA CRÍTICA DE INTEGRIDAD - APP TABLERO
## Fecha: 2026-02-05 15:21 CST

---

## 📋 RESUMEN EJECUTIVO

Se han identificado **2 BUGS CRÍTICOS** que afectan la integridad de los datos:

1. **🔴 BUG CRÍTICO #1**: Sincronización de KPIs con opción "1" (Solo Estructura) modifica datos que NO debería tocar
2. **🔴 BUG CRÍTICO # 2**: Dirección "Centro Norte" no aparece en filtro de grupos del módulo de usuarios

---

## 🔴 BUG CRÍTICO #1: SINCRONIZACIÓN CORROMPE DATOS

### Descripción del Problema
Cuando el usuario ejecuta una sincronización de KPIs y selecciona:
- Opción "1" = "SOLO ESTRUCTURA (Nombres, Pesos, Metros, Tipo - RECOMENDADO)"
- Variable `syncGoals = false`

**RESULTADO ESPERADO**: Solo se deben sincronizar nombres, pesos, metros y tipo de meta  
**RESULTADO ACTUAL**: ❌ También se sincronizan METAS Y AVANCES

### Ubicación del Bug
**Archivo**: `App.tsx`  
**Líneas**: 1096-1108  
**Función**: `handleSaveIndicators()`

### Código Problemático

```typescript
if (existing) {
  return {
    ...newItem,  // ⚠️ PROBLEMA: Esto copia TODO de newItem, incluyendo metas y avances
    // Sincronización de Metas Estratégicas
    monthlyGoals: syncGoals ? [...newItem.monthlyGoals] : [...existing.monthlyGoals],
    weeklyGoals: syncGoals ? [...(newItem.weeklyGoals || [])] : [...(existing.weeklyGoals || [])],
    
    // PROTECCIÓN DE AVANCES OPERATIVOS (Real)
    monthlyProgress: [...existing.monthlyProgress],
    weeklyProgress: [...(existing.weeklyProgress || [])],
    monthlyNotes: (existing.monthlyNotes && existing.monthlyNotes.some(n => n?.length > 0)) ? existing.monthlyNotes : newItem.monthlyNotes,
    activityConfig: existing.activityConfig || newItem.activityConfig
  };
}
```

### Análisis Técnico

El problema está en el **orden de las operaciones**:

1. **`...newItem`** copia **TODOS** los campos del nuevo indicador (incluyendo `monthlyGoals`, `monthlyProgress`, etc.)
2. Luego, los campos se intentan sobrescribir selectivamente
3. **PERO**: Si hay campos que no se mencionan explícitamente después del spread, quedan con los valores del origen

### Campos Afectados (Potenciales)
- `monthlyGoals` ✅ (se sobrescribe correctamente)
- `weeklyGoals` ✅ (se sobrescribe correctamente)
- `monthlyProgress` ✅ (se sobrescribe correctamente)
- `weeklyProgress` ✅ (se sobrescribe correctamente)
- `monthlyNotes` ⚠️ (lógica condicional, podría fallar)
- `activityConfig` ⚠️ (lógica condicional, podría fallar)
- **Cualquier otro campo del DashboardItem** ❌ (quedaría con valor del origen)

### Impacto
- **Severidad**: 🔴 CRÍTICA
- **Frecuencia**: Cada vez que se usa sincronización con opción "1"
- **Datos Comprometidos**: Metas y avances de indicadores
- **Áreas Afectadas**: Todos los tableros sincronizados desde "BAJIO"

---

## 🔴 BUG CRÍTICO #2: GRUPOS NO APARECEN EN FILTRO DE USUARIOS

### Descripción del Problema
La "Dirección Centro Norte" está creada en el sistema pero **NO aparece** en el filtro de grupos del módulo de usuarios.

### Ubicación del Bug
**Archivo**: `App.tsx`  
**Líneas**: 443-454  
**Función**: `useEffect()` - Cálculo de `localOfficialGroups`

### Código Problemático

```typescript
// 🛡️ CÁLCULO LOCAL DE GRUPOS OFICIALES PARA EVITAR LOOP
const rawDirectors = allUsers
  .filter(u => (u.clientId || "").trim().toUpperCase() === targetClientAgg && u.globalRole === 'Director')
  .map(u => u.directorTitle?.replace(/\s+/g, ' ').trim().toUpperCase())
  .filter(Boolean) as string[];

const seenMap = new Map<string, string>();
rawDirectors.forEach(title => {
  const norm = normalizeGroupName(title);
  if (!seenMap.has(norm)) seenMap.set(norm, title);
});

let localOfficialGroups = Array.from(seenMap.values());
```

### Análisis Técnico

**PROBLEMA**: El código solo toma los `directorTitle` de los usuarios con rol `Director`, pero **NO considera los `subGroups`**.

Si un director tiene:
- `directorTitle`: "DIRECCIÓN OPERACIONES"
- `subGroups`: ["DIRECCIÓN CENTRO NORTE", "DIRECCIÓN SUR"]

Solo "DIRECCIÓN OPERACIONES" aparecerá en la lista de grupos disponibles, **pero NO** "DIRECCIÓN CENTRO NORTE" ni "DIRECCIÓN SUR".

### Impacto
- **Severidad**: 🔴 CRÍTICA
- **Frecuencia**: Afecta a TODOS los directores con subgrupos
- **Funcionalidad Afectada**: Módulo de usuarios - Asignación de grupos
- **Resultado**: No se pueden asignar correctamente permisos jerárquicos

---

## 🛠️ SOLUCIONES PROPUESTAS

### Solución #1: Corregir Lógica de Sincronización

**Enfoque Quirúrgico**: En lugar de usar spread (`...newItem`), construir el objeto explícitamente con solo los campos que queremos sincronizar.

```typescript
if (existing) {
  // BASE: Usar el item existente como base
  const syncedItem: DashboardItem = {
    ...existing,  // ✅ Preservar TODO del existente
    
    // SINCRONIZACIÓN CONDICIONAL DE ESTRUCTURA
    indicator: newItem.indicator,
    unit: newItem.unit,
    weight: newItem.weight,
    goalType: newItem.goalType,
    calculation: newItem.calculation,
    frequency: newItem.frequency,
    
    // SINCRONIZACIÓN CONDICIONAL DE METAS
    monthlyGoals: syncGoals ? [...newItem.monthlyGoals] : [...existing.monthlyGoals],
    weeklyGoals: syncGoals ? [...(newItem.weeklyGoals || [])] : [...(existing.weeklyGoals || [])],
    
    // PROTECCIÓN ABSOLUTA DE AVANCES (NUNCA se sincronizan)
    monthlyProgress: [...existing.monthlyProgress],
    weeklyProgress: [...(existing.weeklyProgress || [])],
    monthlyNotes: existing.monthlyNotes,
    activityConfig: existing.activityConfig
  };
  
  return syncedItem;
}
```

### Solución #2: Incluir SubGroups en Cálculo de Grupos Oficiales

```typescript
// 🛡️ CÁLCULO LOCAL DE GRUPOS OFICIALES (MEJORADO v5.5.1)
const rawDirectors = allUsers
  .filter(u => (u.clientId || "").trim().toUpperCase() === targetClientAgg && u.globalRole === 'Director')
  .flatMap(u => {
    const groups: string[] = [];
    
    // 1. Agregar el título del director
    if (u.directorTitle) {
      groups.push(u.directorTitle.replace(/\s+/g, ' ').trim().toUpperCase());
    }
    
    // 2. Agregar todos sus subgrupos
    if (u.subGroups && u.subGroups.length > 0) {
      u.subGroups.forEach(sg => {
        groups.push(sg.replace(/\s+/g, ' ').trim().toUpperCase());
      });
    }
    
    return groups;
  })
  .filter(Boolean) as string[];

const seenMap = new Map<string, string>();
rawDirectors.forEach(title => {
  const norm = normalizeGroupName(title);
  if (!seenMap.has(norm)) seenMap.set(norm, title);
});

let localOfficialGroups = Array.from(seenMap.values());
```

---

## ✅ PLAN DE CORRECCIÓN

### Fase 1: Correcciones Inmediatas (AHORA)
1. ✅ Auditoría completa documentada
2. ⏳ Implementar Solución #1 (Sincronización)
3. ⏳ Implementar Solución #2 (Grupos)
4. ⏳ Incrementar versión a v5.5.1

### Fase 2: Validación (POST-CORRECCIÓN)
1. ⏳ Probar sincronización con opción "1" en entorno de prueba
2. ⏳ Verificar que "DIRECCIÓN CENTRO NORTE" aparece en filtros
3. ⏳ Validar que NO se modifican metas ni avances con opción "1"
4. ⏳ Desplegar a producción

### Fase 3: Prevención (FUTURO)
1. ⏳ Agregar pruebas unitarias para sincronización
2. ⏳ Agregar validación de grupos antes de render
3. ⏳ Implementar logging de cambios en sincronización

---

## 📊 IMPACTO HISTÓRICO

### Sincronizaciones Afectadas
- **Fecha del incidente reportado**: 2026-02-05
- **Tablero origen**: BAJIO
- **Opción seleccionada**: 1 (dos veces)
- **Indicadores afectados**: 2 indicadores reportados
- **Cambios no deseados**: Metas y avances modificados

### Potencial de Corrupción de Datos
⚠️ **ALTO**: Cada sincronización con opción "1" desde la implementación de v4.0.0-PRO pudo haber corrompido datos.

---

## 🔍 RECOMENDACIONES ADICIONALES

1. **Realizar un backup completo** antes de aplicar correcciones
2. **Auditar todos los tableros** sincronizados desde BAJIO en las últimas 30 días
3. **Restaurar metas y avances** de los 2 indicadores reportados si es posible
4. **Implementar versionado de datos** para futuras recuperaciones
5. **Agregar confirmación explícita** antes de sincronizar con previsualización de cambios

---

## 📝 NOTAS TÉCNICAS

### Versión Actual del Sistema
- **Versión**: v5.5.0-PRO • ACTIVE SHIELD
- **Fecha de última modificación**: 2026-02-05

### Archivos Involucrados
- `App.tsx` (líneas 443-454, 1086-1114)
- `components/UserManager.tsx` (líneas 134-161)
- `types.ts` (definición de DashboardItem)

### Dependencias
- Firebase/Firestore
- React 18
- TypeScript

---

## ✍️ AUDITORÍA REALIZADA POR
**Asistente IA**: Antigravity  
**Fecha**: 2026-02-05 15:21 CST  
**Solicitado por**: Usuario (León Prior)

---

## 🚀 PRÓXIMOS PASOS

**ACCIÓN INMEDIATA REQUERIDA**:
1. Aplicar correcciones propuestas
2. Incrementar versión a v5.5.1-HOTFIX
3. Desplegar a producción con comunicación a usuarios
4. Monitorear sincronizaciones por 48 horas

**VERSIÓN A VISUALIZAR DESPUÉS DE CORRECCIONES**: **v5.5.1-HOTFIX**
