import { admin, db } from './firebase-admin-init.js'; // Assuming a setup exists or I'll create one

async function setSuperAdmin() {
  const email = 'kyuahn@yahoo.com';
  try {
    const user = await admin.auth().getUserByEmail(email);
    console.log(`Found user: ${user.uid}`);

    // Update Custom Claims
    await admin.auth().setCustomUserClaims(user.uid, { 
      role: 'R10010', // Super Admin
      tenantId: 'global'
    });
    console.log('Set custom claims for super admin.');

    // Update Firestore
    const userSnapshot = await db.collection('global_users').where('email', '==', email).get();
    if (!userSnapshot.empty) {
      const doc = userSnapshot.docs[0];
      await doc.ref.update({
        role: 'R10010',
        auth_uid: user.uid,
        status: 'Active'
      });
      console.log('Updated Firestore record.');
    } else {
      // Create it if it doesn't exist
      await db.collection('global_users').doc('U00001').set({
        user_id: 'U00001',
        auth_uid: user.uid,
        email: email,
        first_name: 'Kyu',
        last_name: 'Ahn',
        role: 'R10010',
        status: 'Active',
        created_at: admin.firestore.FieldValue.serverTimestamp()
      });
      console.log('Created new Firestore record.');
    }
  } catch (err) {
    console.error('Error:', err);
  }
}

setSuperAdmin();
