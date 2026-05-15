"use client";
import React, { useState, useEffect } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import Image from "next/image";
import { useTenant } from "../context/TenantContext";
import { auth } from "../lib/firebase";
import { signOut, sendPasswordResetEmail, updateProfile } from "firebase/auth";
import DimensionsView from "./DimensionsView";
import RoleTypesView from "./RoleTypesView";
import UserAdminView from "./UserAdminView";
import PlatformTenantAdminView from "./PlatformTenantAdminView";
import AIAdminView from "./AIAdminView";
import CompanyView from "./CompanyView";
import CourtBookingView from "./CourtBookingView";
import SchedulesAdminView from "./SchedulesAdminView";
import MemberAdminView from "./MemberAdminView";
import { Modal } from "@repo/ui/modal";
import { useAuth } from "../context/AuthContext";
import { 
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  doc, 
  updateDoc, 
  deleteDoc,
  arrayRemove,
  serverTimestamp,
  limit,
  where
} from "firebase/firestore";
import { format } from "date-fns";
import { db, storage } from "../lib/firebase";
import EventsAdminView from "./EventsAdminView";
import EventDetailsModal from "./EventDetailsModal";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

const US_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY"
];

export default function DashboardClient({ params }: { params: { tenantId: string } }) {
  const { tenantId: contextTenantId, loading, setTenantId } = useTenant();
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const [activeView, setActiveView] = React.useState<"DASHBOARD" | "COURT BOOKING" | "PROGRAMS" | "MEMBERSHIP" | "SETTINGS" | "PROFILE" | "AI_ADMIN" | "DIMENSIONS" | "ROLE_TYPES" | "USER_ADMIN" | "PLATFORM_TENANT_ADMIN" | "COMPANY" | "PLATFORM_COMPANY" | "TENANT_USER_ADMIN" | "MEMBER_ADMIN" | "PLATFORM_ROLE_TYPES" | "SCHEDULES" | "EVENTS_ADMIN">("DASHBOARD");
  const [platformAdminOpen, setPlatformAdminOpen] = React.useState(false);
  const [administrationOpen, setAdministrationOpen] = React.useState(false);
  const [theme, setTheme] = React.useState<"LIGHT" | "DARK" | "VINTAGE">("LIGHT");
  const [roles, setRoles] = React.useState<any[]>([]);
  const [allTenants, setAllTenants] = React.useState<any[]>([]);
  const [globalTenant, setGlobalTenant] = React.useState<any>(null);
  const [isTenantSelectorOpen, setIsTenantSelectorOpen] = React.useState(false);
  const { user: authUser, profile, loading: authLoading } = useAuth();
  const [overrideTenantId, setOverrideTenantId] = React.useState<string | null>(null);

  const isGlobalUser = React.useMemo(() => {
    if (!profile) return false;
    // A user is global only if they have no tenant_id OR if their role is marked as global
    return !profile.tenant_id || profile.tenant_id === "";
  }, [profile]);

  const tenantId = overrideTenantId || (!isGlobalUser ? profile?.tenant_id : params.tenantId || contextTenantId) || "";

  // Debugging permissions
  React.useEffect(() => {
    if (profile) {
      console.log("[Dashboard] Profile:", profile.email, "Tenant:", profile.tenant_id, "isGlobal:", isGlobalUser);
    }
  }, [profile, isGlobalUser]);

  // URL enforcement disabled for clean address support
  React.useEffect(() => {
    // Non-global users stay on the root path; their tenant is resolved via profile
  }, [profile, isGlobalUser]);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          <p className="text-on-background/50 font-body text-[10px] uppercase tracking-[0.2em]">Synchronizing Context...</p>
        </div>
      </div>
    );
  }

  const tenantSelectorRef = React.useRef<HTMLDivElement>(null);

  // --- Permission derivation ---
  const userRoles = React.useMemo(() => {
    const roleIds = profile?.roles || (profile?.role ? [profile.role] : []);
    const filtered = roles.filter(r => {
      const match = roleIds.includes(r.role_id) || roleIds.includes(r.id);
      return match;
    });
    console.log("[Dashboard] userRoles debug:", { 
      roleIds, 
      rolesAvailable: roles.map(r => ({ id: r.id, role_id: r.role_id })),
      filteredCount: filtered.length 
    });
    return filtered;
  }, [roles, profile]);

  const userPermissions = React.useMemo(() => {
    const perms = new Set<string>();
    userRoles.forEach(r => {
      (r.permissions || []).forEach((p: string) => perms.add(p));
    });
    const permsArray = Array.from(perms);
    console.log("[Dashboard] User Permissions:", permsArray);
    return permsArray;
  }, [userRoles]);

  const isSuperAdmin = React.useMemo(() => 
    userRoles.some(r => (r.IsGlobal === true || r.is_global === true)), [userRoles]);

  const hasPermission = (perm: string) => {
    if (isSuperAdmin) return true;
    return userPermissions.includes(perm);
  };

  // View → required permission mapping
  const VIEW_PERMISSIONS: Partial<Record<typeof activeView, string>> = {
    "DASHBOARD": "DASHBOARD_VIEW",
    "COURT BOOKING": "MY_SCHEDULE_VIEW",
    "PROGRAMS": "PROGRAMS_VIEW",
    "MEMBERSHIP": "MEMBERSHIP_VIEW",
    "ROLE_TYPES": "ADMINISTRATION_VIEW",
    "COMPANY": "ADMINISTRATION_VIEW",
    "TENANT_USER_ADMIN": "ADMINISTRATION_VIEW",
    "MEMBER_ADMIN": "ADMINISTRATION_VIEW",
    "SCHEDULES": "ADMINISTRATION_VIEW",
    "SETTINGS": "SETTINGS_VIEW",
    "AI_ADMIN": "PLATFORM_VIEW",
    "DIMENSIONS": "PLATFORM_VIEW",
    "USER_ADMIN": "PLATFORM_VIEW",
    "PLATFORM_TENANT_ADMIN": "PLATFORM_VIEW",
    "PLATFORM_COMPANY": "PLATFORM_VIEW",
    "PLATFORM_ROLE_TYPES": "PLATFORM_VIEW",
    "EVENTS_ADMIN": "ADMINISTRATION_VIEW",
  };

  // Sync state with History API for clean URL + Back/Forward support
  const handleViewChange = (view: typeof activeView) => {
    const requiredPerm = VIEW_PERMISSIONS[view];
    if (requiredPerm && !hasPermission(requiredPerm)) return;
    setActiveView(view);
    // Push to history state without changing the visible URL info
    window.history.pushState({ view }, "", pathname);
  };

  React.useEffect(() => {
    // Listen for browser navigation (Back/Forward)
    const handlePopState = (event: PopStateEvent) => {
      if (event.state && event.state.view) {
        setActiveView(event.state.view);
      }
    };

    window.addEventListener("popstate", handlePopState);

    // Initial state setup for current view if needed
    if (!window.history.state) {
      window.history.replaceState({ view: activeView }, "", pathname);
    }

    return () => window.removeEventListener("popstate", handlePopState);
  }, [activeView, pathname]);

  // Redirect away from forbidden view when permissions resolve
  React.useEffect(() => {
    if (!profile || roles.length === 0) return;

    // If current view is not allowed, switch to a safe default
    const requiredPermission = VIEW_PERMISSIONS[activeView];
    if (requiredPermission && !hasPermission(requiredPermission)) {
      if (hasPermission("DASHBOARD_VIEW")) {
        setActiveView("DASHBOARD");
      } else if (hasPermission("MY_SCHEDULE_VIEW")) {
        setActiveView("COURT BOOKING");
      } else {
        setActiveView("PROFILE");
      }
    }
    const requiredPerm = VIEW_PERMISSIONS[activeView];
    if (requiredPerm && !hasPermission(requiredPerm)) {
      setActiveView("DASHBOARD");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userPermissions.join(","), activeView]);

  const [unreadNotifications, setUnreadNotifications] = React.useState<any[]>([]);
  const [showNotificationsModal, setShowNotificationsModal] = React.useState(false);

  React.useEffect(() => {
    if (!profile?.id || !tenantId) return;
    const q = query(
      collection(db, "tenants", tenantId, "notifications"),
      where("userId", "==", profile.id),
      where("read", "==", false),
      orderBy("created_at", "desc"),
      limit(20)
    );
    const unsub = onSnapshot(q, (snap) => {
      setUnreadNotifications(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [profile?.id, tenantId]);

  const [userSchedule, setUserSchedule] = React.useState<any[]>([]);

  React.useEffect(() => {
    if (!profile?.id || !tenantId) return;

    // 1. Fetch Court Bookings
    const bookingsQ = query(
      collection(db, "tenants", tenantId, "bookings"),
      where("userId", "==", profile.id)
    );

    const unsubBookings = onSnapshot(bookingsQ, (snap) => {
      const bookings = snap.docs.map(d => ({
        id: d.id,
        type: "BOOKING",
        ...d.data()
      }));
      updateSchedule(bookings, "BOOKINGS");
    });

    // 2. Fetch Signed up Events
    const eventsQ = query(
      collection(db, "tenants", tenantId, "events"),
      where("signups", "array-contains", profile.id)
    );

    const unsubEvents = onSnapshot(eventsQ, (snap) => {
      const events = snap.docs.map(d => ({
        id: d.id,
        type: "EVENT",
        ...d.data()
      }));
      updateSchedule(events, "EVENTS");
    });

    let currentBookings: any[] = [];
    let currentEvents: any[] = [];

    const updateSchedule = (items: any[], category: "BOOKINGS" | "EVENTS") => {
      if (category === "BOOKINGS") currentBookings = items;
      else currentEvents = items;

      const combined = [...currentBookings, ...currentEvents].sort((a, b) => {
        const dateA = a.type === "EVENT" ? (a.date?.toDate ? a.date.toDate() : new Date(a.date)) : new Date(a.date);
        const dateB = b.type === "EVENT" ? (b.date?.toDate ? b.date.toDate() : new Date(b.date)) : new Date(b.date);
        return dateA.getTime() - dateB.getTime();
      });

      setUserSchedule(combined.filter(item => {
        const itemDate = item.type === "EVENT" ? (item.date?.toDate ? item.date.toDate() : new Date(item.date)) : new Date(item.date);
        const now = new Date();
        now.setHours(0,0,0,0);
        return itemDate >= now;
      }));
    };

    return () => {
      unsubBookings();
      unsubEvents();
    };
  }, [profile?.id, tenantId]);

  const handleRemoveFromSchedule = async (item: any) => {
    if (!tenantId || !profile?.id) return;
    try {
      if (item.type === "BOOKING") {
        await deleteDoc(doc(db, "tenants", tenantId, "bookings", item.id));
      } else {
        // Event: Unregister
        const eventRef = doc(db, "tenants", tenantId, "events", item.id);
        await updateDoc(eventRef, {
          signups: arrayRemove(profile.id)
        });
      }
    } catch (err) {
      console.error("Error removing from schedule:", err);
    }
  };

  const markAllAsRead = async () => {
    if (!tenantId || unreadNotifications.length === 0) return;
    const batch: any[] = [];
    unreadNotifications.forEach(n => {
      batch.push(updateDoc(doc(db, "tenants", tenantId, "notifications", n.id), { read: true }));
    });
    await Promise.all(batch);
  };

  React.useEffect(() => {
    const q = query(collection(db, "role_types"), orderBy("role_id", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setRoles(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubscribeTenants = onSnapshot(collection(db, "tenants"), (snapshot) => {
      setAllTenants(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubscribeGlobal = onSnapshot(doc(db, "platform_company", "branding"), (snapshot) => {
      if (snapshot.exists()) {
        setGlobalTenant(snapshot.data());
      }
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
      unsubscribeGlobal();
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
    <div className={`min-h-screen transition-colors duration-500 theme-${theme.toLowerCase()} bg-background text-on-background selection:bg-primary/30 font-body`}>
      <Sidebar 
        activeView={activeView} 
        setActiveView={handleViewChange}
        platformAdminOpen={platformAdminOpen}
        setPlatformAdminOpen={setPlatformAdminOpen}
        administrationOpen={administrationOpen}
        setAdministrationOpen={setAdministrationOpen}
        isGlobalUser={isGlobalUser}
        hasPermission={hasPermission}
        profile={profile}
        onLogout={() => signOut(auth)}
        theme={theme}
        tenantId={tenantId}
        allTenants={allTenants}
        globalTenant={globalTenant}
      />

      {/* TopAppBar Component */}
      <header className="sticky top-0 z-40 w-full backdrop-blur-xl flex justify-between items-center ml-[320px] px-12 py-6 max-w-[calc(100%-20rem)] transition-colors duration-500 bg-background/60 border-b border-outline/10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center transition-all bg-primary-container text-on-primary-container">
            <span className="material-symbols-outlined text-sm">
              {activeView === "DASHBOARD" ? "dashboard" :
                activeView.includes("ADMIN") ? "admin_panel_settings" :
                  activeView === "ROLE_TYPES" || activeView === "PLATFORM_ROLE_TYPES" ? "rule" : "grid_view"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black tracking-widest uppercase opacity-70 text-on-background">
              {activeView === "DASHBOARD" || activeView === "PROGRAMS" || activeView === "MEMBERSHIP" || activeView.includes("PLATFORM") || activeView === "USER_ADMIN" || activeView === "AI_ADMIN" || activeView === "DIMENSIONS" ? "PLATFORM" :
                activeView === "ROLE_TYPES" || activeView === "COMPANY" || activeView === "TENANT_USER_ADMIN" || activeView === "SCHEDULES" ? "ADMINISTRATION" : "MANAGEMENT"}
            </span>
            <span className="text-outline/20">/</span>
            <span className="text-xs font-black tracking-widest uppercase text-on-background">
              {activeView === "TENANT_USER_ADMIN"
                ? "USER ADMIN"
                : activeView === "USER_ADMIN"
                  ? "USER ADMIN"
                  : activeView === "PLATFORM_COMPANY"
                    ? "PLATFORM COMPANY"
                    : activeView.replace(/_/g, " ")}
            </span>
          </div>
        </div>

        {/* Tenant Selector - Only visible for platform admins */}
        {isGlobalUser && hasPermission("PLATFORM_VIEW") && (
          <div className="relative flex items-center gap-3 ml-6 pl-6 border-l border-outline/10" ref={tenantSelectorRef}>
            <button
              onClick={() => setIsTenantSelectorOpen(!isTenantSelectorOpen)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl transition-all bg-surface-container hover:bg-surface-container-high text-on-surface"
            >
              <span className="material-symbols-outlined text-sm">corporate_fare</span>
              <span className="text-[10px] font-black tracking-widest uppercase truncate max-w-[120px]">
                {tenantId === "consolidated" ? "Consolidated" : allTenants.find(t => t.tenant_id === tenantId)?.name || "Select Tenant"}
              </span>
              <span className={`material-symbols-outlined text-xs transition-transform duration-300 ${isTenantSelectorOpen ? "rotate-180" : ""}`}>unfold_more</span>
            </button>

            {isTenantSelectorOpen && (
              <div className="absolute top-full left-6 mt-4 w-72 rounded-3xl shadow-2xl z-50 border p-2 animate-in fade-in slide-in-from-top-2 duration-300 bg-surface border-outline/10">
                <div className="px-4 py-3 mb-2">
                  <p className="text-[8px] font-black tracking-[0.2em] uppercase opacity-70">Available Companies</p>
                </div>
                <div className="px-1 space-y-1">
                  <button
                    onClick={() => {
                      setOverrideTenantId("consolidated");
                      setTenantId("consolidated");
                      setIsTenantSelectorOpen(false);
                    }}
                    className={`w-full flex flex-col gap-0.5 items-start px-4 py-3 rounded-2xl transition-all ${tenantId === "consolidated"
                      ? "bg-primary text-on-primary shadow-lg shadow-primary/20"
                      : "hover:bg-surface-container text-on-surface"
                      }`}
                  >
                    <span className="text-[10px] font-black tracking-tight uppercase truncate w-full text-left italic">Consolidated (All Tenants)</span>
                    <span className={`text-[8px] font-mono opacity-50 ${tenantId === "consolidated" ? "opacity-70" : ""}`}>GLOBAL_VIEW</span>
                  </button>
                  <div className={`h-px mx-4 my-2 ${theme === "DARK" ? "bg-stone-800" : "bg-stone-100"}`} />
                </div>
                <div className="max-h-64 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                  {allTenants
                    .filter(t => t.tenant_id && /^T\d+/.test(t.tenant_id))
                    .map((t) => (
                      <button
                        key={t.id}
                        onClick={() => {
                          setOverrideTenantId(t.tenant_id);
                          setTenantId(t.tenant_id);
                          setIsTenantSelectorOpen(false);
                        }}
                        className={`w-full flex flex-col gap-0.5 items-start px-4 py-3 rounded-2xl transition-all ${t.tenant_id === tenantId
                          ? "bg-primary text-on-primary shadow-lg shadow-primary/20"
                          : "hover:bg-surface-container text-on-surface"
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
              className="rounded-full px-6 py-2 w-64 text-sm outline-none transition-all bg-surface-container text-on-surface focus:ring-2 focus:ring-primary placeholder:text-on-surface/30"
            />
            <span className="material-symbols-outlined absolute right-4 top-2 transition-colors text-on-surface/40">search</span>
          </div>
          <div className="flex items-center gap-4 text-primary">
            <button 
              onClick={() => {
                setShowNotificationsModal(true);
                markAllAsRead();
              }}
              className="material-symbols-outlined hover:opacity-80 transition-opacity relative"
            >
              notifications
              {unreadNotifications.length > 0 && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-surface"></span>
              )}
            </button>
            <button className="material-symbols-outlined hover:opacity-80 transition-opacity">settings</button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="ml-[320px] min-h-screen p-12 transition-colors duration-500 bg-background">
        {(() => {
          const requiredPerm = VIEW_PERMISSIONS[activeView];
          
          // 1. Still loading profile or roles
          if (authLoading || (profile && roles.length === 0)) {
            return (
              <div className="flex flex-col items-center justify-center min-h-[60vh]">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                <p className="mt-4 text-[10px] font-black uppercase tracking-widest opacity-50">Checking Permissions...</p>
              </div>
            );
          }

          // 2. Profile loaded, but no permission
          if (profile && requiredPerm && !hasPermission(requiredPerm)) {
            return (
              <div className={`flex flex-col items-center justify-center min-h-[60vh] ${theme === "DARK" ? "text-white" : "text-stone-900"}`}>
                <span className="material-symbols-outlined text-6xl mb-4">lock</span>
                <h3 className="text-2xl font-black uppercase tracking-widest">Access Denied</h3>
                <p className="mt-2 text-sm text-center max-w-md opacity-70">
                  You are logged in as <span className="font-bold">{profile.email}</span>. 
                  Your current role (<span className="font-bold">{profile.role}</span>) does not have permission to view the <span className="font-bold">{activeView}</span>.
                </p>
                {profile.tenant_id && (
                  <p className="mt-1 text-[10px] opacity-50">Tenant ID: {profile.tenant_id}</p>
                )}
                <button
                  onClick={() => signOut(auth)}
                  className="mt-8 px-6 py-2 bg-red-500/10 text-red-500 rounded-full text-xs font-bold uppercase tracking-widest hover:bg-red-500/20 transition-all"
                >
                  Logout
                </button>
              </div>
            );
          }
          
          // 3. Render the view
          if (activeView === "DASHBOARD") return <DashboardHome theme={theme} profile={profile} tenantId={tenantId} authUser={authUser} userSchedule={userSchedule} onRemoveFromSchedule={handleRemoveFromSchedule} />;
          if (activeView === "AI_ADMIN") return <AIAdminView theme={theme} />;
          if (activeView === "DIMENSIONS") return <DimensionsView theme={theme} />;
          if (activeView === "ROLE_TYPES") return <RoleTypesView theme={theme} userRoleId={profile?.role} readOnly />;
          if (activeView === "COMPANY") return <CompanyView theme={theme} tenantId={tenantId} />;
          if (activeView === "TENANT_USER_ADMIN") return <UserAdminView theme={theme} tenantId={tenantId} />;
          if (activeView === "MEMBER_ADMIN") return <MemberAdminView theme={theme} tenantId={tenantId} />;
          if (activeView === "PLATFORM_COMPANY") return <CompanyView theme={theme} tenantId={null} />;
          if (activeView === "USER_ADMIN") return <UserAdminView theme={theme} tenantId={null} />;
          if (activeView === "PLATFORM_TENANT_ADMIN") return <PlatformTenantAdminView theme={theme} />;
          if (activeView === "PLATFORM_ROLE_TYPES") return <RoleTypesView theme={theme} />;
          if (activeView === "COURT BOOKING") return <CourtBookingView theme={theme} isAdmin={hasPermission("ADMINISTRATION_VIEW")} tenantId={tenantId ?? undefined} />;
          if (activeView === "SCHEDULES") return <SchedulesAdminView theme={theme} />;
          if (activeView === "PROGRAMS") return <ProgramsView theme={theme} />;
          if (activeView === "MEMBERSHIP") return <MembershipView theme={theme} />;
          if (activeView === "SETTINGS") return <SettingsView theme={theme} />;
          if (activeView === "PROFILE") return <ProfileView theme={theme} profile={profile} roles={roles} />;
          if (activeView === "EVENTS_ADMIN") return <EventsAdminView theme={theme} tenantId={tenantId} />;
          return (
            <div className={`flex flex-col items-center justify-center min-h-[60vh] ${theme === "DARK" ? "text-white" : theme === "LIGHT" ? "text-[#4f6b28]" : "text-stone-900"}`}>
              <span className="material-symbols-outlined text-6xl mb-4">construction</span>
              <h3 className="text-2xl font-black uppercase tracking-widest">{activeView} UNDER CONSTRUCTION</h3>
              <p className="mt-2">We're building something elite for you.</p>
            </div>
          );
        })()}
      </main>

      <Modal
        isOpen={showNotificationsModal}
        onClose={() => setShowNotificationsModal(false)}
        title="Notifications"
        theme={theme}
        width={400}
      >
        <div className="space-y-4">
          {unreadNotifications.length > 0 ? (
            unreadNotifications.map(n => (
              <div key={n.id} className="p-4 rounded-2xl border transition-colors bg-surface-container-low border-outline/10 shadow-sm">
                <div className="flex justify-between items-start mb-1">
                  <h5 className="text-[10px] font-black uppercase tracking-widest text-primary">{n.title}</h5>
                  <span className="text-[8px] opacity-40 font-mono">
                    {n.created_at?.toDate ? format(n.created_at.toDate(), "MMM dd, HH:mm") : "Just now"}
                  </span>
                </div>
                <p className="text-xs text-on-surface-variant">{n.message}</p>
              </div>
            ))
          ) : (
            <div className="text-center py-12 opacity-40">
              <span className="material-symbols-outlined text-4xl mb-2">notifications_off</span>
              <p className="text-[10px] font-black uppercase tracking-widest">No unread notifications</p>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}

function Sidebar({ activeView, setActiveView, platformAdminOpen, setPlatformAdminOpen, administrationOpen, setAdministrationOpen, isGlobalUser, hasPermission, profile, onLogout, theme, tenantId, allTenants, globalTenant }: any) {
  return (
    <aside className="w-[320px] h-screen flex flex-col transition-all duration-700 ease-in-out z-30 fixed left-0 top-0 bg-surface">
      {/* Brand Header */}
      <div className="px-8 pt-10 pb-6 mb-4">
        <div className="flex items-center gap-4 group cursor-pointer" onClick={() => setActiveView("DASHBOARD")}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-500 group-hover:rotate-[15deg] shadow-lg bg-primary text-on-primary">
            <span className="material-symbols-outlined text-xl font-black">sports_tennis</span>
          </div>
          <div>
            <h1 className="text-xl font-black italic tracking-tighter leading-none transition-colors text-primary font-headline">
              LINWOOD COURT
            </h1>
            <p className="text-[8px] font-black uppercase tracking-[0.3em] mt-1 transition-colors text-on-surface/40 font-body">
              {tenantId === "consolidated" ? "CONSOLIDATED" : 
               (allTenants?.find((t:any) => t.tenant_id === tenantId || t.id === tenantId)?.name || 
                (tenantId ? tenantId.toUpperCase() : "PLATFORM"))}
            </p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex-1 space-y-1 overflow-y-auto hide-scrollbar">
        <NavItem
          label="DASHBOARD"
          icon="grid_view"
          active={activeView === "DASHBOARD"}
          onClick={() => setActiveView("DASHBOARD")}
          theme={theme}
        />
        <NavItem
          label="COURT BOOKING"
          icon="calendar_today"
          active={activeView === "COURT BOOKING"}
          onClick={() => setActiveView("COURT BOOKING")}
          theme={theme}
        />
        <NavItem
          label="PROGRAMS"
          icon="exercise"
          active={activeView === "PROGRAMS"}
          onClick={() => setActiveView("PROGRAMS")}
          theme={theme}
        />
        <NavItem
          label="MEMBERSHIP"
          icon="card_membership"
          active={activeView === "MEMBERSHIP"}
          onClick={() => setActiveView("MEMBERSHIP")}
          theme={theme}
        />

        {/* Administration Section */}
        {(hasPermission('TENANT_ADMIN') || hasPermission('ADMINISTRATION_VIEW') || hasPermission('DIMENSIONS_VIEW') || hasPermission('ROLE_TYPES_VIEW') || hasPermission('USER_ADMIN_VIEW') || isGlobalUser || profile?.role?.includes('R10005')) && (
          <div className="mt-10 pt-10 relative">
            {/* Tonal Divider */}
            <div className="absolute top-0 left-4 right-4 h-[1px] bg-outline/10"></div>
            <p className="px-8 text-[10px] font-black uppercase tracking-[0.2em] mb-4 text-on-surface-variant/50">Administration</p>

            <button
              onClick={() => setAdministrationOpen(!administrationOpen)}
              className={`w-full flex items-center justify-between px-8 py-4 transition-all duration-300 group ${administrationOpen ? "bg-primary-container/10" : "hover:bg-surface-container-high"
                }`}
            >
              <div className="flex items-center gap-5">
                <span className={`material-symbols-outlined text-2xl transition-colors ${administrationOpen ? "text-primary" : "text-on-surface-variant/60 group-hover:text-primary"}`}>settings</span>
                <span className={`text-base font-black uppercase tracking-[0.2em] transition-colors ${administrationOpen ? "text-on-surface" : "text-on-surface-variant/70 group-hover:text-primary"} font-headline`}>Club Settings</span>
              </div>
              <span className={`material-symbols-outlined text-sm transition-transform duration-300 ${administrationOpen ? "rotate-180 text-primary" : "text-on-surface-variant"}`}>expand_more</span>
            </button>

            {administrationOpen && (
              <div className="mt-2 space-y-1 animate-in fade-in slide-in-from-top-2 duration-300">
                {(hasPermission('TENANT_ADMIN') || isGlobalUser || profile?.role?.includes('R10005')) && (
                  <SubNavItem label="Company" active={activeView === "COMPANY"} onClick={() => setActiveView("COMPANY")} theme={theme} />
                )}
                {(hasPermission('SCHEDULES_VIEW') || profile?.role?.includes('R10005')) && (
                  <SubNavItem label="Schedules" active={activeView === "SCHEDULES"} onClick={() => setActiveView("SCHEDULES")} theme={theme} />
                )}
                {(hasPermission('EVENTS_VIEW') || profile?.role?.includes('R10005')) && (
                  <SubNavItem label="Events" active={activeView === "EVENTS_ADMIN"} onClick={() => setActiveView("EVENTS_ADMIN")} theme={theme} />
                )}
                {(hasPermission('USER_ADMIN_VIEW') || profile?.role?.includes('R10005')) && (
                  <SubNavItem label="Staff" active={activeView === "USER_ADMIN"} onClick={() => setActiveView("USER_ADMIN")} theme={theme} />
                )}
                {(hasPermission('MEMBER_ADMIN_VIEW') || profile?.role?.includes('R10005')) && (
                  <SubNavItem label="Members" active={activeView === "MEMBER_ADMIN"} onClick={() => setActiveView("MEMBER_ADMIN")} theme={theme} />
                )}
                {(hasPermission('ROLE_TYPES_VIEW') || profile?.role?.includes('R10005')) && (
                  <SubNavItem label="Roles" active={activeView === "ROLE_TYPES"} onClick={() => setActiveView("ROLE_TYPES")} theme={theme} />
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* User Profile Section */}
      <div className="p-4 mt-auto">
        <div 
          onClick={() => setActiveView("PROFILE")}
          className={`flex items-center gap-3 p-4 rounded-3xl transition-all duration-500 relative overflow-hidden group cursor-pointer hover:shadow-xl hover:scale-[1.02] border border-outline/5 ${activeView === "PROFILE" ? "bg-primary-container shadow-inner" : "bg-surface-container-low hover:bg-surface-container"}`}
        >
          <div className="relative">
            <img
              src={profile?.portrait_url || profile?.photoURL || "/images/clay_court.png"}
              alt="Profile"
              className="w-10 h-10 rounded-xl object-cover ring-2 ring-offset-2 transition-all duration-500 group-hover:scale-110 ring-primary/20 ring-offset-surface group-hover:ring-primary/50"
            />
            <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 border-2 border-surface rounded-full"></div>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-black uppercase tracking-widest truncate text-on-surface">
              {profile?.first_name || 'Player'} {profile?.last_name || ''}
            </p>
            <p className="text-[8px] font-black uppercase tracking-widest transition-colors text-primary truncate opacity-70">
              {profile?.role || 'Member'}
            </p>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onLogout();
            }}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-300 bg-surface/50 text-on-surface-variant hover:bg-red-500 hover:text-white shadow-sm"
          >
            <span className="material-symbols-outlined text-base">logout</span>
          </button>
        </div>
      </div>
    </aside>
  );
}

function DashboardHome({ theme, profile, tenantId, authUser, userSchedule, onRemoveFromSchedule }: { theme: "LIGHT" | "DARK" | "VINTAGE", profile: any, tenantId: string, authUser: any, userSchedule: any[], onRemoveFromSchedule: (item: any) => void }) {
  const [events, setEvents] = useState<any[]>([]);

  useEffect(() => {
    if (!tenantId) return;
    const q = query(
      collection(db, "tenants", tenantId, "events"),
      orderBy("date", "asc"),
      limit(4)
    );
    const unsub = onSnapshot(q, (snap) => {
      setEvents(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [tenantId]);

  const [selectedEvent, setSelectedEvent] = useState<any | null>(null);

  const featuredEvent = events[0];
  const otherEvents = events.slice(1);

  return (
    <>
      {/* Welcome Hero */}
      <section className="mb-12 relative overflow-hidden rounded-[2.5rem] p-16 flex items-end min-h-[400px] shadow-sm transition-colors duration-500 bg-surface-container-low">
        <div className="absolute inset-0 z-0">
          <img
            src="/images/clay_court.png"
            alt="Tennis court"
            className="w-full h-full object-cover opacity-20 scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-surface to-transparent"></div>
        </div>
        <div className="relative z-10 w-full">
          <span className={`font-black tracking-[0.2em] text-[11px] uppercase mb-4 block transition-colors text-primary`}>
            Welcome Back, {profile?.first_name || authUser?.displayName?.split(' ')[0] || "User"}
          </span>
          <h3 className={`text-7xl font-black tracking-tighter leading-tight max-w-2xl transition-colors ${theme === "DARK" ? "text-white" : "text-on-surface"
            }`} style={{ fontFamily: 'Lexend, sans-serif' }}>READY TO DOMINATE THE COURT?</h3>
        </div>
      </section>

      <div className="grid grid-cols-12 gap-10">
        {/* Performance Stats Bento */}
        <div className="col-span-12 lg:col-span-8 space-y-8">
          <div className="grid grid-cols-3 gap-8">
            <StatCard label="Win Rate" value="68%" trend="+4.2%" icon="trending_up" theme={theme} />
            <StatCard label="Matches" value="124" trend="Total" icon="sports_tennis" theme={theme} />
            <StatCard label="Loyalty Points" value="2,450" trend="Active" icon="workspace_premium" theme={theme} variant="yellow" />
          </div>
          
          {/* Featured Match Card */}
          <div className="rounded-[2.5rem] p-12 relative overflow-hidden group cursor-pointer shadow-xl transition-all hover:scale-[1.01] bg-primary">
            <div className="absolute inset-0 opacity-10 bg-[url('/images/clay_court.png')] bg-cover bg-center mix-blend-overlay"></div>
            <div className="relative z-10 flex justify-between items-center">
              <div>
                <span className="px-4 py-1 rounded-full text-[9px] font-black tracking-widest uppercase bg-white/20 text-white mb-4 inline-block">Scheduled: Tomorrow</span>
                <h4 className="text-4xl font-black text-white tracking-tighter uppercase" style={{ fontFamily: 'Lexend, sans-serif' }}>QUARTER FINAL MATCH</h4>
                <p className="text-white/70 text-xs font-black uppercase tracking-widest mt-2">Center Court • 10:00 AM vs. Marcus V.</p>
              </div>
              <button className="px-8 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all bg-white text-primary hover:bg-stone-100 shadow-lg">
                Match Preview
              </button>
            </div>
          </div>
        </div>

        {/* Recent Activity Section */}
        <div className="col-span-12 lg:col-span-4">
          <div className="rounded-[2.5rem] p-10 h-full transition-colors duration-500 bg-surface-container-low">
            <h4 className="font-black text-xl tracking-tighter uppercase mb-8 transition-colors text-on-surface" style={{ fontFamily: 'Lexend, sans-serif' }}>Recent Activity</h4>
            <div className="space-y-8">
              <ActivityItem icon="check_circle" title="Booking Confirmed" subtitle="Court 4 • Wed, 14 Oct" theme={theme} />
              <ActivityItem icon="trophy" title="Tournament Reg" subtitle="Autumn Open Elite" theme={theme} />
              <ActivityItem icon="payments" title="Membership" subtitle="Processed successfully" theme={theme} />
            </div>
          </div>
        </div>
      </div>

      {/* Schedule Section */}
      <section className="mt-12">
        <div className="flex justify-between items-end mb-10">
          <div>
            <h4 className="text-5xl font-black tracking-tighter uppercase transition-colors text-on-surface" style={{ fontFamily: 'Lexend, sans-serif' }}>Upcoming Bookings</h4>
            <p className="text-on-surface-variant text-[11px] font-black uppercase tracking-widest mt-2">Your scheduled time on the court.</p>
          </div>
          <div className="flex gap-3">
            <button className="w-12 h-12 rounded-2xl flex items-center justify-center transition-all bg-surface-container-low text-primary hover:bg-surface-container-high shadow-sm">
              <span className="material-symbols-outlined font-black">chevron_left</span>
            </button>
            <button className="w-12 h-12 rounded-2xl flex items-center justify-center transition-all bg-surface-container-low text-primary hover:bg-surface-container-high shadow-sm">
              <span className="material-symbols-outlined font-black">chevron_right</span>
            </button>
          </div>
        </div>

        <div className="flex gap-8 overflow-x-auto pb-10 hide-scrollbar">
          {userSchedule.length > 0 ? (
            userSchedule.map(item => (
              <BookingCard
                key={item.id}
                theme={theme}
                type={item.type}
                court={item.type === "EVENT" ? (item.tag || "EVENT") : (item.courtName || item.courtId || "Court")}
                date={format(item.type === "EVENT" ? (item.date?.toDate ? item.date.toDate() : new Date(item.date)) : new Date(item.date), "MMM d")}
                time={item.type === "EVENT" ? format(item.date?.toDate ? item.date.toDate() : new Date(item.date), "h:mm a") : item.time}
                partner={item.type === "EVENT" ? "Club Event" : (item.partner || "Solo Session")}
                avatar={item.type === "EVENT" ? item.image_url : (item.avatar || "/images/clay_court.png")}
                highlight={item.type === "EVENT"}
                onRemove={() => onRemoveFromSchedule(item)}
              />
            ))
          ) : (
            <div className="p-16 rounded-[2.5rem] flex flex-col items-center justify-center min-w-[320px] bg-surface-container-low">
              <span className="material-symbols-outlined text-5xl mb-6 opacity-20 text-primary">calendar_today</span>
              <p className="text-[10px] font-black uppercase tracking-widest opacity-40">No upcoming bookings</p>
            </div>
          )}
        </div>
      </section>

      {/* Events Section */}
      <section className="mt-20 mb-32">
        <h4 className="text-5xl font-black tracking-tighter uppercase mb-12 transition-colors text-on-surface" style={{ fontFamily: 'Lexend, sans-serif' }}>
          Club Events & News
        </h4>
        <div className="grid grid-cols-12 gap-10">
          {featuredEvent ? (
            <div 
              onClick={() => setSelectedEvent(featuredEvent)}
              className={`col-span-12 md:col-span-7 group cursor-pointer overflow-hidden rounded-[2.5rem] relative h-[500px] shadow-2xl transition-all duration-700 hover:scale-[1.01]`}
            >
              <img
                src={featuredEvent.image_url || "/images/clay_court.png"}
                alt={featuredEvent.title}
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent"></div>
              <div className="absolute bottom-0 left-0 p-12 w-full">
                <span className="px-4 py-1.5 rounded-full text-[10px] font-black tracking-widest uppercase mb-6 inline-block bg-primary text-on-primary">
                  {featuredEvent.tag || "Club News"}
                </span>
                <h5 className="text-6xl font-black text-white tracking-tighter uppercase leading-none" style={{ fontFamily: 'Lexend, sans-serif' }}>{featuredEvent.title}</h5>
                <p className="text-white/70 mt-4 max-w-xl text-sm leading-relaxed line-clamp-2">{featuredEvent.description}</p>
              </div>
            </div>
          ) : (
            <div className="col-span-12 md:col-span-7 rounded-[2.5rem] flex items-center justify-center h-[500px] bg-surface-container-low">
              <p className="text-[10px] font-black uppercase tracking-widest opacity-40 text-on-surface-variant">No upcoming events</p>
            </div>
          )}

          <div className="col-span-12 md:col-span-5 flex flex-col gap-4">
            {otherEvents.length > 0 ? (
              otherEvents.map(event => (
                <NewsItem 
                  key={event.id} 
                  theme={theme} 
                  title={event.title} 
                  subtitle={event.description} 
                  tag={event.tag} 
                  onClick={() => setSelectedEvent(event)}
                />
              ))
            ) : (
              <div className="space-y-4">
                <NewsItem theme={theme} title="PRO CLINIC WITH COACH MILLER" subtitle="Master the overhead smash this weekend." tag="Training" />
                <NewsItem theme={theme} title="MIXER NIGHT: DRINKS & DOUBLES" subtitle="Join us for the seasonal social event next Friday." tag="Social" />
              </div>
            )}
          </div>
        </div>
      </section>

      {selectedEvent && (
        <EventDetailsModal
          event={selectedEvent}
          theme={theme}
          profile={profile}
          tenantId={tenantId}
          onClose={() => setSelectedEvent(null)}
        />
      )}
    </>
  );
}

function ThemeSelector({ theme, setTheme }: { theme: "LIGHT" | "DARK" | "VINTAGE", setTheme: (t: "LIGHT" | "DARK" | "VINTAGE") => void }) {
  return (
    <div className="flex items-center gap-1 p-1 rounded-full border transition-colors duration-500 bg-surface-container-low border-outline/10">
      <div className="px-4 py-1.5 flex items-center gap-2 border-r mr-1 transition-colors border-outline/10">
        <span className="text-[10px] font-black uppercase tracking-widest text-on-surface">
          {theme === "VINTAGE" ? "Vintage" : theme === "DARK" ? "Vantage Noir" : "Vantage Sport"}
        </span>
      </div>
      <button
        onClick={() => setTheme("LIGHT")}
        className={`p-1.5 rounded-full transition-all flex items-center justify-center ${theme === "LIGHT" ? "bg-surface shadow-sm ring-1 ring-outline/10 text-primary" : "text-on-surface/40 hover:bg-surface-container-high hover:text-on-surface"}`}
        title="Light Mode"
      >
        <span className="material-symbols-outlined text-sm">sports_tennis</span>
      </button>
      <button
        onClick={() => setTheme("DARK")}
        className={`p-1.5 rounded-full transition-all flex items-center justify-center ${theme === "DARK" ? "bg-surface-container-highest shadow-sm text-primary" : "text-on-surface/40 hover:bg-surface-container-high hover:text-on-surface"}`}
        title="Dark Mode"
      >
        <span className="material-symbols-outlined text-sm">dark_mode</span>
      </button>
      <button
        onClick={() => setTheme("VINTAGE")}
        className={`p-1.5 rounded-full transition-all flex items-center justify-center ${theme === "VINTAGE" ? "bg-surface shadow-sm text-primary" : "text-on-surface/40 hover:bg-surface-container-high hover:text-on-surface"}`}
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
      className={`w-full flex items-center gap-5 py-4 transition-all duration-300 ease-in-out px-8 relative group ${active
        ? "text-primary bg-primary-container/5"
        : "text-on-surface-variant hover:text-primary hover:bg-surface-container-high/50"
        }`}
    >
      {active && (
        <div className="absolute left-0 top-1 bottom-1 w-1 rounded-r-full bg-primary/40" />
      )}
      {/* Alignment Spacer to match NavItem icon width (24px) + gap (20px) */}
      <div className="w-6 flex-shrink-0 flex justify-center">
        <div className={`w-1 h-1 rounded-full bg-current transition-all ${active ? "scale-150" : "opacity-20 group-hover:opacity-100"}`} />
      </div>
      <span className={`text-sm font-black uppercase tracking-[0.2em] transition-all font-headline ${active ? "translate-x-1" : "group-hover:translate-x-1"}`}>
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
        ? "text-primary bg-primary-container/10"
        : "text-on-surface-variant/70 hover:text-primary hover:bg-surface-container-high"
        }`}
    >
      {active && (
        <div className="absolute left-0 top-0 bottom-0 w-1.5 rounded-r-full bg-primary" />
      )}
      <span className={`material-symbols-outlined text-2xl transition-all ${active ? "opacity-100 scale-110" : "opacity-40 group-hover:opacity-100"}`} style={active ? { fontVariationSettings: "'FILL' 1" } : {}}>
        {icon}
      </span>
      <span className={`text-base font-black uppercase tracking-[0.2em] transition-all font-headline ${active ? "translate-x-1" : "group-hover:translate-x-1"}`}>
        {label}
      </span>
    </button>
  );
}

function StatCard({ label, value, trend, icon, theme, active = false, variant }: { label: string; value: string; trend: string; icon: string; theme: "LIGHT" | "DARK" | "VINTAGE"; active?: boolean; variant?: "yellow" | "primary" }) {


  return (
    <div className={`p-10 rounded-[2.5rem] transition-all duration-700 ease-in-out group relative overflow-hidden flex flex-col h-full ${active || variant === 'primary'
      ? "bg-primary shadow-2xl scale-[1.02] z-10"
      : variant === 'yellow'
        ? "bg-tertiary-container shadow-lg"
        : "bg-surface-container-low hover:bg-surface-container-high"
      }`}>
      <div className="flex justify-between items-start mb-10 relative z-10">
        <div className={`w-16 h-16 rounded-[1.5rem] flex items-center justify-center transition-all duration-500 ${active
          ? "bg-on-primary text-primary rotate-[15deg]"
          : "bg-surface text-primary group-hover:rotate-12"
          }`}>
          <span className="material-symbols-outlined text-3xl">{icon}</span>
        </div>
        <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${active || variant === 'primary'
          ? "bg-on-primary/20 text-on-primary"
          : variant === 'yellow'
            ? "bg-on-tertiary-container/10 text-on-tertiary-container"
            : (trend.startsWith('+') ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500")
          }`}>
          {trend}
        </div>
      </div>
      <div className="mt-auto relative z-10">
        <p className={`text-[11px] font-black uppercase tracking-[0.2em] mb-3 transition-colors ${active || variant === 'primary' ? "text-on-primary/70" : variant === 'yellow' ? "text-on-tertiary-container/60" : "text-on-surface-variant"}`}>{label}</p>
        <h3 className={`text-6xl font-black tracking-tighter transition-colors ${active || variant === 'primary' ? "text-on-primary" : variant === 'yellow' ? "text-on-tertiary-container" : "text-on-surface"}`} style={{ fontFamily: 'Lexend, sans-serif' }}>{value}</h3>
      </div>
      {/* Background Micro-animation */}
      <div className={`absolute top-0 right-0 w-48 h-48 rounded-full blur-[80px] -mr-24 -mt-24 transition-opacity duration-1000 ${active ? "bg-on-primary/20 opacity-100" : "bg-primary/5 opacity-0 group-hover:opacity-100"}`}></div>
    </div>
  );
}

function ActivityItem({ icon, title, subtitle, theme }: { icon: string; title: string; subtitle: string; theme: "LIGHT" | "DARK" | "VINTAGE" }) {

  return (
    <div className="flex gap-4 items-center">
      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors bg-surface text-primary`}>
        <span className="material-symbols-outlined text-xl">{icon}</span>
      </div>
      <div>
        <p className={`text-sm font-black uppercase tracking-tight text-on-surface`}>{title}</p>
        <p className={`text-[10px] font-black uppercase tracking-widest opacity-60 text-on-surface-variant`}>{subtitle}</p>
      </div>
    </div>
  );
}

function BookingCard({ court, date, time, partner, avatar, highlight = false, theme, onRemove }: {
  court: string;
  date: string;
  time: string;
  partner?: string;
  avatar?: string;
  highlight?: boolean;
  theme: "LIGHT" | "DARK" | "VINTAGE";
  type?: "BOOKING" | "EVENT";
  onRemove?: () => void;
}) {

  return (
    <div className={`min-w-[320px] p-10 rounded-[2.5rem] transition-all duration-500 group relative overflow-hidden bg-surface-container-low`}>
      <div className="flex justify-between items-start mb-10 relative z-10">
        <div className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest ${highlight 
          ? "bg-primary text-on-primary" 
          : "bg-surface-container-high text-on-surface"}`}>
          {court}
        </div>
        <div className="relative group/menu">
          <button className={`material-symbols-outlined w-8 h-8 rounded-lg flex items-center justify-center transition-colors text-on-surface-variant hover:text-primary hover:bg-surface-container-highest`}>more_vert</button>
          <div className={`absolute right-0 top-full mt-2 w-48 rounded-2xl shadow-2xl opacity-0 translate-y-2 pointer-events-none group-hover/menu:opacity-100 group-hover/menu:translate-y-0 group-hover/menu:pointer-events-auto transition-all z-20 overflow-hidden bg-surface-container-high border border-outline/10`}>
            <button 
              onClick={onRemove}
              className="w-full px-5 py-4 text-left text-[10px] font-black uppercase tracking-widest text-red-500 hover:bg-red-500/10 transition-colors flex items-center gap-3"
            >
              <span className="material-symbols-outlined text-sm">delete</span>
              Cancel Booking
            </button>
          </div>
        </div>
      </div>
      <div className="mb-10 relative z-10">
        <h5 className="text-4xl font-black tracking-tighter text-on-surface" style={{ fontFamily: 'Lexend, sans-serif' }}>{date}</h5>
        <p className="text-xs font-black uppercase tracking-widest mt-2 text-primary">{time}</p>
      </div>
      <div className="flex items-center gap-4 relative z-10">
        <img src={avatar} alt={partner} className="w-12 h-12 rounded-2xl object-cover ring-2 ring-surface-container-high shadow-sm" />
        <span className="text-[10px] font-black uppercase tracking-widest text-on-surface">With {partner}</span>
      </div>
      <div className={`absolute -right-4 -bottom-4 w-24 h-24 rounded-full blur-3xl opacity-0 group-hover:opacity-20 transition-opacity duration-700 bg-primary`}></div>
    </div>
  );
}

function NewsItem({ title, subtitle, tag, theme, onClick }: { title: string; subtitle: string; tag: string; theme: "LIGHT" | "DARK" | "VINTAGE"; onClick?: () => void }) {
  return (
    <div onClick={onClick} className="group cursor-pointer flex gap-6 p-6 rounded-[2rem] transition-all duration-300 hover:bg-surface-container-low">
      <div className="w-28 h-28 flex-shrink-0 overflow-hidden rounded-[1.5rem] relative transition-all duration-500 group-hover:scale-105 bg-surface-container-high">
        <div className="absolute inset-0 flex items-center justify-center opacity-20 text-primary">
          <span className="material-symbols-outlined text-4xl font-black">image</span>
        </div>
      </div>
      <div className="flex flex-col justify-center">
        <span className="font-black text-[10px] tracking-widest uppercase transition-colors text-primary">{tag}</span>
        <h6 className="text-xl font-black tracking-tight mt-1 group-hover:translate-x-1 transition-all text-on-surface" style={{ fontFamily: 'Lexend, sans-serif' }}>{title}</h6>
        <p className="text-[10px] font-black uppercase tracking-widest mt-1 opacity-60 text-on-surface-variant">{subtitle}</p>
      </div>
    </div>
  );
}


function ProgramsView({ theme }: { theme: "LIGHT" | "DARK" | "VINTAGE" }) {

  return (
    <div className="space-y-16 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header Section */}
      <div className="flex justify-between items-center">
        <h2 className="text-5xl font-black tracking-tighter uppercase transition-colors text-primary" style={{ fontFamily: 'Lexend, sans-serif' }}>
          CLUB PROGRAMS
        </h2>
        <div className="relative">
          <input
            type="text"
            placeholder="Search training..."
            className="border-none rounded-full px-8 py-3 w-80 focus:ring-2 text-sm font-black uppercase tracking-widest transition-colors bg-surface-container text-on-surface focus:ring-primary placeholder:text-on-surface-variant/40"
          />
          <span className="material-symbols-outlined absolute right-4 top-3 text-on-surface-variant/60">search</span>
        </div>
      </div>

      {/* Hero Section */}
      <div className="grid grid-cols-12 gap-8">
        <div className="col-span-12 lg:col-span-8 group relative h-[450px] overflow-hidden rounded-[40px] shadow-2xl border border-outline/10">
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

        <div className="col-span-12 lg:col-span-4 rounded-[40px] p-10 flex flex-col justify-between shadow-xl transition-colors border bg-surface-container-low border-outline/10">
          <div>
            <h4 className="text-3xl font-black leading-tight mb-4 uppercase transition-colors text-primary">
              PRO-FOCUS WEEKEND
            </h4>
            <p className="font-medium leading-relaxed transition-colors text-on-surface-variant">
              Join Coach Marcus for a 48-hour immersion into strategy and bio-mechanics. Limited to 8 participants.
            </p>
          </div>
          <button className="w-full py-4 border-2 rounded-full text-[10px] font-black tracking-[0.2em] transition-all uppercase border-primary text-primary hover:bg-primary hover:text-on-primary">
            VIEW COACH BIO
          </button>
        </div>
      </div>

      {/* Training Tracks Section */}
      <section>
        <div className="flex justify-between items-end mb-12">
          <h3 className="text-5xl font-black tracking-tighter uppercase transition-colors text-primary">
            TRAINING TRACKS
          </h3>
          <div className="flex gap-8 text-[10px] font-black tracking-widest uppercase text-on-surface-variant">
            <span>FILTER BY:</span>
            <button className="pb-1 transition-colors text-primary border-b-2 border-primary">ALL</button>
            <button className="hover:text-primary transition-colors">YOUTH</button>
            <button className="hover:text-primary transition-colors">ADULT</button>
            <button className="hover:text-primary transition-colors">PRO</button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Active Clinics */}
          <div className="rounded-[40px] overflow-hidden flex flex-col group shadow-lg transition-colors border bg-surface-container-low border-outline/10">
            <div className="h-64 overflow-hidden">
              <img src="/images/active_clinics.png" alt="Active Clinics" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
            </div>
            <div className="p-10 flex-1 relative">
              <div className="absolute right-10 top-10 w-12 h-12 rounded-full flex items-center justify-center shadow-md transition-colors bg-surface-container-highest text-primary">
                <span className="material-symbols-outlined">bolt</span>
              </div>
              <h4 className="text-3xl font-black mb-4 uppercase transition-colors text-primary">ACTIVE CLINICS</h4>
              <p className="text-sm font-medium leading-relaxed mb-8 transition-colors text-on-surface-variant">
                High-energy drills focused on footwork, stamina, and consistent point construction.
              </p>
              <div className="flex justify-between items-center mt-auto">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant/60">STARTS AT</div>
                  <div className="text-2xl font-black text-on-surface">$45/HR</div>
                </div>
                <button className="w-14 h-14 rounded-full flex items-center justify-center hover:scale-110 transition-transform shadow-lg bg-primary text-on-primary">
                  <span className="material-symbols-outlined">arrow_forward</span>
                </button>
              </div>
            </div>
          </div>

          {/* Junior Academy */}
          <div className="rounded-[40px] overflow-hidden flex flex-col group shadow-lg transition-colors bg-surface-container-low border border-outline/10">
            <div className="h-64 overflow-hidden relative">
              <img src="/images/junior_academy.png" alt="Junior Academy" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
              <div className="absolute top-6 left-6 px-4 py-1 backdrop-blur rounded-full text-[8px] font-black tracking-widest uppercase bg-surface/90 text-primary">
                PREMIER LEVEL
              </div>
            </div>
            <div className="p-10 flex-1">
              <h4 className="text-3xl font-black mb-4 uppercase leading-none transition-colors text-primary">JUNIOR<br />ACADEMY</h4>
              <p className="text-sm font-medium leading-relaxed mb-8 transition-colors text-on-surface-variant">
                Developing the next generation of competitors. Age groups 8-16.
              </p>
              <button className="w-full py-4 rounded-2xl text-[10px] font-black tracking-widest transition-all uppercase bg-primary text-on-primary">
                EXPLORE PATHWAY
              </button>
            </div>
          </div>

          {/* Social Mixers */}
          <div className="rounded-[40px] overflow-hidden flex flex-col group shadow-lg transition-colors border bg-surface-container-low border-outline/10">
            <div className="p-10 pb-0">
              <div className="flex justify-between items-start mb-4">
                <h4 className="text-3xl font-black uppercase leading-none transition-colors text-primary">SOCIAL<br />MIXERS</h4>
                <span className="material-symbols-outlined transition-colors text-primary/40">groups</span>
              </div>
              <p className="text-sm font-medium leading-relaxed mb-6 transition-colors text-on-surface-variant">
                Network while you play. Round-robin format followed by clubhouse drinks.
              </p>
              <div className="flex items-center -space-x-3 mb-8">
                {[1, 2, 3].map(i => (
                  <div key={i} className="w-8 h-8 rounded-full border-2 overflow-hidden border-surface">
                    <img src={`https://i.pravatar.cc/100?img=${i + 10}`} alt="User" />
                  </div>
                ))}
                <div className="h-8 px-2 text-on-primary text-[8px] font-black flex items-center justify-center rounded-full border-2 transition-colors bg-primary border-surface">
                  +14
                </div>
              </div>
            </div>
            <div className="h-48 overflow-hidden relative mt-auto">
              <img src="/images/social_mixers.png" alt="Social Mixers" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
              <div className="absolute right-6 bottom-6 w-12 h-12 rounded-2xl flex items-center justify-center shadow-xl transition-colors bg-primary text-on-primary">
                <span className="material-symbols-outlined">calendar_today</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Spring Session Section */}
      <section className="rounded-[40px] p-16 grid grid-cols-12 gap-12 transition-colors border bg-surface-container-low border-outline/10 shadow-sm">
        <div className="col-span-12 lg:col-span-5 space-y-8">
          <div className="space-y-4">
            <h3 className="text-6xl font-black tracking-tighter uppercase leading-none transition-colors text-on-surface">
              SPRING<br />SESSION '24
            </h3>
            <div className="flex items-center gap-4 transition-colors text-primary">
              <div className="w-6 h-6 rounded-md flex items-center justify-center transition-colors bg-primary text-on-primary">
                <span className="material-symbols-outlined text-sm">schedule</span>
              </div>
              <span className="text-[10px] font-black tracking-widest uppercase">24/7 ELITE ACCESS</span>
            </div>
            <p className="font-medium leading-relaxed max-w-sm transition-colors text-on-surface-variant">
              Registration is now open for all technical workshops and weekly ladders. Secure your spot before March 15th.
            </p>
          </div>

          <div className="space-y-4 pt-4">
            <div className={`flex items-center gap-4 transition-colors ${theme === "DARK" ? "text-[#ccff00]" : theme === "VINTAGE" ? "text-black" : "text-[#4f6b28]"}`}>
              <div className={`w-6 h-6 rounded-md flex items-center justify-center transition-colors ${theme === "DARK" ? "bg-[#ccff00] text-stone-950" : theme === "VINTAGE" ? "bg-black text-white" : "bg-[#cfff00] text-[#4f6b28]"}`}>
                <span className="material-symbols-outlined text-sm">check</span>
              </div>
              <span className="text-[10px] font-black tracking-widest uppercase">ITF GOLD STANDARDS</span>
            </div>
            <div className={`flex items-center gap-4 transition-colors ${theme === "DARK" ? "text-[#ccff00]" : theme === "VINTAGE" ? "text-black" : "text-[#4f6b28]"}`}>
              <div className={`w-6 h-6 rounded-md flex items-center justify-center transition-colors ${theme === "DARK" ? "bg-[#ccff00] text-stone-950" : theme === "VINTAGE" ? "bg-black text-white" : "bg-[#cfff00] text-[#4f6b28]"}`}>
                <span className="material-symbols-outlined text-sm">bar_chart</span>
              </div>
              <span className="text-[10px] font-black tracking-widest uppercase">PERFORMANCE TRACKING</span>
            </div>
          </div>
        </div>

        <div className="col-span-12 lg:col-span-7 grid grid-cols-1 md:grid-cols-2 gap-6">
          {[
            { date: "MARCH 12-14", title: "SERVE VELOCITY CLINIC", badge: "2 SLOTS LEFT", badgeColor: theme === "DARK" ? "bg-stone-900 text-[#ccff00]" : theme === "LIGHT" ? "bg-[#cfff00] text-[#4f6b28]" : "bg-yellow-100 text-yellow-700" },
            { date: "APRIL 05", title: "DOUBLES MASTERCLASS", badge: "OPENING SOON", badgeColor: theme === "DARK" ? "bg-stone-900 text-white" : theme === "LIGHT" ? "bg-[#cfff00] text-[#4f6b28]" : "bg-blue-100 text-blue-700" },
            { date: "WEEKLY SAT", title: "CARDIO TENNIS LADDER", badge: "RECURRING", badgeColor: theme === "DARK" ? "bg-stone-900 text-[#ccff00]" : theme === "LIGHT" ? "bg-[#cfff00] text-[#4f6b28]" : "bg-green-100 text-green-700" },
            { date: "MONTHLY", title: "VIDEO ANALYSIS LAB", badge: "MEMBER EXCLUSIVE", badgeColor: theme === "DARK" ? "bg-stone-900 text-white" : theme === "LIGHT" ? "bg-[#cfff00] text-[#4f6b28]" : "bg-stone-200 text-stone-800" }
          ].map((item, i) => (
            <div key={i} className={`p-8 rounded-3xl group cursor-pointer hover:shadow-xl transition-all border ${theme === "DARK" ? "bg-stone-900 border-stone-800" : theme === "LIGHT" ? "bg-white border-[#cfff00]/20" : "bg-white border-stone-100"}`}>
              <div className={`text-[10px] font-black tracking-widest uppercase mb-2 ${theme === "DARK" ? "text-white" : "text-stone-600"}`}>{item.date}</div>
              <h5 className={`text-lg font-black tracking-tighter mb-6 group-hover:translate-x-1 transition-all uppercase leading-tight ${theme === "DARK" ? "text-white group-hover:text-[#ccff00]" : theme === "LIGHT" ? "text-[#4f6b28] group-hover:text-[#3a4f1d]" : "text-stone-900 group-hover:text-black"}`}>{item.title}</h5>
              <div className="flex justify-between items-center">
                <span className={`px-3 py-1 rounded-full text-[8px] font-black tracking-widest uppercase ${item.badgeColor}`}>
                  {item.badge}
                </span>
                <span className={`material-symbols-outlined group-hover:translate-x-1 transition-all ${theme === "DARK" ? "text-white group-hover:text-[#ccff00]" : theme === "LIGHT" ? "text-[#4f6b28] group-hover:text-[#3a4f1d]" : "text-stone-900 group-hover:text-black"}`}>chevron_right</span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function ProfileView({ theme, profile, roles }: { theme: "LIGHT" | "DARK" | "VINTAGE", profile: any, roles: any[] }) {
  const [showEditModal, setShowEditModal] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [showSuccess, setShowSuccess] = React.useState<string | null>(null);
  const [isUploading, setIsUploading] = React.useState(false);
  const [showPortraitSelector, setShowPortraitSelector] = React.useState(false);
  const [defaultPortraits, setDefaultPortraits] = React.useState<{ id: string; url: string; label: string }[]>([]);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "platform_company", "defaults", "portraits"), (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as any[];
      setDefaultPortraits(data);
    });
    return () => unsubscribe();
  }, []);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!profile || !profile.user_id) {
      console.error("Missing profile user_id for upload:", profile);
      alert("Error: User ID not found. Please refresh and try again.");
      return;
    }

    setIsUploading(true);
    try {
      console.log("Starting photo upload for:", profile.user_id);
      const effectiveTenantId = profile.tenant_id || "Global";
      const compositeId = `${effectiveTenantId}_${profile.user_id}`;
      const path = `users/${compositeId}/portrait`;

      console.log("Storage path:", path);
      if (!storage) throw new Error("Firebase Storage not initialized");

      const storageRef = ref(storage, path);
      console.log("Storage ref created");

      await uploadBytes(storageRef, file);
      console.log("Bytes uploaded");

      const photoURL = await getDownloadURL(storageRef);
      console.log("Download URL obtained:", photoURL);

      // Update global_users doc
      if (!profile.id) throw new Error("Missing profile Firestore ID");
      const userRef = doc(db, "global_users", profile.id);
      await updateDoc(userRef, {
        portrait_url: photoURL,
        updated_at: serverTimestamp()
      });
      console.log("Firestore updated");

      // Update auth profile
      if (auth.currentUser) {
        await updateProfile(auth.currentUser, { photoURL });
        console.log("Auth profile updated");
      }

      setShowSuccess("Profile photo updated!");
      setTimeout(() => setShowSuccess(null), 3000);
    } catch (err: any) {
      console.error("Photo upload error:", err);
      alert(`Failed to upload photo: ${err.message || "Unknown error"}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handlePortraitSelect = async (url: string) => {
    if (!profile || !profile.id) return;
    setIsUploading(true);
    try {
      const userRef = doc(db, "global_users", profile.id);
      await updateDoc(userRef, {
        portrait_url: url,
        updated_at: serverTimestamp()
      });

      if (auth.currentUser) {
        await updateProfile(auth.currentUser, { photoURL: url });
      }

      setShowSuccess("Profile photo updated!");
      setTimeout(() => setShowSuccess(null), 3000);
      setShowPortraitSelector(false);
    } catch (err: any) {
      console.error("Portrait update error:", err);
      alert(`Failed to update photo: ${err.message || "Unknown error"}`);
    } finally {
      setIsUploading(false);
    }
  };
  const [formData, setFormData] = React.useState({
    first_name: profile?.first_name || "",
    last_name: profile?.last_name || "",
    phone: profile?.phone || "",
    address_street_1: profile?.address_street_1 || profile?.address_street || "",
    address_street_2: profile?.address_street_2 || "",
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
        address_street_1: profile.address_street_1 || profile.address_street || "",
        address_street_2: profile.address_street_2 || "",
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
        <div className={`fixed top-8 right-8 z-[9999] px-8 py-4 rounded-2xl shadow-2xl animate-in slide-in-from-right-8 duration-500 border flex items-center gap-3 ${theme === "DARK" ? "bg-[#ccff00] text-stone-950 border-[#ccff00]" : "bg-stone-900 text-white border-stone-800"
          }`}>
          <span className="material-symbols-outlined">check_circle</span>
          <span className="text-xs font-black uppercase tracking-widest">{showSuccess}</span>
        </div>
      )}

      <div className="flex items-center gap-10">
        <div className={`w-40 h-40 rounded-[40px] overflow-hidden border-4 shadow-2xl transition-all relative group ${theme === "DARK" ? "border-stone-800" : "border-white"
          }`}>
          <img
            src={profile?.portrait_url || "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=2574&auto=format&fit=crop"}
            alt="Profile"
            className={`w-full h-full object-cover transition-all ${isUploading ? "opacity-50 blur-sm" : "group-hover:scale-110 group-hover:opacity-50"}`}
          />
          <div className="absolute inset-0 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-all text-white z-10 gap-3">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="flex flex-col items-center hover:scale-110 transition-transform"
            >
              <span className="material-symbols-outlined text-3xl mb-0.5">photo_camera</span>
              <span className="text-[8px] font-black uppercase tracking-widest">Upload</span>
            </button>
            <div className={`w-8 h-[1px] ${theme === "DARK" ? "bg-stone-700" : "bg-white/30"}`}></div>
            <button
              onClick={() => setShowPortraitSelector(true)}
              disabled={isUploading}
              className="flex flex-col items-center hover:scale-110 transition-transform"
            >
              <span className="material-symbols-outlined text-3xl mb-0.5">face</span>
              <span className="text-[8px] font-black uppercase tracking-widest">Default</span>
            </button>
          </div>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handlePhotoUpload}
            accept="image/*"
            className="hidden"
          />
        </div>
        <div>
          <div className={`text-[10px] font-black tracking-[0.3em] uppercase mb-2 transition-colors ${theme === "DARK" ? "text-white" : theme === "VINTAGE" ? "text-stone-800" : "text-stone-900"
            }`}>Member Profile</div>
          <h2 className={`text-6xl font-black tracking-tighter uppercase leading-none transition-colors ${theme === "DARK" ? "text-white" : "text-black"
            }`} style={{ fontFamily: 'Lexend, sans-serif' }}>
            {profile ? `${profile.first_name} ${profile.last_name}` : "MEMBER"}
          </h2>
          <div className="flex flex-wrap gap-4 mt-6">
            {(() => {
              const roleIds = profile?.roles || (profile?.role ? [profile.role] : []);
              const userRoles = roles.filter(r => roleIds.includes(r.role_id) || roleIds.includes(r.id));

              if (userRoles.length > 0) {
                return userRoles.map(r => (
                  <span key={r.role_id || r.id} className={`px-5 py-2 rounded-full text-[10px] font-black tracking-widest uppercase transition-colors ${theme === "DARK" ? "bg-stone-800 text-[#ccff00]" : theme === "VINTAGE" ? "bg-black text-white" : "bg-stone-900 text-white"
                    }`}>
                    {r.role_name}
                  </span>
                ));
              }

              return (
                <span className={`px-5 py-2 rounded-full text-[10px] font-black tracking-widest uppercase transition-colors ${theme === "DARK" ? "bg-stone-800 text-[#ccff00]" : theme === "VINTAGE" ? "bg-black text-white" : "bg-stone-900 text-white"
                  }`}>
                  {profile?.role || "GUEST"}
                </span>
              );
            })()}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-8">
        <div className={`col-span-12 rounded-[40px] p-12 shadow-xl space-y-10 transition-colors border ${theme === "DARK" ? "bg-stone-900 border-stone-800" :
          theme === "VINTAGE" ? "bg-white border-stone-50" :
            "bg-stone-50 border-stone-100"
          }`}>
          <h3 className={`text-3xl font-black tracking-tighter uppercase transition-colors ${theme === "DARK" ? "text-[#ccff00]" : "text-black"
            }`}>Account Security</h3>
          <div className="grid grid-cols-2 gap-10">
            {[
              { label: "REGISTERED EMAIL", value: profile?.email || "NOT PROVIDED" },
              { label: "PHONE VERIFIED", value: profile?.phone || "NOT PROVIDED" },
              { label: "MAILING ADDRESS", value: (profile?.address_street_1 || profile?.address_street) ? `${profile?.address_street_1 || profile?.address_street}${profile?.address_street_2 ? `, ${profile.address_street_2}` : ""}, ${profile.address_city}, ${profile.address_state} ${profile.address_zip}` : "NOT PROVIDED" },
              { label: "INTERNAL ID", value: profile?.user_id || "NOT PROVIDED" },
            ].map((item, i) => (
              <div key={i} className={item.label === "MAILING ADDRESS" ? "col-span-2" : ""}>
                <div className={`text-[10px] font-black mb-1 tracking-widest transition-colors ${theme === "DARK" ? "text-white" : "text-stone-900"
                  }`}>{item.label}</div>
                <div className={`font-black text-lg transition-colors ${theme === "DARK" ? "text-white" : "text-black"
                  }`}>{item.value}</div>
              </div>
            ))}
          </div>
          <div className="pt-8 flex gap-4">
            <button
              onClick={() => setShowEditModal(true)}
              className={`flex-1 py-4 rounded-2xl text-[10px] font-black tracking-widest uppercase transition-colors ${theme === "DARK" ? "bg-stone-800 text-[#ccff00]" : theme === "VINTAGE" ? "bg-black text-white" : "bg-[#4f6b28] text-white"
                }`}>
              EDIT INFORMATION
            </button>
            <button
              onClick={handleChangePassword}
              className={`flex-1 py-4 border-2 rounded-2xl text-[10px] font-black tracking-widest uppercase transition-colors ${theme === "DARK" ? "border-stone-800 text-white hover:bg-stone-800" : theme === "VINTAGE" ? "border-black text-black hover:bg-black hover:text-white" : "border-[#4f6b28] text-[#4f6b28] hover:bg-[#4f6b28] hover:text-white"
                }`}>
              CHANGE PASSWORD
            </button>
          </div>
        </div>

        <Modal
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          title="Edit Information"
          theme={theme}
          width={600}
          footer={
            <div className="flex gap-4">
              <button
                onClick={() => setShowEditModal(false)}
                className={`flex-1 py-5 rounded-2xl text-[10px] font-black tracking-widest uppercase transition-colors border ${theme === "DARK" ? "border-stone-800 text-white hover:bg-stone-800" : "border-stone-200 text-stone-900 hover:bg-stone-50"}`}
              >
                CANCEL
              </button>
              <button
                onClick={handleSaveProfile}
                disabled={isSaving}
                className={`flex-1 py-5 rounded-2xl text-[10px] font-black tracking-widest uppercase transition-all shadow-xl flex items-center justify-center gap-3 ${theme === "DARK" ? "bg-[#ccff00] text-stone-950 shadow-[#ccff00]/20" : theme === "LIGHT" ? "bg-[#4f6b28] text-white shadow-[#4f6b28]/20" : "bg-stone-900 text-white shadow-stone-900/20"}`}
              >
                {isSaving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                    SAVING...
                  </>
                ) : "SAVE CHANGES"}
              </button>
            </div>
          }
        >
          <div className="space-y-8">
            <div className="grid grid-cols-2 gap-8">
              <div>
                <label className={`text-[10px] font-black uppercase tracking-widest mb-3 block ${theme === "DARK" ? "text-white" : theme === "LIGHT" ? "text-[#4f6b28]/60" : "text-stone-600"}`}>First Name</label>
                <input
                  value={formData.first_name}
                  onChange={e => setFormData({ ...formData, first_name: e.target.value })}
                  className={`w-full bg-transparent border-b-2 py-4 text-lg font-bold outline-none transition-colors placeholder:text-stone-200 ${theme === "DARK" ? "border-stone-800 focus:border-[#ccff00] text-white" : theme === "LIGHT" ? "border-stone-200 focus:border-[#4f6b28] text-[#4f6b28]" : "border-stone-100 focus:border-stone-900 text-stone-900"}`}
                />
              </div>
              <div>
                <label className={`text-[10px] font-black uppercase tracking-widest mb-3 block ${theme === "DARK" ? "text-white" : theme === "LIGHT" ? "text-[#4f6b28]/60" : "text-stone-600"}`}>Last Name</label>
                <input
                  value={formData.last_name}
                  onChange={e => setFormData({ ...formData, last_name: e.target.value })}
                  className={`w-full bg-transparent border-b-2 py-4 text-lg font-bold outline-none transition-colors placeholder:text-stone-200 ${theme === "DARK" ? "border-stone-800 focus:border-[#ccff00] text-white" : theme === "LIGHT" ? "border-stone-200 focus:border-[#4f6b28] text-[#4f6b28]" : "border-stone-100 focus:border-stone-900 text-stone-900"}`}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-8">
              <div>
                <label className={`text-[10px] font-black uppercase tracking-widest mb-3 block ${theme === "DARK" ? "text-white" : theme === "LIGHT" ? "text-[#4f6b28]/60" : "text-stone-600"}`}>Street Address 1</label>
                <input
                  value={formData.address_street_1}
                  onChange={e => setFormData({ ...formData, address_street_1: e.target.value })}
                  placeholder="123 Tennis Court Lane"
                  className={`w-full bg-transparent border-b-2 py-4 text-lg font-bold outline-none transition-colors placeholder:text-stone-200 ${theme === "DARK" ? "border-stone-800 focus:border-[#ccff00] text-white" : theme === "LIGHT" ? "border-stone-200 focus:border-[#4f6b28] text-[#4f6b28]" : "border-stone-100 focus:border-stone-900 text-stone-900"}`}
                />
              </div>
              <div>
                <label className={`text-[10px] font-black uppercase tracking-widest mb-3 block ${theme === "DARK" ? "text-white" : theme === "LIGHT" ? "text-[#4f6b28]/60" : "text-stone-600"}`}>Street Address 2</label>
                <input
                  value={formData.address_street_2}
                  onChange={e => setFormData({ ...formData, address_street_2: e.target.value })}
                  placeholder="Apt 4B"
                  className={`w-full bg-transparent border-b-2 py-4 text-lg font-bold outline-none transition-colors placeholder:text-stone-200 ${theme === "DARK" ? "border-stone-800 focus:border-[#ccff00] text-white" : theme === "LIGHT" ? "border-stone-200 focus:border-[#4f6b28] text-[#4f6b28]" : "border-stone-100 focus:border-stone-900 text-stone-900"}`}
                />
              </div>
            </div>
            <div>
              <label className={`text-[10px] font-black uppercase tracking-widest mb-3 block ${theme === "DARK" ? "text-white" : theme === "LIGHT" ? "text-[#4f6b28]/60" : "text-stone-600"}`}>Phone Number</label>
              <input
                value={formData.phone}
                onChange={e => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+1 (555) 000-0000"
                className={`w-full bg-transparent border-b-2 py-4 text-lg font-bold outline-none transition-colors placeholder:text-stone-200 ${theme === "DARK" ? "border-stone-800 focus:border-[#ccff00] text-white" : theme === "LIGHT" ? "border-stone-200 focus:border-[#4f6b28] text-[#4f6b28]" : "border-stone-100 focus:border-stone-900 text-stone-900"}`}
              />
            </div>
            <div className="grid grid-cols-3 gap-8">
              <div className="col-span-1">
                <label className={`text-[10px] font-black uppercase tracking-widest mb-3 block ${theme === "DARK" ? "text-white" : theme === "LIGHT" ? "text-[#4f6b28]/60" : "text-stone-600"}`}>City</label>
                <input
                  value={formData.address_city}
                  onChange={e => setFormData({ ...formData, address_city: e.target.value })}
                  placeholder="Wimbledon"
                  className={`w-full bg-transparent border-b-2 py-4 text-lg font-bold outline-none transition-colors placeholder:text-stone-200 ${theme === "DARK" ? "border-stone-800 focus:border-[#ccff00] text-white" : theme === "LIGHT" ? "border-stone-200 focus:border-[#4f6b28] text-[#4f6b28]" : "border-stone-100 focus:border-stone-900 text-stone-900"}`}
                />
              </div>
              <div className="col-span-1">
                <label className={`text-[10px] font-black uppercase tracking-widest mb-3 block ${theme === "DARK" ? "text-white" : theme === "LIGHT" ? "text-[#4f6b28]/60" : "text-stone-600"}`}>State</label>
                <select
                  value={formData.address_state}
                  onChange={e => setFormData({ ...formData, address_state: e.target.value })}
                  className={`w-full bg-transparent border-b-2 py-4 text-lg font-bold outline-none transition-colors appearance-none ${!formData.address_state ? '!text-stone-200' : ''} ${theme === "DARK" ? "border-stone-800 focus:border-[#ccff00] text-white" : theme === "LIGHT" ? "border-stone-200 focus:border-[#4f6b28] text-[#4f6b28]" : "border-stone-100 focus:border-stone-900 text-stone-900"}`}
                >
                  <option value="" className={theme === "DARK" ? "bg-stone-900" : "bg-white"}>Select State</option>
                  {US_STATES.map(state => (
                    <option key={state} value={state} className={theme === "DARK" ? "bg-stone-900" : "bg-white"}>{state}</option>
                  ))}
                </select>
              </div>
              <div className="col-span-1">
                <label className={`text-[10px] font-black uppercase tracking-widest mb-3 block ${theme === "DARK" ? "text-white" : theme === "LIGHT" ? "text-[#4f6b28]/60" : "text-stone-600"}`}>Zip Code</label>
                <input
                  value={formData.address_zip}
                  onChange={e => setFormData({ ...formData, address_zip: e.target.value })}
                  placeholder="SW19"
                  className={`w-full bg-transparent border-b-2 py-4 text-lg font-bold outline-none transition-colors placeholder:text-stone-200 ${theme === "DARK" ? "border-stone-800 focus:border-[#ccff00] text-white" : theme === "LIGHT" ? "border-stone-200 focus:border-[#4f6b28] text-[#4f6b28]" : "border-stone-100 focus:border-stone-900 text-stone-900"}`}
                />
              </div>
            </div>
          </div>
        </Modal>

        {/* Default Portrait Selector Modal */}
        <Modal
          isOpen={showPortraitSelector}
          onClose={() => setShowPortraitSelector(false)}
          title="Select Default Portrait"
          theme={theme}
          width={700}
        >
          <div className="space-y-10 py-4">
            <div className="grid grid-cols-4 gap-6">
              {defaultPortraits.map((portrait) => (
                <button
                  key={portrait.id}
                  onClick={() => handlePortraitSelect(portrait.url)}
                  className={`group relative aspect-square rounded-3xl overflow-hidden border-2 transition-all hover:scale-105 ${theme === "DARK" ? "border-stone-800 hover:border-[#ccff00]" : theme === "LIGHT" ? "border-stone-100 hover:border-[#4f6b28]" : "border-stone-100 hover:border-stone-900"
                    }`}
                >
                  <img
                    src={portrait.url}
                    alt={portrait.label}
                    className="w-full h-full object-cover transition-transform group-hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <span className="text-[8px] font-black text-white uppercase tracking-widest">Select</span>
                  </div>
                </button>
              ))}
              {defaultPortraits.length === 0 && (
                <div className={`col-span-4 py-20 text-center ${theme === "DARK" ? "text-stone-500" : "text-stone-400"}`}>
                  <span className="material-symbols-outlined text-4xl mb-4 opacity-20">face</span>
                  <p className="text-[10px] font-black uppercase tracking-widest">No default portraits found</p>
                </div>
              )}
            </div>
          </div>
        </Modal>
      </div>
    </div>
  );
}

function MembershipView({ theme }: { theme: "LIGHT" | "DARK" | "VINTAGE" }) {

  return (
    <div className="space-y-16 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <h2 className={`text-5xl font-black tracking-tighter uppercase transition-colors ${theme === "DARK" ? "text-white" : theme === "LIGHT" ? "text-[#4f6b28]" : "text-black"
        }`} style={{ fontFamily: 'Lexend, sans-serif' }}>
        MEMBERSHIP PLANS
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {[
          { name: "SILVER", price: "99", color: theme === "DARK" ? "bg-stone-900 text-white" : theme === "VINTAGE" ? "bg-white text-black border border-stone-50" : theme === "LIGHT" ? "bg-white text-[#4f6b28] border-2 border-[#4f6b28]/10" : "bg-stone-50 text-stone-900", features: ["2 Bookings/Week", "Standard Access", "Social Mixers"] },
          { name: "GOLD", price: "199", popular: true, color: theme === "DARK" ? "bg-[#ccff00] text-stone-950" : theme === "VINTAGE" ? "bg-black text-white" : theme === "LIGHT" ? "bg-[#4f6b28] text-white shadow-[#4f6b28]/20" : "bg-stone-900 text-white", features: ["Unlimited Bookings", "Priority Courts", "Guest Passes (4)", "Pro Discounts"] },
          { name: "PLATINUM", price: "299", color: theme === "DARK" ? "bg-stone-950 text-white border border-stone-800" : theme === "VINTAGE" ? "bg-white text-black border-2 border-black" : theme === "LIGHT" ? "bg-[#4f6b28] text-white" : "bg-stone-900 text-white", features: ["24/7 Access", "Personal Locker", "Free Stringing", "Pro Clinic Access"] }
        ].map((plan, i) => (
          <div key={i} className={`${plan.color} rounded-[40px] p-12 shadow-2xl relative flex flex-col transition-all hover:scale-105`}>
            {plan.popular && (
              <div className={`absolute -top-4 left-12 px-6 py-2 text-[10px] font-black tracking-[0.2em] rounded-full shadow-lg transition-colors ${theme === "DARK" ? "bg-white text-black" : theme === "LIGHT" ? "bg-[#ccff00] text-[#4f6b28]" : "bg-stone-900 text-white"
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
            <button className={`mt-12 w-full py-5 rounded-2xl text-[10px] font-black tracking-widest transition-all uppercase ${plan.popular ? (theme === "DARK" ? "bg-stone-900 text-white" : theme === "VINTAGE" ? "bg-white text-black" : theme === "LIGHT" ? "bg-[#ccff00] text-[#4f6b28]" : "bg-white text-stone-900") :
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

  return (
    <div className="max-w-2xl space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <h2 className={`text-5xl font-black tracking-tighter uppercase transition-colors ${theme === "DARK" ? "text-white" : theme === "LIGHT" ? "text-[#4f6b28]" : "text-black"
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
          <div key={i} className={`flex items-center justify-between p-8 rounded-3xl border shadow-sm transition-all ${theme === "DARK" ? "bg-stone-900 border-stone-800" :
            theme === "VINTAGE" ? "bg-white border-stone-50" :
              "bg-white border-[#4f6b28]/10"
            }`}>
            <div className="flex items-center gap-6">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors ${theme === "DARK" ? "bg-stone-800 text-[#ccff00]" : theme === "LIGHT" ? "bg-[#cfff00] text-[#4f6b28]" : "bg-stone-50 text-stone-900"
                }`}>
                <span className="material-symbols-outlined">{opt.icon}</span>
              </div>
              <div>
                <h4 className={`font-black text-lg uppercase transition-colors ${theme === "DARK" ? "text-white" : theme === "LIGHT" ? "text-[#4f6b28]" : "text-stone-900"
                  }`}>{opt.title}</h4>
                <p className={`${theme === "DARK" ? "text-white" : theme === "LIGHT" ? "text-[#4f6b28]/60" : "text-stone-700"} text-sm font-medium`}>{opt.desc}</p>
              </div>
            </div>
            <button className={`w-14 h-8 rounded-full relative transition-colors ${opt.active ? (theme === "DARK" ? "bg-[#ccff00]" : theme === "VINTAGE" ? "bg-black" : theme === "LIGHT" ? "bg-[#4f6b28]" : "bg-stone-900") : "bg-stone-200"
              }`}>
              <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-transform ${opt.active ? "right-1" : "left-1"}`}></div>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
