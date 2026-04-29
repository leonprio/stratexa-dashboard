import admin from 'firebase-admin';
import { readFileSync } from 'fs';
const serviceAccount = JSON.parse(readFileSync('C:\\Users\\LeonPrior\\OneDrive - Prior Consultoría\\Documentos\\CONSULTORÍAS 2025\\IPS\\IA\\APP ACTIVADOR\\prior-01-firebase-adminsdk-fbsvc-7aad9f63fd.json', 'utf8'));
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();
async function main() {
    console.log("weekly_data query:");
    const s1 = await db.collection('weekly_data').get();
    let years = {};
    let weeks = {};
    s1.forEach(d => {
        let y = d.data().year;
        let w = d.data().week;
        years[y] = (years[y] || 0) + 1;
        weeks[w] = (weeks[w] || 0) + 1;
    });
    console.log(JSON.stringify(years));
    console.log(JSON.stringify(weeks));
    process.exit(0);
}
main();
