"use client";
import React, { useState } from "react";

interface Slot {
  time: string;
  status: "AVAILABLE" | "RESERVED" | "SELECTED";
  member?: string;
}

const COURTS = ["ALPHA", "SIGMA", "OMEGA"];
const TIMES = Array.from({ length: 17 }, (_, i) => `${(i + 6).toString().padStart(2, "0")}:00`);

export default function CourtBookingView({ theme }: { theme: "LIGHT" | "DARK" | "VINTAGE" }) {
  const [activeOption, setActiveOption] = useState<"PURE" | "NOIR">("PURE");
  const [selectedDate, setSelectedDate] = useState(14);

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20">
      {/* Header & Toggle */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="flex flex-col gap-2">
          <h3 className={`text-6xl font-black italic tracking-tighter transition-all duration-500 ${
            activeOption === "NOIR" ? "text-white" : "text-stone-900"
          }`}>MY SCHEDULE</h3>
          <p className={`text-xs font-bold tracking-[0.2em] uppercase ${
            activeOption === "NOIR" ? "text-stone-500" : "text-stone-400"
          }`}>Kinetic Editorial Scheduling Suite</p>
        </div>

        <div className={`flex items-center gap-1 p-1 rounded-2xl w-fit border transition-all duration-500 ${
          activeOption === "NOIR" ? "bg-stone-900 border-stone-800" : "bg-stone-100 border-stone-200"
        }`}>
          <button
            onClick={() => setActiveOption("PURE")}
            className={`px-8 py-3 rounded-xl text-[10px] font-black tracking-widest uppercase transition-all ${
              activeOption === "PURE"
                ? "bg-white text-stone-900 shadow-sm"
                : "text-stone-400 hover:text-stone-600"
            }`}
          >
            Vintage Pure
          </button>
          <button
            onClick={() => setActiveOption("NOIR")}
            className={`px-8 py-3 rounded-xl text-[10px] font-black tracking-widest uppercase transition-all ${
              activeOption === "NOIR"
                ? "bg-stone-800 text-white shadow-lg shadow-black/20"
                : "text-stone-400 hover:text-stone-600"
            }`}
          >
            Vintage Noir
          </button>
        </div>
      </div>

      {/* Main View Container */}
      <div className="transition-all duration-500">
        {activeOption === "PURE" ? (
          <VintagePureSchedule selectedDate={selectedDate} onDateSelect={setSelectedDate} />
        ) : (
          <VintageNoirSchedule selectedDate={selectedDate} onDateSelect={setSelectedDate} />
        )}
      </div>
    </div>
  );
}

