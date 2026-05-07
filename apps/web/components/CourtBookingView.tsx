"use client";
import React, { useState, useEffect, useMemo } from "react";
import { db } from "../lib/firebase";
import { doc, onSnapshot } from "firebase/firestore";
import { useTenant } from "../context/TenantContext";

interface Slot {
  time: string;
  status: "AVAILABLE" | "RESERVED" | "SELECTED";
  member?: string;
}

const TIMES = Array.from({ length: 17 }, (_, i) => `${(i + 6).toString().padStart(2, "0")}:00`);

export default function CourtBookingView({ theme }: { theme: "LIGHT" | "DARK" | "VINTAGE" }) {
  const { tenantId } = useTenant();
  const [baseDate, setBaseDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [courts, setCourts] = useState<any[]>([]);

  useEffect(() => {
    if (!tenantId) return;
    const unsub = onSnapshot(doc(db, "tenants", tenantId), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        const rawCourts = Array.isArray(data.courts) ? data.courts : [];
        setCourts(rawCourts.filter((c: any) => c.status === "Available"));
      }
    });
    return () => unsub();
  }, [tenantId]);

  const weekDates = useMemo(() => {
    const start = new Date(baseDate);
    const day = start.getDay();
    const diff = start.getDate() - day + (day === 0 ? -6 : 1); // Monday
    start.setDate(diff);
    
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [baseDate]);

  const handlePrevWeek = () => {
    const d = new Date(baseDate);
    d.setDate(d.getDate() - 7);
    setBaseDate(d);
  };

  const handleNextWeek = () => {
    const d = new Date(baseDate);
    d.setDate(d.getDate() + 7);
    setBaseDate(d);
  };

  const scheduleProps = {
    selectedDate,
    onDateSelect: setSelectedDate,
    weekDates,
    onPrevWeek: handlePrevWeek,
    onNextWeek: handleNextWeek,
    courts,
    theme
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <h3 className={`text-6xl font-black italic tracking-tighter transition-all duration-500 ${
          theme === "DARK" ? "text-white" : "text-stone-900"
        }`}>MY SCHEDULE</h3>
        <p className={`text-xs font-bold tracking-[0.2em] uppercase ${
          theme === "DARK" ? "text-stone-500" : "text-stone-400"
        }`}>
          {theme === "LIGHT" ? "Kinetic Lemon Edition" : theme === "DARK" ? "Noir Edition" : "Pure Edition"}
        </p>
      </div>

      {/* Main View Container */}
      <div className="transition-all duration-500">
        {theme === "LIGHT" ? (
          <KineticLemonSchedule {...scheduleProps} />
        ) : theme === "DARK" ? (
          <VintageNoirSchedule {...scheduleProps} />
        ) : (
          <VintagePureSchedule {...scheduleProps} />
        )}
      </div>
    </div>
  );
}

