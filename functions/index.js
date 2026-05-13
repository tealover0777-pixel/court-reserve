const functions = require("firebase-functions");
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");

admin.initializeApp();
const db = admin.firestore();

/**
 * Sends a real SMTP test/verification email using tenant-configured credentials.
 * Called from the Email Settings panel in the platform UI.
 */
exports.sendVerificationEmail = functions.https.onRequest(async (req, res) => {
  // CORS
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ success: false, error: "Method not allowed" });
    return;
  }

  const {
    from_email,
    from_name,
    test_email,
    smtp_host,
    smtp_port,
    smtp_user,
    smtp_password,
    smtp_app_password,
    smtp_2fa,
    smtp_tls,
    delivery_method,
    smtp_service,
  } = req.body;

  if (!from_email || !test_email) {
    res.status(400).json({ success: false, error: "from_email and test_email are required." });
    return;
  }

  const password = smtp_2fa && smtp_app_password ? smtp_app_password : smtp_password;

  const serviceMap = {
    "Gmail":    { host: "smtp.gmail.com",      port: 587 },
    "Yahoo!":   { host: "smtp.mail.yahoo.com", port: 587 },
    "Outlook":  { host: "smtp.office365.com",  port: 587 },
    "SendGrid": { host: "smtp.sendgrid.net",   port: 587 },
    "Mailgun":  { host: "smtp.mailgun.org",     port: 587 },
  };

  let host, port;
  if (delivery_method === "SMTP" && smtp_host) {
    host = smtp_host;
    port = Number(smtp_port) || 587;
  } else {
    const svc = serviceMap[smtp_service] || serviceMap["Gmail"];
    host = svc.host;
    port = svc.port;
  }

  const transporterConfig = {
    host,
    port,
    secure: port === 465,
    auth: {
      user: smtp_user || from_email,
      pass: password,
    },
    tls: { rejectUnauthorized: false },
  };

  try {
    const transporter = nodemailer.createTransport(transporterConfig);

    await transporter.sendMail({
      from: from_name ? `"${from_name}" <${from_email}>` : from_email,
      to: test_email,
      subject: "✅ Court Reserve – Email Verification Test",
      html: `
        <div style="font-family:Inter,sans-serif;background:#0a0a0a;padding:40px;border-radius:16px;max-width:480px;margin:0 auto;">
          <div style="margin-bottom:24px;font-size:40px;">✅</div>
          <h1 style="color:#fff;font-size:24px;font-weight:900;margin:0 0 8px;letter-spacing:-0.5px;">Email Verified</h1>
          <p style="color:#a8a29e;font-size:14px;margin:0 0 24px;line-height:1.6;">
            Your SMTP configuration for <strong style="color:#fff;">${from_email}</strong> is working correctly.
            This test was sent from the Court Reserve platform.
          </p>
          <p style="color:#57534e;font-size:11px;border-top:1px solid #1c1917;padding-top:16px;margin:0;">
            Court Reserve Platform · Email Verification Test
          </p>
        </div>
      `,
    });

    res.status(200).json({ success: true, message: `Verification email sent to ${test_email}` });
  } catch (err) {
    console.error("[sendVerificationEmail] SMTP error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});



/**
 * Invites a user to a tenant and sets their role/claims.
 * Ensures the user exists in Firebase Authentication.
 */
exports.inviteUser = functions.https.onCall(async (data, context) => {
  const {
    email,
    role,
    tenantId,
    tenant_id,
    user_id,
    first_name,
    last_name,
    phone,
    notes,
    useTenantUserDoc,
  } = data;

  if (!email || !user_id) {
    throw new functions.https.HttpsError("invalid-argument", "Missing required fields: email or user_id");
  }

  const tenantDocId = tenantId || "global";
  const isTenantScoped =
    tenantDocId && String(tenantDocId).toLowerCase() !== "global";

  /** Tenant primary owner from Platform Tenant Admin: tenants/{tenantDocId}/users/{user_id}. All other invites stay in global_users. */
  const useTenantPath = Boolean(useTenantUserDoc) && isTenantScoped;

  const userDocRef = useTenantPath
    ? db.collection("tenants").doc(tenantDocId).collection("users").doc(user_id)
    : db.collection("global_users").doc(user_id);

  const tenantSlug = tenant_id || tenantDocId;

  try {
    // 1. Pre-create in Firestore to prevent sync race condition
    await userDocRef.set({
      user_id,
      email,
      first_name: first_name || "",
      last_name: last_name || "",
      phone: phone || "",
      tenantId: tenantDocId,
      tenant_id: useTenantPath ? tenantSlug : isTenantScoped ? tenantSlug : "Global",
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
    await admin.auth().setCustomUserClaims(uid, { tenantId: tenantDocId, role });

    // 4. Update Firestore with final Auth UID and ensure "Invited" status
    await userDocRef.update({
      auth_uid: uid,
      status: "Invited",
      updated_at: admin.firestore.FieldValue.serverTimestamp()
    });

    // 5. Generate Password Reset Link (Setup Link) pointing to our custom page
    const actionCodeSettings = {
      url: "https://court-reserve-9eeed.web.app/reset-password",
      handleCodeInApp: false,
    };
    const invitationLink = await admin.auth().generatePasswordResetLink(email, actionCodeSettings);
    
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
  
  // Prefer tenant-scoped invite row (tenants/*/users) matched by email
  const tenantUserSnap = await db.collectionGroup("users").where("email", "==", email).limit(5).get();
  if (!tenantUserSnap.empty) {
    const doc = tenantUserSnap.docs[0];
    await doc.ref.update({
      auth_uid: uid,
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
    });
    return;
  }

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
  const batch = db.batch();

  const tenantUserSnap = await db.collectionGroup("users").where("auth_uid", "==", uid).get();
  tenantUserSnap.forEach((d) => batch.delete(d.ref));

  const globalSnap = await db.collection("global_users").where("auth_uid", "==", uid).get();
  globalSnap.forEach((d) => batch.delete(d.ref));

  if (!tenantUserSnap.empty || !globalSnap.empty) {
    return batch.commit();
  }
  return null;
});

/**
 * Deletes a user from both Firestore and Firebase Authentication.
 */
exports.deleteUserAccount = functions.https.onCall(async (data, context) => {
  const { user_id, auth_uid, tenant_doc_id } = data;

  if (!user_id) {
    throw new functions.https.HttpsError("invalid-argument", "Missing user_id");
  }

  try {
    // 1. Delete from Firestore (global_users doc id, or tenants/{tenant}/users/{user_id})
    const globalRef = db.collection("global_users").doc(user_id);
    const globalSnap = await globalRef.get();
    if (globalSnap.exists) {
      await globalRef.delete();
    } else if (tenant_doc_id) {
      await db.collection("tenants").doc(tenant_doc_id).collection("users").doc(user_id).delete();
    } else if (auth_uid) {
      const tu = await db.collectionGroup("users").where("auth_uid", "==", auth_uid).limit(1).get();
      if (!tu.empty) await tu.docs[0].ref.delete();
    }

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
