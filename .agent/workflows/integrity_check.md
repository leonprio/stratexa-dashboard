---
description: Ejecutar análisis de integridad completa y generar informe
---

1. Instalar dependencias de desarrollo (si no están instaladas)
   ```bash
   npm i -D eslint prettier jest @testing-library/react typescript
   ```

// turbo
2. Ejecutar lint
   ```bash
   npx eslint . --ext .ts,.tsx
   ```

// turbo
3. Verificar tipado TypeScript
   ```bash
   npx tsc --noEmit
   ```

// turbo
4. Ejecutar pruebas unitarias con cobertura
   ```bash
   npm test -- --coverage
   ```

5. Generar informe de integridad (usando script node o manual)
   ```bash
   node scripts/generateIntegrityReport.js
   ```
