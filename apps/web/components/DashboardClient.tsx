"use client";
import React from "react";
import Image from "next/image";
import { useTenant } from "../context/TenantContext";
import { auth } from "../lib/firebase";
import { signOut } from "firebase/auth";
import DimensionsView from "./DimensionsView";
import RoleTypesView from "./RoleTypesView";

export default function DashboardClient({ params }: { params: { tenantId: string } }) {
  const { tenantId: contextTenantId, loading } = useTenant();
  const [activeView, setActiveView] = React.useState<"DASHBOARD" | "COURT BOOKING" | "PROGRAMS" | "MEMBERSHIP" | "SETTINGS" | "PROFILE" | "ADMINISTRATION" | "PLATFORM_ADMINISTRATION" | "AI_ADMIN" | "DIMENSIONS" | "ROLE_TYPES" | "USER_ADMIN" | "PLATFORM_TENANT_ADMIN">("DASHBOARD");
  const [platformAdminOpen, setPlatformAdminOpen] = React.useState(false);
  const [administrationOpen, setAdministrationOpen] = React.useState(false);
  const tenantId = params.tenantId || contextTenantId;

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-on-background selection:bg-primary/30">
      {/* SideNavBar Component */}
      <aside className="fixed left-0 top-0 h-full w-72 border-r bg-white flex flex-col z-50">
        <div className="py-10 px-8">
          <h1 className="text-3xl font-black italic tracking-tighter text-[#4f6b28]">
            {tenantId ? tenantId.toUpperCase() : "KINETIC COURT"}
          </h1>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-stone-400 mt-1">
            Elite Membership
          </p>
        </div>

        <nav className="flex-1 space-y-2 py-4">
          <NavItem
            icon="grid_view"
            label="Dashboard"
            active={activeView === "DASHBOARD"}
            onClick={() => setActiveView("DASHBOARD")}
          />
          <NavItem
            icon="sports_tennis"
            label="My Schedule"
            active={activeView === "COURT BOOKING"}
            onClick={() => setActiveView("COURT BOOKING")}
          />
          <NavItem
            icon="calendar_today"
            label="Programs"
            active={activeView === "PROGRAMS"}
            onClick={() => setActiveView("PROGRAMS")}
          />
          <NavItem
            icon="card_membership"
            label="Membership"
            active={activeView === "MEMBERSHIP"}
            onClick={() => setActiveView("MEMBERSHIP")}
          />
          <NavItem
            icon="admin_panel_settings"
            label="Administration"
            active={activeView === "ADMINISTRATION" || activeView === "ROLE_TYPES"}
            onClick={() => {
              setActiveView("ADMINISTRATION");
              setAdministrationOpen(!administrationOpen);
            }}
          />
          {administrationOpen && (
            <div className="bg-stone-50/50 py-2">
              <SubNavItem
                label="Role Types"
                active={activeView === "ROLE_TYPES"}
                onClick={() => setActiveView("ROLE_TYPES")}
              />
            </div>
          )}
          <NavItem
            icon="settings"
            label="Settings"
            active={activeView === "SETTINGS"}
            onClick={() => setActiveView("SETTINGS")}
          />
          <NavItem
            icon="hub"
            label="Platform Admin"
            active={activeView === "PLATFORM_ADMINISTRATION" || activeView === "AI_ADMIN" || activeView === "DIMENSIONS" || activeView === "USER_ADMIN" || activeView === "PLATFORM_TENANT_ADMIN"}
            onClick={() => {
              setActiveView("PLATFORM_ADMINISTRATION");
              setPlatformAdminOpen(!platformAdminOpen);
            }}
          />
          {platformAdminOpen && (
            <div className="bg-stone-50/50 py-2">
              <SubNavItem
                label="AI Admin"
                active={activeView === "AI_ADMIN"}
                onClick={() => setActiveView("AI_ADMIN")}
              />
              <SubNavItem
                label="Dimensions"
                active={activeView === "DIMENSIONS"}
                onClick={() => setActiveView("DIMENSIONS")}
              />
              <SubNavItem
                label="User Admin"
                active={activeView === "USER_ADMIN"}
                onClick={() => setActiveView("USER_ADMIN")}
              />
              <SubNavItem
                label="Platform Tenant Admin"
                active={activeView === "PLATFORM_TENANT_ADMIN"}
                onClick={() => setActiveView("PLATFORM_TENANT_ADMIN")}
              />
            </div>
          )}
        </nav>

        <div className="mt-auto p-8 border-t border-stone-100">
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
            <div className="w-10 h-10 rounded-full bg-stone-100 overflow-hidden border-2 border-transparent group-hover:border-[#4f6b28] transition-all">
              <img
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuCIVNG3lcWVm-Ge5NEEZUf-GdmgLwhFzcFnGsboAMqruvOsGoG2KsUaJnNi7egzkBHc-8ccIDPAhhUoKLhZ-6htVuQieJX6w20tMHdUP6wvr91JZaIcvqIJEmHuGFa4z4EtafMvMDZVDCE0FvjKCsjs2BQO27LBpb-zAw7Vj2lY1t1lbEH1wcnRQt6l-9LceLngmvluUeTcJdDm9RVYiiwiCLuDdYSnjSgJK13-P326RgshwnopS9Qa-T0LE8kRyriIPjwU5NIlUVY"
                alt="Profile"
                className="w-full h-full object-cover"
              />
            </div>
            <div>
              <p className="text-xs font-black group-hover:text-[#4f6b28] transition-colors">ALEX STERLING</p>
              <p className="text-[9px] font-black uppercase tracking-widest text-stone-400">Gold Tier Member</p>
            </div>
          </div>

          <button
            onClick={() => signOut(auth)}
            className="mt-6 flex items-center gap-3 text-stone-400 hover:text-red-500 transition-colors px-1"
          >
            <span className="material-symbols-outlined text-sm">logout</span>
            <span className="text-[10px] font-black uppercase tracking-widest">LOGOUT</span>
          </button>
        </div>
      </aside>

      {/* TopAppBar Component */}
      <header className="sticky top-0 z-40 w-full bg-white/60 backdrop-blur-xl flex justify-between items-center ml-72 px-12 py-6 max-w-[calc(100%-18rem)]">
        <h2 className="text-4xl font-black italic text-[#4f6b28] tracking-tighter uppercase" style={{ fontFamily: 'Lexend, sans-serif' }}>{activeView}</h2>
        <div className="flex items-center gap-6">
          <div className="relative hidden lg:block">
            <input
              type="text"
              placeholder="Search facilities..."
              className="bg-surface-container-low border-none rounded-full px-6 py-2 w-64 focus:ring-2 focus:ring-primary text-sm text-on-surface"
            />
            <span className="material-symbols-outlined absolute right-4 top-2 text-stone-400">search</span>
          </div>
          <div className="flex items-center gap-4 text-primary">
            <button className="material-symbols-outlined hover:opacity-80 transition-opacity">notifications</button>
            <button className="material-symbols-outlined hover:opacity-80 transition-opacity">settings</button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="ml-72 p-12 min-h-screen">
        {activeView === "DASHBOARD" ? (
          <>
            {/* Welcome Hero */}
            <section className="mb-12 relative overflow-hidden rounded-2xl bg-surface-container-low p-12 flex items-end min-h-[320px] shadow-sm">
              <div className="absolute inset-0 z-0">
                <img
                  src="/images/clay_court.png"
                  alt="Tennis court"
                  className="w-full h-full object-cover opacity-30 scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-surface-container-low via-surface-container-low/40 to-transparent"></div>
              </div>
              <div className="relative z-10 w-full">
                <span className="text-primary font-black tracking-widest text-sm uppercase mb-4 block">Welcome Back, Alex</span>
                <h3 className="text-7xl font-black text-on-surface tracking-tighter leading-tight max-w-2xl">READY TO DOMINATE THE COURT?</h3>
              </div>
            </section>

            <div className="grid grid-cols-12 gap-8">
              {/* Performance Stats Bento */}
              <div className="col-span-12 lg:col-span-8 grid grid-cols-3 gap-6">
                <StatCard label="Win Rate" value="68%" trend="+4.2% this month" color="primary" />
                <StatCard label="Matches" value="124" trend="Total Career Played" color="surface" />
                <StatCard label="Loyalty Points" value="2,450" trend="Elite Status Active" color="tertiary" />

                {/* Next Match Card */}
                <div className="col-span-3 bg-on-surface text-surface rounded-2xl p-8 relative overflow-hidden shadow-xl">
                  <div className="absolute right-0 top-0 h-full w-1/3 bg-primary opacity-10 skew-x-12 translate-x-12"></div>
                  <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
                    <div>
                      <span className="inline-block bg-primary text-on-primary px-3 py-1 rounded-full text-[10px] font-black tracking-widest uppercase mb-4">Upcoming: Tomorrow</span>
                      <h4 className="text-3xl font-black tracking-tighter">QUARTER FINAL MATCH</h4>
                      <p className="text-surface/60 font-medium mt-2">Center Court • 10:00 AM vs. Marcus V.</p>
                    </div>
                    <button className="bg-surface text-on-surface px-8 py-4 rounded-full font-black text-xs tracking-widest hover:bg-primary-container hover:text-on-primary-container transition-all uppercase shadow-lg">
                      MATCH PREVIEW
                    </button>
                  </div>
                </div>
              </div>

              {/* Recent Activity Section */}
              <div className="col-span-12 lg:col-span-4">
                <div className="bg-surface-container-low rounded-2xl p-8 h-full shadow-sm">
                  <div className="flex justify-between items-center mb-6">
                    <h4 className="font-headline font-black text-xl tracking-tighter uppercase">Recent Activity</h4>
                    <button className="text-primary font-black text-[10px] tracking-widest uppercase hover:underline">View All</button>
                  </div>
                  <div className="space-y-6">
                    <ActivityItem icon="check_circle" title="Booking Confirmed" subtitle="Court 4 • Wed, 14 Oct" color="bg-primary-container text-primary" fill />
                    <ActivityItem icon="trophy" title="Tournament Registration" subtitle="Autumn Open Elite Tier" color="bg-secondary-container text-secondary" />
                    <ActivityItem icon="payments" title="Membership Renewal" subtitle="Processed successfully" color="bg-tertiary-container text-tertiary" />
                  </div>
                </div>
              </div>
            </div>

            {/* Upcoming Bookings */}
            <section className="mt-16">
              <div className="flex justify-between items-end mb-8">
                <div>
                  <h4 className="text-4xl font-black text-on-surface tracking-tighter uppercase">Upcoming Bookings</h4>
                  <p className="text-stone-400 font-medium mt-1">Your scheduled time on the court.</p>
                </div>
                <div className="flex gap-2">
                  <button className="w-10 h-10 rounded-full border border-outline-variant/30 flex items-center justify-center text-[#4f6b28] hover:bg-primary-container transition-colors">
                    <span className="material-symbols-outlined">chevron_left</span>
                  </button>
                  <button className="w-10 h-10 rounded-full border border-outline-variant/30 flex items-center justify-center text-[#4f6b28] hover:bg-primary-container transition-colors">
                    <span className="material-symbols-outlined">chevron_right</span>
                  </button>
                </div>
              </div>

              <div className="flex gap-6 overflow-x-auto pb-8 hide-scrollbar">
                <BookingCard court="Court 02" date="OCT 16" time="04:00 PM - 05:30 PM" partner="Sarah Jenkins" avatar="https://lh3.googleusercontent.com/aida-public/AB6AXuDJwGLQJGS7l8awuXxFimqmgZMt3TgCyqyLykcGCi-I30U4I6UMXYtSSHoLMLp-X_Jh3IDS8WG85Go6xqEYtnE3ZuPzsENZW3X_DVY0IyohJE1JXEztGlZmksG0ifboNkfrakgRhDqaARnOym2XV1Bz_7RRHq7SGY2l_b7n1mrmOSYYjtDkvYJwPhzSV6NOYvLoeiV4jONAvGzksAWjX3u0JAjzJM38DeDRn8mO4seXqz0uojWd-WCz41rqriUeXQBFGr-PNYJDwko" />
                <BookingCard court="Court 08" date="OCT 18" time="09:00 AM - 10:30 AM" isOpen />
                <BookingCard court="Clay Court A" date="OCT 19" time="02:00 PM - 04:00 PM" partner="David Chen" avatar="https://lh3.googleusercontent.com/aida-public/AB6AXuBzfMV3RQuW53lY_bhBvzBMT-I3HlNV_sphtXexF5W_G4XkRxeqpHnR-qftrvvgBpR8ICU84H6IzrvC4mtisehaYF4bJtcMsQyBNDvIdynLEn7WZUxGs0yGtrCb6Uy2n9cOrcEVDEx9rurz4q7ULq18bYhOZ8uakqYr398Jv79LVVfZrMzIozUEiRFK8LvlPak-m0-thE3HgKPhoOEcdaX4PZ0LMBGaFXZIE35tp_pd_eBNrtngIobFSvwDt6j2IbAtRP7YRcGmaGE" highlight />
                <BookingCard court="Court 01" date="OCT 22" time="05:30 PM - 07:00 PM" partner="Emma Watson" avatar="https://lh3.googleusercontent.com/aida-public/AB6AXuBzzuPwdLFtvkWfVtGdUUQWVmIi4KEQypeMrixMSTcgzhQFnc4cwbnSbPlVNw7gv1yXa5tMGjZFa6nOirsGggsolwq7PL0xndKn751oEnA29NzpG0Mx1xNs4wUFiPHlgL46jM66YbdKq6kM8SsbQzqrlSS5dqb_xz1MYIps9CCqjo_yl7HBsMFDtDEcyqWiokD4YmsMYd9rB1FhdBTk01BhklCqlAunBZzrqYxLdFBJYTOrwBYDXiKkyZcQYJ3J2VTtQAUNCgP_cKs" />
              </div>
            </section>

            {/* Club News */}
            <section className="mt-16 mb-24">
              <h4 className="text-4xl font-black text-on-surface tracking-tighter uppercase mb-8">Club News</h4>
              <div className="grid grid-cols-12 gap-8">
                <div className="col-span-12 md:col-span-7 group cursor-pointer overflow-hidden rounded-2xl relative h-[400px] shadow-lg">
                  <img
                    src="/images/clay_court.png"
                    alt="New facilities"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent"></div>
                  <div className="absolute bottom-0 left-0 p-8">
                    <span className="bg-primary text-on-primary px-3 py-1 rounded-full text-[10px] font-black tracking-widest uppercase mb-4 inline-block">New Facilities</span>
                    <h5 className="text-4xl font-black text-white tracking-tighter">THE CLAY REVOLUTION ARRIVES</h5>
                    <p className="text-white/70 mt-2 max-w-lg">Three new professional-grade clay courts are now open. Experience the authentic European feel.</p>
                  </div>
                </div>

                <div className="col-span-12 md:col-span-5 flex flex-col gap-8">
                  <NewsItem title="PRO CLINIC WITH COACH MILLER" subtitle="Master the overhead smash this weekend." tag="Training" />
                  <NewsItem title="MIXER NIGHT: DRINKS & DOUBLES" subtitle="Join us for the seasonal social event next Friday." tag="Social" />
                  <NewsItem title="THE FALL COLLECTION HAS LANDED" subtitle="Exclusive Kinetic Court apparel now available." tag="Pro Shop" />
                </div>
              </div>
            </section>
          </>
        ) : activeView === "AI_ADMIN" ? (
          <PlaceholderView title="AI Admin" icon="psychology" />
        ) : activeView === "DIMENSIONS" ? (
          <DimensionsView />
        ) : activeView === "ROLE_TYPES" ? (
          <RoleTypesView />
        ) : activeView === "USER_ADMIN" ? (
          <PlaceholderView title="User Admin" icon="person_search" />
        ) : activeView === "PLATFORM_TENANT_ADMIN" ? (
          <PlaceholderView title="Platform Tenant Admin" icon="corporate_fare" />
        ) : activeView === "COURT BOOKING" ? (
          <CourtBookingView />
        ) : activeView === "PROGRAMS" ? (
          <ProgramsView />
        ) : activeView === "MEMBERSHIP" ? (
          <MembershipView />
        ) : activeView === "SETTINGS" ? (
          <SettingsView />
        ) : activeView === "PROFILE" ? (
          <ProfileView />
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
function SubNavItem({ label, active = false, onClick }: { label: string; active?: boolean; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-5 py-3 transition-all duration-300 ease-in-out pl-20 relative group ${active
        ? "text-[#4f6b28]"
        : "text-stone-400 hover:text-stone-600"
        }`}
    >
      <span className={`text-[10px] font-black uppercase tracking-[0.2em] transition-all ${active ? "translate-x-1" : "group-hover:translate-x-1"}`} style={{ fontFamily: 'Lexend, sans-serif' }}>
        {label}
      </span>
    </button>
  );
}

function NavItem({ icon, label, active = false, onClick }: { icon: string; label: string; active?: boolean; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-5 py-4 transition-all duration-300 ease-in-out px-8 relative group ${active
          ? "text-[#4f6b28]"
          : "text-stone-400 hover:text-stone-600"
        }`}
    >
      {active && (
        <div className="absolute left-0 top-0 bottom-0 w-2 bg-[#4f6b28] rounded-r-full" />
      )}
      <span className={`material-symbols-outlined text-2xl transition-all ${active ? "opacity-100 scale-110" : "opacity-40 group-hover:opacity-100"}`} style={active ? { fontVariationSettings: "'FILL' 1" } : {}}>
        {icon}
      </span>
      <span className={`text-[11px] font-black uppercase tracking-[0.2em] transition-all ${active ? "translate-x-1" : "group-hover:translate-x-1"}`} style={{ fontFamily: 'Lexend, sans-serif' }}>
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
        <p className="text-stone-400 font-bold uppercase tracking-widest text-xs">Module Under Construction</p>
      </div>
    </div>
  );
}

function StatCard({ label, value, trend, color }: { label: string; value: string; trend: string; color: string }) {
  const bgColor = color === "primary" ? "bg-surface-container-highest" : color === "tertiary" ? "bg-tertiary-container" : "bg-surface-container-highest";
  const textColor = color === "tertiary" ? "text-on-tertiary-container" : color === "primary" ? "text-primary" : "text-on-surface";

  return (
    <div className={`col-span-1 ${bgColor} p-8 rounded-2xl flex flex-col justify-between shadow-sm border border-black/5`}>
      <span className={`font-label text-xs uppercase font-bold tracking-widest ${color === "tertiary" ? "text-on-tertiary-container/60" : "text-stone-500"}`}>
        {label}
      </span>
      <div className="mt-4">
        <div className={`text-5xl font-black ${textColor}`}>{value}</div>
        <div className={`flex items-center text-xs font-bold mt-2 ${color === "tertiary" ? "text-on-tertiary-container/60" : color === "primary" ? "text-primary" : "text-stone-400"}`}>
          {color === "primary" && <span className="material-symbols-outlined text-sm mr-1">trending_up</span>}
          <span>{trend}</span>
        </div>
      </div>
    </div>
  );
}

function ActivityItem({ icon, title, subtitle, color, fill = false }: { icon: string; title: string; subtitle: string; color: string; fill?: boolean }) {
  return (
    <div className="flex gap-4 items-center">
      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${color}`}>
        <span className="material-symbols-outlined" style={fill ? { fontVariationSettings: "'FILL' 1" } : {}}>{icon}</span>
      </div>
      <div>
        <p className="text-sm font-bold">{title}</p>
        <p className="text-xs text-stone-500">{subtitle}</p>
      </div>
    </div>
  );
}

function BookingCard({ court, date, time, partner, avatar, isOpen = false, highlight = false }: { court: string; date: string; time: string; partner?: string; avatar?: string; isOpen?: boolean; highlight?: boolean }) {
  return (
    <div className="min-w-[300px] bg-white border border-stone-100 p-6 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-6">
        <div className={`${highlight ? 'bg-primary-container text-on-primary-container' : 'bg-surface-container-highest text-on-surface-variant'} px-3 py-1 rounded text-[10px] font-black uppercase`}>
          {court}
        </div>
        <button className="material-symbols-outlined text-stone-300 hover:text-stone-500 transition-colors">more_vert</button>
      </div>
      <div className="mb-6">
        <h5 className="text-2xl font-black text-on-surface">{date}</h5>
        <p className="text-sm font-bold text-stone-400 uppercase tracking-tighter">{time}</p>
      </div>
      <div className="flex items-center gap-3 pt-6 border-t border-stone-50">
        {isOpen ? (
          <>
            <div className="w-8 h-8 rounded-full bg-secondary-container flex items-center justify-center text-secondary">
              <span className="material-symbols-outlined text-sm">person_add</span>
            </div>
            <span className="text-xs font-bold">Open Slot</span>
          </>
        ) : (
          <>
            <img src={avatar} alt={partner} className="w-8 h-8 rounded-full object-cover border border-stone-200" />
            <span className="text-xs font-bold">With {partner}</span>
          </>
        )}
      </div>
    </div>
  );
}

function NewsItem({ title, subtitle, tag }: { title: string; subtitle: string; tag: string }) {
  return (
    <div className="group cursor-pointer flex gap-6 hover:translate-x-1 transition-transform">
      <div className="w-24 h-24 flex-shrink-0 overflow-hidden rounded-xl bg-stone-100 relative">
        <div className="absolute inset-0 bg-primary/10 flex items-center justify-center">
          <span className="material-symbols-outlined text-primary/40 text-4xl">image</span>
        </div>
      </div>
      <div className="py-2">
        <span className="text-primary font-black text-[10px] tracking-widest uppercase">{tag}</span>
        <h6 className="text-lg font-black text-on-surface tracking-tight mt-1 group-hover:text-primary transition-colors">{title}</h6>
        <p className="text-stone-500 text-xs mt-1">{subtitle}</p>
      </div>
    </div>
  );
}
function CourtBookingView() {
  return (
    <div className="space-y-12">
      {/* Date Selection */}
      <section>
        <div className="flex justify-between items-center mb-8">
          <div>
            <h3 className="text-2xl font-black tracking-tighter uppercase">Select Date</h3>
            <p className="text-stone-400 text-sm font-medium mt-1">Showing availability for October 2023</p>
          </div>
          <button className="flex items-center gap-2 bg-surface-container-low px-4 py-2 rounded-full font-bold text-xs uppercase tracking-widest border border-outline-variant/10">
            <span className="material-symbols-outlined text-sm">calendar_month</span>
            October 2023
          </button>
        </div>

        <div className="flex gap-4 overflow-x-auto pb-4 hide-scrollbar">
          {[12, 13, 14, 15, 16, 17, 18].map((day) => (
            <button
              key={day}
              className={`flex-shrink-0 w-20 h-24 rounded-2xl flex flex-col items-center justify-center transition-all ${day === 14
                  ? "bg-[#4f6b28] text-white shadow-lg shadow-[#4f6b28]/20 scale-105"
                  : "bg-surface-container-low text-on-surface hover:bg-stone-100"
                }`}
            >
              <span className="text-[10px] font-black uppercase tracking-widest opacity-60">
                {day === 12 ? 'Mon' : day === 13 ? 'Tue' : day === 14 ? 'Wed' : day === 15 ? 'Thu' : day === 16 ? 'Fri' : day === 17 ? 'Sat' : 'Sun'}
              </span>
              <span className="text-3xl font-black mt-1">{day}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Courts Availability */}
      <div className="grid grid-cols-12 gap-8">
        <div className="col-span-12 lg:col-span-6 space-y-6">
          <CourtSection title="Court 01 (Premium Grass)" />
        </div>
        <div className="col-span-12 lg:col-span-6 space-y-6">
          <CourtSection title="Court 02 (Traditional Clay)" />
        </div>
      </div>
    </div>
  );
}

function CourtSection({ title }: { title: string }) {
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
    <div className="bg-surface-container-low rounded-3xl p-8 shadow-sm">
      <div className="flex justify-between items-center mb-8">
        <h4 className="font-black tracking-tighter uppercase text-xl">{title}</h4>
        <span className="material-symbols-outlined text-stone-300">info</span>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {times.map((slot, i) => (
          <button
            key={i}
            disabled={slot.status === "booked"}
            className={`p-6 rounded-2xl flex flex-col items-start transition-all border ${slot.status === "booked"
                ? "bg-stone-50 border-stone-100 opacity-50 cursor-not-allowed"
                : "bg-white border-stone-100 hover:border-primary hover:shadow-md cursor-pointer group"
              }`}
          >
            <span className={`text-sm font-black ${slot.status === "available" ? "text-primary" : "text-stone-400"}`}>
              {slot.time}
            </span>
            <div className="mt-2 flex items-center justify-between w-full">
              <span className={`text-[10px] font-bold uppercase tracking-widest ${slot.status === "available" ? "text-stone-500" : "text-stone-300"}`}>
                {slot.status === "available" ? "AVAILABLE" : `BOOKED: ${slot.user}`}
              </span>
              {slot.status === "available" && (
                <span className="material-symbols-outlined text-sm opacity-0 group-hover:opacity-100 transition-opacity">add_circle</span>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function ProgramsView() {
  return (
    <div className="space-y-16 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header Section */}
      <div className="flex justify-between items-center">
        <h2 className="text-5xl font-black italic tracking-tighter text-[#4f6b28] uppercase" style={{ fontFamily: 'Lexend, sans-serif' }}>
          CLUB PROGRAMS
        </h2>
        <div className="relative">
          <input
            type="text"
            placeholder="Search training..."
            className="bg-[#f7f8f2] border-none rounded-full px-8 py-3 w-80 focus:ring-2 focus:ring-[#4f6b28] text-sm font-medium italic"
          />
          <span className="material-symbols-outlined absolute right-4 top-3 text-stone-400">search</span>
        </div>
      </div>

      {/* Hero Section */}
      <div className="grid grid-cols-12 gap-8">
        <div className="col-span-12 lg:col-span-8 group relative h-[450px] overflow-hidden rounded-[40px] shadow-2xl">
          <img
            src="/images/programs_hero.png"
            alt="Championship Clinic"
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-transparent"></div>
          <div className="absolute inset-0 p-12 flex flex-col justify-end max-w-2xl">
            <h3 className="text-7xl font-black italic text-white leading-[0.9] tracking-tighter mb-6 uppercase">
              CHAMPIONSHIP CLINIC 2024
            </h3>
            <p className="text-white/80 text-lg font-medium leading-relaxed">
              Intensive technical refinement for competitive players. Lead by ITF-certified master professionals.
            </p>
          </div>
        </div>

        <div className="col-span-12 lg:col-span-4 bg-[#fdfbe6] rounded-[40px] p-10 flex flex-col justify-between shadow-xl">
          <div>
            <h4 className="text-3xl font-black italic text-[#4f6b28] leading-tight mb-4 uppercase">
              PRO-FOCUS WEEKEND
            </h4>
            <p className="text-[#4f6b28]/70 font-medium leading-relaxed">
              Join Coach Marcus for a 48-hour immersion into strategy and bio-mechanics. Limited to 8 participants.
            </p>
          </div>
          <button className="w-full py-4 border-2 border-[#4f6b28] text-[#4f6b28] rounded-full text-xs font-black tracking-[0.2em] hover:bg-[#4f6b28] hover:text-white transition-all uppercase">
            VIEW COACH BIO
          </button>
        </div>
      </div>

      {/* Training Tracks Section */}
      <section>
        <div className="flex justify-between items-end mb-12">
          <h3 className="text-5xl font-black italic tracking-tighter text-[#4f6b28] uppercase">
            TRAINING TRACKS
          </h3>
          <div className="flex gap-8 text-[10px] font-black tracking-widest uppercase text-stone-400">
            <span>FILTER BY:</span>
            <button className="text-[#4f6b28] border-b-2 border-[#4f6b28] pb-1">ALL</button>
            <button className="hover:text-stone-600 transition-colors">YOUTH</button>
            <button className="hover:text-stone-600 transition-colors">ADULT</button>
            <button className="hover:text-stone-600 transition-colors">PRO</button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Active Clinics */}
          <div className="bg-[#fdfbe6] rounded-[40px] overflow-hidden flex flex-col group shadow-lg">
            <div className="h-64 overflow-hidden">
              <img src="/images/active_clinics.png" alt="Active Clinics" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
            </div>
            <div className="p-10 flex-1 relative">
              <div className="absolute right-10 top-10 w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-md">
                <span className="material-symbols-outlined text-[#4f6b28]">bolt</span>
              </div>
              <h4 className="text-3xl font-black italic text-[#4f6b28] mb-4 uppercase">ACTIVE CLINICS</h4>
              <p className="text-[#4f6b28]/60 text-sm font-medium leading-relaxed mb-8">
                High-energy drills focused on footwork, stamina, and consistent point construction.
              </p>
              <div className="flex justify-between items-center mt-auto">
                <div>
                  <div className="text-[10px] font-black text-[#4f6b28]/40 uppercase tracking-widest">STARTS AT</div>
                  <div className="text-2xl font-black text-[#4f6b28]">$45/HR</div>
                </div>
                <button className="w-14 h-14 bg-[#4f6b28] text-white rounded-full flex items-center justify-center hover:scale-110 transition-transform shadow-lg shadow-[#4f6b28]/20">
                  <span className="material-symbols-outlined">arrow_forward</span>
                </button>
              </div>
            </div>
          </div>

          {/* Junior Academy */}
          <div className="bg-[#cfff00] rounded-[40px] overflow-hidden flex flex-col group shadow-lg">
            <div className="h-64 overflow-hidden relative">
              <img src="/images/junior_academy.png" alt="Junior Academy" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
              <div className="absolute top-6 left-6 px-4 py-1 bg-white/90 backdrop-blur rounded-full text-[8px] font-black tracking-widest uppercase">
                PREMIER LEVEL
              </div>
            </div>
            <div className="p-10 flex-1">
              <h4 className="text-3xl font-black italic text-[#1a1a1a] mb-4 uppercase leading-none">JUNIOR<br />ACADEMY</h4>
              <p className="text-black/60 text-sm font-medium leading-relaxed mb-8">
                Developing the next generation of competitors. Age groups 8-16.
              </p>
              <button className="w-full py-4 bg-[#4f6b28] text-white rounded-2xl text-[10px] font-black tracking-widest hover:opacity-90 transition-all uppercase">
                EXPLORE PATHWAY
              </button>
            </div>
          </div>

          {/* Social Mixers */}
          <div className="bg-[#fdfbe6] rounded-[40px] overflow-hidden flex flex-col group shadow-lg">
            <div className="p-10 pb-0">
              <div className="flex justify-between items-start mb-4">
                <h4 className="text-3xl font-black italic text-[#4f6b28] uppercase leading-none">SOCIAL<br />MIXERS</h4>
                <span className="material-symbols-outlined text-[#4f6b28] opacity-40">groups</span>
              </div>
              <p className="text-[#4f6b28]/60 text-sm font-medium leading-relaxed mb-6">
                Network while you play. Round-robin format followed by clubhouse drinks.
              </p>
              <div className="flex items-center -space-x-3 mb-8">
                {[1, 2, 3].map(i => (
                  <div key={i} className="w-8 h-8 rounded-full border-2 border-[#fdfbe6] bg-stone-200 overflow-hidden">
                    <img src={`https://i.pravatar.cc/100?img=${i + 10}`} alt="User" />
                  </div>
                ))}
                <div className="h-8 px-2 bg-[#4f6b28] text-white text-[8px] font-black flex items-center justify-center rounded-full border-2 border-[#fdfbe6]">
                  +14
                </div>
              </div>
            </div>
            <div className="h-48 overflow-hidden relative mt-auto">
              <img src="/images/social_mixers.png" alt="Social Mixers" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
              <div className="absolute right-6 bottom-6 w-12 h-12 bg-black text-white rounded-2xl flex items-center justify-center shadow-xl">
                <span className="material-symbols-outlined">calendar_today</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Spring Session Section */}
      <section className="bg-stone-50 rounded-[40px] p-16 grid grid-cols-12 gap-12">
        <div className="col-span-12 lg:col-span-5 space-y-8">
          <div className="space-y-4">
            <h3 className="text-6xl font-black italic tracking-tighter text-[#1a1a1a] uppercase leading-none">
              SPRING<br />SESSION '24
            </h3>
            <p className="text-stone-500 font-medium leading-relaxed max-w-sm">
              Registration is now open for all technical workshops and weekly ladders. Secure your spot before March 15th.
            </p>
          </div>

          <div className="space-y-4 pt-4">
            <div className="flex items-center gap-4 text-[#4f6b28]">
              <div className="w-6 h-6 bg-[#4f6b28] text-white rounded-md flex items-center justify-center">
                <span className="material-symbols-outlined text-sm">check</span>
              </div>
              <span className="text-xs font-black tracking-widest uppercase">ITF GOLD STANDARDS</span>
            </div>
            <div className="flex items-center gap-4 text-[#4f6b28]">
              <div className="w-6 h-6 bg-[#4f6b28] text-white rounded-md flex items-center justify-center">
                <span className="material-symbols-outlined text-sm">bar_chart</span>
              </div>
              <span className="text-xs font-black tracking-widest uppercase">PERFORMANCE TRACKING</span>
            </div>
          </div>
        </div>

        <div className="col-span-12 lg:col-span-7 grid grid-cols-1 md:grid-cols-2 gap-6">
          {[
            { date: "MARCH 12-14", title: "SERVE VELOCITY CLINIC", badge: "2 SLOTS LEFT", badgeColor: "bg-yellow-100 text-yellow-700" },
            { date: "APRIL 05", title: "DOUBLES MASTERCLASS", badge: "OPENING SOON", badgeColor: "bg-blue-100 text-blue-700" },
            { date: "WEEKLY SAT", title: "CARDIO TENNIS LADDER", badge: "RECURRING", badgeColor: "bg-green-100 text-green-700" },
            { date: "MONTHLY", title: "VIDEO ANALYSIS LAB", badge: "MEMBER EXCLUSIVE", badgeColor: "bg-stone-200 text-stone-600" }
          ].map((item, i) => (
            <div key={i} className="bg-white p-8 rounded-3xl group cursor-pointer hover:shadow-xl transition-all border border-stone-100">
              <div className="text-[10px] font-black text-stone-400 tracking-widest uppercase mb-2">{item.date}</div>
              <h5 className="text-lg font-black italic text-stone-900 mb-6 group-hover:text-[#4f6b28] transition-colors uppercase leading-tight">{item.title}</h5>
              <div className="flex justify-between items-center">
                <span className={`px-3 py-1 rounded-full text-[8px] font-black tracking-widest uppercase ${item.badgeColor}`}>
                  {item.badge}
                </span>
                <span className="material-symbols-outlined text-stone-300 group-hover:text-[#4f6b28] group-hover:translate-x-1 transition-all">chevron_right</span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function ProfileView() {
  return (
    <div className="max-w-4xl space-y-16 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex items-center gap-10">
        <div className="w-40 h-40 rounded-[40px] overflow-hidden border-4 border-white shadow-2xl">
          <img
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuCIVNG3lcWVm-Ge5NEEZUf-GdmgLwhFzcFnGsboAMqruvOsGoG2KsUaJnNi7egzkBHc-8ccIDPAhhUoKLhZ-6htVuQieJX6w20tMHdUP6wvr91JZaIcvqIJEmHuGFa4z4EtafMvMDZVDCE0FvjKCsjs2BQO27LBpb-zAw7Vj2lY1t1lbEH1wcnRQt6l-9LceLngmvluUeTcJdDm9RVYiiwiCLuDdYSnjSgJK13-P326RgshwnopS9Qa-T0LE8kRyriIPjwU5NIlUVY"
            alt="Profile"
            className="w-full h-full object-cover"
          />
        </div>
        <div>
          <div className="text-[10px] font-black text-[#4f6b28] tracking-[0.3em] uppercase mb-2">Member Profile</div>
          <h2 className="text-6xl font-black italic text-[#1a1a1a] tracking-tighter uppercase leading-none" style={{ fontFamily: 'Lexend, sans-serif' }}>
            ALEX STERLING
          </h2>
          <div className="flex gap-4 mt-6">
            <span className="px-5 py-2 bg-[#4f6b28] text-white rounded-full text-[10px] font-black tracking-widest uppercase">
              GOLD TIER MEMBER
            </span>
            <span className="px-5 py-2 border-2 border-[#4f6b28] text-[#4f6b28] rounded-full text-[10px] font-black tracking-widest uppercase">
              NTRP 4.5
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-8">
        <div className="col-span-12 lg:col-span-7 bg-[#fdfbe6] rounded-[40px] p-12 shadow-xl space-y-10">
          <h3 className="text-3xl font-black italic text-[#4f6b28] uppercase">Account Security</h3>
          <div className="grid grid-cols-2 gap-10">
            {[
              { label: "REGISTERED EMAIL", value: "alex.sterling@pro.com" },
              { label: "PHONE VERIFIED", value: "+1 (555) 042-9901" },
              { label: "MEMBER SINCE", value: "January 2024" },
              { label: "LAST LOGIN", value: "2 hours ago" }
            ].map((item, i) => (
              <div key={i}>
                <div className="text-[10px] font-black text-[#4f6b28]/40 mb-1 tracking-widest">{item.label}</div>
                <div className="text-[#4f6b28] font-black text-lg">{item.value}</div>
              </div>
            ))}
          </div>
          <div className="pt-8 flex gap-4">
            <button className="flex-1 py-4 bg-[#4f6b28] text-white rounded-2xl text-[10px] font-black tracking-widest hover:opacity-90 transition-all uppercase">
              EDIT INFORMATION
            </button>
            <button className="flex-1 py-4 border-2 border-[#4f6b28] text-[#4f6b28] rounded-2xl text-[10px] font-black tracking-widest hover:bg-[#4f6b28] hover:text-white transition-all uppercase">
              CHANGE PASSWORD
            </button>
          </div>
        </div>

        <div className="col-span-12 lg:col-span-5 bg-white border border-stone-100 rounded-[40px] p-12 shadow-xl flex flex-col justify-between">
          <div>
            <h3 className="text-3xl font-black italic text-[#1a1a1a] uppercase mb-8">Performance</h3>
            <div className="space-y-8">
              <div className="flex justify-between items-end">
                <span className="text-[10px] font-black text-stone-400 tracking-widest uppercase">Season Progress</span>
                <span className="text-sm font-black">74%</span>
              </div>
              <div className="h-3 bg-stone-100 rounded-full overflow-hidden">
                <div className="h-full bg-[#cfff00] w-[74%] rounded-full shadow-[0_0_15px_rgba(207,255,0,0.5)]"></div>
              </div>
              <p className="text-stone-500 text-sm font-medium leading-relaxed">
                You've completed 12 matches this session. 4 more to qualify for the Autumn Championship.
              </p>
            </div>
          </div>
          <button className="mt-12 w-full py-4 bg-stone-900 text-white rounded-2xl text-[10px] font-black tracking-widest hover:bg-black transition-all uppercase">
            VIEW ANALYTICS
          </button>
        </div>
      </div>
    </div>
  );
}

function MembershipView() {
  return (
    <div className="space-y-16 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <h2 className="text-5xl font-black italic tracking-tighter text-[#4f6b28] uppercase" style={{ fontFamily: 'Lexend, sans-serif' }}>
        MEMBERSHIP PLANS
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {[
          { name: "SILVER", price: "99", color: "bg-stone-50 text-stone-900", features: ["2 Bookings/Week", "Standard Access", "Social Mixers"] },
          { name: "GOLD", price: "199", color: "bg-[#4f6b28] text-white", features: ["Unlimited Bookings", "Priority Courts", "Guest Passes (4)", "Pro Discounts"], popular: true },
          { name: "PLATINUM", price: "299", color: "bg-stone-900 text-white", features: ["24/7 Access", "Personal Locker", "Free Stringing", "Pro Clinic Access"] }
        ].map((plan, i) => (
          <div key={i} className={`${plan.color} rounded-[40px] p-12 shadow-2xl relative flex flex-col`}>
            {plan.popular && (
              <div className="absolute -top-4 left-12 px-6 py-2 bg-[#cfff00] text-black text-[10px] font-black tracking-[0.2em] rounded-full shadow-lg">
                MOST POPULAR
              </div>
            )}
            <div className="mb-12">
              <h3 className="text-2xl font-black italic tracking-widest uppercase opacity-60 mb-2">{plan.name}</h3>
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
            <button className={`mt-12 w-full py-5 rounded-2xl text-xs font-black tracking-widest transition-all uppercase ${plan.popular ? "bg-white text-[#4f6b28]" : "border-2 border-current hover:bg-current hover:text-white"
              }`}>
              {plan.name === "GOLD" ? "CURRENT PLAN" : "UPGRADE NOW"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function SettingsView() {
  return (
    <div className="max-w-2xl space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <h2 className="text-5xl font-black italic tracking-tighter text-[#4f6b28] uppercase" style={{ fontFamily: 'Lexend, sans-serif' }}>
        PREFERENCES
      </h2>

      <div className="space-y-8">
        {[
          { icon: "notifications", title: "Push Notifications", desc: "Get alerts for bookings and match invites", active: true },
          { icon: "visibility", title: "Profile Visibility", desc: "Allow other members to find you", active: true },
          { icon: "history", title: "Activity History", desc: "Log match results and training progress", active: false },
          { icon: "mail", title: "Newsletter", desc: "Weekly club updates and clinic openings", active: true }
        ].map((opt, i) => (
          <div key={i} className="flex items-center justify-between p-8 bg-white rounded-3xl border border-stone-100 shadow-sm hover:shadow-md transition-all">
            <div className="flex items-center gap-6">
              <div className="w-12 h-12 bg-stone-50 rounded-2xl flex items-center justify-center text-[#4f6b28]">
                <span className="material-symbols-outlined">{opt.icon}</span>
              </div>
              <div>
                <h4 className="font-black italic text-lg text-stone-900 uppercase">{opt.title}</h4>
                <p className="text-stone-400 text-sm font-medium">{opt.desc}</p>
              </div>
            </div>
            <button className={`w-14 h-8 rounded-full relative transition-colors ${opt.active ? "bg-[#4f6b28]" : "bg-stone-200"}`}>
              <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-transform ${opt.active ? "right-1" : "left-1"}`}></div>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
