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

async function listCollections() {
    const collections = await db.listCollections();
    collections.forEach(collection => {
        console.log("Collection:", collection.id);
    });
    process.exit(0);
}

listCollections();
