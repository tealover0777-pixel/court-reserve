import * as admin from "firebase-admin";

admin.initializeApp();
const db = admin.firestore();

async function findUser() {
  const email = "fortlee0717@gmail.com";
  console.log(`Searching for ${email}...`);

  const globalSnap = await db.collection("global_users").where("email", "==", email).get();
  console.log(`Found in global_users: ${globalSnap.docs.length}`);
  globalSnap.forEach(doc => console.log(`  Path: ${doc.ref.path}, Data:`, doc.data()));

  const tenantSnap = await db.collectionGroup("users").where("email", "==", email).get();
  console.log(`Found in collectionGroup(users): ${tenantSnap.docs.length}`);
  tenantSnap.forEach(doc => console.log(`  Path: ${doc.ref.path}, Data:`, doc.data()));

  process.exit(0);
}

findUser();
