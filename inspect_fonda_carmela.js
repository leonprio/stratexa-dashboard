
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();
const dashboardId = '1769440535443';

async function inspectIndicators() {
    const itemsRef = db.collection('stx_dashboards').doc(dashboardId).collection('items');
    const snapshot = await itemsRef.get();
    
    console.log(`Found ${snapshot.size} items for dashboard ${dashboardId}`);
    
    snapshot.forEach(doc => {
        const data = doc.data();
        if ([3, 4, 5, 6, 7, 8].includes(parseInt(data.id))) {
            console.log(`--- Indicator ${data.id}: ${data.indicator} ---`);
            console.log(`Type: ${data.indicatorType || 'manual'}`);
            console.log(`Formula: ${data.formula || 'N/A'}`);
            console.log(`Monthly Progress (first 4 months):`, data.monthlyProgress?.slice(0, 4));
            console.log(`Monthly Goals (first 4 months):`, data.monthlyGoals?.slice(0, 4));
            if (data.frequency === 'weekly') {
                console.log(`Frequency: weekly`);
                console.log(`Weekly Progress length: ${data.weeklyProgress?.length}`);
            }
        }
    });
}

inspectIndicators().catch(console.error);
