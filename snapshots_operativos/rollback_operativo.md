# Plan de Contingencia y Guía de Rollback Operativo

Esta guía detalla el procedimiento exacto para restaurar de forma íntegra los datos de KPIs, metas, semáforos y pesos de la base de datos de producción de Firestore del proyecto `prior-01` a partir del snapshot JSON extraído.

---

## 1. Inventario de Snapshots y Archivos de Recuperación

Todos los snapshots operativos se guardan localmente en el directorio:
`snapshots_operativos/`

- **`dashboard_snapshot.json`**: El volcado íntegro de los 69 dashboards activos de `tbl_dashboards` y sus subcolecciones de `items` (618 KPIs en total).
- **`snapshot_manifest.json`**: Los metadatos de integridad y auditoría de la extracción (conteos y hashes).
- **`build_fingerprint.json`**: La huella digital de los archivos compilados del Tablero en producción.

---

## 2. Escenario de Contingencia: Restauración Operativa de Base de Datos

Si un dashboard o un KPI es eliminado o modificado por error humano en producción, sigue estos pasos para revertir los datos al estado estable actual sin afectar a otras colecciones (como las de Gobernanza):

### Paso 1: Configurar el Entorno de Scratch de Recuperación
El entorno seguro con las dependencias necesarias de Firebase y la credencial de administración administrativa está configurado en:
`C:\Users\LeonPrior\.gemini\antigravity\brain\d7488bbc-481c-45a9-aad2-d6f7fcfbcba2\scratch\`

### Paso 2: Crear el Script de Restauración Quirúrgica
Puedes escribir un script `restoreSnapshot.js` en el directorio de scratch con el siguiente flujo:
```javascript
import admin from 'firebase-admin';
import { readFileSync } from 'fs';

const serviceAccount = JSON.parse(readFileSync('C:\\Users\\LeonPrior\\OneDrive - Prior Consultoría\\Documentos\\CONSULTORÍAS 2025\\IPS\\IA\\APP ACTIVADOR\\prior-01-firebase-adminsdk-fbsvc-7aad9f63fd.json', 'utf8'));
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const snapshot = JSON.parse(readFileSync('c:\\Users\\LeonPrior\\OneDrive - Prior Consultoría\\Documentos\\CONSULTORÍAS 2025\\IPS\\IA\\APP TABLERO\\snapshots_operativos\\dashboard_snapshot.json', 'utf8'));

async function restore() {
    for (const d of snapshot) {
        // Restaurar el documento principal del dashboard
        const dRef = db.collection('tbl_dashboards').doc(d.id);
        await dRef.set({
            year: d.year,
            // (Otros campos del dashboard si existen en tu snapshot)
        }, { merge: true });
        
        // Restaurar cada KPI/item en su subcolección
        for (const item of d.items) {
            const itemRef = dRef.collection('items').doc(item.id);
            const { id, ...itemData } = item;
            await itemRef.set(itemData, { merge: true });
        }
        console.log(`✅ Dashboard [${d.id}] e items restaurados.`);
    }
    console.log("🎉 RESTAURACIÓN COMPLETADA CON ÉXITO.");
}
restore();
```

### Paso 3: Ejecutar la Restauración
Corre el comando desde tu consola:
```bash
node restoreSnapshot.js
```

---

## 3. Matriz de Mitigación y Buenas Prácticas

1. **Aislamiento de Colecciones**: La restauración descrita arriba opera exclusivamente sobre la colección `tbl_dashboards` y sus subcolecciones de KPIs. **No altera, lee ni escribe** en ninguna tabla o colección de Gobernanza COPARMEX ni de activadores auxiliares.
2. **Backups Periódicos**: Cada vez que se realicen cierres mensuales o trimestrales de KPIs, se recomienda ejecutar el script de extracción para mantener el snapshot actualizado.
3. **Cero Cambios de Lógica**: La restauración es meramente operacional a nivel de base de datos; la lógica funcional de semáforos, pesos y cálculos del frontend reside en el build verificado y no se ve afectada.
