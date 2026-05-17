import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, query, where, collectionGroup } from "firebase/firestore";
const firebaseConfig = {
  apiKey: "AIzaSyAA5hBvvGcG24g8tZv8vZvxhIJ5bh3Qtsg",
  authDomain: "court-reserve-9eeed.firebaseapp.com",
  projectId: "court-reserve-9eeed",
  storageBucket: "court-reserve-9eeed.firebasestorage.app",
  messagingSenderId: "502620154691",
  appId: "1:502620154691:web:310a93e591f1f08492ddf6"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function findUser() {
  const email = "fortlee0717@gmail.com";
  console.log(`Searching for ${email}...`);

  const globalQ = query(collection(db, "global_users"), where("email", "==", email));
  const globalSnap = await getDocs(globalQ);
  console.log(`Found in global_users: ${globalSnap.docs.length}`);
  globalSnap.forEach(doc => console.log(`  Path: ${doc.ref.path}, Data:`, doc.data()));

  const tenantQ = query(collectionGroup(db, "users"), where("email", "==", email));
  const tenantSnap = await getDocs(tenantQ);
  console.log(`Found in collectionGroup(users): ${tenantSnap.docs.length}`);
  tenantSnap.forEach(doc => console.log(`  Path: ${doc.ref.path}, Data:`, doc.data()));

  process.exit(0);
}

findUser();
