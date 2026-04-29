
const admin = require('firebase-admin');
const serviceAccount = require('./APP ACTIVADOR/prior-01-firebase-adminsdk-fbsvc-7aad9f63fd.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function inspect() {
    const dashId = "IPS_2026_1769706810567"; // METRO CENTRO
    console.log(`Inspeccionando Tablero: ${dashId}`);
    const itemsRef = db.collection("tbl_dashboards").doc(dashId).collection("items");
    const snap = await itemsRef.get();

    if (snap.empty) {
        console.log("No se encontraron items.");
        return;
    }

    const items = snap.docs.map(d => d.data());
    items.sort((a, b) => (a.order || 0) - (b.id || 0));

    items.forEach(data => {
        console.log(`[${data.id}] ${data.indicator}`);
        console.log(`    Type: ${data.indicatorType}, Agg: ${data.type}, Freq: ${data.frequency}`);
        if (data.componentIds) console.log(`    Components: ${JSON.stringify(data.componentIds)}`);
        if (data.indicator.includes("TOTALES")) {
            console.log(`    --- DATA FOR TOTALS ---`);
            console.log(`    monthlyProgress: ${JSON.stringify(data.monthlyProgress)}`);
            console.log(`    weeklyProgress: ${data.weeklyProgress ? "ALIVE" : "NULL"}`);
        }
        if (data.indicator.includes("BAJAS")) {
            console.log(`    Value Month 0: ${data.monthlyProgress?.[0]}, Month 1: ${data.monthlyProgress?.[1]}`);
        }
    });
}

inspect().catch(console.error);
