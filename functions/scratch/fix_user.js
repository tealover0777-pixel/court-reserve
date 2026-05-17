const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

async function fixUser() {
  const email = "fortlee0717@gmail.com";
  console.log(`Searching for ${email}...`);

  const globalSnap = await db.collection("global_users").where("email", "==", email).get();
  console.log(`Found in global_users: ${globalSnap.docs.length}`);
  
  for (const doc of globalSnap.docs) {
    console.log(`Deleting from global_users: ${doc.ref.path}`);
    await doc.ref.delete();
  }

  const tenantSnap = await db.collectionGroup("users").where("email", "==", email).get();
  console.log(`Found in collectionGroup(users): ${tenantSnap.docs.length}`);
  
  let authUid = null;
  let role = "Member";
  let tenantId = "T10001"; // Fallback
  
  for (const doc of tenantSnap.docs) {
    console.log(`  Path: ${doc.ref.path}, Data:`, doc.data());
    authUid = doc.data().auth_uid;
    role = doc.data().role || role;
    tenantId = doc.data().tenant_id || tenantId;
  }

  if (authUid) {
    console.log(`Updating Custom Claims for ${authUid} -> tenantId: ${tenantId}`);
    try {
      await admin.auth().setCustomUserClaims(authUid, { tenantId: tenantId, role: role });
      console.log("Successfully updated claims.");
    } catch (e) {
      console.error("Failed to update custom claims:", e);
    }
  }

  process.exit(0);
}

fixUser();
