"use client";
import React from "react";
import Image from "next/image";
import { useTenant } from "../context/TenantContext";
import { auth } from "../lib/firebase";
import { signOut, sendPasswordResetEmail } from "firebase/auth";
import DimensionsView from "./DimensionsView";
import RoleTypesView from "./RoleTypesView";
import UserAdminView from "./UserAdminView";
import PlatformTenantAdminView from "./PlatformTenantAdminView";
import AIAdminView from "./AIAdminView";
import OrganizationView from "./OrganizationView";
import { useAuth } from "../context/AuthContext";
import { collection, onSnapshot, query, orderBy, doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../lib/firebase";

const US_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA", 
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD", 
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ", 
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC", 
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY"
];

export default function DashboardClient({ params }: { params: { tenantId: string } }) {
  const { tenantId: contextTenantId, loading } = useTenant();
  const [activeView, setActiveView] = React.useState<"DASHBOARD" | "COURT BOOKING" | "PROGRAMS" | "MEMBERSHIP" | "SETTINGS" | "PROFILE" | "AI_ADMIN" | "DIMENSIONS" | "ROLE_TYPES" | "USER_ADMIN" | "PLATFORM_TENANT_ADMIN" | "ORGANIZATION">("DASHBOARD");
  const [platformAdminOpen, setPlatformAdminOpen] = React.useState(false);
  const [administrationOpen, setAdministrationOpen] = React.useState(false);
  const [theme, setTheme] = React.useState<"LIGHT" | "DARK" | "VINTAGE">("LIGHT");
  const [roles, setRoles] = React.useState<any[]>([]);
  const [allTenants, setAllTenants] = React.useState<any[]>([]);
  const [isTenantSelectorOpen, setIsTenantSelectorOpen] = React.useState(false);
  const { user: authUser, profile, loading: authLoading } = useAuth();
  const tenantId = params.tenantId || contextTenantId;
  const tenantSelectorRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const q = query(collection(db, "role_types"), orderBy("role_id", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setRoles(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubscribeTenants = onSnapshot(collection(db, "tenants"), (snapshot) => {
      setAllTenants(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // Click outside listener
    const handleClickOutside = (event: MouseEvent) => {
      if (tenantSelectorRef.current && !tenantSelectorRef.current.contains(event.target as Node)) {
        setIsTenantSelectorOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      unsubscribe();
      unsubscribeTenants();
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  if (loading || authLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen transition-colors duration-500 ${theme === "DARK" ? "bg-stone-950 text-white" :
        theme === "VINTAGE" ? "bg-[#f7f9fb] text-black" :
          "bg-background text-on-background"
      } selection:bg-primary/30`}>
      {/* SideNavBar Component */}
      <aside className={`fixed left-0 top-0 h-full w-72 border-r transition-colors duration-500 ${theme === "DARK" ? "bg-stone-950 border-stone-800" :
          theme === "VINTAGE" ? "bg-white border-transparent" :
            "bg-white border-stone-200"
        } flex flex-col z-50`}>
        <div className="py-10 px-8">
          {allTenants.find(t => t.id === tenantId)?.logo_url ? (
            <div className="h-16 w-full relative mb-4">
              <img 
                src={allTenants.find(t => t.id === tenantId).logo_url} 
                alt="Logo" 
                className="h-full w-auto object-contain object-left"
              />
            </div>
          ) : (
            <h1 className={`text-3xl font-black italic tracking-tighter ${theme === "DARK" ? "text-[#ccff00]" :
                theme === "VINTAGE" ? "text-black" :
                  "text-[#4f6b28]"
              }`}>
              {tenantId ? tenantId.toUpperCase() : "KINETIC COURT"}
            </h1>
          )}
          <p className={`text-xs font-bold uppercase tracking-[0.2em] mt-1 ${theme === "DARK" ? "text-stone-400" :
              theme === "VINTAGE" ? "text-stone-500" :
                "text-stone-900"
            }`}>
            Elite Membership
          </p>
        </div>

        <nav className="flex-1 space-y-2 py-4">
          <NavItem
            icon="grid_view"
            label="Dashboard"
            active={activeView === "DASHBOARD"}
            onClick={() => setActiveView("DASHBOARD")}
            theme={theme}
          />
          <NavItem
            icon="sports_tennis"
            label="My Schedule"
            active={activeView === "COURT BOOKING"}
            onClick={() => setActiveView("COURT BOOKING")}
            theme={theme}
          />
          <NavItem
            icon="calendar_today"
            label="Programs"
            active={activeView === "PROGRAMS"}
            onClick={() => setActiveView("PROGRAMS")}
            theme={theme}
          />
          <NavItem
            icon="card_membership"
            label="Membership"
            active={activeView === "MEMBERSHIP"}
            onClick={() => setActiveView("MEMBERSHIP")}
            theme={theme}
          />
          <NavItem
            icon="admin_panel_settings"
            label="Administration"
            active={activeView === "ROLE_TYPES"}
            onClick={() => setAdministrationOpen(!administrationOpen)}
            theme={theme}
          />
          {administrationOpen && (
            <div className="bg-stone-100/50 py-2">
              <SubNavItem
                label="Role Types"
                active={activeView === "ROLE_TYPES"}
                onClick={() => setActiveView("ROLE_TYPES")}
                theme={theme}
              />
              <SubNavItem
                label="Organization"
                active={activeView === "ORGANIZATION"}
                onClick={() => setActiveView("ORGANIZATION")}
                theme={theme}
              />
            </div>
          )}
          <NavItem
            icon="settings"
            label="Settings"
            active={activeView === "SETTINGS"}
            onClick={() => setActiveView("SETTINGS")}
            theme={theme}
          />
          <NavItem
            icon="hub"
            label="Platform"
            active={activeView === "AI_ADMIN" || activeView === "DIMENSIONS" || activeView === "USER_ADMIN" || activeView === "PLATFORM_TENANT_ADMIN"}
            onClick={() => setPlatformAdminOpen(!platformAdminOpen)}
            theme={theme}
          />
          {platformAdminOpen && (
            <div className="bg-stone-100/50 py-2">
              <SubNavItem
                label="AI Admin"
                active={activeView === "AI_ADMIN"}
                onClick={() => setActiveView("AI_ADMIN")}
                theme={theme}
              />
              <SubNavItem
                label="Dimensions"
                active={activeView === "DIMENSIONS"}
                onClick={() => setActiveView("DIMENSIONS")}
                theme={theme}
              />
              <SubNavItem
                label="User Admin"
                active={activeView === "USER_ADMIN"}
                onClick={() => setActiveView("USER_ADMIN")}
                theme={theme}
              />
              <SubNavItem
                label="Tenant Admin"
                active={activeView === "PLATFORM_TENANT_ADMIN"}
                onClick={() => setActiveView("PLATFORM_TENANT_ADMIN")}
                theme={theme}
              />
            </div>
          )}
        </nav>

        <div className="mt-auto p-8 border-t border-stone-200">
          <button
            onClick={() => setActiveView("COURT BOOKING")}
            className="w-full py-4 bg-[#4f6b28] text-white font-black rounded-lg text-xs tracking-widest hover:opacity-90 transition-all uppercase shadow-lg shadow-[#4f6b28]/10"
          >
            BOOK A COURT
          </button>

          <div
            onClick={() => setActiveView("PROFILE")}
            className="mt-8 flex items-center gap-3 cursor-pointer group"
          >
            <div className={`w-10 h-10 rounded-full overflow-hidden border-2 border-transparent transition-all flex items-center justify-center ${theme === "DARK" ? "bg-stone-800 group-hover:border-[#ccff00]" :
                theme === "VINTAGE" ? "bg-stone-100 group-hover:border-black" :
                  "bg-stone-100 group-hover:border-[#4f6b28]"
              }`}>
              {authUser?.photoURL ? (
                <img
                  src={authUser.photoURL}
                  alt="Profile"
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className={`text-xs font-black uppercase ${theme === "DARK" ? "text-stone-300" : "text-stone-600"}`}>
                  {profile ? `${profile.first_name[0]}${profile.last_name[0]}` : "?"}
                </span>
              )}
            </div>
            <div>
              <p className={`text-xs font-black transition-colors uppercase ${theme === "DARK" ? "group-hover:text-[#ccff00]" :
                  theme === "VINTAGE" ? "group-hover:text-black" :
                    "group-hover:text-[#4f6b28]"
                }`}>
                {profile ? `${profile.first_name} ${profile.last_name}` : ""}
              </p>
              <p className={`text-[10px] font-black uppercase tracking-widest ${theme === "DARK" ? "text-stone-500" :
                  theme === "VINTAGE" ? "text-stone-400" :
                    "text-stone-900"
                }`}>
                {profile
                  ? (roles.find(r => r.role_id === profile.role || r.id === profile.role)?.role_name || profile.role)
                  : ""
                }
              </p>
            </div>
          </div>

          <button
            onClick={() => signOut(auth)}
            className={`mt-6 flex items-center gap-3 transition-colors px-1 ${theme === "DARK" ? "text-stone-400 hover:text-red-400" :
                theme === "VINTAGE" ? "text-stone-500 hover:text-black" :
                  "text-stone-900 hover:text-red-500"
              }`}
          >
            <span className="material-symbols-outlined text-sm">logout</span>
            <span className="text-xs font-black uppercase tracking-widest">LOGOUT</span>
          </button>
        </div>
      </aside>

      {/* TopAppBar Component */}
      <header className={`sticky top-0 z-40 w-full backdrop-blur-xl flex justify-between items-center ml-72 px-12 py-6 max-w-[calc(100%-18rem)] transition-colors duration-500 ${theme === "DARK" ? "bg-stone-950/60 border-b border-stone-800" :
          theme === "VINTAGE" ? "bg-white/80 border-b border-[#f0f0f0]" :
            "bg-white/60"
        }`}>
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${
            theme === "DARK" ? "bg-stone-900 text-[#ccff00]" : 
            theme === "VINTAGE" ? "bg-black text-white" : 
            "bg-stone-100 text-[#4f6b28]"
          }`}>
            <span className="material-symbols-outlined text-sm">
              {activeView === "DASHBOARD" ? "dashboard" : 
               activeView.includes("ADMIN") ? "admin_panel_settings" : 
               activeView === "ROLE_TYPES" ? "rule" : "grid_view"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-black tracking-widest uppercase opacity-40 ${theme === "DARK" ? "text-white" : "text-stone-950"}`}>
              {activeView === "DASHBOARD" || activeView === "PROGRAMS" || activeView === "MEMBERSHIP" ? "PLATFORM" : 
               activeView === "ROLE_TYPES" || activeView === "ORGANIZATION" ? "ADMINISTRATION" : "MANAGEMENT"}
            </span>
            <span className="text-stone-300">/</span>
            <span className={`text-xs font-black tracking-widest uppercase ${theme === "DARK" ? "text-white" : "text-stone-950"}`}>
              {activeView.replace(/_/g, ' ')}
            </span>
          </div>
        </div>

        {/* Tenant Selector - Only visible to Global users */}
        {(!profile?.tenant_id || profile?.tenant_id === "Global") && (
          <div className="relative flex items-center gap-3 ml-6 pl-6 border-l border-stone-200 dark:border-stone-800" ref={tenantSelectorRef}>
            <button 
              onClick={() => setIsTenantSelectorOpen(!isTenantSelectorOpen)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${
                theme === "DARK" ? "bg-stone-900 text-[#ccff00] hover:bg-stone-800 shadow-lg shadow-black/20" : "bg-stone-100 text-stone-950 hover:bg-stone-200"
              }`}
            >
              <span className="material-symbols-outlined text-sm">corporate_fare</span>
              <span className="text-[10px] font-black tracking-widest uppercase truncate max-w-[120px]">
                {tenantId === "consolidated" ? "Consolidated" : allTenants.find(t => t.tenant_id === tenantId)?.name || "Select Tenant"}
              </span>
              <span className={`material-symbols-outlined text-xs transition-transform duration-300 ${isTenantSelectorOpen ? "rotate-180" : ""}`}>unfold_more</span>
            </button>
            
            {isTenantSelectorOpen && (
              <div className={`absolute top-full left-6 mt-4 w-72 rounded-3xl shadow-2xl z-50 border p-2 animate-in fade-in slide-in-from-top-2 duration-300 ${
                theme === "DARK" ? "bg-stone-950 border-stone-800" : "bg-white border-stone-100"
              }`}>
                <div className="px-4 py-3 mb-2">
                  <p className="text-[8px] font-black tracking-[0.2em] uppercase opacity-40">Available Organizations</p>
                </div>
                <div className="px-1 space-y-1">
                  <button
                    onClick={() => {
                      window.location.href = `/consolidated`;
                      setIsTenantSelectorOpen(false);
                    }}
                    className={`w-full flex flex-col gap-0.5 items-start px-4 py-3 rounded-2xl transition-all ${
                      tenantId === "consolidated" 
                        ? (theme === "DARK" ? "bg-[#ccff00] text-stone-950 shadow-lg shadow-[#ccff00]/10" : "bg-stone-900 text-white shadow-lg")
                        : (theme === "DARK" ? "hover:bg-stone-900 text-stone-400 hover:text-white" : "hover:bg-stone-50 text-stone-500 hover:text-stone-900")
                    }`}
                  >
                    <span className="text-[10px] font-black tracking-tight uppercase truncate w-full text-left italic">Consolidated (All Tenants)</span>
                    <span className={`text-[8px] font-mono opacity-50 ${tenantId === "consolidated" ? "opacity-70" : ""}`}>GLOBAL_VIEW</span>
                  </button>
                  <div className={`h-px mx-4 my-2 ${theme === "DARK" ? "bg-stone-800" : "bg-stone-100"}`} />
                </div>
                <div className="max-h-64 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                  {allTenants.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => {
                        window.location.href = `/${t.tenant_id}`;
                        setIsTenantSelectorOpen(false);
                      }}
                      className={`w-full flex flex-col gap-0.5 items-start px-4 py-3 rounded-2xl transition-all ${
                        t.tenant_id === tenantId 
                          ? (theme === "DARK" ? "bg-[#ccff00] text-stone-950 shadow-lg shadow-[#ccff00]/10" : "bg-stone-900 text-white shadow-lg")
                          : (theme === "DARK" ? "hover:bg-stone-900 text-stone-400 hover:text-white" : "hover:bg-stone-50 text-stone-500 hover:text-stone-900")
                      }`}
                    >
                      <span className="text-[10px] font-black tracking-tight uppercase truncate w-full text-left">{t.name}</span>
                      <span className={`text-[8px] font-mono opacity-50 ${t.tenant_id === tenantId ? "opacity-70" : ""}`}>{t.tenant_id}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        <div className="flex items-center gap-8">
          <ThemeSelector theme={theme} setTheme={setTheme} />
          <div className="relative hidden lg:block">
            <input
              type="text"
              placeholder="Search platform..."
              className={`rounded-full px-6 py-2 w-64 text-sm outline-none transition-all ${theme === "DARK"
                  ? "bg-stone-900 text-white focus:ring-2 focus:ring-[#ccff00] placeholder:text-stone-600"
                  : "bg-stone-100 text-stone-900 focus:ring-2 focus:ring-[#4f6b28] placeholder:text-stone-400"
                }`}
            />
            <span className={`material-symbols-outlined absolute right-4 top-2 transition-colors ${theme === "DARK" ? "text-stone-600" : "text-stone-400"}`}>search</span>
          </div>
          <div className="flex items-center gap-4 text-primary">
            <button className="material-symbols-outlined hover:opacity-80 transition-opacity">notifications</button>
            <button className="material-symbols-outlined hover:opacity-80 transition-opacity">settings</button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className={`ml-72 p-12 min-h-screen transition-colors duration-500 ${theme === "DARK" ? "bg-stone-900" :
          theme === "VINTAGE" ? "bg-[#f7f9fb]" :
            "bg-stone-50"
        }`}>
        {activeView === "DASHBOARD" ? (
          <DashboardHome theme={theme} profile={profile} />
        ) : activeView === "AI_ADMIN" ? (
          <AIAdminView theme={theme} />
        ) : activeView === "DIMENSIONS" ? (
          <DimensionsView theme={theme} />
        ) : activeView === "ROLE_TYPES" ? (
          <RoleTypesView theme={theme} />
        ) : activeView === "ORGANIZATION" ? (
          <OrganizationView theme={theme} />
        ) : activeView === "USER_ADMIN" ? (
          <UserAdminView theme={theme} />
        ) : activeView === "PLATFORM_TENANT_ADMIN" ? (
          <PlatformTenantAdminView theme={theme} />
        ) : activeView === "COURT BOOKING" ? (
          <CourtBookingView theme={theme} />
        ) : activeView === "PROGRAMS" ? (
          <ProgramsView theme={theme} />
        ) : activeView === "MEMBERSHIP" ? (
          <MembershipView theme={theme} />
        ) : activeView === "SETTINGS" ? (
          <SettingsView theme={theme} />
        ) : activeView === "PROFILE" ? (
          <ProfileView theme={theme} profile={profile} roles={roles} />
        ) : (
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-stone-400">
            <span className="material-symbols-outlined text-6xl mb-4">construction</span>
            <h3 className="text-2xl font-black uppercase tracking-widest">{activeView} UNDER CONSTRUCTION</h3>
            <p className="mt-2">We're building something elite for you.</p>
          </div>
        )}
      </main>
    </div>
  );
}

function DashboardHome({ theme, profile }: { theme: "LIGHT" | "DARK" | "VINTAGE", profile: any }) {
  return (
    <>
      {/* Welcome Hero */}
      <section className={`mb-12 relative overflow-hidden rounded-2xl p-12 flex items-end min-h-[320px] shadow-sm transition-colors duration-500 ${theme === "DARK" ? "bg-stone-900" :
          theme === "VINTAGE" ? "bg-white" :
            "bg-white"
        }`}>
        <div className="absolute inset-0 z-0">
          <img
            src="/images/clay_court.png"
            alt="Tennis court"
            className={`w-full h-full object-cover transition-opacity duration-500 ${theme === "DARK" ? "opacity-10" : "opacity-30"} scale-105`}
          />
          <div className={`absolute inset-0 ${theme === "DARK" ? "bg-gradient-to-t from-stone-900 via-stone-900/40 to-transparent" :
              theme === "VINTAGE" ? "bg-gradient-to-t from-white via-white/20 to-transparent" :
                "bg-gradient-to-t from-white via-white/40 to-transparent"
            }`}></div>
        </div>
        <div className="relative z-10 w-full">
          <span className={`font-black tracking-widest text-sm uppercase mb-4 block transition-colors ${theme === "DARK" ? "text-[#ccff00]" :
              theme === "VINTAGE" ? "text-stone-400" :
                "text-[#4f6b28]"
            }`}>
            Welcome Back, {profile?.first_name || "Alex"}
          </span>
          <h3 className={`text-7xl font-black tracking-tighter leading-tight max-w-2xl transition-colors ${theme === "DARK" ? "text-white" : "text-black"
            }`}>READY TO DOMINATE THE COURT?</h3>
        </div>
      </section>

      <div className="grid grid-cols-12 gap-8">
        {/* Performance Stats Bento */}
        <div className="col-span-12 lg:col-span-8 grid grid-cols-3 gap-6">
          <StatCard label="Win Rate" value="68%" trend="+4.2% this month" color="primary" theme={theme} />
          <StatCard label="Matches" value="124" trend="Total Career Played" color="surface" theme={theme} />
          <StatCard label="Loyalty Points" value="2,450" trend="Elite Status Active" color="tertiary" theme={theme} />

          {/* Next Match Card */}
          <div className={`col-span-3 rounded-2xl p-8 relative overflow-hidden shadow-xl transition-colors duration-500 ${theme === "DARK" ? "bg-stone-800 text-white" :
              theme === "VINTAGE" ? "bg-black text-white" :
                "bg-[#4f6b28] text-white"
            }`}>
            <div className={`absolute right-0 top-0 h-full w-1/3 opacity-10 skew-x-12 translate-x-12 ${theme === "DARK" ? "bg-[#ccff00]" : "bg-white"
              }`}></div>
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
              <div>
                <span className={`inline-block px-3 py-1 rounded-full text-[10px] font-black tracking-widest uppercase mb-4 ${theme === "DARK" ? "bg-[#ccff00] text-stone-950" :
                    theme === "VINTAGE" ? "bg-white text-black" :
                      "bg-white text-[#4f6b28]"
                  }`}>Upcoming: Tomorrow</span>
                <h4 className="text-3xl font-black tracking-tighter">QUARTER FINAL MATCH</h4>
                <p className="opacity-60 font-medium mt-2">Center Court • 10:00 AM vs. Marcus V.</p>
              </div>
              <button className={`px-8 py-4 rounded-full font-black text-xs tracking-widest transition-all uppercase shadow-lg ${theme === "DARK" ? "bg-[#ccff00] text-stone-950" :
                  theme === "VINTAGE" ? "bg-white text-black" :
                    "bg-white text-[#4f6b28]"
                }`}>
                MATCH PREVIEW
              </button>
            </div>
          </div>
        </div>

        {/* Recent Activity Section */}
        <div className="col-span-12 lg:col-span-4">
          <div className={`rounded-2xl p-8 h-full shadow-sm border transition-colors duration-500 ${theme === "DARK" ? "bg-stone-950 border-stone-800" :
              theme === "VINTAGE" ? "bg-white border-transparent" :
                "bg-white border-stone-100"
            }`}>
            <div className="flex justify-between items-center mb-6">
              <h4 className={`font-headline font-black text-xl tracking-tighter uppercase transition-colors ${theme === "DARK" ? "text-white" : "text-black"
                }`}>Recent Activity</h4>
              <button className={`font-black text-[10px] tracking-widest uppercase hover:underline ${theme === "DARK" ? "text-[#ccff00]" :
                  theme === "VINTAGE" ? "text-black" :
                    "text-[#4f6b28]"
                }`}>View All</button>
            </div>
            <div className="space-y-6">
              <ActivityItem icon="check_circle" title="Booking Confirmed" subtitle="Court 4 • Wed, 14 Oct" color={theme === "DARK" ? "bg-stone-800 text-[#ccff00]" : "bg-stone-50 text-black"} fill theme={theme} />
              <ActivityItem icon="trophy" title="Tournament Registration" subtitle="Autumn Open Elite Tier" color={theme === "DARK" ? "bg-stone-800 text-[#ccff00]" : "bg-stone-50 text-black"} theme={theme} />
              <ActivityItem icon="payments" title="Membership Renewal" subtitle="Processed successfully" color={theme === "DARK" ? "bg-stone-800 text-[#ccff00]" : "bg-stone-50 text-black"} theme={theme} />
            </div>
          </div>
        </div>
      </div>

      {/* Upcoming Bookings */}
      <section className="mt-16">
        <div className="flex justify-between items-end mb-8">
          <div>
            <h4 className={`text-4xl font-black tracking-tighter uppercase transition-colors ${theme === "DARK" ? "text-white" : "text-black"
              }`}>Upcoming Bookings</h4>
            <p className="text-stone-400 font-medium mt-1">Your scheduled time on the court.</p>
          </div>
          <div className="flex gap-2">
            <button className={`w-10 h-10 rounded-full border flex items-center justify-center transition-all ${theme === "DARK" ? "border-stone-800 text-[#ccff00] hover:bg-stone-800" : "border-stone-200 text-black hover:bg-stone-50"
              }`}>
              <span className="material-symbols-outlined">chevron_left</span>
            </button>
            <button className={`w-10 h-10 rounded-full border flex items-center justify-center transition-all ${theme === "DARK" ? "border-stone-800 text-[#ccff00] hover:bg-stone-800" : "border-stone-200 text-black hover:bg-stone-50"
              }`}>
              <span className="material-symbols-outlined">chevron_right</span>
            </button>
          </div>
        </div>

        <div className="flex gap-6 overflow-x-auto pb-8 hide-scrollbar">
          <BookingCard theme={theme} court="Court 02" date="OCT 16" time="04:00 PM - 05:30 PM" partner="Sarah Jenkins" avatar="https://lh3.googleusercontent.com/aida-public/AB6AXuDJwGLQJGS7l8awuXxFimqmgZMt3TgCyqyLykcGCi-I30U4I6UMXYtSSHoLMLp-X_Jh3IDS8WG85Go6xqEYtnE3ZuPzsENZW3X_DVY0IyohJE1JXEztGlZmksG0ifboNkfrakgRhDqaARnOym2XV1Bz_7RRHq7SGY2l_b7n1mrmOSYYjtDkvYJwPhzSV6NOYvLoeiV4jONAvGzksAWjX3u0JAjzJM38DeDRn8mO4seXqz0uojWd-WCz41rqriUeXQBFGr-PNYJDwko" />
          <BookingCard theme={theme} court="Court 08" date="OCT 18" time="09:00 AM - 10:30 AM" isOpen />
          <BookingCard theme={theme} court="Clay Court A" date="OCT 19" time="02:00 PM - 04:00 PM" partner="David Chen" avatar="https://lh3.googleusercontent.com/aida-public/AB6AXuBzfMV3RQuW53lY_bhBvzBMT-I3HlNV_sphtXexF5W_G4XkRxeqpHnR-qftrvvgBpR8ICU84H6IzrvC4mtisehaYF4bJtcMsQyBNDvIdynLEn7WZUxGs0yGtrCb6Uy2n9cOrcEVDEx9rurz4q7ULq18bYhOZ8uakqYr398Jv79LVVfZrMzIozUEiRFK8LvlPak-m0-thE3HgKPhoOEcdaX4PZ0LMBGaFXZIE35tp_pd_eBNrtngIobFSvwDt6j2IbAtRP7YRcGmaGE" highlight />
          <BookingCard theme={theme} court="Court 01" date="OCT 22" time="05:30 PM - 07:00 PM" partner="Emma Watson" avatar="https://lh3.googleusercontent.com/aida-public/AB6AXuBzzuPwdLFtvkWfVtGdUUQWVmIi4KEQypeMrixMSTcgzhQFnc4cwbnSbPlVNw7gv1yXa5tMGjZFa6nOirsGggsolwq7PL0xndKn751oEnA29NzpG0Mx1xNs4wUFiPHlgL46jM66YbdKq6kM8SsbQzqrlSS5dqb_xz1MYIps9CCqjo_yl7HBsMFDtDEcyqWiokD4YmsMYd9rB1FhdBTk01BhklCqlAunBZzrqYxLdFBJYTOrwBYDXiKkyZcQYJ3J2VTtQAUNCgP_cKs" />
        </div>
      </section>

      {/* Club News */}
      <section className="mt-16 mb-24">
        <h4 className={`text-4xl font-black tracking-tighter uppercase mb-8 transition-colors ${theme === "DARK" ? "text-white" : "text-black"
          }`}>Club News</h4>
        <div className="grid grid-cols-12 gap-8">
          <div className={`col-span-12 md:col-span-7 group cursor-pointer overflow-hidden rounded-2xl relative h-[400px] shadow-lg border transition-colors ${theme === "DARK" ? "border-stone-800" : "border-transparent"
            }`}>
            <img
              src="/images/clay_court.png"
              alt="New facilities"
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent"></div>
            <div className="absolute bottom-0 left-0 p-8">
              <span className={`px-3 py-1 rounded-full text-[10px] font-black tracking-widest uppercase mb-4 inline-block ${theme === "DARK" ? "bg-[#ccff00] text-stone-950" : "bg-white text-black"
                }`}>New Facilities</span>
              <h5 className="text-4xl font-black text-white tracking-tighter">THE CLAY REVOLUTION ARRIVES</h5>
              <p className="text-white/70 mt-2 max-w-lg">Three new professional-grade clay courts are now open. Experience the authentic European feel.</p>
            </div>
          </div>

          <div className="col-span-12 md:col-span-5 flex flex-col gap-8">
            <NewsItem theme={theme} title="PRO CLINIC WITH COACH MILLER" subtitle="Master the overhead smash this weekend." tag="Training" />
            <NewsItem theme={theme} title="MIXER NIGHT: DRINKS & DOUBLES" subtitle="Join us for the seasonal social event next Friday." tag="Social" />
            <NewsItem theme={theme} title="THE FALL COLLECTION HAS LANDED" subtitle="Exclusive Kinetic Court apparel now available." tag="Pro Shop" />
          </div>
        </div>
      </section>
    </>
  );
}

function ThemeSelector({ theme, setTheme }: { theme: "LIGHT" | "DARK" | "VINTAGE", setTheme: (t: "LIGHT" | "DARK" | "VINTAGE") => void }) {
  return (
    <div className={`flex items-center gap-1 p-1 rounded-full border transition-colors duration-500 ${theme === "DARK" ? "bg-stone-900 border-stone-800" :
        theme === "VINTAGE" ? "bg-[#f2f4f6] border-stone-200" :
          "bg-stone-100 border-stone-200"
      }`}>
      <div className={`px-4 py-1.5 flex items-center gap-2 border-r mr-1 transition-colors ${theme === "DARK" ? "border-stone-800" : "border-stone-200"
        }`}>
        <span className={`text-[10px] font-black uppercase tracking-widest ${theme === "DARK" ? "text-stone-400" : "text-stone-900"
          }`}>
          {theme === "VINTAGE" ? "light mode" : theme === "DARK" ? "Dark mode" : "Kinetic Lemon"}
        </span>
      </div>
      <button
        onClick={() => setTheme("LIGHT")}
        className={`p-1.5 rounded-full transition-all flex items-center justify-center ${theme === "LIGHT" ? "bg-white shadow-sm ring-1 ring-stone-200" : "text-stone-500 hover:text-stone-300"}`}
        title="Light Mode"
      >
        <span className={`material-symbols-outlined text-sm ${theme === "LIGHT" ? "text-[#4f6b28]" : ""}`}>sports_tennis</span>
      </button>
      <button
        onClick={() => setTheme("DARK")}
        className={`p-1.5 rounded-full transition-all flex items-center justify-center ${theme === "DARK" ? "bg-stone-800 shadow-sm" : "text-stone-500 hover:text-stone-700"}`}
        title="Dark Mode"
      >
        <span className={`material-symbols-outlined text-sm ${theme === "DARK" ? "text-[#ccff00]" : ""}`}>dark_mode</span>
      </button>
      <button
        onClick={() => setTheme("VINTAGE")}
        className={`p-1.5 rounded-full transition-all flex items-center justify-center ${theme === "VINTAGE" ? "bg-black shadow-sm text-white" : "text-stone-500 hover:text-stone-700"}`}
        title="Vintage Mode"
      >
        <span className="material-symbols-outlined text-sm">light_mode</span>
      </button>
    </div>
  )
}

function SubNavItem({ label, active = false, onClick, theme }: { label: string; active?: boolean; onClick?: () => void; theme: "LIGHT" | "DARK" | "VINTAGE" }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-5 py-3 transition-all duration-300 ease-in-out pl-20 relative group ${active
          ? (theme === "DARK" ? "text-[#ccff00]" : theme === "VINTAGE" ? "text-black" : "text-[#4f6b28]")
          : (theme === "DARK" ? "text-stone-400 hover:text-[#ccff00]" : theme === "VINTAGE" ? "text-stone-400 hover:text-black" : "text-black hover:bg-stone-50")
        }`}
    >
      <span className={`text-sm font-black uppercase tracking-[0.2em] transition-all ${active ? "translate-x-1" : "group-hover:translate-x-1"}`} style={{ fontFamily: 'Lexend, sans-serif' }}>
        {label}
      </span>
    </button>
  );
}

function NavItem({ icon, label, active = false, onClick, theme }: { icon: string; label: string; active?: boolean; onClick?: () => void; theme: "LIGHT" | "DARK" | "VINTAGE" }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-5 py-4 transition-all duration-300 ease-in-out px-8 relative group ${active
          ? (theme === "DARK" ? "text-[#ccff00] bg-stone-900" : theme === "VINTAGE" ? "text-black bg-[#f7f9fb]" : "text-[#4f6b28] bg-stone-100")
          : (theme === "DARK" ? "text-stone-400 hover:text-[#ccff00]" : theme === "VINTAGE" ? "text-stone-400 hover:text-black" : "text-black hover:bg-stone-50")
        }`}
    >
      {active && (
        <div className={`absolute left-0 top-0 bottom-0 w-2 rounded-r-full ${theme === "DARK" ? "bg-[#ccff00]" :
            theme === "VINTAGE" ? "bg-black" :
              "bg-[#4f6b28]"
          }`} />
      )}
      <span className={`material-symbols-outlined text-2xl transition-all ${active ? "opacity-100 scale-110" : "opacity-60 group-hover:opacity-100"}`} style={active ? { fontVariationSettings: "'FILL' 1" } : {}}>
        {icon}
      </span>
      <span className={`text-base font-black uppercase tracking-[0.2em] transition-all ${active ? "translate-x-1" : "group-hover:translate-x-1"}`} style={{ fontFamily: 'Lexend, sans-serif' }}>
        {label}
      </span>
    </button>
  );
}

function PlaceholderView({ title, icon }: { title: string; icon: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="w-24 h-24 bg-stone-50 rounded-[32px] flex items-center justify-center text-[#4f6b28]">
        <span className="material-symbols-outlined text-5xl">{icon}</span>
      </div>
      <div className="text-center">
        <h2 className="text-4xl font-black italic tracking-tighter text-[#4f6b28] uppercase mb-4" style={{ fontFamily: 'Lexend, sans-serif' }}>
          {title}
        </h2>
        <p className="text-stone-900 font-bold uppercase tracking-widest text-xs">Module Under Construction</p>
      </div>
    </div>
  );
}

function StatCard({ label, value, trend, color, theme }: { label: string; value: string; trend: string; color: string; theme: "LIGHT" | "DARK" | "VINTAGE" }) {
  const isVintage = theme === "VINTAGE";
  const isDark = theme === "DARK";

  const bgColor = isDark
    ? "bg-stone-900 border-stone-800"
    : isVintage
      ? "bg-white border-transparent"
      : (color === "primary" ? "bg-stone-100" : color === "tertiary" ? "bg-tertiary-container" : "bg-stone-100");

  const textColor = isDark
    ? "text-white"
    : isVintage
      ? "text-black"
      : (color === "tertiary" ? "text-on-tertiary-container" : color === "primary" ? "text-primary" : "text-black");

  const labelColor = isDark
    ? "text-stone-400"
    : isVintage
      ? "text-stone-400"
      : (color === "tertiary" ? "text-on-tertiary-container/80" : "text-stone-900");

  const trendColor = isDark
    ? (color === "primary" ? "text-[#ccff00]" : "text-stone-400")
    : isVintage
      ? "text-stone-400"
      : (color === "tertiary" ? "text-on-tertiary-container/80" : color === "primary" ? "text-primary" : "text-stone-900");

  return (
    <div className={`col-span-1 ${bgColor} p-8 rounded-2xl flex flex-col justify-between shadow-sm border transition-colors duration-500`}>
      <span className={`font-label text-xs uppercase font-black tracking-widest ${labelColor}`}>
        {label}
      </span>
      <div className="mt-4">
        <div className={`text-5xl font-black tracking-tighter ${textColor}`}>{value}</div>
        <div className={`flex items-center text-[10px] font-black uppercase tracking-widest mt-2 ${trendColor}`}>
          {color === "primary" && <span className="material-symbols-outlined text-sm mr-1">trending_up</span>}
          <span>{trend}</span>
        </div>
      </div>
    </div>
  );
}

function ActivityItem({ icon, title, subtitle, color, fill = false, theme }: { icon: string; title: string; subtitle: string; color: string; fill?: boolean; theme: "LIGHT" | "DARK" | "VINTAGE" }) {
  const isDark = theme === "DARK";
  const isVintage = theme === "VINTAGE";

  return (
    <div className="flex gap-4 items-center">
      <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${isDark ? "bg-stone-800 text-[#ccff00]" :
          isVintage ? "bg-[#f7f9fb] text-black" :
            color
        }`}>
        <span className="material-symbols-outlined text-xl" style={fill ? { fontVariationSettings: "'FILL' 1" } : {}}>{icon}</span>
      </div>
      <div>
        <p className={`text-sm font-black uppercase tracking-tight ${isDark ? "text-white" : "text-black"}`}>{title}</p>
        <p className={`text-[10px] font-black uppercase tracking-widest ${isDark || isVintage ? "text-stone-500" : "text-stone-400"}`}>{subtitle}</p>
      </div>
    </div>
  );
}

function BookingCard({ court, date, time, partner, avatar, isOpen = false, highlight = false, theme }: { 
  court: string; 
  date: string; 
  time: string; 
  partner?: string; 
  avatar?: string; 
  isOpen?: boolean; 
  highlight?: boolean; 
  theme: "LIGHT" | "DARK" | "VINTAGE" 
}) {
  const isDark = theme === "DARK";
  const isVintage = theme === "VINTAGE";

  const cardBg = isDark ? "bg-stone-900 border-stone-800" : "bg-white border-transparent";
  const badgeClass = isDark
    ? (highlight ? 'bg-[#ccff00] text-stone-950' : 'bg-stone-800 text-stone-400')
    : isVintage
      ? (highlight ? 'bg-black text-white' : 'bg-[#f7f9fb] text-stone-500')
      : (highlight ? 'bg-[#4f6b28] text-white' : 'bg-stone-100 text-black');

  return (
    <div className={`min-w-[300px] ${cardBg} border p-8 rounded-2xl shadow-sm hover:shadow-md transition-all duration-500 group`}>
      <div className="flex justify-between items-start mb-8">
        <div className={`${badgeClass} px-3 py-1 rounded text-[10px] font-black uppercase tracking-widest`}>
          {court}
        </div>
        <button className={`material-symbols-outlined ${isDark ? "text-stone-600 hover:text-[#ccff00]" : "text-stone-300 hover:text-black"} transition-colors`}>more_vert</button>
      </div>
      <div className="mb-8">
        <h5 className={`text-3xl font-black tracking-tighter ${isDark ? "text-white" : "text-black"}`}>{date}</h5>
        <p className={`text-xs font-black uppercase tracking-widest mt-1 ${isDark ? "text-[#ccff00]" : isVintage ? "text-stone-400" : "text-[#4f6b28]"}`}>{time}</p>
      </div>
      <div className={`flex items-center gap-3 pt-6 border-t ${isDark ? "border-stone-800" : "border-stone-50"}`}>
        {isOpen ? (
          <>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isDark ? "bg-stone-800 text-[#ccff00]" : "bg-stone-50 text-black"}`}>
              <span className="material-symbols-outlined text-sm">person_add</span>
            </div>
            <span className={`text-[10px] font-black uppercase tracking-widest ${isDark ? "text-stone-400" : "text-stone-500"}`}>Open Slot</span>
          </>
        ) : (
          <>
            <img src={avatar} alt={partner} className={`w-8 h-8 rounded-full object-cover border ${isDark ? "border-stone-700" : "border-stone-100"}`} />
            <span className={`text-[10px] font-black uppercase tracking-widest ${isDark ? "text-stone-300" : "text-black"}`}>With {partner}</span>
          </>
        )}
      </div>
    </div>
  );
}

function NewsItem({ title, subtitle, tag, theme }: { title: string; subtitle: string; tag: string; theme: "LIGHT" | "DARK" | "VINTAGE" }) {
  const isDark = theme === "DARK";
  const isVintage = theme === "VINTAGE";

  return (
    <div className="group cursor-pointer flex gap-6 hover:translate-x-1 transition-all duration-300">
      <div className={`w-24 h-24 flex-shrink-0 overflow-hidden rounded-xl relative transition-colors ${isDark ? "bg-stone-900" : isVintage ? "bg-[#f7f9fb]" : "bg-stone-100"
        }`}>
        <div className={`absolute inset-0 flex items-center justify-center opacity-20 ${isDark ? "text-[#ccff00]" : isVintage ? "text-black" : "text-[#4f6b28]"}`}>
          <span className="material-symbols-outlined text-4xl">image</span>
        </div>
      </div>
      <div className="py-2">
        <span className={`font-black text-[10px] tracking-widest uppercase transition-colors ${isDark ? "text-[#ccff00]" : isVintage ? "text-stone-400" : "text-[#4f6b28]"
          }`}>{tag}</span>
        <h6 className={`text-lg font-black tracking-tight mt-1 group-hover:translate-x-1 transition-all ${isDark ? "text-white group-hover:text-[#ccff00]" : "text-black"
          }`}>{title}</h6>
        <p className={`text-[10px] font-black uppercase tracking-widest mt-1 ${isDark || isVintage ? "text-stone-500" : "text-stone-400"}`}>{subtitle}</p>
      </div>
    </div>
  );
}
function CourtBookingView({ theme }: { theme: "LIGHT" | "DARK" | "VINTAGE" }) {
  const isDark = theme === "DARK";
  const isVintage = theme === "VINTAGE";

  return (
    <div className="space-y-12">
      {/* Date Selection */}
      <section>
        <div className="flex justify-between items-center mb-8">
          <div>
            <h3 className={`text-2xl font-black tracking-tighter uppercase ${isDark ? "text-white" : "text-black"}`}>Select Date</h3>
            <p className="text-stone-400 text-[10px] font-black uppercase tracking-widest mt-1">Showing availability for October 2023</p>
          </div>
          <button className={`flex items-center gap-2 px-6 py-2.5 rounded-full font-black text-[10px] uppercase tracking-widest border transition-all ${isDark ? "bg-stone-900 border-stone-800 text-[#ccff00]" :
              isVintage ? "bg-white border-transparent text-black" :
                "bg-stone-100 border-stone-200 text-[#4f6b28]"
            }`}>
            <span className="material-symbols-outlined text-sm">calendar_month</span>
            October 2023
          </button>
        </div>

        <div className="flex gap-4 overflow-x-auto pb-4 hide-scrollbar">
          {[12, 13, 14, 15, 16, 17, 18].map((day) => (
            <button
              key={day}
              className={`flex-shrink-0 w-20 h-24 rounded-2xl flex flex-col items-center justify-center transition-all ${day === 14
                  ? (isDark ? "bg-[#ccff00] text-stone-950 scale-105" : isVintage ? "bg-black text-white scale-105" : "bg-[#4f6b28] text-white scale-105 shadow-lg")
                  : (isDark ? "bg-stone-900 text-stone-400 hover:text-white" : isVintage ? "bg-white text-stone-400 hover:text-black" : "bg-stone-100 text-stone-500 hover:bg-stone-200")
                }`}
            >
              <span className="text-[10px] font-black uppercase tracking-widest opacity-60">
                {day === 12 ? 'Mon' : day === 13 ? 'Tue' : day === 14 ? 'Wed' : day === 15 ? 'Thu' : day === 16 ? 'Fri' : day === 17 ? 'Sat' : 'Sun'}
              </span>
              <span className="text-3xl font-black mt-1 tracking-tighter">{day}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Courts Availability */}
      <div className="grid grid-cols-12 gap-8">
        <div className="col-span-12 lg:col-span-6 space-y-6">
          <CourtSection title="Court 01 (Premium Grass)" theme={theme} />
        </div>
        <div className="col-span-12 lg:col-span-6 space-y-6">
          <CourtSection title="Court 02 (Traditional Clay)" theme={theme} />
        </div>
      </div>
    </div>
  );
}

function CourtSection({ title, theme }: { title: string; theme: "LIGHT" | "DARK" | "VINTAGE" }) {
  const isDark = theme === "DARK";
  const isVintage = theme === "VINTAGE";

  const times = [
    { time: "08:00 AM", status: "booked", user: "Marcus V." },
    { time: "09:00 AM", status: "booked", user: "Marcus V." },
    { time: "10:00 AM", status: "available" },
    { time: "11:00 AM", status: "available" },
    { time: "12:00 PM", status: "booked", user: "Team Practice" },
    { time: "01:00 PM", status: "available" },
    { time: "02:00 PM", status: "available" },
    { time: "03:00 PM", status: "available" },
  ];

  return (
    <div className={`rounded-3xl p-8 shadow-sm transition-colors duration-500 ${isDark ? "bg-stone-900 border border-stone-800" :
        isVintage ? "bg-white border border-transparent" :
          "bg-white border border-stone-100"
      }`}>
      <div className="flex justify-between items-center mb-8">
        <h4 className={`font-black tracking-tighter uppercase text-xl ${isDark ? "text-white" : "text-black"}`}>{title}</h4>
        <span className="material-symbols-outlined text-stone-300">info</span>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {times.map((slot, i) => (
          <button
            key={i}
            disabled={slot.status === "booked"}
            className={`p-6 rounded-2xl flex flex-col items-start transition-all border ${slot.status === "booked"
                ? (isDark ? "bg-stone-950 border-stone-800 opacity-40 cursor-not-allowed" : "bg-stone-50 border-stone-100 opacity-50 cursor-not-allowed")
                : (isDark
                  ? "bg-stone-900 border-stone-800 hover:border-[#ccff00] cursor-pointer group"
                  : isVintage
                    ? "bg-white border-stone-100 hover:border-black cursor-pointer group"
                    : "bg-white border-stone-100 hover:border-[#4f6b28] cursor-pointer group")
              }`}
          >
            <span className={`text-sm font-black ${slot.status === "available"
                ? (isDark ? "text-[#ccff00]" : isVintage ? "text-black" : "text-[#4f6b28]")
                : "text-stone-400"
              }`}>
              {slot.time}
            </span>
            <div className="mt-2 flex items-center justify-between w-full">
              <span className={`text-[8px] font-black uppercase tracking-widest ${slot.status === "available" ? "text-stone-500" : "text-stone-300"}`}>
                {slot.status === "available" ? "AVAILABLE" : `BOOKED: ${slot.user}`}
              </span>
              {slot.status === "available" && (
                <span className={`material-symbols-outlined text-sm opacity-0 group-hover:opacity-100 transition-opacity ${isDark ? "text-[#ccff00]" : isVintage ? "text-black" : "text-[#4f6b28]"
                  }`}>add_circle</span>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function ProgramsView({ theme }: { theme: "LIGHT" | "DARK" | "VINTAGE" }) {
  const isDark = theme === "DARK";
  const isVintage = theme === "VINTAGE";

  return (
    <div className="space-y-16 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header Section */}
      <div className="flex justify-between items-center">
        <h2 className={`text-5xl font-black tracking-tighter uppercase transition-colors ${isDark ? "text-white" : "text-black"
          }`} style={{ fontFamily: 'Lexend, sans-serif' }}>
          CLUB PROGRAMS
        </h2>
        <div className="relative">
          <input
            type="text"
            placeholder="Search training..."
            className={`border-none rounded-full px-8 py-3 w-80 focus:ring-2 text-sm font-black uppercase tracking-widest transition-colors ${isDark ? "bg-stone-900 text-white focus:ring-[#ccff00] placeholder-stone-600" :
                isVintage ? "bg-white text-black focus:ring-black placeholder-stone-300" :
                  "bg-stone-100 text-[#4f6b28] focus:ring-[#4f6b28] placeholder-stone-400"
              }`}
          />
          <span className={`material-symbols-outlined absolute right-4 top-3 ${isDark ? "text-stone-700" : "text-stone-300"
            }`}>search</span>
        </div>
      </div>

      {/* Hero Section */}
      <div className="grid grid-cols-12 gap-8">
        <div className={`col-span-12 lg:col-span-8 group relative h-[450px] overflow-hidden rounded-[40px] shadow-2xl border ${isDark ? "border-stone-800" : "border-transparent"
          }`}>
          <img
            src="/images/programs_hero.png"
            alt="Championship Clinic"
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-transparent"></div>
          <div className="absolute inset-0 p-12 flex flex-col justify-end max-w-2xl">
            <h3 className="text-7xl font-black text-white leading-[0.9] tracking-tighter mb-6 uppercase">
              CHAMPIONSHIP CLINIC 2024
            </h3>
            <p className="text-white/80 text-lg font-medium leading-relaxed">
              Intensive technical refinement for competitive players. Lead by ITF-certified master professionals.
            </p>
          </div>
        </div>

        <div className={`col-span-12 lg:col-span-4 rounded-[40px] p-10 flex flex-col justify-between shadow-xl transition-colors ${isDark ? "bg-stone-900" :
            isVintage ? "bg-white border border-stone-50" :
              "bg-[#fdfbe6]"
          }`}>
          <div>
            <h4 className={`text-3xl font-black leading-tight mb-4 uppercase transition-colors ${isDark ? "text-[#ccff00]" :
                isVintage ? "text-black" :
                  "text-[#4f6b28]"
              }`}>
              PRO-FOCUS WEEKEND
            </h4>
            <p className={`font-medium leading-relaxed transition-colors ${isDark ? "text-stone-400" :
                isVintage ? "text-stone-500" :
                  "text-[#4f6b28]/70"
              }`}>
              Join Coach Marcus for a 48-hour immersion into strategy and bio-mechanics. Limited to 8 participants.
            </p>
          </div>
          <button className={`w-full py-4 border-2 rounded-full text-[10px] font-black tracking-[0.2em] transition-all uppercase ${isDark ? "border-[#ccff00] text-[#ccff00] hover:bg-[#ccff00] hover:text-stone-950" :
              isVintage ? "border-black text-black hover:bg-black hover:text-white" :
                "border-[#4f6b28] text-[#4f6b28] hover:bg-[#4f6b28] hover:text-white"
            }`}>
            VIEW COACH BIO
          </button>
        </div>
      </div>

      {/* Training Tracks Section */}
      <section>
        <div className="flex justify-between items-end mb-12">
          <h3 className={`text-5xl font-black tracking-tighter uppercase transition-colors ${isDark ? "text-white" : "text-black"
            }`}>
            TRAINING TRACKS
          </h3>
          <div className="flex gap-8 text-[10px] font-black tracking-widest uppercase text-stone-400">
            <span>FILTER BY:</span>
            <button className={`pb-1 transition-colors ${isDark ? "text-[#ccff00] border-b-2 border-[#ccff00]" :
                isVintage ? "text-black border-b-2 border-black" :
                  "text-[#4f6b28] border-b-2 border-[#4f6b28]"
              }`}>ALL</button>
            <button className="hover:text-stone-600 transition-colors">YOUTH</button>
            <button className="hover:text-stone-600 transition-colors">ADULT</button>
            <button className="hover:text-stone-600 transition-colors">PRO</button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Active Clinics */}
          <div className={`rounded-[40px] overflow-hidden flex flex-col group shadow-lg transition-colors border ${isDark ? "bg-stone-900 border-stone-800" :
              isVintage ? "bg-white border-stone-50" :
                "bg-[#fdfbe6] border-transparent"
            }`}>
            <div className="h-64 overflow-hidden">
              <img src="/images/active_clinics.png" alt="Active Clinics" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
            </div>
            <div className="p-10 flex-1 relative">
              <div className={`absolute right-10 top-10 w-12 h-12 rounded-full flex items-center justify-center shadow-md transition-colors ${isDark ? "bg-stone-800 text-[#ccff00]" : "bg-white text-black"
                }`}>
                <span className="material-symbols-outlined">bolt</span>
              </div>
              <h4 className={`text-3xl font-black mb-4 uppercase transition-colors ${isDark ? "text-white" : isVintage ? "text-black" : "text-[#4f6b28]"
                }`}>ACTIVE CLINICS</h4>
              <p className={`text-sm font-medium leading-relaxed mb-8 transition-colors ${isDark ? "text-stone-400" : isVintage ? "text-stone-500" : "text-[#4f6b28]/60"
                }`}>
                High-energy drills focused on footwork, stamina, and consistent point construction.
              </p>
              <div className="flex justify-between items-center mt-auto">
                <div>
                  <div className={`text-[10px] font-black uppercase tracking-widest ${isDark ? "text-stone-600" : "text-stone-300"}`}>STARTS AT</div>
                  <div className={`text-2xl font-black ${isDark ? "text-[#ccff00]" : "text-black"}`}>$45/HR</div>
                </div>
                <button className={`w-14 h-14 rounded-full flex items-center justify-center hover:scale-110 transition-transform shadow-lg ${isDark ? "bg-[#ccff00] text-stone-950" : isVintage ? "bg-black text-white" : "bg-[#4f6b28] text-white"
                  }`}>
                  <span className="material-symbols-outlined">arrow_forward</span>
                </button>
              </div>
            </div>
          </div>

          {/* Junior Academy */}
          <div className={`rounded-[40px] overflow-hidden flex flex-col group shadow-lg transition-colors ${isDark ? "bg-stone-900 border border-stone-800" :
              isVintage ? "bg-white border border-stone-50" :
                "bg-[#cfff00]"
            }`}>
            <div className="h-64 overflow-hidden relative">
              <img src="/images/junior_academy.png" alt="Junior Academy" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
              <div className={`absolute top-6 left-6 px-4 py-1 backdrop-blur rounded-full text-[8px] font-black tracking-widest uppercase ${isDark ? "bg-stone-900/90 text-[#ccff00]" : "bg-white/90 text-black"
                }`}>
                PREMIER LEVEL
              </div>
            </div>
            <div className="p-10 flex-1">
              <h4 className={`text-3xl font-black mb-4 uppercase leading-none transition-colors ${isDark ? "text-white" : "text-[#1a1a1a]"
                }`}>JUNIOR<br />ACADEMY</h4>
              <p className={`text-sm font-medium leading-relaxed mb-8 transition-colors ${isDark ? "text-stone-400" : "text-black/60"
                }`}>
                Developing the next generation of competitors. Age groups 8-16.
              </p>
              <button className={`w-full py-4 rounded-2xl text-[10px] font-black tracking-widest transition-all uppercase ${isDark ? "bg-[#ccff00] text-stone-950" : "bg-black text-white"
                }`}>
                EXPLORE PATHWAY
              </button>
            </div>
          </div>

          {/* Social Mixers */}
          <div className={`rounded-[40px] overflow-hidden flex flex-col group shadow-lg transition-colors border ${isDark ? "bg-stone-900 border-stone-800" :
              isVintage ? "bg-white border-stone-50" :
                "bg-[#fdfbe6] border-transparent"
            }`}>
            <div className="p-10 pb-0">
              <div className="flex justify-between items-start mb-4">
                <h4 className={`text-3xl font-black uppercase leading-none transition-colors ${isDark ? "text-white" : isVintage ? "text-black" : "text-[#4f6b28]"
                  }`}>SOCIAL<br />MIXERS</h4>
                <span className={`material-symbols-outlined transition-colors ${isDark ? "text-[#ccff00] opacity-40" : "text-[#4f6b28] opacity-40"}`}>groups</span>
              </div>
              <p className={`text-sm font-medium leading-relaxed mb-6 transition-colors ${isDark ? "text-stone-400" : isVintage ? "text-stone-500" : "text-[#4f6b28]/60"
                }`}>
                Network while you play. Round-robin format followed by clubhouse drinks.
              </p>
              <div className="flex items-center -space-x-3 mb-8">
                {[1, 2, 3].map(i => (
                  <div key={i} className={`w-8 h-8 rounded-full border-2 overflow-hidden ${isDark ? "border-stone-900" : "border-white"}`}>
                    <img src={`https://i.pravatar.cc/100?img=${i + 10}`} alt="User" />
                  </div>
                ))}
                <div className={`h-8 px-2 text-white text-[8px] font-black flex items-center justify-center rounded-full border-2 transition-colors ${isDark ? "bg-stone-800 border-stone-900" : "bg-black border-white"
                  }`}>
                  +14
                </div>
              </div>
            </div>
            <div className="h-48 overflow-hidden relative mt-auto">
              <img src="/images/social_mixers.png" alt="Social Mixers" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
              <div className={`absolute right-6 bottom-6 w-12 h-12 rounded-2xl flex items-center justify-center shadow-xl transition-colors ${isDark ? "bg-[#ccff00] text-stone-950" : "bg-black text-white"
                }`}>
                <span className="material-symbols-outlined">calendar_today</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Spring Session Section */}
      <section className={`rounded-[40px] p-16 grid grid-cols-12 gap-12 transition-colors border ${isDark ? "bg-stone-950 border-stone-800" :
          isVintage ? "bg-white border-stone-50 shadow-sm" :
            "bg-stone-50 border-transparent"
        }`}>
        <div className="col-span-12 lg:col-span-5 space-y-8">
          <div className="space-y-4">
            <h3 className={`text-6xl font-black tracking-tighter uppercase leading-none transition-colors ${isDark ? "text-white" : "text-black"
              }`}>
              SPRING<br />SESSION '24
            </h3>
            <p className={`font-medium leading-relaxed max-w-sm transition-colors ${isDark ? "text-stone-500" : "text-stone-500"
              }`}>
              Registration is now open for all technical workshops and weekly ladders. Secure your spot before March 15th.
            </p>
          </div>

          <div className="space-y-4 pt-4">
            <div className={`flex items-center gap-4 transition-colors ${isDark ? "text-[#ccff00]" : isVintage ? "text-black" : "text-[#4f6b28]"
              }`}>
              <div className={`w-6 h-6 rounded-md flex items-center justify-center transition-colors ${isDark ? "bg-[#ccff00] text-stone-950" : isVintage ? "bg-black text-white" : "bg-[#4f6b28] text-white"
                }`}>
                <span className="material-symbols-outlined text-sm">check</span>
              </div>
              <span className="text-[10px] font-black tracking-widest uppercase">ITF GOLD STANDARDS</span>
            </div>
            <div className={`flex items-center gap-4 transition-colors ${isDark ? "text-[#ccff00]" : isVintage ? "text-black" : "text-[#4f6b28]"
              }`}>
              <div className={`w-6 h-6 rounded-md flex items-center justify-center transition-colors ${isDark ? "bg-[#ccff00] text-stone-950" : isVintage ? "bg-black text-white" : "bg-[#4f6b28] text-white"
                }`}>
                <span className="material-symbols-outlined text-sm">bar_chart</span>
              </div>
              <span className="text-[10px] font-black tracking-widest uppercase">PERFORMANCE TRACKING</span>
            </div>
          </div>
        </div>

        <div className="col-span-12 lg:col-span-7 grid grid-cols-1 md:grid-cols-2 gap-6">
          {[
            { date: "MARCH 12-14", title: "SERVE VELOCITY CLINIC", badge: "2 SLOTS LEFT", badgeColor: isDark ? "bg-stone-900 text-[#ccff00]" : "bg-yellow-100 text-yellow-700" },
            { date: "APRIL 05", title: "DOUBLES MASTERCLASS", badge: "OPENING SOON", badgeColor: isDark ? "bg-stone-900 text-stone-400" : "bg-blue-100 text-blue-700" },
            { date: "WEEKLY SAT", title: "CARDIO TENNIS LADDER", badge: "RECURRING", badgeColor: isDark ? "bg-stone-900 text-[#ccff00]" : "bg-green-100 text-green-700" },
            { date: "MONTHLY", title: "VIDEO ANALYSIS LAB", badge: "MEMBER EXCLUSIVE", badgeColor: isDark ? "bg-stone-900 text-stone-500" : "bg-stone-200 text-stone-600" }
          ].map((item, i) => (
            <div key={i} className={`p-8 rounded-3xl group cursor-pointer hover:shadow-xl transition-all border ${isDark ? "bg-stone-900 border-stone-800" : "bg-white border-stone-100"
              }`}>
              <div className="text-[10px] font-black text-stone-400 tracking-widest uppercase mb-2">{item.date}</div>
              <h5 className={`text-lg font-black tracking-tighter mb-6 group-hover:translate-x-1 transition-all uppercase leading-tight ${isDark ? "text-white group-hover:text-[#ccff00]" : "text-stone-900 group-hover:text-black"
                }`}>{item.title}</h5>
              <div className="flex justify-between items-center">
                <span className={`px-3 py-1 rounded-full text-[8px] font-black tracking-widest uppercase ${item.badgeColor}`}>
                  {item.badge}
                </span>
                <span className={`material-symbols-outlined text-stone-300 group-hover:translate-x-1 transition-all ${isDark ? "group-hover:text-[#ccff00]" : "group-hover:text-black"
                  }`}>chevron_right</span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function ProfileView({ theme, profile, roles }: { theme: "LIGHT" | "DARK" | "VINTAGE", profile: any, roles: any[] }) {
  const isDark = theme === "DARK";
  const isVintage = theme === "VINTAGE";
  const [showEditModal, setShowEditModal] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [showSuccess, setShowSuccess] = React.useState<string | null>(null);
  const [formData, setFormData] = React.useState({
    first_name: profile?.first_name || "",
    last_name: profile?.last_name || "",
    phone: profile?.phone || "",
    address_street: profile?.address_street || "",
    address_city: profile?.address_city || "",
    address_state: profile?.address_state || "",
    address_zip: profile?.address_zip || ""
  });

  React.useEffect(() => {
    if (profile) {
      setFormData({
        first_name: profile.first_name || "",
        last_name: profile.last_name || "",
        phone: profile.phone || "",
        address_street: profile.address_street || "",
        address_city: profile.address_city || "",
        address_state: profile.address_state || "",
        address_zip: profile.address_zip || ""
      });
    }
  }, [profile]);

  const handleSaveProfile = async () => {
    if (!profile?.user_id) return;
    setIsSaving(true);
    try {
      const userRef = doc(db, "global_users", profile.user_id);
      await updateDoc(userRef, {
        ...formData,
        updated_at: serverTimestamp()
      });
      setShowEditModal(false);
      setShowSuccess("Profile updated successfully!");
      setTimeout(() => setShowSuccess(null), 3000);
    } catch (err) {
      console.error("Failed to update profile:", err);
      alert("Failed to update profile. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!profile?.email) return;
    try {
      await sendPasswordResetEmail(auth, profile.email);
      setShowSuccess("Password reset email sent!");
      setTimeout(() => setShowSuccess(null), 5000);
    } catch (err) {
      console.error("Password reset error:", err);
      alert("Failed to send reset email. Please try again.");
    }
  };

  return (
    <div className="max-w-4xl space-y-16 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {showSuccess && (
        <div className={`fixed top-8 right-8 z-[100] px-8 py-4 rounded-2xl shadow-2xl animate-in slide-in-from-right-8 duration-500 border flex items-center gap-3 ${
          isDark ? "bg-[#ccff00] text-stone-950 border-[#ccff00]" : "bg-[#4f6b28] text-white border-[#4f6b28]"
        }`}>
          <span className="material-symbols-outlined">check_circle</span>
          <span className="text-xs font-black uppercase tracking-widest">{showSuccess}</span>
        </div>
      )}

      <div className="flex items-center gap-10">
        <div className={`w-40 h-40 rounded-[40px] overflow-hidden border-4 shadow-2xl transition-colors ${isDark ? "border-stone-800" : "border-white"
          }`}>
          <img
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuCIVNG3lcWVm-Ge5NEEZUf-GdmgLwhFzcFnGsboAMqruvOsGoG2KsUaJnNi7egzkBHc-8ccIDPAhhUoKLhZ-6htVuQieJX6w20tMHdUP6wvr91JZaIcvqIJEmHuGFa4z4EtafMvMDZVDCE0FvjKCsjs2BQO27LBpb-zAw7Vj2lY1t1lbEH1wcnRQt6l-9LceLngmvluUeTcJdDm9RVYiiwiCLuDdYSnjSgJK13-P326RgshwnopS9Qa-T0LE8kRyriIPjwU5NIlUVY"
            alt="Profile"
            className="w-full h-full object-cover"
          />
        </div>
        <div>
          <div className={`text-[10px] font-black tracking-[0.3em] uppercase mb-2 transition-colors ${isDark ? "text-stone-500" : isVintage ? "text-stone-400" : "text-[#4f6b28]"
            }`}>Member Profile</div>
          <h2 className={`text-6xl font-black tracking-tighter uppercase leading-none transition-colors ${isDark ? "text-white" : "text-black"
            }`} style={{ fontFamily: 'Lexend, sans-serif' }}>
            {profile ? `${profile.first_name} ${profile.last_name}` : "ALEX STERLING"}
          </h2>
          <div className="flex gap-4 mt-6">
            <span className={`px-5 py-2 rounded-full text-[10px] font-black tracking-widest uppercase transition-colors ${isDark ? "bg-stone-800 text-[#ccff00]" : isVintage ? "bg-black text-white" : "bg-[#4f6b28] text-white"
              }`}>
              {profile ? (roles.find(r => r.role_id === profile.role)?.role_name || profile.role) : "GOLD TIER MEMBER"}
            </span>
            <span className={`px-5 py-2 border-2 rounded-full text-[10px] font-black tracking-widest uppercase transition-colors ${isDark ? "border-stone-800 text-stone-500" : isVintage ? "border-black text-black" : "border-[#4f6b28] text-[#4f6b28]"
              }`}>
              NTRP 4.5
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-8">
        <div className={`col-span-12 lg:col-span-7 rounded-[40px] p-12 shadow-xl space-y-10 transition-colors border ${isDark ? "bg-stone-900 border-stone-800" :
            isVintage ? "bg-white border-stone-50" :
              "bg-[#fdfbe6] border-transparent"
          }`}>
          <h3 className={`text-3xl font-black tracking-tighter uppercase transition-colors ${isDark ? "text-[#ccff00]" : "text-black"
            }`}>Account Security</h3>
          <div className="grid grid-cols-2 gap-10">
            {[
              { label: "REGISTERED EMAIL", value: profile?.email || "alex.sterling@pro.com" },
              { label: "PHONE VERIFIED", value: profile?.phone || "+1 (555) 042-9901" },
              { label: "MAILING ADDRESS", value: profile?.address_street ? `${profile.address_street}, ${profile.address_city}, ${profile.address_state} ${profile.address_zip}` : "NOT PROVIDED" },
              { label: "INTERNAL ID", value: profile?.user_id || "U00001" },
            ].map((item, i) => (
              <div key={i} className={item.label === "MAILING ADDRESS" ? "col-span-2" : ""}>
                <div className={`text-[10px] font-black mb-1 tracking-widest transition-colors ${isDark ? "text-stone-600" : "text-stone-400"
                  }`}>{item.label}</div>
                <div className={`font-black text-lg transition-colors ${isDark ? "text-white" : "text-black"
                  }`}>{item.value}</div>
              </div>
            ))}
          </div>
          <div className="pt-8 flex gap-4">
            <button 
              onClick={() => setShowEditModal(true)}
              className={`flex-1 py-4 rounded-2xl text-[10px] font-black tracking-widest uppercase transition-colors ${isDark ? "bg-stone-800 text-[#ccff00]" : isVintage ? "bg-black text-white" : "bg-[#4f6b28] text-white"
              }`}>
              EDIT INFORMATION
            </button>
            <button 
              onClick={handleChangePassword}
              className={`flex-1 py-4 border-2 rounded-2xl text-[10px] font-black tracking-widest uppercase transition-colors ${isDark ? "border-stone-800 text-white hover:bg-stone-800" : isVintage ? "border-black text-black hover:bg-black hover:text-white" : "border-[#4f6b28] text-[#4f6b28] hover:bg-[#4f6b28] hover:text-white"
              }`}>
              CHANGE PASSWORD
            </button>
          </div>
        </div>

        {/* Edit Modal */}
        <div className={`fixed inset-0 z-[100] flex items-center justify-center p-8 transition-opacity duration-300 ${showEditModal ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
          <div className="absolute inset-0 bg-stone-950/80 backdrop-blur-md" onClick={() => setShowEditModal(false)}></div>
          <div className={`relative w-full max-w-xl rounded-[40px] p-12 shadow-2xl animate-in zoom-in-95 duration-300 border ${isDark ? "bg-stone-900 border-stone-800" : "bg-white border-stone-100"}`}>
            <h3 className={`text-4xl font-black tracking-tighter uppercase mb-10 ${isDark ? "text-white" : "text-stone-900"}`}>Edit Information</h3>
            
            <div className="space-y-8">
              <div className="grid grid-cols-2 gap-8">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-3 block">First Name</label>
                  <input 
                    value={formData.first_name}
                    onChange={e => setFormData({ ...formData, first_name: e.target.value })}
                    className={`w-full bg-transparent border-b-2 py-4 text-lg font-bold outline-none transition-colors ${isDark ? "border-stone-800 focus:border-[#ccff00] text-white" : "border-stone-100 focus:border-[#4f6b28] text-stone-900"}`}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-3 block">Last Name</label>
                  <input 
                    value={formData.last_name}
                    onChange={e => setFormData({ ...formData, last_name: e.target.value })}
                    className={`w-full bg-transparent border-b-2 py-4 text-lg font-bold outline-none transition-colors ${isDark ? "border-stone-800 focus:border-[#ccff00] text-white" : "border-stone-100 focus:border-[#4f6b28] text-stone-900"}`}
                  />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-3 block">Street Address</label>
                <input 
                  value={formData.address_street}
                  onChange={e => setFormData({ ...formData, address_street: e.target.value })}
                  placeholder="123 Tennis Court Lane"
                  className={`w-full bg-transparent border-b-2 py-4 text-lg font-bold outline-none transition-colors ${isDark ? "border-stone-800 focus:border-[#ccff00] text-white" : "border-stone-100 focus:border-[#4f6b28] text-stone-900"}`}
                />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-3 block">Phone Number</label>
                <input 
                  value={formData.phone}
                  onChange={e => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+1 (555) 000-0000"
                  className={`w-full bg-transparent border-b-2 py-4 text-lg font-bold outline-none transition-colors ${isDark ? "border-stone-800 focus:border-[#ccff00] text-white" : "border-stone-100 focus:border-[#4f6b28] text-stone-900"}`}
                />
              </div>
              <div className="grid grid-cols-3 gap-8">
                <div className="col-span-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-3 block">City</label>
                  <input 
                    value={formData.address_city}
                    onChange={e => setFormData({ ...formData, address_city: e.target.value })}
                    placeholder="Wimbledon"
                    className={`w-full bg-transparent border-b-2 py-4 text-lg font-bold outline-none transition-colors ${isDark ? "border-stone-800 focus:border-[#ccff00] text-white" : "border-stone-100 focus:border-[#4f6b28] text-stone-900"}`}
                  />
                </div>
                <div className="col-span-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-3 block">State</label>
                  <select 
                    value={formData.address_state}
                    onChange={e => setFormData({ ...formData, address_state: e.target.value })}
                    className={`w-full bg-transparent border-b-2 py-4 text-lg font-bold outline-none transition-colors appearance-none ${isDark ? "border-stone-800 focus:border-[#ccff00] text-white" : "border-stone-100 focus:border-[#4f6b28] text-stone-900"}`}
                  >
                    <option value="" className={isDark ? "bg-stone-900" : "bg-white"}>Select State</option>
                    {US_STATES.map(state => (
                      <option key={state} value={state} className={isDark ? "bg-stone-900" : "bg-white"}>{state}</option>
                    ))}
                  </select>
                </div>
                <div className="col-span-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-3 block">Zip Code</label>
                  <input 
                    value={formData.address_zip}
                    onChange={e => setFormData({ ...formData, address_zip: e.target.value })}
                    placeholder="SW19"
                    className={`w-full bg-transparent border-b-2 py-4 text-lg font-bold outline-none transition-colors ${isDark ? "border-stone-800 focus:border-[#ccff00] text-white" : "border-stone-100 focus:border-[#4f6b28] text-stone-900"}`}
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-4 mt-16">
              <button 
                onClick={() => setShowEditModal(false)}
                className={`flex-1 py-5 rounded-2xl text-[10px] font-black tracking-widest uppercase transition-colors border ${isDark ? "border-stone-800 text-stone-500 hover:bg-stone-800" : "border-stone-200 text-stone-400 hover:bg-stone-50"}`}
              >
                CANCEL
              </button>
              <button 
                onClick={handleSaveProfile}
                disabled={isSaving}
                className={`flex-1 py-5 rounded-2xl text-[10px] font-black tracking-widest uppercase transition-all shadow-xl flex items-center justify-center gap-3 ${isDark ? "bg-[#ccff00] text-stone-950 shadow-[#ccff00]/20" : "bg-[#4f6b28] text-white shadow-[#4f6b28]/20"}`}
              >
                {isSaving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                    SAVING...
                  </>
                ) : "SAVE CHANGES"}
              </button>
            </div>
          </div>
        </div>

        <div className={`col-span-12 lg:col-span-5 rounded-[40px] p-12 shadow-xl flex flex-col justify-between transition-colors border ${isDark ? "bg-stone-950 border-stone-800" :
            isVintage ? "bg-white border-stone-50" :
              "bg-white border-stone-100"
          }`}>
          <div>
            <h3 className={`text-3xl font-black tracking-tighter uppercase mb-8 transition-colors ${isDark ? "text-white" : "text-black"
              }`}>Performance</h3>
            <div className="space-y-8">
              <div className="flex justify-between items-end">
                <span className="text-[10px] font-black text-stone-400 tracking-widest uppercase">Season Progress</span>
                <span className={`text-sm font-black ${isDark ? "text-[#ccff00]" : "text-black"}`}>74%</span>
              </div>
              <div className={`h-3 rounded-full overflow-hidden transition-colors ${isDark ? "bg-stone-900" : "bg-stone-100"
                }`}>
                <div className={`h-full w-[74%] rounded-full shadow-lg transition-colors ${isDark ? "bg-[#ccff00]" : isVintage ? "bg-black" : "bg-[#cfff00]"
                  }`}></div>
              </div>
              <p className={`text-sm font-medium leading-relaxed transition-colors ${isDark ? "text-stone-500" : "text-stone-500"
                }`}>
                You've completed 12 matches this session. 4 more to qualify for the Autumn Championship.
              </p>
            </div>
          </div>
          <button className={`mt-12 w-full py-4 rounded-2xl text-[10px] font-black tracking-widest transition-colors uppercase ${isDark ? "bg-[#ccff00] text-stone-950" : "bg-black text-white"
            }`}>
            VIEW ANALYTICS
          </button>
        </div>
      </div>
    </div>
  );
}

function MembershipView({ theme }: { theme: "LIGHT" | "DARK" | "VINTAGE" }) {
  const isDark = theme === "DARK";
  const isVintage = theme === "VINTAGE";

  return (
    <div className="space-y-16 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <h2 className={`text-5xl font-black tracking-tighter uppercase transition-colors ${isDark ? "text-white" : "text-black"
        }`} style={{ fontFamily: 'Lexend, sans-serif' }}>
        MEMBERSHIP PLANS
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {[
          { name: "SILVER", price: "99", color: isDark ? "bg-stone-900 text-white" : isVintage ? "bg-white text-black border border-stone-50" : "bg-stone-50 text-stone-900", features: ["2 Bookings/Week", "Standard Access", "Social Mixers"] },
          { name: "GOLD", price: "199", color: isDark ? "bg-[#ccff00] text-stone-950" : isVintage ? "bg-black text-white" : "bg-[#4f6b28] text-white", features: ["Unlimited Bookings", "Priority Courts", "Guest Passes (4)", "Pro Discounts"], popular: true },
          { name: "PLATINUM", price: "299", color: isDark ? "bg-stone-950 text-white border border-stone-800" : isVintage ? "bg-white text-black border-2 border-black" : "bg-stone-900 text-white", features: ["24/7 Access", "Personal Locker", "Free Stringing", "Pro Clinic Access"] }
        ].map((plan, i) => (
          <div key={i} className={`${plan.color} rounded-[40px] p-12 shadow-2xl relative flex flex-col transition-all hover:scale-105`}>
            {plan.popular && (
              <div className={`absolute -top-4 left-12 px-6 py-2 text-[10px] font-black tracking-[0.2em] rounded-full shadow-lg transition-colors ${isDark ? "bg-white text-black" : "bg-[#cfff00] text-black"
                }`}>
                MOST POPULAR
              </div>
            )}
            <div className="mb-12">
              <h3 className="text-2xl font-black tracking-widest uppercase opacity-60 mb-2">{plan.name}</h3>
              <div className="flex items-baseline">
                <span className="text-5xl font-black">${plan.price}</span>
                <span className="text-sm font-bold opacity-40 ml-2">/MO</span>
              </div>
            </div>
            <ul className="space-y-6 flex-1">
              {plan.features.map((f, j) => (
                <li key={j} className="flex items-center gap-4">
                  <span className="material-symbols-outlined text-sm">check_circle</span>
                  <span className="text-sm font-bold">{f}</span>
                </li>
              ))}
            </ul>
            <button className={`mt-12 w-full py-5 rounded-2xl text-[10px] font-black tracking-widest transition-all uppercase ${plan.popular ? (isDark ? "bg-stone-900 text-white" : isVintage ? "bg-white text-black" : "bg-white text-[#4f6b28]") :
                "border-2 border-current hover:bg-current hover:text-white"
              }`}>
              {plan.popular ? "CURRENT PLAN" : "UPGRADE NOW"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function SettingsView({ theme }: { theme: "LIGHT" | "DARK" | "VINTAGE" }) {
  const isDark = theme === "DARK";
  const isVintage = theme === "VINTAGE";

  return (
    <div className="max-w-2xl space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <h2 className={`text-5xl font-black tracking-tighter uppercase transition-colors ${isDark ? "text-white" : "text-black"
        }`} style={{ fontFamily: 'Lexend, sans-serif' }}>
        PREFERENCES
      </h2>

      <div className="space-y-8">
        {[
          { icon: "notifications", title: "Push Notifications", desc: "Get alerts for bookings and match invites", active: true },
          { icon: "visibility", title: "Profile Visibility", desc: "Allow other members to find you", active: true },
          { icon: "history", title: "Activity History", desc: "Log match results and training progress", active: false },
          { icon: "mail", title: "Newsletter", desc: "Weekly club updates and clinic openings", active: true }
        ].map((opt, i) => (
          <div key={i} className={`flex items-center justify-between p-8 rounded-3xl border shadow-sm transition-all border ${isDark ? "bg-stone-900 border-stone-800" :
              isVintage ? "bg-white border-stone-50" :
                "bg-white border-stone-100"
            }`}>
            <div className="flex items-center gap-6">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors ${isDark ? "bg-stone-800 text-[#ccff00]" : "bg-stone-50 text-[#4f6b28]"
                }`}>
                <span className="material-symbols-outlined">{opt.icon}</span>
              </div>
              <div>
                <h4 className={`font-black text-lg uppercase transition-colors ${isDark ? "text-white" : "text-stone-900"
                  }`}>{opt.title}</h4>
                <p className="text-stone-400 text-sm font-medium">{opt.desc}</p>
              </div>
            </div>
            <button className={`w-14 h-8 rounded-full relative transition-colors ${opt.active ? (isDark ? "bg-[#ccff00]" : isVintage ? "bg-black" : "bg-[#4f6b28]") : "bg-stone-200"
              }`}>
              <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-transform ${opt.active ? "right-1" : "left-1"}`}></div>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
