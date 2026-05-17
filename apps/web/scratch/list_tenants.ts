
import { db } from "./lib/firebase";
import { collection, getDocs } from "firebase/firestore";

async function listTenantsAndEvents() {
  const querySnapshot = await getDocs(collection(db, "tenants"));
  for (const tenantDoc of querySnapshot.docs) {
    console.log(`Tenant: ${tenantDoc.id} (${tenantDoc.data().name})`);
    const eventsSnapshot = await getDocs(collection(db, "tenants", tenantDoc.id, "events"));
    eventsSnapshot.forEach(eventDoc => {
      console.log(`  - Event: ${eventDoc.data().title}`);
    });
  }
}

listTenantsAndEvents();
