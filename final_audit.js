import admin from 'firebase-admin';
import { readFileSync } from 'fs';

const serviceAccount = JSON.parse(readFileSync('C:\\Users\\LeonPrior\\OneDrive - Prior Consultoría\\Documentos\\CONSULTORÍAS 2025\\IPS\\IA\\APP ACTIVADOR\\prior-01-firebase-adminsdk-fbsvc-7aad9f63fd.json', 'utf8'));

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function checkFinalIntegrity() {
    console.log("--- AUDITORÍA FINAL DE INTEGRIDAD POST-REPARACIÓN ---");

    // 1. Verificar Colecciones de Usuarios
    const collections = ['tbl_users', 'stx_users', 'vac_users', 'cpx_users'];
    for (const col of collections) {
        const snap = await db.collection(col).limit(1).get();
        console.log(`[AUTH] ${col}: ${snap.empty ? '❌ VACÍA' : '✅ ACTIVA'}`);
    }

    // 2. Verificar Datos Tablero 2026
    const dashSnap = await db.collection('tbl_dashboards').where('year', '==', 2026).get();
    console.log(`[TABLERO] Dashboards 2026 en tbl_dashboards: ${dashSnap.size}`);
    
    if (!dashSnap.empty) {
        const firstDash = dashSnap.docs[0];
        const itemsSnap = await firstDash.ref.collection('items').get();
        console.log(`[TABLERO] Ítems en dashboard muestra (${firstDash.id}): ${itemsSnap.size}`);
    }

    // 3. Verificar Configuración Activador (Legacy)
    const configGlobal = await db.collection('config').doc('global').get();
    const metricsGlobal = await db.collection('config').doc('metrics').get();
    console.log(`[ACTIVADOR] Config Global Legacy: ${configGlobal.exists ? '✅ EXISTE' : '❌ NO EXISTE'}`);
    console.log(`[ACTIVADOR] Metrics Legacy: ${metricsGlobal.exists ? '✅ EXISTE' : '❌ NO EXISTE'}`);

    // 4. Verificar Semana 6
    const stxConfig = await db.collection('stx_config').doc('global').get();
    const currentWeek = stxConfig.exists ? stxConfig.data().currentWeek : 'N/A';
    console.log(`[SISTEMA] Semana actual en stx_config: ${currentWeek}`);

    process.exit(0);
}

checkFinalIntegrity().catch(err => {
    console.error("Error en auditoría:", err);
    process.exit(1);
});
