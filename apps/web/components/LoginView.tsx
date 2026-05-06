"use client";
import React, { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth, db } from "../lib/firebase";
import { doc, onSnapshot } from "firebase/firestore";
import { useEffect } from "react";

export default function LoginView() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [globalTenant, setGlobalTenant] = useState<any>(null);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "tenants", "Global"), (snap) => {
      if (snap.exists()) setGlobalTenant(snap.data());
    });
    return () => unsub();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err: any) {
      console.error("Login failed:", err);
      setError("Invalid email or password. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#f8f9fa] relative overflow-hidden">
      {/* Abstract Background Elements */}
      <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-[#6348eb]/5 rounded-full blur-[120px] animate-pulse"></div>
      <div className="absolute bottom-[-10%] left-[-10%] w-[30%] h-[30%] bg-[#4f6b28]/5 rounded-full blur-[100px]"></div>

      <div className="w-full max-w-[440px] px-6 relative z-10">
        <div className="bg-white rounded-[40px] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.08)] border border-stone-100 p-12 animate-in fade-in zoom-in duration-700">
          {/* Logo/Brand */}
          <div className="flex flex-col items-center mb-12">
            {globalTenant?.logo_url ? (
              <img src={globalTenant.logo_url} alt="Logo" className="h-16 w-auto object-contain mb-6" />
            ) : (
              <div className="w-16 h-16 bg-[#6348eb] rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-[#6348eb]/20 transform rotate-3">
                <span className="material-symbols-outlined text-white text-3xl">sports_tennis</span>
              </div>
            )}
            <h1 className="text-3xl font-black italic tracking-tighter text-stone-900 uppercase" style={{ fontFamily: 'Lexend, sans-serif' }}>
              {globalTenant?.name || "Platform Infrastructure"}
            </h1>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-400 mt-2">Platform Infrastructure</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-3 block ml-1">Email Address</label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-5 top-1/2 -translate-y-1/2 text-stone-300 text-lg">mail</span>
                <input 
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  required
                  className="w-full bg-stone-50 border-none rounded-2xl pl-14 pr-6 py-4 text-sm font-bold text-stone-900 placeholder:text-stone-300 outline-none focus:ring-2 focus:ring-[#6348eb]/20 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-3 block ml-1">Password</label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-5 top-1/2 -translate-y-1/2 text-stone-300 text-lg">lock</span>
                <input 
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full bg-stone-50 border-none rounded-2xl pl-14 pr-6 py-4 text-sm font-bold text-stone-900 placeholder:text-stone-300 outline-none focus:ring-2 focus:ring-[#6348eb]/20 transition-all"
                />
              </div>
            </div>

            {error && (
              <div className="bg-red-50 text-red-500 text-[10px] font-black uppercase tracking-widest px-4 py-3 rounded-xl border border-red-100 animate-in slide-in-from-top-2 duration-300">
                {error}
              </div>
            )}

            <button 
              type="submit"
              disabled={loading}
              className="w-full bg-[#6348eb] text-white py-5 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-[#6348eb]/20 hover:opacity-95 active:scale-[0.98] transition-all flex items-center justify-center gap-3 disabled:opacity-70"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Authenticating...
                </>
              ) : (
                <>
                  Sign In
                  <span className="material-symbols-outlined text-sm">arrow_forward</span>
                </>
              )}
            </button>
          </form>

          <div className="mt-12 pt-8 border-t border-stone-50 text-center">
            <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">
              Authorized Personnel Only
            </p>
          </div>
        </div>
        
        <p className="text-center mt-8 text-stone-400 text-[10px] font-medium uppercase tracking-widest">
          &copy; 2026 {globalTenant?.name || "Platform Infrastructure"}
        </p>
      </div>
    </div>
  );
}
