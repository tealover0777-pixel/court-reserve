"use client";
import React from "react";
import Image from "next/image";
import { useTenant } from "../context/TenantContext";

export default function DashboardClient({ params }: { params: { tenantId: string } }) {
  const { tenantId: contextTenantId, loading } = useTenant();
  const [activeView, setActiveView] = React.useState<"DASHBOARD" | "COURT BOOKING" | "PROGRAMS" | "PROFILE">("DASHBOARD");
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
        
        <nav className="flex-1">
          <NavItem 
            icon="dashboard" 
            label="Dashboard" 
            active={activeView === "DASHBOARD"} 
            onClick={() => setActiveView("DASHBOARD")}
          />
          <NavItem 
            icon="sports_tennis" 
            label="Court Booking" 
            active={activeView === "COURT BOOKING"} 
            onClick={() => setActiveView("COURT BOOKING")}
          />
          <NavItem 
            icon="event_seat" 
            label="Programs" 
            active={activeView === "PROGRAMS"} 
            onClick={() => setActiveView("PROGRAMS")}
          />
          <NavItem 
            icon="person" 
            label="Profile" 
            active={activeView === "PROFILE"} 
            onClick={() => setActiveView("PROFILE")}
          />
        </nav>

        <div className="mt-auto p-8 border-t border-stone-100">
          <button 
            onClick={() => setActiveView("COURT BOOKING")}
            className="w-full py-4 bg-[#4f6b28] text-white font-black rounded-lg text-xs tracking-widest hover:opacity-90 transition-all uppercase shadow-lg shadow-[#4f6b28]/10"
          >
            BOOK A COURT
          </button>
          
          <div className="mt-8 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-surface-container-highest overflow-hidden border-2 border-primary/20">
              <img 
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuCIVNG3lcWVm-Ge5NEEZUf-GdmgLwhFzcFnGsboAMqruvOsGoG2KsUaJnNi7egzkBHc-8ccIDPAhhUoKLhZ-6htVuQieJX6w20tMHdUP6wvr91JZaIcvqIJEmHuGFa4z4EtafMvMDZVDCE0FvjKCsjs2BQO27LBpb-zAw7Vj2lY1t1lbEH1wcnRQt6l-9LceLngmvluUeTcJdDm9RVYiiwiCLuDdYSnjSgJK13-P326RgshwnopS9Qa-T0LE8kRyriIPjwU5NIlUVY" 
                alt="Profile" 
                className="w-full h-full object-cover"
              />
            </div>
            <div>
              <p className="text-xs font-bold">Alex Sterling</p>
              <p className="text-[10px] text-stone-500">Gold Tier Member</p>
            </div>
          </div>
        </div>
      </aside>

      {/* TopAppBar Component */}
      <header className="sticky top-0 z-40 w-full bg-white/60 backdrop-blur-xl flex justify-between items-center ml-72 px-12 py-6 max-w-[calc(100%-18rem)]">
        <h2 className="text-4xl font-black font-headline text-[#4f6b28] tracking-tighter uppercase">{activeView}</h2>
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
        ) : activeView === "COURT BOOKING" ? (
          <CourtBookingView />
        ) : activeView === "PROGRAMS" ? (
          <ProgramsView />
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

function NavItem({ icon, label, active = false, onClick }: { icon: string; label: string; active?: boolean; onClick?: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={`w-full flex items-center gap-5 py-5 transition-all duration-200 ease-in-out px-6 ${
        active 
          ? "text-[#4f6b28] bg-[#f7f8f2] border-l-[6px] border-[#4f6b28]" 
          : "text-stone-400 border-l-[6px] border-transparent hover:bg-stone-50"
      }`}
    >
      <span className={`material-symbols-outlined text-2xl ${active ? "opacity-100" : "opacity-60"}`}>
        {icon}
      </span>
      <span className={`text-sm font-black uppercase tracking-wider ${active ? "text-[#4f6b28]" : "text-stone-500"}`}>
        {label}
      </span>
    </button>
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
              className={`flex-shrink-0 w-20 h-24 rounded-2xl flex flex-col items-center justify-center transition-all ${
                day === 14 
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
            className={`p-6 rounded-2xl flex flex-col items-start transition-all border ${
              slot.status === "booked"
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
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-black text-[#1a1a1a] tracking-tight uppercase" style={{ fontFamily: 'Lexend, sans-serif' }}>
            CLINICS & PROGRAMS
          </h2>
          <p className="text-stone-500 font-medium mt-2">Elevate your game with world-class coaching.</p>
        </div>
        <div className="flex gap-2">
          <button className="px-6 py-2 border-2 border-stone-200 rounded-full text-xs font-bold tracking-widest hover:bg-stone-50 transition-colors uppercase">
            FILTER BY LEVEL
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[
          { 
            title: "Adult Intermediate Clinic", 
            time: "10:00 AM - 11:30 AM", 
            coach: "Marco Rossi", 
            spots: "2 spots left",
            color: "bg-[#4f6b28]"
          },
          { 
            title: "Junior Academy - Elite", 
            time: "04:00 PM - 05:30 PM", 
            coach: "Elena Petrova", 
            spots: "Waitlist only",
            color: "bg-stone-800"
          },
          { 
            title: "Cardio Tennis", 
            time: "07:00 AM - 08:00 AM", 
            coach: "David Smith", 
            spots: "6 spots left",
            color: "bg-stone-400"
          }
        ].map((program, i) => (
          <div key={i} className="group relative bg-white border border-stone-100 rounded-2xl overflow-hidden hover:shadow-xl transition-all duration-300">
            <div className={`h-40 ${program.color} relative overflow-hidden`}>
              <div className="absolute inset-0 opacity-20 flex items-center justify-center">
                <span className="material-symbols-outlined text-[120px] text-white">sports_tennis</span>
              </div>
            </div>
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-xl font-bold text-stone-900 leading-tight">{program.title}</h3>
                <span className="px-3 py-1 bg-stone-100 rounded-full text-[10px] font-black tracking-widest uppercase">
                  {program.spots}
                </span>
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-3 text-stone-500">
                  <span className="material-symbols-outlined text-lg">schedule</span>
                  <span className="text-sm font-medium">{program.time}</span>
                </div>
                <div className="flex items-center gap-3 text-stone-500">
                  <span className="material-symbols-outlined text-lg">person</span>
                  <span className="text-sm font-medium">Coach: {program.coach}</span>
                </div>
              </div>
              <button className="w-full mt-6 py-3 border-2 border-stone-900 text-stone-900 rounded-xl text-xs font-black tracking-widest hover:bg-stone-900 hover:text-white transition-all uppercase">
                REGISTER NOW
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProfileView() {
  return (
    <div className="max-w-4xl space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-8">
        <div className="w-32 h-32 rounded-3xl bg-[#4f6b28] flex items-center justify-center text-white text-5xl font-black">
          KA
        </div>
        <div>
          <h2 className="text-4xl font-black text-[#1a1a1a] tracking-tight uppercase" style={{ fontFamily: 'Lexend, sans-serif' }}>
            KYU AHN
          </h2>
          <div className="flex gap-4 mt-3">
            <span className="px-3 py-1 bg-stone-100 rounded-full text-[10px] font-black tracking-widest uppercase text-stone-600">
              PLATINUM MEMBER
            </span>
            <span className="px-3 py-1 bg-[#4f6b28]/10 text-[#4f6b28] rounded-full text-[10px] font-black tracking-widest uppercase">
              NTRP 4.5
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="p-8 bg-stone-50 rounded-3xl space-y-6">
          <h3 className="text-sm font-black tracking-[0.2em] text-stone-400 uppercase">Personal Information</h3>
          <div className="space-y-4">
            {[
              { label: "EMAIL", value: "kyu.ahn@example.com" },
              { label: "PHONE", value: "+1 (555) 000-0000" },
              { label: "MEMBER SINCE", value: "Oct 2023" }
            ].map((item, i) => (
              <div key={i}>
                <div className="text-[10px] font-black text-stone-400 mb-1">{item.label}</div>
                <div className="text-stone-900 font-bold">{item.value}</div>
              </div>
            ))}
          </div>
          <button className="w-full py-4 bg-white border border-stone-200 rounded-xl text-xs font-black tracking-widest hover:bg-stone-100 transition-all uppercase">
            EDIT PROFILE
          </button>
        </div>

        <div className="p-8 bg-[#4f6b28] rounded-3xl text-white space-y-6">
          <h3 className="text-sm font-black tracking-[0.2em] opacity-60 uppercase">Membership Details</h3>
          <div className="space-y-4">
            <div>
              <div className="text-[10px] font-black opacity-60 mb-1">CURRENT PLAN</div>
              <div className="text-2xl font-black">Annual Platinum</div>
            </div>
            <div>
              <div className="text-[10px] font-black opacity-60 mb-1">RENEWAL DATE</div>
              <div className="text-lg font-bold">October 14, 2024</div>
            </div>
          </div>
          <div className="pt-6 border-t border-white/20">
            <button className="w-full py-4 bg-white text-[#4f6b28] rounded-xl text-xs font-black tracking-widest hover:bg-opacity-90 transition-all uppercase">
              MANAGE SUBSCRIPTION
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