function VintagePureSchedule({ selectedDate, onDateSelect }: { selectedDate: number; onDateSelect: (d: number) => void }) {
  return (
    <div className="bg-white rounded-[2rem] p-12 shadow-sm border border-stone-100 animate-in slide-in-from-bottom-4 duration-700">
      <div className="flex justify-between items-center mb-12">
        <div className="flex gap-4">
          {[12, 13, 14, 15, 16, 17, 18].map((day) => (
            <button
              key={day}
              onClick={() => onDateSelect(day)}
              className={`w-16 h-20 rounded-2xl flex flex-col items-center justify-center transition-all ${
                selectedDate === day
                  ? "bg-stone-900 text-white scale-110 shadow-xl"
                  : "bg-stone-50 text-stone-400 hover:bg-stone-100 hover:text-stone-600"
              }`}
            >
              <span className="text-[10px] font-black uppercase tracking-widest opacity-60">
                {day === 12 ? 'Mon' : day === 13 ? 'Tue' : day === 14 ? 'Wed' : day === 15 ? 'Thu' : day === 16 ? 'Fri' : day === 17 ? 'Sat' : 'Sun'}
              </span>
              <span className="text-2xl font-black mt-1 tracking-tighter">{day}</span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-black uppercase tracking-widest text-stone-400">Surface:</span>
          <div className="flex gap-2">
            {["CLAY", "GRASS", "HARD"].map(s => (
              <button key={s} className="px-4 py-2 bg-stone-50 text-[10px] font-black rounded-lg hover:bg-stone-100 transition-all">{s}</button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-8">
        <div className="col-span-1">
          <div className="h-14 mb-4 border-b border-stone-100 flex items-end pb-4">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-300">Time</span>
          </div>
          {TIMES.map(t => (
            <div key={t} className="h-20 flex items-center">
              <span className="text-sm font-black text-stone-900 tabular-nums">{t}</span>
            </div>
          ))}
        </div>

        {COURTS.map(court => (
          <div key={court} className="col-span-1">
            <div className="h-14 mb-4 border-b border-stone-100 flex items-end pb-4">
              <span className="text-xs font-black uppercase tracking-[0.2em] text-stone-900">{court}</span>
            </div>
            {TIMES.map((t, idx) => (
              <div key={t} className="h-20 border-b border-stone-50 group cursor-pointer relative">
                {idx === 2 && court === "ALPHA" ? (
                  <div className="absolute inset-0 m-1 bg-stone-100 rounded-xl p-4 flex flex-col justify-center border-l-4 border-stone-900">
                    <span className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1">Booked</span>
                    <span className="text-xs font-black text-stone-900">A. MILLER</span>
                  </div>
                ) : (
                  <div className="absolute inset-0 m-1 rounded-xl group-hover:bg-stone-50 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                    <span className="text-[10px] font-black uppercase tracking-widest text-stone-400">Quick Book</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function VintageNoirSchedule({ selectedDate, onDateSelect }: { selectedDate: number; onDateSelect: (d: number) => void }) {
  return (
    <div className="bg-stone-950 rounded-[2rem] p-12 shadow-2xl border border-stone-800 animate-in fade-in zoom-in-95 duration-700">
      <div className="flex justify-between items-center mb-12">
        <div className="flex gap-4">
          {[12, 13, 14, 15, 16, 17, 18].map((day) => (
            <button
              key={day}
              onClick={() => onDateSelect(day)}
              className={`w-16 h-20 rounded-2xl flex flex-col items-center justify-center transition-all ${
                selectedDate === day
                  ? "bg-[#00E5FF] text-stone-950 scale-110 shadow-[0_0_30px_rgba(0,229,255,0.3)]"
                  : "bg-stone-900 text-stone-500 hover:bg-stone-800 hover:text-white"
              }`}
            >
              <span className="text-[10px] font-black uppercase tracking-widest opacity-60">
                {day === 12 ? 'Mon' : day === 13 ? 'Tue' : day === 14 ? 'Wed' : day === 15 ? 'Thu' : day === 16 ? 'Fri' : day === 17 ? 'Sat' : 'Sun'}
              </span>
              <span className="text-2xl font-black mt-1 tracking-tighter">{day}</span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-black uppercase tracking-widest text-stone-600">Command Center</span>
          <div className="h-2 w-2 rounded-full bg-[#00E5FF] animate-pulse"></div>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-8">
        <div className="col-span-1">
          <div className="h-14 mb-4 border-b border-stone-800 flex items-end pb-4">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-700">Time-Log</span>
          </div>
          {TIMES.map(t => (
            <div key={t} className="h-20 flex items-center">
              <span className="text-sm font-black text-stone-500 tabular-nums">{t}</span>
            </div>
          ))}
        </div>

        {COURTS.map(court => (
          <div key={court} className="col-span-1">
            <div className="h-14 mb-4 border-b border-stone-800 flex items-end pb-4">
              <span className="text-xs font-black uppercase tracking-[0.2em] text-white">{court}</span>
            </div>
            {TIMES.map((t, idx) => (
              <div key={t} className="h-20 border-b border-stone-900 group cursor-pointer relative">
                {idx === 4 && court === "SIGMA" ? (
                  <div className="absolute inset-0 m-1 bg-[#00E5FF]/10 rounded-xl p-4 flex flex-col justify-center border-l-4 border-[#00E5FF] backdrop-blur-md">
                    <span className="text-[10px] font-black uppercase tracking-widest text-[#00E5FF] mb-1">Active</span>
                    <span className="text-xs font-black text-white italic">RESERVED</span>
                  </div>
                ) : (
                  <div className="absolute inset-0 m-1 rounded-xl group-hover:bg-stone-900/50 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                    <span className="text-[10px] font-black uppercase tracking-widest text-[#00E5FF]">Booking Active</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
