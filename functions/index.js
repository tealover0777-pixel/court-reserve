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
  
  // 1. Prefer tenant-scoped user row (tenants/*/users) matched by email
  const tenantUserSnap = await db.collectionGroup("users").where("email", "==", email).limit(1).get();
  if (!tenantUserSnap.empty) {
    const userDoc = tenantUserSnap.docs[0];
    const userData = userDoc.data();
    
    await userDoc.ref.update({
      auth_uid: uid,
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Set Custom Claims for security rules
    await admin.auth().setCustomUserClaims(uid, { 
      tenantId: userData.tenantId || userData.tenant_id, 
      role: userData.role || (userData.roles ? userData.roles[0] : "R10001")
    });
    console.log(`Synced tenant user ${email} with UID ${uid}`);
    return;
  }

  // 2. Check global_users (e.g. Platform Admins)
  const globalUserSnap = await db.collection("global_users").where("email", "==", email).limit(1).get();
  if (!globalUserSnap.empty) {
    const userDoc = globalUserSnap.docs[0];
    const userData = userDoc.data();
    await userDoc.ref.update({ 
      auth_uid: uid,
      updated_at: admin.firestore.FieldValue.serverTimestamp()
    });
    await admin.auth().setCustomUserClaims(uid, { 
      role: userData.role || "PlatformAdmin",
      isGlobal: true 
    });
    console.log(`Synced global user ${email} with UID ${uid}`);
    return;
  }

  // 3. If no pre-existing record found, we do NOT create a global user anymore.
  // This satisfies the requirement to eliminate redundant global user records.
  console.log(`No pre-existing Firestore record found for ${email}. Waiting for registration flow.`);
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


/**
 * Database Migration Utility:
 * Sets or updates the high-fidelity 4-tier default membership plans for all active tenants.
 * Can be triggered locally or via deployed cloud functions.
 */
exports.seedFreeMemberships = functions.https.onRequest(async (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");

  try {
    const tenantsSnap = await db.collection("tenants").get();
    if (tenantsSnap.empty) {
      res.status(200).json({ success: true, message: "No tenants found to seed." });
      return;
    }

    const defaultPlans = [
      {
        name: "FREE",
        price: "0",
        popular: false,
        features: ["Standard Access", "Fast Check out and Check in confirmation"],
        bgColor: "#ccff00",
        textColor: "#000000",
        themeColors: {
          LIGHT: { bgColor: "#ccff00", textColor: "#000000" },
          DARK: { bgColor: "#ccff00", textColor: "#000000" },
          VINTAGE: { bgColor: "#ccff00", textColor: "#000000" }
        }
      },
      {
        name: "SILVER",
        price: "99",
        popular: true,
        features: ["2 Bookings/Week", "Standard Access", "Social Mixers"]
      },
      {
        name: "GOLD",
        price: "199",
        popular: false,
        features: ["Unlimited Bookings", "Priority Courts", "Guest Passes (4)", "Pro Discounts"],
        bgColor: "#b8860b",
        textColor: "#ffffff",
        themeColors: {
          LIGHT: { bgColor: "#b8860b", textColor: "#ffffff" },
          DARK: { bgColor: "#b8860b", textColor: "#ffffff" },
          VINTAGE: { bgColor: "#b8860b", textColor: "#ffffff" }
        }
      },
      {
        name: "PLATINUM",
        price: "299",
        popular: false,
        features: ["24/7 Access", "Personal Locker", "Free Stringing", "Pro Clinic Access"],
        bgColor: "#8a9597",
        textColor: "#ffffff",
        themeColors: {
          LIGHT: { bgColor: "#8a9597", textColor: "#ffffff" },
          DARK: { bgColor: "#8a9597", textColor: "#ffffff" },
          VINTAGE: { bgColor: "#8a9597", textColor: "#ffffff" }
        }
      }
    ];

    const results = [];

    for (const tenantDoc of tenantsSnap.docs) {
      const tenantId = tenantDoc.id;
      const membershipsRef = db.collection("tenants").doc(tenantId).collection("config").doc("memberships");
      const snap = await membershipsRef.get();

      if (snap.exists) {
        const data = snap.data();
        let plansToSave = defaultPlans;

        // If plans already exist, we prepend FREE if missing, or fully overwrite if reset requested
        if (req.query.reset !== "true" && data.plans && Array.isArray(data.plans)) {
          const hasFree = data.plans.some(p => p.name?.toUpperCase() === "FREE");
          if (!hasFree) {
            plansToSave = [defaultPlans[0], ...data.plans];
          } else {
            // Update exist Free to have neon green colors
            plansToSave = data.plans.map(p => {
              if (p.name?.toUpperCase() === "FREE") {
                return {
                  ...defaultPlans[0],
                  ...p,
                  bgColor: "#ccff00",
                  textColor: "#000000",
                  themeColors: defaultPlans[0].themeColors
                };
              }
              return p;
            });
          }
        }

        await membershipsRef.set({
          plans: plansToSave,
          updatedAt: new Date()
        }, { merge: true });

        results.push({ tenantId, action: "updated", plansCount: plansToSave.length });
      } else {
        await membershipsRef.set({
          plans: defaultPlans,
          customNames: [],
          updatedAt: new Date()
        });
        results.push({ tenantId, action: "created", plansCount: defaultPlans.length });
      }
    }

    res.status(200).json({
      success: true,
      message: `Successfully seeded memberships config for ${results.length} tenants.`,
      results
    });
  } catch (error) {
    console.error("Migration error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});
