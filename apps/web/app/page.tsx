"use client";

import React from "react";
import { useTenant } from "../context/TenantContext";

export default function Home() {
  const { tenantId, loading } = useTenant();

  return (
    <div className="app-container">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="mb-12">
          <h1 className="text-2xl font-black text-primary leading-tight">
            KINETIC <br /> COURT
          </h1>
          <p className="text-[10px] font-bold tracking-[0.2em] text-secondary opacity-60">
            ELITE MEMBERSHIP
          </p>
        </div>

        <nav className="flex-1 space-y-2">
          <a href="#" className="nav-link active">
            <DashboardIcon />
            DASHBOARD
          </a>
          <a href="#" className="nav-link">
            <CourtIcon />
            COURT BOOKING
          </a>
          <a href="#" className="nav-link">
            <ProgramIcon />
            PROGRAMS
          </a>
          <a href="#" className="nav-link">
            <ProfileIcon />
            PROFILE
          </a>
        </nav>

        <div className="mt-auto space-y-6">
          <button className="btn-primary w-full text-xs tracking-widest">
            BOOK A COURT
          </button>
          
          <div className="flex items-center gap-3 pt-6 border-t border-gray-100">
            <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden">
               <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Alex" alt="Avatar" />
            </div>
            <div>
              <p className="text-sm font-bold">Alex Sterling</p>
              <p className="text-[10px] font-medium text-secondary">Gold Tier Member</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        {/* Header */}
        <header className="flex justify-between items-center mb-8">
          <h2 className="text-3xl font-black tracking-tight">DASHBOARD</h2>
          <div className="flex items-center gap-6">
            <div className="search-pill">
              <SearchIcon />
              <input type="text" placeholder="Search facilities..." />
            </div>
            <div className="flex gap-4">
              <button className="p-2 hover:bg-gray-100 rounded-full">
                <BellIcon />
              </button>
              <button className="p-2 hover:bg-gray-100 rounded-full">
                <SettingsIcon />
              </button>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-12 gap-8">
          {/* Hero Section */}
          <div className="col-span-12 lg:col-span-9">
            <div className="relative bg-[#fdfcd3] rounded-[2.5rem] p-12 overflow-hidden h-[400px] flex flex-col justify-center">
              <div className="relative z-10 max-w-lg">
                <p className="text-xs font-black tracking-[0.3em] text-primary mb-4 uppercase">
                  Welcome back, Alex
                </p>
                <h3 className="text-6xl font-black leading-[0.9] tracking-tighter mb-8">
                  READY TO <br /> DOMINATE THE <br /> COURT?
                </h3>
              </div>
              <img 
                src="/images/hero_player.png" 
                alt="Tennis Player" 
                className="absolute right-0 bottom-0 h-[110%] object-contain pointer-events-none opacity-90 select-none"
              />
            </div>
          </div>

          {/* Stats Section */}
          <div className="col-span-12 lg:col-span-9">
            <div className="grid grid-cols-3 gap-6">
              <div className="card-stat">
                <p className="text-[10px] font-black uppercase tracking-widest text-primary mb-8">Win Rate</p>
                <div className="flex items-end gap-2">
                  <span className="text-5xl font-black leading-none">68%</span>
                  <span className="text-[10px] font-bold text-primary mb-1">↗ 4.2% this month</span>
                </div>
              </div>
              <div className="card-stat">
                <p className="text-[10px] font-black uppercase tracking-widest text-primary mb-8">Matches</p>
                <div className="flex items-end gap-2">
                  <span className="text-5xl font-black leading-none">124</span>
                  <span className="text-[10px] font-bold text-secondary mb-1">Total Career Played</span>
                </div>
              </div>
              <div className="card-stat card-stat-accent">
                <p className="text-[10px] font-black uppercase tracking-widest text-primary mb-8">Loyalty Points</p>
                <div className="flex flex-col">
                  <span className="text-5xl font-black leading-none">2,450</span>
                  <span className="text-[10px] font-bold text-primary mt-2">Elite Status Active</span>
                </div>
              </div>
            </div>

            {/* Upcoming Match Card */}
            <div className="mt-8 bg-[#2c3300] rounded-[2rem] p-10 flex justify-between items-center text-white overflow-hidden relative">
              <div className="relative z-10">
                <span className="inline-block bg-[#556d00] text-xs font-black px-4 py-1 rounded-full mb-6 tracking-tighter uppercase">
                  Upcoming - Tomorrow
                </span>
                <h4 className="text-4xl font-black mb-2 tracking-tighter">QUARTER FINAL MATCH</h4>
                <p className="text-sm font-medium opacity-80">Center Court • 10:00 AM vs. Marcus V.</p>
              </div>
              <button className="relative z-10 bg-white text-black px-8 py-4 rounded-full font-black text-xs tracking-widest uppercase hover:scale-105 transition-transform">
                MATCH PREVIEW
              </button>
              {/* Subtle background texture/glow */}
              <div className="absolute right-0 top-0 w-64 h-64 bg-[#556d00] blur-[100px] opacity-30 rounded-full -mr-20 -mt-20"></div>
            </div>
          </div>

          {/* Recent Activity (Right Side) */}
          <div className="col-span-12 lg:col-span-3">
            <div className="card-stat h-full bg-[#fdf59d]">
              <div className="flex justify-between items-center mb-8">
                <h4 className="text-lg font-black tracking-tight">RECENT ACTIVITY</h4>
                <button className="text-[10px] font-black tracking-tighter text-secondary uppercase">View All</button>
              </div>
              <div className="space-y-6">
                <ActivityItem 
                  icon={<CheckCircleIcon />}
                  title="Booking Confirmed"
                  desc="Court 4 • Wed, 14 Oct"
                />
                <ActivityItem 
                  icon={<TrophyIcon />}
                  title="Tournament Registration"
                  desc="Autumn Open Elite Tier"
                />
                <ActivityItem 
                  icon={<CreditCardIcon />}
                  title="Membership Renewal"
                  desc="Processed successfully"
                />
              </div>
            </div>
          </div>

          {/* Upcoming Bookings */}
          <div className="col-span-12 mt-12">
            <div className="flex justify-between items-center mb-8">
              <div>
                <h3 className="text-2xl font-black tracking-tight">UPCOMING BOOKINGS</h3>
                <p className="text-xs font-medium text-secondary uppercase tracking-widest mt-1">Your scheduled time on the court.</p>
              </div>
              <div className="flex gap-2">
                <button className="w-10 h-10 flex items-center justify-center border border-gray-200 rounded-full hover:bg-gray-50">
                  <ArrowLeftIcon />
                </button>
                <button className="w-10 h-10 flex items-center justify-center border border-gray-200 rounded-full hover:bg-gray-50">
                  <ArrowRightIcon />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <BookingCard 
                date="OCT 16"
                time="04:00 PM - 05:30 PM"
                court="COURT 02"
                partner="With Sarah Jenkins"
                partnerImg="https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah"
              />
              <BookingCard 
                date="OCT 18"
                time="09:00 AM - 10:30 AM"
                court="COURT 08"
                partner="Open Slot"
                isPlaceholder
              />
              <BookingCard 
                date="OCT 19"
                time="02:00 PM - 04:00 PM"
                court="CLAY COURT A"
                partner="With David Chen"
                partnerImg="https://api.dicebear.com/7.x/avataaars/svg?seed=David"
              />
            </div>
          </div>

          {/* Club News */}
          <div className="col-span-12 mt-12 pb-24">
            <h3 className="text-2xl font-black tracking-tight mb-8">CLUB NEWS</h3>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Featured News */}
              <div className="lg:col-span-8">
                <div className="relative h-[450px] rounded-[2.5rem] overflow-hidden group">
                  <img 
                    src="/images/clay_court.png" 
                    alt="Clay Court" 
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent"></div>
                  <div className="absolute bottom-0 p-12 text-white">
                    <span className="inline-block bg-[#556d00] text-[10px] font-black px-4 py-1 rounded-full mb-4 tracking-tighter uppercase">
                      New Facilities
                    </span>
                    <h4 className="text-4xl font-black mb-4 tracking-tighter">THE CLAY REVOLUTION <br /> ARRIVES AT KINETIC</h4>
                    <p className="text-sm font-medium opacity-80 max-w-lg leading-relaxed">
                      Three new professional-grade clay courts are now open for championship booking. Experience the authentic European feel.
                    </p>
                  </div>
                </div>
              </div>

              {/* News List */}
              <div className="lg:col-span-4 space-y-6">
                <NewsItem 
                  category="Training"
                  title="PRO CLINIC WITH COACH MILLER"
                  desc="Master the overhead smash this weekend."
                  img="https://api.dicebear.com/7.x/avataaars/svg?seed=Coach"
                />
                <NewsItem 
                  category="Social"
                  title="MIXER NIGHT: DRINKS & DOUBLES"
                  desc="Join us for the seasonal social event next Friday."
                  img="https://images.unsplash.com/photo-1595435063131-41270258d4e9?w=400&q=80"
                />
                <NewsItem 
                  category="Pro Shop"
                  title="THE FALL COLLECTION HAS LANDED"
                  desc="Exclusive Kinetic Court apparel now available."
                  img="https://api.dicebear.com/7.x/avataaars/svg?seed=ProShop"
                />
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

/* Sub-components */

function ActivityItem({ icon, title, desc }: { icon: React.ReactNode, title: string, desc: string }) {
  return (
    <div className="flex gap-4">
      <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-primary shadow-sm flex-shrink-0">
        {icon}
      </div>
      <div>
        <p className="text-sm font-black tracking-tight">{title}</p>
        <p className="text-[10px] font-medium text-secondary uppercase opacity-60">{desc}</p>
      </div>
    </div>
  );
}

function BookingCard({ date, time, court, partner, partnerImg, isPlaceholder }: { date: string, time: string, court: string, partner: string, partnerImg?: string, isPlaceholder?: boolean }) {
  return (
    <div className="card-white p-8 relative overflow-hidden group border border-transparent hover:border-primary/10 transition-colors">
      <div className="flex justify-between items-start mb-12">
        <span className="bg-[#fdf59d] text-primary text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-tighter">
          {court}
        </span>
        <button className="text-secondary opacity-40 hover:opacity-100 transition-opacity">
           <MoreIcon />
        </button>
      </div>
      <h4 className="text-2xl font-black mb-1">{date}</h4>
      <p className="text-xs font-bold text-secondary opacity-60 uppercase tracking-widest mb-8">{time}</p>
      
      <div className="flex items-center gap-3 pt-6 border-t border-gray-50">
        {isPlaceholder ? (
          <div className="w-8 h-8 rounded-full bg-[#f8f9fa] flex items-center justify-center text-primary/30">
            <ProfileIcon size={16} />
          </div>
        ) : (
          <img src={partnerImg} alt="Partner" className="w-8 h-8 rounded-full bg-gray-100" />
        )}
        <p className="text-xs font-black tracking-tight">{partner}</p>
      </div>
    </div>
  );
}

function NewsItem({ category, title, desc, img }: { category: string, title: string, desc: string, img: string }) {
  return (
    <div className="flex gap-4 group cursor-pointer">
      <div className="w-20 h-20 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0">
        <img src={img} alt={title} className="w-full h-full object-cover transition-transform group-hover:scale-110" />
      </div>
      <div>
        <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mb-1">{category}</p>
        <h4 className="text-sm font-black leading-tight mb-1 group-hover:text-primary transition-colors">{title}</h4>
        <p className="text-[10px] font-medium text-secondary leading-normal">{desc}</p>
      </div>
    </div>
  );
}

/* Icons */

const DashboardIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="9"></rect><rect x="14" y="3" width="7" height="5"></rect><rect x="14" y="12" width="7" height="9"></rect><rect x="3" y="16" width="7" height="5"></rect></svg>
);
const CourtIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 9h20"></path><path d="M2 15h20"></path><path d="M10 9v6"></path><path d="M14 9v6"></path><path d="M3 21h18a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2H3a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2z"></path></svg>
);
const ProgramIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20"></path><path d="M2 12h20"></path><path d="m4.93 4.93 14.14 14.14"></path><path d="m4.93 19.07 14.14-14.14"></path></svg>
);
const ProfileIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
);
const SearchIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-secondary opacity-40"><circle cx="11" cy="11" r="8"></circle><path d="m21 21-4.3-4.3"></path></svg>
);
const BellIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"></path><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"></path></svg>
);
const SettingsIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33 1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82 1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
);
const MoreIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"></circle><circle cx="12" cy="5" r="1"></circle><circle cx="12" cy="19" r="1"></circle></svg>
);
const CheckCircleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
);
const TrophyIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"></path><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"></path><path d="M4 22h16"></path><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"></path><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"></path><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"></path></svg>
);
const CreditCardIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="14" x="2" y="5" rx="2"></rect><line x1="2" x2="22" y1="10" y2="10"></line></svg>
);
const ArrowLeftIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"></path></svg>
);
const ArrowRightIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"></path></svg>
);
