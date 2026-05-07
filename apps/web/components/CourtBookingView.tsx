"use client";
import React, { useState, useEffect, useMemo } from "react";
import { db } from "../lib/firebase";
import { doc, onSnapshot, collection, query, where, addDoc, serverTimestamp } from "firebase/firestore";
import { useTenant } from "../context/TenantContext";
import { useAuth } from "../context/AuthContext";
import { Modal } from "@repo/ui/modal";

const TIMES = Array.from({ length: 17 }, (_, i) => `${(i + 6).toString().padStart(2, "0")}:00`);

const timeToMinutes = (timeStr: string) => {
  if (!timeStr) return 0;
  const match = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!match || !match[1] || !match[2]) return 0;
  let h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  const period = match[3]?.toUpperCase();
  if (period === "PM" && h !== 12) h += 12;
  if (period === "AM" && h === 12) h = 0;
  return h * 60 + m;
};

const getSlotStatus = (court: any, timeStr: string, bookings: any[], selectedDate: Date) => {
  const slotMinutes = timeToMinutes(timeStr);
  const fromMinutes = timeToMinutes(court.available_from || court.availableFrom || "06:00");
  const toMinutes = timeToMinutes(court.available_to || court.availableTo || "23:00");

  if (slotMinutes < fromMinutes || slotMinutes >= toMinutes) return "NOT_AVAILABLE";

  const dateStr = selectedDate.toDateString();
  const isBooked = bookings.some(b => 
    b.courtId === (court.id || court.name) && 
    b.date === dateStr && 
    b.time === timeStr
  );
  if (isBooked) return "SCHEDULED";

  if (court.status === "Blocked") return "BLOCKED";
  if (court.status !== "Available") return "NOT_AVAILABLE";

  return "AVAILABLE";
};

