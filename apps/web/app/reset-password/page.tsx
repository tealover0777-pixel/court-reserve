"use client";
import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  verifyPasswordResetCode,
  confirmPasswordReset,
  applyActionCode,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { auth, db } from "../../lib/firebase";
import { doc, onSnapshot } from "firebase/firestore";
import { useRouter } from "next/navigation";

/* ─────────────────────────────────────────────────────────────────────────────
   Inner component (uses useSearchParams — must be inside <Suspense>)
───────────────────────────────────────────────────────────────────────────── */
function ResetPasswordInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const oobCode = searchParams.get("oobCode") || "";
  const mode = searchParams.get("mode") || "resetPassword";

  const [globalTenant, setGlobalTenant] = useState<any>(null);
  const [stage, setStage] = useState<"verifying" | "form" | "success" | "error">("verifying");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Fetch club branding
  useEffect(() => {
    const unsub = onSnapshot(doc(db, "tenants", "Global"), (snap) => {
      if (snap.exists()) setGlobalTenant(snap.data());
    });
    return () => unsub();
  }, []);

  // Verify the action code on mount
  useEffect(() => {
    if (!oobCode) {
      setErrorMsg("Invalid or expired link. Please request a new one.");
      setStage("error");
      return;
    }

    if (mode === "verifyEmail") {
      // Handle email verification action codes
      applyActionCode(auth, oobCode)
        .then(() => setStage("success"))
        .catch((err) => {
          setErrorMsg(friendlyError(err.code));
          setStage("error");
        });
      return;
    }

    // resetPassword mode
    verifyPasswordResetCode(auth, oobCode)
      .then((emailFromCode) => {
        setEmail(emailFromCode);
        setStage("form");
      })
      .catch((err) => {
        setErrorMsg(friendlyError(err.code));
        setStage("error");
      });
  }, [oobCode, mode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (password !== confirm) {
      setErrorMsg("Passwords do not match.");
      return;
    }
    if (password.length < 6) {
      setErrorMsg("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    try {
      await confirmPasswordReset(auth, oobCode, password);
      // Auto sign in after password reset
      if (mode === "resetPassword") {
        await signInWithEmailAndPassword(auth, email, password);
      }
      setStage("success");
    } catch (err: any) {
      setErrorMsg(friendlyError(err.code));
    } finally {
      setLoading(false);
    }
  };

  const clubName = globalTenant?.name || "Court Reserve";
  const logoUrl = globalTenant?.logo_url;

  const inputCls =
    "w-full bg-[#fffcca] border border-[#bfbc7c]/30 rounded-2xl px-5 py-4 text-sm font-bold text-[#3b3a06] placeholder:text-[#686730]/40 outline-none focus:ring-2 focus:ring-[#556d00]/30 focus:border-[#556d00]/40 transition-all";

  return (
    <div
      className="min-h-screen w-full flex bg-[#fffbff]"
      style={{ fontFamily: "Manrope, sans-serif" }}
    >
      {/* ── Left Panel ──────────────────────────────────────────────────────── */}
      <div
        className="hidden lg:flex lg:w-[52%] flex-col justify-between p-16 relative overflow-hidden"
        style={{
          background: "linear-gradient(145deg, #3b3a06 0%, #556d00 60%, #4b6000 100%)",
        }}
      >
        {/* Lime accent blobs */}
        <div
          className="absolute top-[-10%] right-[-15%] w-[55%] h-[55%] rounded-full opacity-15"
          style={{ background: "radial-gradient(circle, #cafd00 0%, transparent 70%)" }}
        />
        <div
          className="absolute bottom-[-5%] left-[-10%] w-[40%] h-[40%] rounded-full opacity-10"
          style={{ background: "radial-gradient(circle, #cafd00 0%, transparent 70%)" }}
        />
        {/* Court grid overlay */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: `
              linear-gradient(#cafd00 1px, transparent 1px),
              linear-gradient(90deg, #cafd00 1px, transparent 1px)
            `,
            backgroundSize: "80px 80px",
          }}
        />

        {/* Logo */}
        <div className="relative z-10">
          <div className="flex items-center gap-4 mb-6">
            {logoUrl ? (
              <img src={logoUrl} alt={clubName} className="h-12 w-auto object-contain" />
            ) : (
              <div className="w-12 h-12 bg-[#cafd00] rounded-2xl flex items-center justify-center shadow-lg">
                <span
                  className="material-symbols-outlined text-[#3b3a06] text-2xl"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
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

        {/* Hero copy */}
        <div className="relative z-10 space-y-10">
          <div>
            <p className="text-[#cafd00] text-[10px] font-black uppercase tracking-[0.3em] mb-4">
              Account Security
            </p>
            <h2
              className="text-[clamp(3rem,5vw,5.5rem)] font-black text-white uppercase leading-[0.88] tracking-tighter"
              style={{ fontFamily: "Lexend, sans-serif" }}
            >
              Secure<br />
              Your<br />
              <span className="text-[#cafd00]">Account.</span>
            </h2>
          </div>
          <p className="text-white/60 text-sm font-medium max-w-xs leading-relaxed">
            Set a strong password to protect your court reservations and member profile.
          </p>
        </div>

        {/* Footer */}
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
              <span
                className="material-symbols-outlined text-[#cafd00] text-2xl"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
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

          {/* ── Verifying ── */}
          {stage === "verifying" && (
            <div className="flex flex-col items-center gap-6 animate-in fade-in duration-500">
              <div className="w-16 h-16 rounded-full border-4 border-[#cafd00] border-t-transparent animate-spin" />
              <p className="text-[11px] font-black uppercase tracking-widest text-[#686730]">
                Verifying your link…
              </p>
            </div>
          )}

          {/* ── Error ── */}
          {stage === "error" && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-8">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center flex-shrink-0">
                  <span
                    className="material-symbols-outlined text-red-500 text-2xl"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    error
                  </span>
                </div>
                <div>
                  <h3
                    className="text-2xl font-black text-[#3b3a06] uppercase tracking-tight"
                    style={{ fontFamily: "Lexend, sans-serif" }}
                  >
                    Link Expired
                  </h3>
                  <p className="text-[#686730] text-sm font-medium mt-1">{errorMsg}</p>
                </div>
              </div>
              <a
                href="/"
                className="w-full py-5 rounded-2xl text-[11px] font-black uppercase tracking-widest text-[#3b3a06] transition-all hover:opacity-90 flex items-center justify-center gap-3"
                style={{ background: "linear-gradient(135deg, #cafd00 0%, #beee00 100%)" }}
              >
                Back to Sign In
                <span className="material-symbols-outlined text-sm">arrow_forward</span>
              </a>
            </div>
          )}

          {/* ── Password Form ── */}
          {stage === "form" && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <h3
                className="text-3xl font-black text-[#3b3a06] uppercase tracking-tight mb-2"
                style={{ fontFamily: "Lexend, sans-serif" }}
              >
                {mode === "resetPassword" ? "Set New Password" : "Activate Account"}
              </h3>
              <p className="text-[#686730] text-sm font-medium mb-8">
                {email ? (
                  <>
                    Creating password for{" "}
                    <span className="font-black text-[#3b3a06]">{email}</span>
                  </>
                ) : (
                  "Choose a strong password for your account."
                )}
              </p>

              {errorMsg && (
                <div className="mb-6 px-5 py-4 rounded-2xl bg-red-50 border border-red-100 flex items-center gap-3 animate-in slide-in-from-top-2 duration-300">
                  <span
                    className="material-symbols-outlined text-red-500 text-lg"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    error
                  </span>
                  <p className="text-[11px] font-black uppercase tracking-widest text-red-600">
                    {errorMsg}
                  </p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-[#686730] mb-2 block">
                    New Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      placeholder="Min. 6 characters"
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
                  {/* Password strength hint */}
                  {password && (
                    <div className="mt-2 flex gap-1.5">
                      {[6, 8, 12].map((len, i) => (
                        <div
                          key={i}
                          className={`h-1 flex-1 rounded-full transition-colors ${
                            password.length >= len ? "bg-[#cafd00]" : "bg-[#efec93]"
                          }`}
                        />
                      ))}
                      <span className="text-[9px] font-black uppercase tracking-widest text-[#686730] ml-1">
                        {password.length < 6 ? "Weak" : password.length < 10 ? "Fair" : "Strong"}
                      </span>
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-[#686730] mb-2 block">
                    Confirm Password
                  </label>
                  <input
                    type="password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    required
                    placeholder="Repeat password"
                    className={`${inputCls} ${
                      confirm && confirm !== password
                        ? "border-red-300 ring-2 ring-red-100"
                        : ""
                    }`}
                  />
                  {confirm && confirm !== password && (
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
                      Set Password &amp; Sign In
                      <span className="material-symbols-outlined text-sm">lock_open</span>
                    </>
                  )}
                </button>
              </form>
            </div>
          )}

          {/* ── Success ── */}
          {stage === "success" && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-8">
              {/* Animated checkmark */}
              <div className="flex items-center gap-4">
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0"
                  style={{ background: "linear-gradient(135deg, #cafd00 0%, #beee00 100%)" }}
                >
                  <span
                    className="material-symbols-outlined text-[#3b3a06] text-2xl"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    check_circle
                  </span>
                </div>
                <div>
                  <h3
                    className="text-2xl font-black text-[#3b3a06] uppercase tracking-tight"
                    style={{ fontFamily: "Lexend, sans-serif" }}
                  >
                    {mode === "verifyEmail" ? "Email Verified!" : "Password Set!"}
                  </h3>
                  <p className="text-[#686730] text-sm font-medium mt-1">
                    {mode === "verifyEmail"
                      ? "Your email has been verified. You can now sign in."
                      : "Your password has been updated. You are now signed in."}
                  </p>
                </div>
              </div>

              <a
                href="/"
                className="w-full py-5 rounded-2xl text-[11px] font-black uppercase tracking-widest text-[#3b3a06] transition-all hover:opacity-90 flex items-center justify-center gap-3"
                style={{ background: "linear-gradient(135deg, #cafd00 0%, #beee00 100%)" }}
              >
                {mode === "verifyEmail" ? "Continue to Sign In" : "Continue to Dashboard"}
                <span className="material-symbols-outlined text-sm">arrow_forward</span>
              </a>
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

/* ─────────────────────────────────────────────────────────────────────────────
   Error code → friendly message
───────────────────────────────────────────────────────────────────────────── */
function friendlyError(code: string): string {
  switch (code) {
    case "auth/expired-action-code":
      return "This link has expired. Please request a new password reset.";
    case "auth/invalid-action-code":
      return "This link is invalid or has already been used. Please request a new one.";
    case "auth/user-disabled":
      return "This account has been disabled. Contact support.";
    case "auth/user-not-found":
      return "No account found for this link. Please register first.";
    case "auth/weak-password":
      return "Password is too weak. Use at least 6 characters.";
    default:
      return "Something went wrong. Please try again or request a new link.";
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
   Page export — wrapped in Suspense for useSearchParams
───────────────────────────────────────────────────────────────────────────── */
export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen w-full items-center justify-center bg-[#fffbff]">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-[#cafd00] border-t-transparent" />
        </div>
      }
    >
      <ResetPasswordInner />
    </Suspense>
  );
}
