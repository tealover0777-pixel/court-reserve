
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function cleanupDomains() {
  const tenantsRef = db.collection('tenants');
  const snapshot = await tenantsRef.get();
  
  if (snapshot.empty) {
    console.log('No tenants found.');
    return;
  }

  const batch = db.batch();
  snapshot.docs.forEach(doc => {
    console.log(`Removing domain from tenant: ${doc.id}`);
    batch.update(doc.ref, {
      domain: admin.firestore.FieldValue.delete()
    });
  });

  await batch.commit();
  console.log('Successfully removed domain fields from all tenants.');
}

cleanupDomains().catch(console.error);
