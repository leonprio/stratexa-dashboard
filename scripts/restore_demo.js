
import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, doc, writeBatch } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyCChhyWoODY73zTuOJhfX5vMbxyN-HwmV0",
    authDomain: "prior-01.firebaseapp.com",
    projectId: "prior-01",
    storageBucket: "prior-01.firebasestorage.app",
    messagingSenderId: "568084253557",
    appId: "1:568084253557:web:e5b7985513a4c21cd5213c",
    measurementId: "G-LMS2KXKHMT",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function restoreDemo() {
    const targetClient = "DEMO";
    const year = 2025;

    console.log(`🔎 Verificando existencia de tableros para ${targetClient} / ${year}...`);

    // Check ALL dashboards to be sure, robust filtering
    const allDocs = await getDocs(collection(db, "dashboards"));
    const demoDashboards = [];
    allDocs.forEach(d => {
        const data = d.data();
        if ((data.clientId || "").toUpperCase() === targetClient && Number(data.year) === year) {
            demoDashboards.push({ id: d.id, ...data });
        }
    });

    if (demoDashboards.length > 0) {
        console.log(`⚠️ Mmh, encontré ${demoDashboards.length} tableros que TODAVÍA EXISTEN:`);
        demoDashboards.forEach(d => console.log(` - [${d.id}] ${d.title} (${d.group})`));
        console.log("No se crearán nuevos para evitar duplicados. Si deseas reiniciar, borra estos manualmente o usa la opción 'Eliminar TODO' en la config.");
    } else {
        console.log("✅ Confirmado: No hay tableros. Procediendo a recrear la estructura de 3 tableros...");

        const batch = writeBatch(db);
        // Find a safe ID start
        const maxId = allDocs.docs.reduce((acc, d) => Math.max(acc, Number(d.id) || 0), 0);
        let nextId = maxId + 1;

        for (let i = 1; i <= 3; i++) {
            const newId = nextId++;
            const ref = doc(db, "dashboards", String(newId));

            console.log(`   ✨ Creando: Tablero ${i} (ID: ${newId})`);
            batch.set(ref, {
                id: newId,
                title: `TABLERO ${i}`,
                subtitle: "Estructura recuperada",
                group: "GENERAL",
                clientId: "DEMO",
                year: 2025,
                orderNumber: i,
                thresholds: { onTrack: 90, atRisk: 80 },
                items: [] // Empty items
            });
        }

        await batch.commit();
        console.log("🎉 ¡Listo! 3 tableros creados exitosamente.");
    }

    process.exit(0);
}

restoreDemo();
