"use client";
import React, { useState, useEffect } from "react";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
} from "firebase/auth";
import { auth, db } from "../lib/firebase";
import { doc, onSnapshot, setDoc, serverTimestamp, collection, getDocs, query, where, orderBy } from "firebase/firestore";

type Tab = "signin" | "register";

export default function LoginView() {
  const [tab, setTab] = useState<Tab>("signin");

  // Sign-in state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Register state
  const [regFirstName, setRegFirstName] = useState("");
  const [regLastName, setRegLastName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regConfirm, setRegConfirm] = useState("");
  const [regTenantId, setRegTenantId] = useState("");

  // Shared
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [globalTenant, setGlobalTenant] = useState<any>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [tenants, setTenants] = useState<{ id: string; name: string; tenant_id: string }[]>([]);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "tenants", "Global"), (snap) => {
      if (snap.exists()) setGlobalTenant(snap.data());
    });
    return () => unsub();
  }, []);

  // Fetch active tenants for club selector (exclude Global)
  useEffect(() => {
    const q = query(
      collection(db, "tenants"),
      where("status", "==", "Active"),
      orderBy("name")
    );
    getDocs(q).then((snap) => {
      const clubs = snap.docs
        .filter((d) => d.id !== "Global")
        .map((d) => ({
          id: d.id,
          name: d.data().name as string,
          tenant_id: d.data().tenant_id as string,
        }));
      setTenants(clubs);
    }).catch(() => {
      // Firestore rules may prevent unauthenticated reads — silently skip
    });
  }, []);

  // Reset errors when switching tabs
  useEffect(() => {
    setError("");
    setSuccess("");
    setShowForgot(false);
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

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (regPassword !== regConfirm) {
      setError("Passwords do not match.");
      return;
    }
    if (regPassword.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, regEmail, regPassword);
      // Create global_users profile
      const selectedTenant = tenants.find((t) => t.id === regTenantId);
      await setDoc(doc(db, "global_users", cred.user.uid), {
        user_id: cred.user.uid,
        auth_uid: cred.user.uid,
        first_name: regFirstName.trim(),
        last_name: regLastName.trim(),
        email: regEmail.trim().toLowerCase(),
        roles: [],
        status: "Active",
        ...(regTenantId && {
          tenant_id: selectedTenant?.tenant_id || regTenantId,
          tenantId: regTenantId,
          tenant_name: selectedTenant?.name || "",
        }),
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      });
    } catch (err: any) {
      const code = err?.code || "";
      if (code === "auth/email-already-in-use") {
        setError("An account with this email already exists. Please sign in.");
      } else if (code === "auth/weak-password") {
        setError("Password is too weak. Use at least 6 characters.");
      } else if (code === "auth/invalid-email") {
        setError("Please enter a valid email address.");
      } else {
        setError("Registration failed. Please try again.");
      }
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

          {/* Error banner */}
          {error && (
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
            /* ── Register Form ─────────────────────────────────────── */
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <h3
                className="text-3xl font-black text-[#3b3a06] uppercase tracking-tight mb-2"
                style={{ fontFamily: "Lexend, sans-serif" }}
              >
                Join the Club
              </h3>
              <p className="text-[#686730] text-sm font-medium mb-8">
                Create your member account and secure your spot on the court.
              </p>

              <form onSubmit={handleRegister} className="space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-[#686730] mb-2 block">
                      First Name
                    </label>
                    <input
                      type="text"
                      value={regFirstName}
                      onChange={(e) => setRegFirstName(e.target.value)}
                      required
                      placeholder="Alex"
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-[#686730] mb-2 block">
                      Last Name
                    </label>
                    <input
                      type="text"
                      value={regLastName}
                      onChange={(e) => setRegLastName(e.target.value)}
                      required
                      placeholder="Sterling"
                      className={inputCls}
                    />
                  </div>
                </div>

                {/* ── Club / Facility Selector ── */}
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-[#686730] mb-2 block">
                    Club / Facility
                    <span className="ml-2 text-[#bfbc7c] normal-case tracking-normal font-bold">
                      (optional)
                    </span>
                  </label>
                  <div className="relative">
                    <span
                      className="material-symbols-outlined absolute left-5 top-1/2 -translate-y-1/2 text-[#686730]/50 text-lg pointer-events-none"
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      sports_tennis
                    </span>
                    <select
                      value={regTenantId}
                      onChange={(e) => setRegTenantId(e.target.value)}
                      className="w-full bg-[#fffcca] border border-[#bfbc7c]/30 rounded-2xl pl-14 pr-10 py-4 text-sm font-bold text-[#3b3a06] outline-none focus:ring-2 focus:ring-[#556d00]/30 focus:border-[#556d00]/40 transition-all appearance-none cursor-pointer"
                      style={{
                        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23686730' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
                        backgroundRepeat: "no-repeat",
                        backgroundPosition: "right 16px center",
                      }}
                    >
                      <option value="">— Select a club to join —</option>
                      {tenants.length === 0 && (
                        <option value="" disabled>Loading clubs…</option>
                      )}
                      {tenants.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  {regTenantId && (
                    <div className="mt-2 flex items-center gap-2 animate-in slide-in-from-top-1 duration-200">
                      <span
                        className="material-symbols-outlined text-[#556d00] text-sm"
                        style={{ fontVariationSettings: "'FILL' 1" }}
                      >
                        check_circle
                      </span>
                      <p className="text-[10px] font-black uppercase tracking-widest text-[#556d00]">
                        Joining: {tenants.find((t) => t.id === regTenantId)?.name}
                      </p>
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-[#686730] mb-2 block">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    required
                    placeholder="name@example.com"
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-[#686730] mb-2 block">
                    Password
                  </label>
                  <input
                    type="password"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    required
                    placeholder="Min. 6 characters"
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-[#686730] mb-2 block">
                    Confirm Password
                  </label>
                  <input
                    type="password"
                    value={regConfirm}
                    onChange={(e) => setRegConfirm(e.target.value)}
                    required
                    placeholder="Repeat password"
                    className={`${inputCls} ${regConfirm && regConfirm !== regPassword ? "border-red-300 ring-2 ring-red-100" : ""}`}
                  />
                  {regConfirm && regConfirm !== regPassword && (
                    <p className="mt-1.5 text-[10px] font-bold text-red-500 uppercase tracking-widest">
                      Passwords don't match
                    </p>
                  )}
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
                      Create Account
                      <span className="material-symbols-outlined text-sm">person_add</span>
                    </>
                  )}
                </button>
              </form>

              <p className="mt-8 text-center text-[11px] font-bold text-[#686730]">
                Already a member?{" "}
                <button
                  onClick={() => setTab("signin")}
                  className="font-black text-[#556d00] underline underline-offset-2 hover:text-[#3b3a06] transition-colors"
                >
                  Sign In
                </button>
              </p>
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