export default function CourtBookingView({ theme }: { theme: "LIGHT" | "DARK" | "VINTAGE" }) {
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const [baseDate, setBaseDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [courts, setCourts] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [bookingModal, setBookingModal] = useState<{ court: any; time: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!tenantId) return;
    const unsub = onSnapshot(doc(db, "tenants", tenantId), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setCourts(Array.isArray(data.courts) ? data.courts : []);
      }
    });
    return () => unsub();
  }, [tenantId]);

  useEffect(() => {
    if (!tenantId) return;
    const q = query(
      collection(db, "bookings"), 
      where("tenantId", "==", tenantId),
      where("date", "==", selectedDate.toDateString())
    );
    const unsub = onSnapshot(q, (snap) => {
      setBookings(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsub();
  }, [tenantId, selectedDate]);

  const weekDates = useMemo(() => {
    const start = new Date(baseDate);
    const day = start.getDay();
    const diff = start.getDate() - day + (day === 0 ? -6 : 1);
    start.setDate(diff);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [baseDate]);

  const handleCreateBooking = async () => {
    if (!bookingModal || !tenantId || !user) return;
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, "bookings"), {
        tenantId,
        courtId: bookingModal.court.id || bookingModal.court.name,
        courtName: bookingModal.court.name,
        date: selectedDate.toDateString(),
        time: bookingModal.time,
        userId: user.uid,
        userName: user.displayName || user.email,
        status: "SCHEDULED",
        created_at: serverTimestamp()
      });
      setBookingModal(null);
    } catch (err) {
      console.error("Booking failed:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const scheduleProps = {
    selectedDate,
    onDateSelect: setSelectedDate,
    weekDates,
    onPrevWeek: () => {
      const d = new Date(baseDate);
      d.setDate(d.getDate() - 7);
      setBaseDate(d);
    },
    onNextWeek: () => {
      const d = new Date(baseDate);
      d.setDate(d.getDate() + 7);
      setBaseDate(d);
    },
    courts,
    bookings,
    theme,
    onSlotClick: (court: any, time: string) => {
      const status = getSlotStatus(court, time, bookings, selectedDate);
      if (status === "AVAILABLE") {
        setBookingModal({ court, time });
      }
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20">
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

      <div className="transition-all duration-500">
        {theme === "LIGHT" ? (
          <KineticLemonSchedule {...scheduleProps} />
        ) : theme === "DARK" ? (
          <VintageNoirSchedule {...scheduleProps} />
        ) : (
          <VintagePureSchedule {...scheduleProps} />
        )}
      </div>

      <Modal
        isOpen={!!bookingModal}
        onClose={() => setBookingModal(null)}
        title="Confirm Reservation"
        theme={theme}
        width={400}
      >
        {bookingModal && (
          <div className="space-y-6">
            <div className={`p-6 rounded-2xl ${theme === "DARK" ? "bg-stone-900" : "bg-stone-50"}`}>
              <p className="text-[10px] font-black uppercase tracking-widest opacity-40 mb-1">Court</p>
              <p className="text-lg font-black">{bookingModal.court.name}</p>
              <div className="flex gap-4 mt-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest opacity-40 mb-1">Date</p>
                  <p className="text-sm font-bold">{selectedDate.toLocaleDateString()}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest opacity-40 mb-1">Time</p>
                  <p className="text-sm font-bold">{bookingModal.time}</p>
                </div>
              </div>
            </div>
            <button
              onClick={handleCreateBooking}
              disabled={isSubmitting}
              className={`w-full py-4 rounded-2xl text-[10px] font-black tracking-widest transition-all uppercase shadow-lg ${
                theme === "LIGHT" ? "bg-[#4f6b28] text-white" : theme === "DARK" ? "bg-[#00E5FF] text-stone-950" : "bg-stone-900 text-white"
              } hover:opacity-90 disabled:opacity-50`}
            >
              {isSubmitting ? "Processing..." : "Confirm Booking"}
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
}

function ScheduleNavigation({ weekDates, onPrevWeek, onNextWeek, selectedDate, onDateSelect, theme }: any) {
  const isDark = theme === "DARK";
  return (
    <div className="flex flex-wrap items-center justify-between gap-6 mb-12">
      <div className="flex items-center gap-2">
        <button onClick={onPrevWeek} className={`p-2 rounded-xl transition-all ${isDark ? "bg-stone-900 text-white hover:bg-stone-800" : "bg-stone-100 text-stone-600 hover:bg-stone-200"}`}>
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
        <button onClick={onNextWeek} className={`p-2 rounded-xl transition-all ${isDark ? "bg-stone-900 text-white hover:bg-stone-800" : "bg-stone-100 text-stone-600 hover:bg-stone-200"}`}>
          <span className="material-symbols-outlined">chevron_right</span>
        </button>
      </div>
      <div className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest ${isDark ? "bg-stone-900 text-stone-400" : "bg-stone-50 text-stone-500"}`}>
        {weekDates[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {weekDates[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
      </div>
    </div>
  );
}

function SlotCell({ status, theme, time }: { status: string; theme: string; time: string }) {
  const isDark = theme === "DARK";
  const config: any = {
    AVAILABLE: { bg: "transparent", label: "Book Now", textColor: theme === "LIGHT" ? "text-[#4f6b28]" : isDark ? "text-[#00E5FF]" : "text-stone-400", hoverBg: theme === "LIGHT" ? "group-hover:bg-[#ccff00]/10" : isDark ? "group-hover:bg-white/5" : "group-hover:bg-stone-50" },
    SCHEDULED: { bg: "bg-green-500/20", border: "border-l-4 border-green-500", label: "SCHEDULED", textColor: "text-green-500", opacity: "opacity-100" },
    BLOCKED: { bg: "bg-amber-500/20", border: "border-l-4 border-amber-500", label: "BLOCKED", textColor: "text-amber-500", opacity: "opacity-100" },
    NOT_AVAILABLE: { bg: isDark ? "bg-stone-900/50" : "bg-stone-100/50", label: "CLOSED", textColor: "text-stone-400", opacity: "opacity-100" }
  };
  const s = config[status] || config.AVAILABLE;
  return (
    <div className={`absolute inset-0 m-1 rounded-xl transition-all flex flex-col items-center justify-center ${s.bg} ${s.border || ""} ${s.hoverBg || ""} ${s.opacity || "opacity-0 group-hover:opacity-100"}`}>
      <span className={`text-[8px] font-black uppercase tracking-widest ${s.textColor}`}>{s.label}</span>
    </div>
  );
}

function KineticLemonSchedule(props: any) {
  return (
    <div className="bg-white rounded-[2rem] p-12 shadow-sm border-t-[12px] border-[#ccff00] animate-in slide-in-from-bottom-4 duration-700">
      <ScheduleNavigation {...props} />
      <div className="overflow-x-auto pb-4">
        <div className="inline-flex min-w-full gap-4">
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
          {props.courts.map((court: any) => (
            <div key={court.id || court.name} className="flex-shrink-0 w-48 border-l border-stone-100 pl-4">
              <div className="h-14 mb-4 border-b border-stone-200 flex flex-col justify-end pb-4">
                <span className="text-[10px] font-black uppercase tracking-tight text-stone-900 truncate">{court.name}</span>
                <span className="text-[8px] font-black uppercase tracking-widest text-stone-400 truncate">{court.condition}</span>
              </div>
              {TIMES.map(t => (
                <div key={t} onClick={() => props.onSlotClick(court, t)} className="h-20 border-b border-stone-100 group cursor-pointer relative">
                  <SlotCell status={getSlotStatus(court, t, props.bookings, props.selectedDate)} theme={props.theme} time={t} />
                </div>
              ))}
            </div>
          ))}
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
            <div key={court.id || court.name} className="flex-shrink-0 w-48 border-l border-stone-100 pl-4">
              <div className="h-14 mb-4 border-b border-stone-100 flex flex-col justify-end pb-4">
                <span className="text-[10px] font-black uppercase tracking-tight text-stone-900 truncate">{court.name}</span>
                <span className="text-[8px] font-black uppercase tracking-widest text-stone-400 truncate">{court.condition}</span>
              </div>
              {TIMES.map(t => (
                <div key={t} onClick={() => props.onSlotClick(court, t)} className="h-20 border-b border-stone-50 group cursor-pointer relative">
                  <SlotCell status={getSlotStatus(court, t, props.bookings, props.selectedDate)} theme={props.theme} time={t} />
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
            <div key={court.id || court.name} className="flex-shrink-0 w-48 border-l border-stone-900 pl-4">
              <div className="h-14 mb-4 border-b border-stone-800 flex flex-col justify-end pb-4">
                <span className="text-[10px] font-black uppercase tracking-tight text-white truncate">{court.name}</span>
                <span className="text-[8px] font-black uppercase tracking-widest text-stone-600 truncate">{court.condition}</span>
              </div>
              {TIMES.map(t => (
                <div key={t} onClick={() => props.onSlotClick(court, t)} className="h-20 border-b border-stone-900 group cursor-pointer relative">
                  <SlotCell status={getSlotStatus(court, t, props.bookings, props.selectedDate)} theme={props.theme} time={t} />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
