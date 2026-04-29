import admin from 'firebase-admin';
import { readFileSync } from 'fs';

const serviceAccountPath = 'C:\\Users\\LeonPrior\\OneDrive - Prior Consultoría\\Documentos\\CONSULTORÍAS 2025\\IPS\\IA\\APP ACTIVADOR\\prior-01-firebase-adminsdk-fbsvc-7aad9f63fd.json';
const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function checkIps() {
    const snap = await db.collection('ips_config').doc('global').get();
    console.log("ips_config/global:", snap.exists ? snap.data() : "NO EXISTE");
    
    const usersSnap = await db.collection('ips_users').limit(3).get();
    console.log(`ips_users count: ${usersSnap.size}`);
    
    process.exit(0);
}

checkIps();
