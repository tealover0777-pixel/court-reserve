const admin = require("firebase-admin");

// Initialize Admin SDK using default configuration
admin.initializeApp({
  projectId: "court-reserve-9eeed"
});

const db = admin.firestore();

async function run() {
  try {
    console.log("=== DB QUERY START ===");
    
    // 1. Search global_users by email
    const email = "tealover0888@gmail.com";
    console.log(`\nQuerying global_users for email: ${email}`);
    const globalUsersSnap = await db.collection("global_users").where("email", "==", email).get();
    console.log(`Found: ${globalUsersSnap.size} documents`);
    globalUsersSnap.forEach(d => {
      console.log(`- Path: ${d.ref.path}`);
      console.log("  Data:", JSON.stringify(d.data(), null, 2));
    });

    // 2. Query tenant T10001
    console.log(`\nQuerying tenant T10001...`);
    const tenantDoc = await db.collection("tenants").doc("T10001").get();
    if (tenantDoc.exists) {
      console.log("Tenant T10001 Data:", JSON.stringify(tenantDoc.data(), null, 2));
    } else {
      console.log("Tenant T10001 does NOT exist!");
    }

    // 3. Query all users under T10001/users
    console.log(`\nQuerying users under tenants/T10001/users...`);
    const tenantUsersSnap = await db.collection("tenants").doc("T10001").collection("users").get();
    console.log(`Found: ${tenantUsersSnap.size} documents`);
    tenantUsersSnap.forEach(d => {
      console.log(`- Path: ${d.ref.path}`);
      console.log("  Data:", JSON.stringify(d.data(), null, 2));
    });

    // 4. Query collectionGroup("users") for email
    console.log(`\nQuerying collectionGroup('users') for email: ${email}`);
    const groupUsersSnap = await db.collectionGroup("users").where("email", "==", email).get();
    console.log(`Found in collectionGroup: ${groupUsersSnap.size} documents`);
    groupUsersSnap.forEach(d => {
      console.log(`- Path: ${d.ref.path}`);
      console.log("  Data:", JSON.stringify(d.data(), null, 2));
    });

    console.log("\n=== DB QUERY END ===");
    process.exit(0);
  } catch (err) {
    console.error("Query failed:", err);
    process.exit(1);
  }
}

run();
