"use client";
import React, { useRef } from "react";
import { Modal } from "@repo/ui/modal";

const US_STATES = ["AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY"];
const MONTHS = ["01","02","03","04","05","06","07","08","09","10","11","12"];
const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];

const selectCls = "w-full bg-[#fffcca] border border-[#bfbc7c]/30 rounded-2xl px-5 py-4 text-sm font-bold text-[#3b3a06] outline-none focus:ring-2 focus:ring-[#556d00]/30 transition-all appearance-none cursor-pointer";
const chevron = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23686730' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`;

interface Props {
  step: "credentials" | "profile";
  // step 1
  regTenantId: string; setRegTenantId: (v:string)=>void;
  regEmail: string; setRegEmail: (v:string)=>void;
  regPassword: string; setRegPassword: (v:string)=>void;
  regConfirm: string; setRegConfirm: (v:string)=>void;
  tenants: {id:string;name:string}[];
  tenantsLoading: boolean;
  onCredentials: (e:React.FormEvent)=>void;
  // step 2
  profFirstName:string; setProfFirstName:(v:string)=>void;
  profLastName:string;  setProfLastName:(v:string)=>void;
  profGender:string;    setProfGender:(v:string)=>void;
  profPhone:string;     setProfPhone:(v:string)=>void;
  profDobMonth:string;  setProfDobMonth:(v:string)=>void;
  profDobDay:string;    setProfDobDay:(v:string)=>void;
  profDobYear:string;   setProfDobYear:(v:string)=>void;
  profStreet:string;    setProfStreet:(v:string)=>void;
  profCity:string;      setProfCity:(v:string)=>void;
  profState:string;     setProfState:(v:string)=>void;
  profZip:string;       setProfZip:(v:string)=>void;
  onCreateAccount: (e:React.FormEvent)=>void;
  onBack: ()=>void;
  genderOptions: string[];
  // portraits
  profPortraitUrl: string;
  setProfPortraitUrl: (v:string)=>void;
  isUploadingPortrait: boolean;
  onPortraitUpload: (e:React.ChangeEvent<HTMLInputElement>)=>void;
  showPortraitSelector: boolean;
  setShowPortraitSelector: (v:boolean)=>void;
  defaultPortraits: {id:string; url:string; label:string}[];
  // shared
  loading: boolean;
  error: string;
  inputCls: string;
  onSignIn: ()=>void;
}

