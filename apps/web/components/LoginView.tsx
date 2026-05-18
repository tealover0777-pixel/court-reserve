"use client";
import React, { useState, useEffect } from "react";
import RegisterForm from "./RegisterForm";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
} from "firebase/auth";
import { auth, db, storage } from "../lib/firebase";
import { doc, onSnapshot, setDoc, serverTimestamp, collection, query, where, getDocs, orderBy } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

type Tab = "signin" | "register";

export default function LoginView() {
  const [tab, setTab] = useState<Tab>("signin");

  // Sign-in state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Register — step control
  type RegStep = "credentials" | "profile";
  const [regStep, setRegStep] = useState<RegStep>("credentials");

  // Register — step 1
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regConfirm, setRegConfirm] = useState("");
  const [regTenantId, setRegTenantId] = useState("");
  const [tenantsLoading, setTenantsLoading] = useState(true);

  // Register — step 2 (profile)
  const [profFirstName, setProfFirstName] = useState("");
  const [profLastName, setProfLastName]  = useState("");
  const [profGender, setProfGender]      = useState("");
  const [profPhone, setProfPhone]        = useState("");
  const [profDobMonth, setProfDobMonth]  = useState("");
  const [profDobDay, setProfDobDay]      = useState("");
  const [profDobYear, setProfDobYear]    = useState("");
  const [profStreet, setProfStreet]      = useState("");
  const [profCity, setProfCity]          = useState("");
  const [profState, setProfState]        = useState("");
  const [profZip, setProfZip]            = useState("");
  const [profPortraitUrl, setProfPortraitUrl] = useState("");
  const [isUploadingPortrait, setIsUploadingPortrait] = useState(false);
  const [showPortraitSelector, setShowPortraitSelector] = useState(false);

  // Shared
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [globalTenant, setGlobalTenant] = useState<any>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [tenants, setTenants] = useState<{ id: string; name: string; tenant_id: string }[]>([]);
  const [genderDimensionItems, setGenderDimensionItems] = useState<string[]>([]);
  const [defaultPortraits, setDefaultPortraits] = useState<{ id: string; url: string; label: string }[]>([]);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "platform_company", "branding"), (snap) => {
      if (snap.exists()) setGlobalTenant(snap.data());
    });
    return () => unsub();
  }, []);

  // Live-subscribe to all tenants, filter client-side (avoids composite index requirement)
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "tenants"), (snap) => {
      const clubs = snap.docs
        .filter((d) => d.id !== "Global" && d.data().status === "Active")
        .map((d) => ({
          id: d.id,
          name: d.data().name as string,
          tenant_id: d.data().tenant_id as string,
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
      setTenants(clubs);
      setTenantsLoading(false);
    }, (err) => {
      console.error("Tenant fetch error:", err);
      setTenantsLoading(false);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const dimQuery = query(collection(db, "dimensions"), orderBy("category", "asc"));
    const unsub = onSnapshot(dimQuery, (snapshot) => {
      const items: string[] = [];
      snapshot.docs.forEach((d) => {
        const data = d.data();
        const cat = String(data.category || "").toLowerCase().replace(/\s+/g, "");
        if (cat === "gender" || cat.includes("gender")) {
          const raw = Array.isArray(data.items) ? data.items : [];
          raw.forEach((x: unknown) => {
            if (typeof x === "string" && x.trim()) items.push(x.trim());
          });
        }
      });
      setGenderDimensionItems([...new Set(items)].sort((a, b) => a.localeCompare(b)));
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const qPortraits = query(collection(db, "platform_company", "defaults", "portraits"), orderBy("label", "asc"));
    const unsub = onSnapshot(qPortraits, (snap) => {
      const p = snap.docs.map(d => ({
        id: d.id,
        url: d.data().url,
        label: d.data().label || "Portrait"
      }));
      setDefaultPortraits(p);
    });
    return () => unsub();
  }, []);

  // Reset register flow when switching tabs
  useEffect(() => {
    setError("");
    setSuccess("");
    setShowForgot(false);
    setRegStep("credentials");
    setRegEmail("");
    setRegPassword("");
    setRegConfirm("");
    setRegTenantId("");
    setProfFirstName("");
    setProfLastName("");
    setProfGender("");
    setProfPhone("");
    setProfDobMonth("");
    setProfDobDay("");
    setProfDobYear("");
    setProfStreet("");
    setProfCity("");
    setProfState("");
    setProfZip("");
    setProfPortraitUrl("");
    setShowPortraitSelector(false);
    setIsUploadingPortrait(false);
  }, [tab]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err: any) {
      const code = err?.code || "";
      if (code === "auth/user-not-found" || code === "auth/wrong-password" || code === "auth/invalid-credential") {
        setError("Invalid email or password. Please try again.");
      } else if (code === "auth/too-many-requests") {
        setError("Too many attempts. Please wait a moment and try again.");
      } else {
        setError("Sign in failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  /** True if a global_users row already exists for this email at the selected club (matches doc id or tenant slug). */
  const emailExistsForTenant = (emailLower: string, tenantDocId: string) => {
    const selected = tenants.find((t) => t.id === tenantDocId);
    const slug = selected?.tenant_id;
    return (snapDocs: { data: () => Record<string, unknown> }[]) =>
      snapDocs.some((d) => {
        const u = d.data() as Record<string, unknown>;
        const uEmail = String(u.email || "").trim().toLowerCase();
        if (uEmail !== emailLower) return false;
        const tid = u.tenantId ?? u.tenant_id;
        return (
          tid === tenantDocId ||
          tid === slug ||
          u.tenant_id === tenantDocId ||
          u.tenant_id === slug
        );
      });
  };

  // Step 1 — "Create Account": validate credentials + check email uniqueness in tenant, then Additional Info
  const handleCheckCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!regTenantId) {
      setError("Please select a club to continue.");
      return;
    }
    if (regPassword !== regConfirm) {
      setError("Passwords do not match.");
      return;
    }
    if (regPassword.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    const emailLower = regEmail.trim().toLowerCase();
    if (!emailLower) {
      setError("Please enter a valid email address.");
      return;
    }
    setLoading(true);
    try {
      // 1. Check if email already exists in this specific tenant
      const tenantUsersRef = collection(db, "tenants", regTenantId, "users");
      const qTenant = query(tenantUsersRef, where("email", "==", emailLower));
      const snapTenant = await getDocs(qTenant);
      
      if (!snapTenant.empty) {
        const selectedTenant = tenants.find((t) => t.id === regTenantId);
        setError(
          `This email is already registered at ${selectedTenant?.name || "this club"}. Please sign in or use a different email.`
        );
        return;
      }

      // 2. Check global_users (for existing legacy or platform accounts)
      const qGlobal = query(collection(db, "global_users"), where("email", "==", emailLower));
      const snapGlobal = await getDocs(qGlobal);
      const existsInGlobal = emailExistsForTenant(emailLower, regTenantId)(snapGlobal.docs);

      if (existsInGlobal) {
        const selectedTenant = tenants.find((t) => t.id === regTenantId);
        setError(
          `This email is already registered at ${selectedTenant?.name || "this club"}. Please sign in or use a different email.`
        );
        return;
      }

      setRegStep("profile");
    } catch (err) {
      console.error("Verification error:", err);
      setError("Could not verify email. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handlePortraitUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingPortrait(true);
    setError("");

    try {
      const tempId = Math.random().toString(36).substring(7);
      const storageRef = ref(storage, `temp_portraits/${tempId}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      setProfPortraitUrl(url);
    } catch (err) {
      console.error("Portrait upload error:", err);
      setError("Failed to upload photo. Please try again.");
    } finally {
      setIsUploadingPortrait(false);
    }
  };

  // Step 2 — create Auth user + Firestore member profile for selected tenant
  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (!profFirstName.trim() || !profLastName.trim()) {
      setError("First and last name are required.");
      return;
    }
    if (!regTenantId) {
      setError("Club selection is missing. Go back and select your club.");
      return;
    }
    setLoading(true);
    try {
      const emailLower = regEmail.trim().toLowerCase();
      
      // Calculate next user ID for this tenant: U10001, U10002...
      const tenantUsersRef = collection(db, "tenants", regTenantId, "users");
      const allTenantUsersSnap = await getDocs(tenantUsersRef);
      const ids = allTenantUsersSnap.docs.map(d => {
        const uid = d.data().user_id || "";
        const m = uid.match(/^U(\d+)$/);
        return m ? parseInt(m[1], 10) : 0;
      });
      const maxId = ids.length > 0 ? Math.max(...ids) : 0;
      const nextUserId = `U${Math.max(10001, maxId + 1)}`;

      const cred = await createUserWithEmailAndPassword(auth, regEmail.trim(), regPassword);
      const selectedTenant = tenants.find((t) => t.id === regTenantId);
      const dob =
        profDobYear && profDobMonth && profDobDay
          ? `${profDobYear}-${profDobMonth.padStart(2, "0")}-${profDobDay.padStart(2, "0")}`
          : "";

      // Create tenant-scoped user record (Strictly within tenants/{tenantId}/users)
      await setDoc(doc(db, "tenants", regTenantId, "users", nextUserId), {
        user_id: nextUserId,
        auth_uid: cred.user.uid,
        email: emailLower,
        first_name: profFirstName.trim(),
        last_name: profLastName.trim(),
        gender: profGender,
        phone: profPhone.trim(),
        date_of_birth: dob,
        address_street_1: profStreet.trim(),
        address_city: profCity.trim(),
        address_state: profState,
        address_zip: profZip.trim(),
        role: "R10001",
        roles: ["R10001"], // Default to Member
        status: "Active",
        membership: "FREE",
        tenant_id: selectedTenant?.tenant_id || regTenantId,
        tenantId: regTenantId,
        tenant_name: selectedTenant?.name || "",
        portrait_url: profPortraitUrl,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      });
      setRegStep("credentials");
      setRegEmail("");
      setRegPassword("");
      setRegConfirm("");
      setRegTenantId("");
      setProfFirstName("");
      setProfLastName("");
      setProfGender("");
      setProfPhone("");
      setProfDobMonth("");
      setProfDobDay("");
      setProfDobYear("");
      setProfStreet("");
      setProfCity("");
      setProfState("");
      setProfZip("");
    } catch (err: any) {
      const code = err?.code || "";
      if (code === "auth/email-already-in-use") setError("An account with this email already exists. Please sign in.");
      else if (code === "auth/weak-password") setError("Password is too weak. Use at least 6 characters.");
      else if (code === "auth/invalid-email") setError("Please enter a valid email address.");
      else setError("Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await sendPasswordResetEmail(auth, forgotEmail, {
        url: "https://court-reserve-9eeed.web.app/reset-password",
        handleCodeInApp: false,
      });
      setSuccess("Reset link sent! Check your inbox.");
      setShowForgot(false);
    } catch {
      setError("Could not send reset email. Check the address and try again.");
    } finally {
      setLoading(false);
    }
  };

  const clubName = globalTenant?.name || "Court Reserve";
  const logoUrl = globalTenant?.logo_url;

  // ─── Shared input class ───────────────────────────────────────────────────
  const inputCls =
    "w-full bg-[#fffcca] border border-[#bfbc7c]/30 rounded-2xl px-5 py-4 text-sm font-bold text-[#3b3a06] placeholder:text-[#686730]/40 outline-none focus:ring-2 focus:ring-[#556d00]/30 focus:border-[#556d00]/40 transition-all";

  return (
    <div className="min-h-screen w-full flex bg-[#fffbff]" style={{ fontFamily: "Manrope, sans-serif" }}>
      {/* ── Left Panel ──────────────────────────────────────────────────────── */}
      <div
        className="hidden lg:flex lg:w-[52%] flex-col justify-between p-16 relative overflow-hidden"
        style={{ background: "linear-gradient(145deg, #3b3a06 0%, #556d00 60%, #4b6000 100%)" }}
      >
        {/* Decorative lime accent blob */}
        <div className="absolute top-[-10%] right-[-15%] w-[55%] h-[55%] rounded-full opacity-15"
          style={{ background: "radial-gradient(circle, #cafd00 0%, transparent 70%)" }} />
        <div className="absolute bottom-[-5%] left-[-10%] w-[40%] h-[40%] rounded-full opacity-10"
          style={{ background: "radial-gradient(circle, #cafd00 0%, transparent 70%)" }} />

        {/* Court grid overlay */}
        <div className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: `
              linear-gradient(#cafd00 1px, transparent 1px),
              linear-gradient(90deg, #cafd00 1px, transparent 1px)
            `,
            backgroundSize: "80px 80px",
          }}
        />

        {/* Logo / Brand */}
        <div className="relative z-10">
          <div className="flex items-center gap-4 mb-6">
            {logoUrl ? (
              <img src={logoUrl} alt={clubName} className="h-12 w-auto object-contain" />
            ) : (
              <div className="w-12 h-12 bg-[#cafd00] rounded-2xl flex items-center justify-center shadow-lg">
                <span className="material-symbols-outlined text-[#3b3a06] text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                  sports_tennis
                </span>
              </div>
            )}
            <div>
              <h1
                className="text-2xl font-black uppercase tracking-tight text-white leading-none"
                style={{ fontFamily: "Lexend, sans-serif" }}
              >
                {clubName}
              </h1>
              <p className="text-[#cafd00] text-[10px] font-bold uppercase tracking-[0.25em] mt-0.5">
                The Kinetic Voice
              </p>
            </div>
          </div>
        </div>

        {/* Hero Text */}
        <div className="relative z-10 space-y-10">
          <div>
            <p className="text-[#cafd00] text-[10px] font-black uppercase tracking-[0.3em] mb-4">
              Secure Access
            </p>
            <h2
              className="text-[clamp(3rem,5vw,5.5rem)] font-black text-white uppercase leading-[0.88] tracking-tighter"
              style={{ fontFamily: "Lexend, sans-serif" }}
            >
              Elevate<br />
              Your<br />
              <span className="text-[#cafd00]">Perform-<br />ance.</span>
            </h2>
          </div>

          {/* Feature pills */}
          <div className="flex flex-wrap gap-3">
            {["Court Booking", "Live Schedules", "Club Programs", "Member Portal"].map((f) => (
              <span
                key={f}
                className="px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest"
                style={{ background: "rgba(202,253,0,0.12)", color: "#cafd00", border: "1px solid rgba(202,253,0,0.2)" }}
              >
                {f}
              </span>
            ))}
          </div>
        </div>

        {/* Bottom tagline */}
        <div className="relative z-10">
          <p className="text-white/40 text-[10px] font-bold uppercase tracking-[0.25em]">
            © {new Date().getFullYear()} {clubName.toUpperCase()} · All rights reserved
          </p>
        </div>
      </div>

      {/* ── Right Panel ─────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 lg:p-16 bg-[#fffbff] relative">
        {/* Mobile logo */}
        <div className="lg:hidden mb-10 flex flex-col items-center">
          {logoUrl ? (
            <img src={logoUrl} alt={clubName} className="h-12 w-auto object-contain mb-3" />
          ) : (
            <div className="w-12 h-12 bg-[#556d00] rounded-2xl flex items-center justify-center mb-3">
              <span className="material-symbols-outlined text-[#cafd00] text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                sports_tennis
              </span>
            </div>
          )}
          <h1
            className="text-xl font-black uppercase tracking-tight text-[#3b3a06]"
            style={{ fontFamily: "Lexend, sans-serif" }}
          >
            {clubName}
          </h1>
        </div>

        <div className="w-full max-w-[440px]">
          {/* Tab switcher */}
          {!showForgot && (
            <div className="flex mb-10 bg-[#fbf7a7] rounded-2xl p-1">
              {(["signin", "register"] as Tab[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`flex-1 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${
                    tab === t
                      ? "bg-white text-[#3b3a06] shadow-sm"
                      : "text-[#686730] hover:text-[#3b3a06]"
                  }`}
                >
                  {t === "signin" ? "Sign In" : "Register"}
                </button>
              ))}
            </div>
          )}

          {/* Success banner */}
          {success && (
            <div className="mb-6 px-5 py-4 rounded-2xl bg-[#cafd00]/20 border border-[#cafd00]/40 flex items-center gap-3 animate-in slide-in-from-top-2 duration-300">
              <span className="material-symbols-outlined text-[#556d00] text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>
                check_circle
              </span>
              <p className="text-[11px] font-black uppercase tracking-widest text-[#556d00]">{success}</p>
            </div>
          )}

          {/* Error banner (register errors show inside RegisterForm) */}
          {error && tab !== "register" && (
            <div className="mb-6 px-5 py-4 rounded-2xl bg-red-50 border border-red-100 flex items-center gap-3 animate-in slide-in-from-top-2 duration-300">
              <span className="material-symbols-outlined text-red-500 text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>
                error
              </span>
              <p className="text-[11px] font-black uppercase tracking-widest text-red-600">{error}</p>
            </div>
          )}

          {/* ── Forgot Password ─────────────────────────────────────── */}
          {showForgot ? (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <button
                onClick={() => { setShowForgot(false); setError(""); }}
                className="flex items-center gap-2 text-[#686730] text-[10px] font-black uppercase tracking-widest mb-8 hover:text-[#3b3a06] transition-colors"
              >
                <span className="material-symbols-outlined text-base">arrow_back</span>
                Back to Sign In
              </button>
              <h3
                className="text-3xl font-black text-[#3b3a06] uppercase tracking-tight mb-2"
                style={{ fontFamily: "Lexend, sans-serif" }}
              >
                Reset Password
              </h3>
              <p className="text-[#686730] text-sm font-medium mb-8">
                Enter your email and we'll send you a reset link.
              </p>
              <form onSubmit={handleForgotPassword} className="space-y-5">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-[#686730] mb-2 block">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    required
                    placeholder="name@example.com"
                    className={inputCls}
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest text-[#3b3a06] transition-all hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-3"
                  style={{ background: "linear-gradient(135deg, #cafd00 0%, #beee00 100%)" }}
                >
                  {loading ? (
                    <div className="w-4 h-4 border-2 border-[#3b3a06]/30 border-t-[#3b3a06] rounded-full animate-spin" />
                  ) : (
                    <>Send Reset Link <span className="material-symbols-outlined text-sm">send</span></>
                  )}
                </button>
              </form>
            </div>
          ) : tab === "signin" ? (
            /* ── Sign In Form ──────────────────────────────────────── */
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <h3
                className="text-3xl font-black text-[#3b3a06] uppercase tracking-tight mb-2"
                style={{ fontFamily: "Lexend, sans-serif" }}
              >
                Sign In
              </h3>
              <p className="text-[#686730] text-sm font-medium mb-8">
                Enter your credentials to access the archive and manage your elite court experience.
              </p>

              <form onSubmit={handleLogin} className="space-y-5">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-[#686730] mb-2 block">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="name@example.com"
                    className={inputCls}
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-[#686730]">
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => { setShowForgot(true); setError(""); }}
                      className="text-[10px] font-black uppercase tracking-widest text-[#556d00] hover:text-[#3b3a06] transition-colors"
                    >
                      Forgot?
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      placeholder="••••••••"
                      className={`${inputCls} pr-14`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-5 top-1/2 -translate-y-1/2 text-[#686730] hover:text-[#3b3a06] transition-colors"
                    >
                      <span className="material-symbols-outlined text-lg">
                        {showPassword ? "visibility_off" : "visibility"}
                      </span>
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-5 rounded-2xl text-[11px] font-black uppercase tracking-widest text-[#3b3a06] transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-60 flex items-center justify-center gap-3 mt-2"
                  style={{ background: "linear-gradient(135deg, #cafd00 0%, #beee00 100%)" }}
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-[#3b3a06]/30 border-t-[#3b3a06] rounded-full animate-spin" />
                  ) : (
                    <>
                      Sign In
                      <span className="material-symbols-outlined text-sm">arrow_forward</span>
                    </>
                  )}
                </button>
              </form>

              <p className="mt-8 text-center text-[11px] font-bold text-[#686730]">
                New to the club?{" "}
                <button
                  onClick={() => setTab("register")}
                  className="font-black text-[#556d00] underline underline-offset-2 hover:text-[#3b3a06] transition-colors"
                >
                  Request Membership
                </button>
              </p>
            </div>
          ) : (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <RegisterForm
                step={regStep}
                regTenantId={regTenantId}
                setRegTenantId={(v) => {
                  setRegTenantId(v);
                  setError("");
                }}
                regEmail={regEmail}
                setRegEmail={setRegEmail}
                regPassword={regPassword}
                setRegPassword={setRegPassword}
                regConfirm={regConfirm}
                setRegConfirm={setRegConfirm}
                tenants={tenants}
                tenantsLoading={tenantsLoading}
                onCredentials={handleCheckCredentials}
                profFirstName={profFirstName}
                setProfFirstName={setProfFirstName}
                profLastName={profLastName}
                setProfLastName={setProfLastName}
                profGender={profGender}
                setProfGender={setProfGender}
                profPhone={profPhone}
                setProfPhone={setProfPhone}
                profDobMonth={profDobMonth}
                setProfDobMonth={setProfDobMonth}
                profDobDay={profDobDay}
                setProfDobDay={setProfDobDay}
                profDobYear={profDobYear}
                setProfDobYear={setProfDobYear}
                profStreet={profStreet}
                setProfStreet={setProfStreet}
                profCity={profCity}
                setProfCity={setProfCity}
                profState={profState}
                setProfState={setProfState}
                profZip={profZip}
                setProfZip={setProfZip}
                profPortraitUrl={profPortraitUrl}
                setProfPortraitUrl={setProfPortraitUrl}
                isUploadingPortrait={isUploadingPortrait}
                onPortraitUpload={handlePortraitUpload}
                showPortraitSelector={showPortraitSelector}
                setShowPortraitSelector={setShowPortraitSelector}
                defaultPortraits={defaultPortraits}
                genderOptions={genderDimensionItems}
                onCreateAccount={handleCreateAccount}
                onBack={() => {
                  setRegStep("credentials");
                  setError("");
                }}
                loading={loading}
                error={error}
                inputCls={inputCls}
                onSignIn={() => setTab("signin")}
              />
            </div>
          )}

          {/* Footer */}
          <p className="mt-12 text-center text-[10px] font-bold text-[#bfbc7c] uppercase tracking-[0.2em]">
            © {new Date().getFullYear()} {clubName.toUpperCase()} · All rights reserved
          </p>
        </div>
      </div>
    </div>
  );
}