function ScheduleNavigation({ weekDates, onPrevWeek, onNextWeek, selectedDate, onDateSelect, theme }: any) {
  const isDark = theme === "DARK";
  const isVintage = theme === "VINTAGE";

  return (
    <div className="flex flex-wrap items-center justify-between gap-6 mb-12">
      <div className="flex items-center gap-2">
        <button 
          onClick={onPrevWeek}
          className={`p-2 rounded-xl transition-all ${isDark ? "bg-stone-900 text-white hover:bg-stone-800" : "bg-stone-100 text-stone-600 hover:bg-stone-200"}`}
        >
          <span className="material-symbols-outlined">chevron_left</span>
        </button>
        <div className="flex gap-2">
          {weekDates.map((date: Date) => {
            const isSelected = date.toDateString() === selectedDate.toDateString();
            return (
              <button
                key={date.toISOString()}
                onClick={() => onDateSelect(date)}
                className={`w-14 h-16 rounded-2xl flex flex-col items-center justify-center transition-all ${
                  isSelected
                    ? (theme === "LIGHT" ? "bg-[#4f6b28] text-white scale-110 shadow-xl" : theme === "DARK" ? "bg-[#00E5FF] text-stone-950 scale-110" : "bg-stone-900 text-white scale-110")
                    : (isDark ? "bg-stone-900 text-stone-500 hover:text-white" : "bg-stone-50 text-stone-400 hover:bg-stone-100")
                }`}
              >
                <span className="text-[8px] font-black uppercase tracking-widest opacity-60">
                  {date.toLocaleDateString('en-US', { weekday: 'short' })}
                </span>
                <span className="text-lg font-black mt-0.5 tracking-tighter">{date.getDate()}</span>
              </button>
            );
          })}
        </div>
        <button 
          onClick={onNextWeek}
          className={`p-2 rounded-xl transition-all ${isDark ? "bg-stone-900 text-white hover:bg-stone-800" : "bg-stone-100 text-stone-600 hover:bg-stone-200"}`}
        >
          <span className="material-symbols-outlined">chevron_right</span>
        </button>
      </div>
      
      <div className="flex items-center gap-4">
        <div className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest ${isDark ? "bg-stone-900 text-stone-400" : "bg-stone-50 text-stone-500"}`}>
          {weekDates[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {weekDates[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        </div>
      </div>
    </div>
  );
}

function KineticLemonSchedule(props: any) {
  return (
    <div className="bg-white rounded-[2rem] p-12 shadow-sm border-t-[12px] border-[#ccff00] animate-in slide-in-from-bottom-4 duration-700">
      <ScheduleNavigation {...props} />
      
      <div className="overflow-x-auto pb-4">
        <div className="inline-flex min-w-full gap-4">
          {/* Time Column */}
          <div className="flex-shrink-0 w-16">
            <div className="h-14 mb-4 border-b border-stone-200 flex items-end pb-4">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-400">Time</span>
            </div>
            {TIMES.map(t => (
              <div key={t} className="h-20 flex items-center border-b border-stone-100">
                <span className="text-[10px] font-black text-[#4f6b28] tabular-nums">{t}</span>
              </div>
            ))}
          </div>

          {/* Court Columns */}
          {props.courts.map((court: any) => (
            <div key={court.id} className="flex-shrink-0 w-48 border-l border-stone-100 pl-4">
              <div className="h-14 mb-4 border-b border-stone-200 flex flex-col justify-end pb-4">
                <span className="text-[10px] font-black uppercase tracking-tight text-stone-900 truncate">{court.name}</span>
                <span className="text-[8px] font-black uppercase tracking-widest text-stone-400 truncate">{court.condition}</span>
              </div>
              {TIMES.map((t, idx) => (
                <div key={t} className="h-20 border-b border-stone-100 group cursor-pointer relative">
                  <div className="absolute inset-0 m-1 rounded-xl group-hover:bg-[#ccff00]/10 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                    <span className="text-[10px] font-black uppercase tracking-widest text-[#4f6b28]">Book Now</span>
                  </div>
                </div>
              ))}
            </div>
          ))}
          
          {props.courts.length === 0 && (
            <div className="flex-1 flex items-center justify-center py-20 bg-stone-50 rounded-2xl border-2 border-dashed border-stone-200">
              <p className="text-[10px] font-black uppercase tracking-widest text-stone-400">No active courts available</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function VintagePureSchedule(props: any) {
  return (
    <div className="bg-white rounded-[2rem] p-12 shadow-sm border border-stone-100 animate-in slide-in-from-bottom-4 duration-700">
      <ScheduleNavigation {...props} />
      
      <div className="overflow-x-auto pb-4">
        <div className="inline-flex min-w-full gap-4">
          <div className="flex-shrink-0 w-16">
            <div className="h-14 mb-4 border-b border-stone-100 flex items-end pb-4">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-400">Time</span>
            </div>
            {TIMES.map(t => (
              <div key={t} className="h-20 flex items-center border-b border-stone-50">
                <span className="text-[10px] font-black text-stone-900 tabular-nums">{t}</span>
              </div>
            ))}
          </div>

          {props.courts.map((court: any) => (
            <div key={court.id} className="flex-shrink-0 w-48 border-l border-stone-100 pl-4">
              <div className="h-14 mb-4 border-b border-stone-100 flex flex-col justify-end pb-4">
                <span className="text-[10px] font-black uppercase tracking-tight text-stone-900 truncate">{court.name}</span>
                <span className="text-[8px] font-black uppercase tracking-widest text-stone-400 truncate">{court.condition}</span>
              </div>
              {TIMES.map((t, idx) => (
                <div key={t} className="h-20 border-b border-stone-50 group cursor-pointer relative">
                  <div className="absolute inset-0 m-1 rounded-xl group-hover:bg-stone-50 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                    <span className="text-[10px] font-black uppercase tracking-widest text-stone-400">Quick Book</span>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function VintageNoirSchedule(props: any) {
  return (
    <div className="bg-stone-950 rounded-[2rem] p-12 shadow-2xl border border-stone-800 animate-in fade-in zoom-in-95 duration-700">
      <ScheduleNavigation {...props} />
      
      <div className="overflow-x-auto pb-4">
        <div className="inline-flex min-w-full gap-4">
          <div className="flex-shrink-0 w-16">
            <div className="h-14 mb-4 border-b border-stone-800 flex items-end pb-4">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-600">Time</span>
            </div>
            {TIMES.map(t => (
              <div key={t} className="h-20 flex items-center border-b border-stone-900">
                <span className="text-[10px] font-black text-stone-400 tabular-nums">{t}</span>
              </div>
            ))}
          </div>

          {props.courts.map((court: any) => (
            <div key={court.id} className="flex-shrink-0 w-48 border-l border-stone-900 pl-4">
              <div className="h-14 mb-4 border-b border-stone-800 flex flex-col justify-end pb-4">
                <span className="text-[10px] font-black uppercase tracking-tight text-white truncate">{court.name}</span>
                <span className="text-[8px] font-black uppercase tracking-widest text-stone-600 truncate">{court.condition}</span>
              </div>
              {TIMES.map((t, idx) => (
                <div key={t} className="h-20 border-b border-stone-900 group cursor-pointer relative">
                  <div className="absolute inset-0 m-1 rounded-xl group-hover:bg-white/5 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                    <span className="text-[10px] font-black uppercase tracking-widest text-[#00E5FF]">Booking Active</span>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
