"use client";

import React from "react";
import { useTenant } from "../context/TenantContext";

export default function Home() {
  const { tenantId, loading } = useTenant();

  return (
    <main className="min-h-screen">
      {/* Hero Section with Asymmetry */}
      <section className="relative pt-24 pb-12 px-8 overflow-hidden">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center gap-12">
          <div className="flex-1 space-y-6">
            <h1 className="text-7xl md:text-9xl font-extrabold leading-none tracking-tighter">
              Kinetic <br />
              <span className="text-primary">Court</span>
            </h1>
            <p className="text-xl max-w-md font-medium text-secondary">
              Elite court management for high-performance clubs. Intentional, athletic, and precise.
            </p>
            <div className="flex gap-4">
              <button className="btn-primary">Book Now</button>
              <button className="px-8 py-4 rounded-full font-bold uppercase tracking-wider border-2 border-secondary text-secondary">
                View Schedule
              </button>
            </div>
          </div>
          
          {/* Asymmetric Image/Card */}
          <div className="flex-1 relative">
            <div className="w-full h-[500px] bg-surface-container-high rounded-[3rem] overflow-hidden rotate-3 hover:rotate-0 transition-transform duration-500 shadow-2xl">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-transparent"></div>
              <div className="p-12 h-full flex flex-col justify-end">
                <span className="text-sm font-bold uppercase tracking-widest bg-white/40 backdrop-blur-md px-4 py-2 rounded-full self-start mb-4">
                  Live Status
                </span>
                <h2 className="text-4xl font-bold text-on-surface">Peak Performance <br/> Club NYC</h2>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Tonal Layered Dashboard Section */}
      <section className="section-low py-24 px-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-end mb-12">
            <div>
              <span className="text-primary font-bold tracking-widest uppercase text-sm">Dashboard</span>
              <h2 className="text-5xl font-extrabold">Club Activity</h2>
            </div>
            <div className="hidden md:flex gap-8">
              <div className="text-right">
                <div className="text-3xl font-black">88%</div>
                <div className="text-xs uppercase font-bold text-secondary">Court Occupancy</div>
              </div>
              <div className="text-right">
                <div className="text-3xl font-black">92%</div>
                <div className="text-xs uppercase font-bold text-secondary">Member Satisfaction</div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Real-time Cards */}
            <div className="card-editorial flex flex-col justify-between">
              <div>
                <h3 className="text-2xl font-bold mb-2">Elena Vance</h3>
                <p className="text-secondary font-medium">Court 4 • 2:00 PM - 3:30 PM</p>
              </div>
              <div className="mt-8 flex justify-between items-center">
                <span className="text-xs font-black bg-primary/10 text-primary px-3 py-1 rounded-full uppercase">Confirmed</span>
                <span className="text-xs font-bold text-secondary">2 mins ago</span>
              </div>
            </div>

            <div className="card-editorial flex flex-col justify-between">
              <div>
                <h3 className="text-2xl font-bold mb-2">Marcus Thorne</h3>
                <p className="text-secondary font-medium">Court 1 • 4:00 PM - 6:00 PM</p>
              </div>
              <div className="mt-8 flex justify-between items-center">
                <span className="text-xs font-black bg-secondary/10 text-secondary px-3 py-1 rounded-full uppercase">Pending</span>
                <span className="text-xs font-bold text-secondary">14 mins ago</span>
              </div>
            </div>

            <div className="card-editorial flex flex-col justify-between glass-panel border-none shadow-xl">
              <div>
                <h3 className="text-2xl font-bold mb-2 text-primary">Active Tenant</h3>
                <p className="text-on-surface font-bold text-lg">
                  {loading ? "Identifying..." : tenantId || "Default Org"}
                </p>
              </div>
              <div className="mt-8">
                 <button className="w-full py-2 bg-on-surface text-white rounded-full font-bold text-sm uppercase tracking-tighter">
                   Switch Account
                 </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Kinetic Slot Picker Simulation */}
      <section className="py-24 px-8 bg-white">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-4xl font-extrabold mb-12">Available Slots</h2>
          <div className="flex overflow-x-auto gap-4 pb-8 scrollbar-hide">
            {["08:00", "09:30", "11:00", "12:30", "14:00", "15:30", "17:00", "18:30"].map((time, i) => (
              <div 
                key={time} 
                className={`flex-shrink-0 w-32 h-32 rounded-xl flex flex-col items-center justify-center cursor-pointer transition-all ${i === 2 ? 'bg-primary-container scale-110 shadow-lg' : 'bg-surface-container-low hover:bg-surface-container-high'}`}
              >
                <span className="text-xl font-black">{time}</span>
                <span className="text-[10px] font-bold uppercase tracking-widest mt-1">Available</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
