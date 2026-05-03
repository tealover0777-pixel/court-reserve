const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

/**
 * Invites a user to a tenant and sets their role/claims.
 * Ensures the user exists in Firebase Authentication.
 */
exports.inviteUser = functions.https.onCall(async (data, context) => {
  const { email, role, tenantId, user_id, first_name, last_name, phone, notes } = data;

  if (!email || !user_id) {
    throw new functions.https.HttpsError("invalid-argument", "Missing required fields: email or user_id");
  }

  try {
    // 1. Pre-create in Firestore to prevent sync race condition
    await db.collection("global_users").doc(user_id).set({
      user_id,
      email,
      first_name: first_name || "",
      last_name: last_name || "",
      phone: phone || "",
      tenantId: tenantId || "global",
      role,
      notes: notes || "",
      status: "Invited",
      updated_at: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    let uid;
    let userRecord;

    // 2. Check if user exists in Auth, or create them
    try {
      userRecord = await admin.auth().getUserByEmail(email);
      uid = userRecord.uid;
    } catch (error) {
      if (error.code === 'auth/user-not-found') {
        userRecord = await admin.auth().createUser({
          email: email,
          displayName: `${first_name || ''} ${last_name || ''}`.trim(),
          disabled: false,
        });
        uid = userRecord.uid;
      } else {
        throw error;
      }
    }

    // 3. Set Custom Claims
    await admin.auth().setCustomUserClaims(uid, { tenantId: tenantId || 'global', role });

    // 4. Update Firestore with final Auth UID and ensure "Invited" status
    await db.collection("global_users").doc(user_id).update({
      auth_uid: uid,
      status: "Invited",
      updated_at: admin.firestore.FieldValue.serverTimestamp()
    });

    // 5. Generate Password Reset Link (Setup Link)
    const invitationLink = await admin.auth().generatePasswordResetLink(email);
    
    return { 
      status: "success", 
      message: `User ${email} invited and synced. Auth UID: ${uid}`,
      invitationLink,
      uid
    };
  } catch (error) {
    console.error("Error in inviteUser:", error);
    throw new functions.https.HttpsError("internal", error.message);
  }
});

/**
 * Sync Auth users to Firestore on creation
 */
exports.syncUserOnCreate = functions.auth.user().onCreate(async (user) => {
  const { uid, email, displayName } = user;
  
  // Only sync if they don't already exist in global_users (checked by email)
  const userSnapshot = await db.collection("global_users").where("email", "==", email).get();
  
  if (userSnapshot.empty) {
    const nameParts = (displayName || "").split(" ");
    const firstName = nameParts[0] || "";
    const lastName = nameParts.slice(1).join(" ") || "";

    // Generate a temporary user_id if not present
    const nextId = `U${Math.floor(Math.random() * 100000).toString().padStart(5, '0')}`;

    await db.collection("global_users").doc(nextId).set({
      user_id: nextId,
      auth_uid: uid,
      email,
      first_name: firstName,
      last_name: lastName,
      role: "Member", // Default role
      status: "Active",
      created_at: admin.firestore.FieldValue.serverTimestamp()
    });
  } else {
    // If they exist but lack auth_uid, update it (Keep existing status)
    const doc = userSnapshot.docs[0];
    await doc.ref.update({ auth_uid: uid });
  }
});

/**
 * Cleanup Firestore when Auth user is deleted
 */
exports.syncUserOnDelete = functions.auth.user().onDelete(async (user) => {
  const { uid } = user;
  const userSnapshot = await db.collection("global_users").where("auth_uid", "==", uid).get();
  
  const batch = db.batch();
  userSnapshot.forEach(doc => {
    batch.delete(doc.ref);
  });
  
  return batch.commit();
});

/**
 * Deletes a user from both Firestore and Firebase Authentication.
 */
exports.deleteUserAccount = functions.https.onCall(async (data, context) => {
  const { user_id, auth_uid } = data;

  if (!user_id) {
    throw new functions.https.HttpsError("invalid-argument", "Missing user_id");
  }

  try {
    // 1. Delete from Firestore
    await db.collection("global_users").doc(user_id).delete();

    // 2. Delete from Auth (if UID is provided)
    if (auth_uid) {
      try {
        await admin.auth().deleteUser(auth_uid);
      } catch (authError) {
        // If user already doesn't exist in Auth, we can ignore
        if (authError.code !== 'auth/user-not-found') {
          throw authError;
        }
      }
    }

    return { status: "success", message: `User ${user_id} deleted from Firestore and Auth.` };
  } catch (error) {
    console.error("Error in deleteUserAccount:", error);
    throw new functions.https.HttpsError("internal", error.message);
  }
});
