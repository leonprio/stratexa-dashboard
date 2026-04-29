import admin from 'firebase-admin';
import { readFileSync } from 'fs';

// Usando una ruta más segura y directa
const serviceAccountPath = 'C:\\Users\\LeonPrior\\OneDrive - Prior Consultoría\\Documentos\\CONSULTORÍAS 2025\\IPS\\IA\\APP ACTIVADOR\\prior-01-firebase-adminsdk-fbsvc-7aad9f63fd.json';
const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function fixFinalConfig() {
    console.log("Asegurando configuración de semana 6 en todas las fuentes...");

    const weekData = {
        currentWeek: 6,
        currentYear: 2026,
        lastUpdated: admin.firestore.FieldValue.serverTimestamp()
    };

    // 1. Fuente moderna principal (Activador V2 / Vacantes)
    await db.collection('stx_config').doc('global').set(weekData, { merge: true });
    
    // 2. Fuente legacy para Activador original
    await db.collection('config').doc('global').set(weekData, { merge: true });

    // 3. Fuente para Tablero (systemSettings)
    await db.collection('tbl_systemSettings').doc('IPS').set({
        globalPeriod: { week: 6, year: 2026 }
    }, { merge: true });

    console.log("✅ Configuración sincronizada a Semana 6 en todas las apps.");
    process.exit(0);
}

fixFinalConfig().catch(err => {
    console.error("Error catastrófico:", err);
    process.exit(1);
});