export default function RegisterForm(p: Props) {
  const selectedClubName = p.tenants.find(t => t.id === p.regTenantId)?.name;

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        {p.step === "profile" && (
          <button type="button" onClick={p.onBack}
            className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-[#fffcca] text-[#686730] transition-colors">
            <span className="material-symbols-outlined text-lg">arrow_back</span>
          </button>
        )}
        <h3 className="text-3xl font-black text-[#3b3a06] uppercase tracking-tight"
          style={{fontFamily:"Lexend, sans-serif"}}>
          {p.step === "credentials" ? "Join the Club" : "Additional Info"}
        </h3>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-6">
        <div className={`h-1.5 flex-1 rounded-full transition-all ${p.step === "credentials" ? "bg-[#cafd00]" : "bg-[#cafd00]"}`}/>
        <div className={`h-1.5 flex-1 rounded-full transition-all ${p.step === "profile" ? "bg-[#cafd00]" : "bg-[#bfbc7c]/30"}`}/>
        <span className="text-[9px] font-black uppercase tracking-widest text-[#686730]">
          {p.step === "credentials" ? "Account" : "Details"} · Step {p.step === "credentials" ? "1" : "2"} of 2
        </span>
      </div>

      <p className="text-[#686730] text-sm font-medium mb-6">
        {p.step === "credentials"
          ? "Select your club, then choose Create Account. We will check that your email is not already registered at that club."
          : `Enter your details to finish joining ${selectedClubName || "the club"}.`}
      </p>

      {/* Error */}
      {p.error && (
        <div className="mb-5 px-4 py-3 rounded-2xl bg-red-50 border border-red-100 flex items-center gap-3 animate-in slide-in-from-top-2 duration-200">
          <span className="material-symbols-outlined text-red-500 text-lg" style={{fontVariationSettings:"'FILL' 1"}}>error</span>
          <p className="text-[11px] font-black uppercase tracking-widest text-red-600">{p.error}</p>
        </div>
      )}

      {/* ── STEP 1: Credentials ── */}
      {p.step === "credentials" && (
        <form onSubmit={p.onCredentials} className="space-y-5">
          {/* Club selector */}
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-[#686730] mb-2 flex items-center gap-2">
              Club / Facility
              <span className="px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest bg-[#cafd00] text-[#3b3a06]">Required</span>
            </label>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-5 top-1/2 -translate-y-1/2 text-lg pointer-events-none transition-colors"
                style={{fontVariationSettings:"'FILL' 1", color: p.regTenantId ? "#556d00" : "rgba(104,103,48,0.5)"}}>
                sports_tennis
              </span>
              <select value={p.regTenantId} onChange={e=>{p.setRegTenantId(e.target.value);}} required
                className={`w-full rounded-2xl pl-14 pr-10 py-4 text-sm font-bold outline-none transition-all appearance-none cursor-pointer border ${p.regTenantId ? "bg-[#fffcca] border-[#556d00]/40 text-[#3b3a06] ring-2 ring-[#556d00]/20" : "bg-[#fffcca] border-[#bfbc7c]/30 text-[#686730]"}`}
                style={{backgroundImage:chevron, backgroundRepeat:"no-repeat", backgroundPosition:"right 16px center"}}>
                <option value="">{p.tenantsLoading ? "Loading clubs…" : "— Select your club —"}</option>
                {p.tenants.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            {p.regTenantId ? (
              <div className="mt-2 flex items-center gap-2 animate-in slide-in-from-top-1 duration-200">
                <span className="material-symbols-outlined text-[#556d00] text-sm" style={{fontVariationSettings:"'FILL' 1"}}>check_circle</span>
                <p className="text-[10px] font-black uppercase tracking-widest text-[#556d00]">Joining · {selectedClubName}</p>
              </div>
            ) : (
              <div className="mt-2 flex items-center gap-2">
                <span className="material-symbols-outlined text-[#bfbc7c] text-sm">lock</span>
                <p className="text-[10px] font-bold text-[#bfbc7c] uppercase tracking-widest">Select a club to unlock registration</p>
              </div>
            )}
          </div>

          {/* Email + passwords — faded until club chosen */}
          <div className={`space-y-5 transition-all duration-300 ${!p.regTenantId ? "opacity-40 pointer-events-none select-none" : "opacity-100"}`}>
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-[#686730] mb-2 block">Email Address</label>
              <input type="email" value={p.regEmail} onChange={e=>p.setRegEmail(e.target.value)}
                required disabled={!p.regTenantId} placeholder="name@example.com"
                className={p.inputCls} tabIndex={p.regTenantId ? 0 : -1}/>
            </div>
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-[#686730] mb-2 block">Password</label>
              <input type="password" value={p.regPassword} onChange={e=>p.setRegPassword(e.target.value)}
                required disabled={!p.regTenantId} placeholder="Min. 6 characters"
                className={p.inputCls} tabIndex={p.regTenantId ? 0 : -1}/>
            </div>
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-[#686730] mb-2 block">Confirm Password</label>
              <input type="password" value={p.regConfirm} onChange={e=>p.setRegConfirm(e.target.value)}
                required disabled={!p.regTenantId} placeholder="Repeat password"
                tabIndex={p.regTenantId ? 0 : -1}
                className={`${p.inputCls} ${p.regConfirm && p.regConfirm !== p.regPassword ? "border-red-300 ring-2 ring-red-100" : ""}`}/>
              {p.regConfirm && p.regConfirm !== p.regPassword && (
                <p className="mt-1.5 text-[10px] font-bold text-red-500 uppercase tracking-widest">Passwords don't match</p>
              )}
            </div>
          </div>

          <button type="submit" disabled={p.loading || !p.regTenantId}
            className="w-full py-5 rounded-2xl text-[11px] font-black uppercase tracking-widest text-[#3b3a06] transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-3 mt-2"
            style={{background:"linear-gradient(135deg, #cafd00 0%, #beee00 100%)"}}>
            {p.loading
              ? <div className="w-5 h-5 border-2 border-[#3b3a06]/30 border-t-[#3b3a06] rounded-full animate-spin"/>
              : <><span>Create Account</span><span className="material-symbols-outlined text-sm">person_add</span></>}
          </button>
        </form>
      )}

      {/* ── STEP 2: Profile ── */}
      {p.step === "profile" && (
        <form onSubmit={p.onCreateAccount} className="space-y-4">
          {/* Portrait Selection */}
          <div className="flex flex-col items-center mb-6">
            <div className="relative group">
              <div className="w-24 h-24 rounded-2xl overflow-hidden bg-[#fffcca] border-2 border-[#bfbc7c]/30 shadow-inner flex items-center justify-center transition-all group-hover:border-[#556d00]/50">
                {p.profPortraitUrl ? (
                  <img src={p.profPortraitUrl} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <span className="material-symbols-outlined text-4xl text-[#bfbc7c]/50">person</span>
                )}
                
                {/* Upload Overlay */}
                <label className="absolute inset-0 bg-[#3b3a06]/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center cursor-pointer">
                  <input type="file" className="hidden" accept="image/*" onChange={p.onPortraitUpload} />
                  <span className="material-symbols-outlined text-white text-2xl mb-1">upload</span>
                  <span className="text-[8px] font-black uppercase tracking-widest text-[#cafd00]">Upload</span>
                </label>
              </div>

              {p.isUploadingPortrait && (
                <div className="absolute inset-0 bg-[#fffcca]/80 flex items-center justify-center rounded-2xl">
                  <div className="w-5 h-5 border-2 border-[#556d00]/30 border-t-[#556d00] rounded-full animate-spin" />
                </div>
              )}
            </div>

            <button type="button" onClick={() => p.setShowPortraitSelector(true)}
              className="mt-3 px-4 py-1.5 rounded-full bg-[#fbf7a7] border border-[#bfbc7c]/30 text-[9px] font-black uppercase tracking-widest text-[#686730] hover:bg-[#fffcca] hover:text-[#3b3a06] transition-all flex items-center gap-2">
              <span className="material-symbols-outlined text-xs">gallery_thumbnail</span>
              Choose Default
            </button>
          </div>

          {/* Name row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-[#686730] mb-2 block">
                First Name <span className="text-red-400">*</span>
              </label>
              <input type="text" value={p.profFirstName} onChange={e=>p.setProfFirstName(e.target.value)}
                required placeholder="First Name" className={p.inputCls}/>
            </div>
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-[#686730] mb-2 block">
                Last Name <span className="text-red-400">*</span>
              </label>
              <input type="text" value={p.profLastName} onChange={e=>p.setProfLastName(e.target.value)}
                required placeholder="Last Name" className={p.inputCls}/>
            </div>
          </div>

          {/* Gender + Phone */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-[#686730] mb-2 block">Gender</label>
              <div className="relative">
                <select value={p.profGender} onChange={e=>p.setProfGender(e.target.value)}
                  className={selectCls}
                  style={{backgroundImage:chevron, backgroundRepeat:"no-repeat", backgroundPosition:"right 14px center"}}>
                  <option value="">— Select —</option>
                  {(p.genderOptions && p.genderOptions.length > 0
                    ? p.genderOptions
                    : []
                  ).map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>
              {(!p.genderOptions || p.genderOptions.length === 0) && (
                <p className="mt-1.5 text-[9px] font-bold text-[#686730]/80 uppercase tracking-tight">
                  Add a &quot;Gender&quot; category under Platform → Dimensions to populate this list.
                </p>
              )}
            </div>
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-[#686730] mb-2 block">Phone number</label>
              <input type="tel" value={p.profPhone} onChange={e=>p.setProfPhone(e.target.value)}
                placeholder="(555) 000-0000" className={p.inputCls}/>
            </div>
          </div>

          {/* Date of Birth */}
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-[#686730] mb-2 block">Date of Birth</label>
            <div className="grid grid-cols-3 gap-2">
              <div className="relative">
                <select value={p.profDobMonth} onChange={e=>p.setProfDobMonth(e.target.value)}
                  className={selectCls}
                  style={{backgroundImage:chevron, backgroundRepeat:"no-repeat", backgroundPosition:"right 10px center"}}>
                  <option value="">Month</option>
                  {MONTHS.map((m,i)=><option key={m} value={m}>{MONTH_NAMES[i]}</option>)}
                </select>
              </div>
              <div className="relative">
                <select value={p.profDobDay} onChange={e=>p.setProfDobDay(e.target.value)}
                  className={selectCls}
                  style={{backgroundImage:chevron, backgroundRepeat:"no-repeat", backgroundPosition:"right 10px center"}}>
                  <option value="">Day</option>
                  {Array.from({length:31},(_,i)=>i+1).map(d=><option key={d} value={String(d)}>{d}</option>)}
                </select>
              </div>
              <div className="relative">
                <select value={p.profDobYear} onChange={e=>p.setProfDobYear(e.target.value)}
                  className={selectCls}
                  style={{backgroundImage:chevron, backgroundRepeat:"no-repeat", backgroundPosition:"right 10px center"}}>
                  <option value="">Year</option>
                  {Array.from({length:100},(_,i)=>new Date().getFullYear()-i).map(y=><option key={y} value={String(y)}>{y}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Address */}
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-[#686730] mb-2 block">Street Address</label>
            <input type="text" value={p.profStreet} onChange={e=>p.setProfStreet(e.target.value)}
              placeholder="123 Court Lane" className={p.inputCls}/>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-[#686730] mb-2 block">City</label>
              <input type="text" value={p.profCity} onChange={e=>p.setProfCity(e.target.value)}
                placeholder="Springfield" className={p.inputCls}/>
            </div>
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-[#686730] mb-2 block">State (abbrev.)</label>
              <div className="relative">
                <select value={p.profState} onChange={e=>p.setProfState(e.target.value)}
                  className={selectCls}
                  style={{backgroundImage:chevron, backgroundRepeat:"no-repeat", backgroundPosition:"right 14px center"}}>
                  <option value="">— State —</option>
                  {US_STATES.map(s=><option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
          </div>
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-[#686730] mb-2 block">Zip Code</label>
            <input type="text" value={p.profZip} onChange={e=>p.setProfZip(e.target.value)}
              placeholder="07001" maxLength={10} className={p.inputCls}/>
          </div>

          <button type="submit" disabled={p.loading}
            className="w-full py-5 rounded-2xl text-[11px] font-black uppercase tracking-widest text-[#3b3a06] transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-60 flex items-center justify-center gap-3 mt-2"
            style={{background:"linear-gradient(135deg, #cafd00 0%, #beee00 100%)"}}>
            {p.loading
              ? <div className="w-5 h-5 border-2 border-[#3b3a06]/30 border-t-[#3b3a06] rounded-full animate-spin"/>
              : <><span>Complete registration</span><span className="material-symbols-outlined text-sm">check_circle</span></>}
          </button>
        </form>
      )}

      <p className="mt-6 text-center text-[11px] font-bold text-[#686730]">
        Already a member?{" "}
        <button onClick={p.onSignIn}
          className="font-black text-[#556d00] underline underline-offset-2 hover:text-[#3b3a06] transition-colors">
          Sign In
        </button>
      </p>

      {/* Portrait Selector Modal */}
      <Modal 
        isOpen={p.showPortraitSelector} 
        onClose={() => p.setShowPortraitSelector(false)}
        title="Default Portraits"
      >
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
            {p.defaultPortraits.map((portrait) => (
              <button
                key={portrait.id}
                type="button"
                onClick={() => {
                  p.setProfPortraitUrl(portrait.url);
                  p.setShowPortraitSelector(false);
                }}
                className={`group relative aspect-square rounded-2xl overflow-hidden border-2 transition-all hover:scale-105 active:scale-95 ${
                  p.profPortraitUrl === portrait.url ? "border-[#556d00] ring-4 ring-[#556d00]/10" : "border-[#bfbc7c]/20 hover:border-[#556d00]/30"
                }`}
              >
                <img src={portrait.url} alt={portrait.label} className="w-full h-full object-cover" />
                <div className={`absolute inset-0 bg-[#556d00]/10 transition-opacity ${p.profPortraitUrl === portrait.url ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`} />
                {p.profPortraitUrl === portrait.url && (
                  <div className="absolute top-2 right-2 w-6 h-6 bg-[#556d00] rounded-full flex items-center justify-center shadow-lg border-2 border-white">
                    <span className="material-symbols-outlined text-white text-sm font-bold">check</span>
                  </div>
                )}
                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                  <p className="text-[8px] font-black text-white uppercase tracking-widest truncate">{portrait.label}</p>
                </div>
              </button>
            ))}
          </div>

          {p.defaultPortraits.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 bg-[#fffcca]/30 rounded-3xl border-2 border-dashed border-[#bfbc7c]/30">
              <span className="material-symbols-outlined text-4xl text-[#bfbc7c] mb-3">image_not_supported</span>
              <p className="text-[10px] font-black text-[#686730] uppercase tracking-widest">No default portraits available</p>
            </div>
          )}
      </Modal>

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #bfbc7c; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #686730; }
      `}</style>
    </div>
  );
}
