const { onRequest } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

admin.initializeApp();

/**
 * Sets the tenantId custom claim for a user.
 * In a real app, this should be restricted to admins.
 */
exports.setTenantClaim = onRequest(async (req, res) => {
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
