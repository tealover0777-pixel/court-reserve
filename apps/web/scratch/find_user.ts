import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, doc, getDoc, query, where } from "firebase/firestore";

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
  const email = "tealover0888@gmail.com";
  console.log(`=== START PUBLIC DB SEARCH ===`);
  console.log(`Searching for email: ${email}\n`);

  try {
    // 1. Search global_users by email
    const globalQ = query(collection(db, "global_users"), where("email", "==", email));
    const globalSnap = await getDocs(globalQ);
    console.log(`Found in global_users: ${globalSnap.docs.length}`);
    globalSnap.forEach(doc => console.log(`  Path: ${doc.ref.path}, Data:`, JSON.stringify(doc.data(), null, 2)));

    // 2. Fetch tenant T10001
    console.log(`\nFetching tenant T10001...`);
    const tenantRef = doc(db, "tenants", "T10001");
    const tenantSnap = await getDoc(tenantRef);
    if (tenantSnap.exists()) {
      console.log(`  Tenant T10001 Data:`, JSON.stringify(tenantSnap.data(), null, 2));
    } else {
      console.log(`  Tenant T10001 does NOT exist!`);
    }

    // 3. Fetch all users in tenants/T10001/users
    console.log(`\nFetching users under tenants/T10001/users...`);
    const usersSnap = await getDocs(collection(db, "tenants", "T10001", "users"));
    console.log(`  Found under T10001/users: ${usersSnap.docs.length}`);
    usersSnap.forEach(doc => console.log(`  Path: ${doc.ref.path}, Data:`, JSON.stringify(doc.data(), null, 2)));

  } catch (err) {
    console.error("Error running queries:", err);
  }

  console.log(`\n=== END PUBLIC DB SEARCH ===`);
  process.exit(0);
}

findUser();
