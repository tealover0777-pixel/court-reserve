"use client";
import React, { useState } from "react";
import DashboardClient from "../components/DashboardClient";
import { useTenant } from "../context/TenantContext";
import { auth } from "../lib/firebase";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";

export default function Home() {
  const { tenantId, loading } = useTenant();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setAuthError(null);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err: any) {
      setAuthError(err.message || "Failed to log in. Please check your credentials.");
    } finally {
      setIsLoggingIn(false);
    }
  };

  if (tenantId) {
    return <DashboardClient params={{ tenantId }} />;
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-6 text-on-background selection:bg-primary/30">
      <div className="w-full max-w-md bg-white p-12 rounded-[40px] shadow-2xl space-y-10 animate-in fade-in zoom-in-95 duration-700">
        <div className="text-center">
          <h1 className="text-5xl font-black tracking-tighter text-[#4f6b28] italic uppercase mb-2" style={{ fontFamily: 'Lexend, sans-serif' }}>
            COURT RESERVE
          </h1>
          <p className="text-stone-400 font-bold uppercase tracking-widest text-[10px]">
            Elite Management Portal
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-2">Member Email</label>
            <input 
              type="email" 
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="alex@kinetic.com"
              className="w-full bg-[#f7f8f2] border-none rounded-2xl px-6 py-4 focus:ring-2 focus:ring-[#4f6b28] font-medium"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-2">Secure Password</label>
            <input 
              type="password" 
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-[#f7f8f2] border-none rounded-2xl px-6 py-4 focus:ring-2 focus:ring-[#4f6b28] font-medium"
            />
          </div>

          {authError && (
            <div className="p-4 bg-red-50 text-red-600 rounded-2xl text-xs font-bold leading-relaxed">
              {authError}
            </div>
          )}

          <button 
            type="submit"
            disabled={isLoggingIn}
            className="w-full py-5 bg-[#4f6b28] text-white font-black rounded-2xl shadow-xl shadow-[#4f6b28]/20 hover:scale-[1.02] active:scale-95 transition-all uppercase tracking-widest flex items-center justify-center gap-3 disabled:opacity-50"
          >
            {isLoggingIn ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent animate-spin rounded-full" />
            ) : (
              <>
                AUTHENTICATE
                <span className="material-symbols-outlined">key</span>
              </>
            )}
          </button>
        </form>

        <div className="text-center">
          <p className="text-stone-400 text-[10px] font-medium">
            Protected by enterprise-grade security.
          </p>
        </div>
      </div>
      
      {/* Background decoration */}
      <div className="fixed -z-10 top-0 left-0 w-full h-full overflow-hidden opacity-20 pointer-events-none">
        <div className="absolute -top-1/4 -left-1/4 w-[600px] h-[600px] bg-[#4f6b28] rounded-full blur-[120px]"></div>
        <div className="absolute -bottom-1/4 -right-1/4 w-[600px] h-[600px] bg-[#cfff00] rounded-full blur-[120px]"></div>
      </div>
    </div>
  );
}
