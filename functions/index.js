const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

/**
 * Invites a user to a tenant and sets their role/claims.
 */
exports.inviteUser = functions.https.onCall(async (data, context) => {
  const { email, role, tenantId, user_id, first_name, last_name, phone, notes } = data;

  if (!email || !tenantId || !user_id) {
    throw new functions.https.HttpsError("invalid-argument", "Missing required fields: email, tenantId, or user_id");
  }

  try {
    // 1. Create/Update user in global_users collection
    await db.collection("global_users").doc(user_id).set({
      user_id,
      email,
      first_name,
      last_name,
      phone,
      tenantId,
      role,
      notes,
      status: "Invited",
      created_at: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    // 2. Set Custom Claims for the user if they already exist in Auth
    try {
      const userRecord = await admin.auth().getUserByEmail(email);
      await admin.auth().setCustomUserClaims(userRecord.uid, { tenantId, role });
    } catch (authError) {
      console.log("User not found in Auth yet, claims will be set upon first login or sign up.");
    }

    return { status: "success", message: `User ${email} invited to tenant ${tenantId}` };
  } catch (error) {
    console.error("Error in inviteUser:", error);
    throw new functions.https.HttpsError("internal", error.message);
  }
});

/**
 * Sets the tenantId custom claim for a user.
 */
exports.setTenantClaim = functions.https.onRequest(async (req, res) => {
  const { uid, tenantId } = req.body;

  if (!uid || !tenantId) {
    return res.status(400).send("Missing uid or tenantId");
  }

  try {
    await admin.auth().setCustomUserClaims(uid, { tenantId });
    res.status(200).send({ status: "success", message: `User ${uid} assigned to tenant ${tenantId}` });
  } catch (error) {
    console.error("Error setting custom claims:", error);
    res.status(500).send({ status: "error", message: error.message });
  }
});
