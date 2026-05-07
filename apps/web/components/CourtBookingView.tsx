"use client";
import React, { useState, useEffect, useMemo, useRef } from "react";
import { db } from "../lib/firebase";
import { doc, onSnapshot, collection, query, where, addDoc, serverTimestamp, deleteDoc, updateDoc } from "firebase/firestore";
import { useTenant } from "../context/TenantContext";
import { useAuth } from "../context/AuthContext";
import { Modal } from "@repo/ui/modal";

const DEFAULT_TIMES_30 = Array.from({ length: 33 }, (_, i) => {
  const mins = (i + 12) * 30; // Starts at 06:00
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
});

const buildTimes = (courts: any[]): string[] => {
  if (!courts.length) return DEFAULT_TIMES_30;
  let minMinutes = 23 * 60;
  let maxMinutes = 6 * 60;
  courts.forEach((court) => {
    const fromMin = timeToMinutes(court.available_from || court.availableFrom || "06:00");
    const toMin = timeToMinutes(court.available_to || court.availableTo || "23:00");
    if (fromMin > 0 || toMin > 0) {
      minMinutes = Math.min(minMinutes, fromMin);
      maxMinutes = Math.max(maxMinutes, toMin);
    }
  });

  const slots: string[] = [];
  let current = Math.floor(minMinutes / 30) * 30;
  while (current <= maxMinutes) {
    const h = Math.floor(current / 60);
    const m = current % 60;
    slots.push(`${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`);
    current += 30;
  }
  return slots.length ? slots : DEFAULT_TIMES_30;
};

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December"
];
const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

const timeToMinutes = (timeStr: string): number => {
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

const addMinutesToTime = (timeStr: string, minutes: number): string => {
  const total = timeToMinutes(timeStr) + minutes;
  const h = Math.floor(total / 60) % 24;
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

type SlotStatus = "AVAILABLE" | "SCHEDULED" | "BLOCKED" | "NOT_AVAILABLE" | "CLOSED";

const getSlotStatus = (court: any, timeStr: string, bookings: any[], selectedDate: Date): SlotStatus => {
  // Default undefined/empty status to "Available" for backward compatibility
  const courtStatus = court.status || "Available";
  if (courtStatus === "Blocked") return "BLOCKED";
  if (courtStatus !== "Available") return "NOT_AVAILABLE";

  const slotMinutes = timeToMinutes(timeStr);
  // Support both legacy "6:00 AM" strings and new "HH:MM" 24-hour format
  const fromMinutes = timeToMinutes(court.available_from || court.availableFrom || "06:00");
  const toMinutes = timeToMinutes(court.available_to || court.availableTo || "23:00");

  if (slotMinutes < fromMinutes || slotMinutes >= toMinutes) return "CLOSED";

  const dateStr = selectedDate.toDateString();
  const isBooked = bookings.some((b) => {
    if (b.courtId !== (court.id || court.name) || b.date !== dateStr) return false;
    const bStart = timeToMinutes(b.time);
    const bEnd = bStart + (b.duration * 60);
    return slotMinutes >= bStart && slotMinutes < bEnd;
  });
  if (isBooked) return "SCHEDULED";

  return "AVAILABLE";
};

interface BookingModal {
  court: any;
  time: string;
  duration: number;
  notes: string;
  playerCount: number;
}

export default function CourtBookingView({ theme }: { theme: "LIGHT" | "DARK" | "VINTAGE" }) {
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const [baseDate, setBaseDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [courts, setCourts] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [userBookings, setUserBookings] = useState<any[]>([]);
  const [bookingModal, setBookingModal] = useState<BookingModal | null>(null);
  const [viewBooking, setViewBooking] = useState<any | null>(null);
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
      setBookings(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [tenantId, selectedDate]);

  useEffect(() => {
    if (!tenantId || !user) return;
    const q = query(
      collection(db, "bookings"),
      where("tenantId", "==", tenantId),
      where("userId", "==", user.uid)
    );
    const unsub = onSnapshot(q, (snap) => {
      const all = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as any[];
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const upcoming = all
        .filter((b) => {
          const bDate = new Date(b.date);
          return bDate >= today;
        })
        .sort((a, b) => {
          const dA = new Date(a.date).getTime();
          const dB = new Date(b.date).getTime();
          if (dA !== dB) return dA - dB;
          return timeToMinutes(a.time) - timeToMinutes(b.time);
        });
      setUserBookings(upcoming);
    });
    return () => unsub();
  }, [tenantId, user]);

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

    // Final overlap check (in case duration was changed in modal)
    const requestedStart = timeToMinutes(bookingModal.time);
    const requestedEnd = requestedStart + (bookingModal.duration * 60);

    const hasOverlap = bookings.some(b => {
      if (b.courtId !== (bookingModal.court.id || bookingModal.court.name) || b.date !== selectedDate.toDateString()) return false;
      const bStart = timeToMinutes(b.time);
      const bEnd = bStart + (b.duration * 60);
      return requestedStart < bEnd && requestedEnd > bStart;
    });

    if (hasOverlap) {
      alert("This reservation overlaps with an existing schedule. Please adjust the duration or time.");
      setIsSubmitting(false);
      return;
    }

    try {
      await addDoc(collection(db, "bookings"), {
        tenantId,
        courtId: bookingModal.court.id || bookingModal.court.name,
        courtName: bookingModal.court.name,
        date: selectedDate.toDateString(),
        time: bookingModal.time,
        endTime: addMinutesToTime(bookingModal.time, bookingModal.duration * 60),
        duration: bookingModal.duration,
        userId: user.uid,
        userName: user.displayName || user.email,
        userEmail: user.email,
        playerCount: bookingModal.playerCount,
        notes: bookingModal.notes.trim(),
        status: "SCHEDULED",
        created_at: serverTimestamp(),
      });
      setBookingModal(null);
    } catch (err) {
      console.error("Booking failed:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const navHandlers = {
    onPrevWeek: () => { const d = new Date(baseDate); d.setDate(d.getDate() - 7); setBaseDate(d); },
    onNextWeek: () => { const d = new Date(baseDate); d.setDate(d.getDate() + 7); setBaseDate(d); },
    onPrevMonth: () => { const d = new Date(baseDate); d.setMonth(d.getMonth() - 1); setBaseDate(d); },
    onNextMonth: () => { const d = new Date(baseDate); d.setMonth(d.getMonth() + 1); setBaseDate(d); },
    onToday: () => { const today = new Date(); setBaseDate(today); setSelectedDate(today); },
    onJumpToMonth: (year: number, month: number) => setBaseDate(new Date(year, month, 1)),
  };

  const times = useMemo(() => buildTimes(courts), [courts]);

  const scheduleProps = {
    selectedDate,
    onDateSelect: setSelectedDate,
    weekDates,
    ...navHandlers,
    courts,
    times,
    bookings,
    theme,
    onSlotClick: (court: any, time: string) => {
      const status = getSlotStatus(court, time, bookings, selectedDate);
      if (status === "AVAILABLE") {
        setBookingModal({ court, time, duration: 1, notes: "", playerCount: 1 });
      } else if (status === "SCHEDULED") {
        const b = bookings.find(
          (b: any) =>
            b.courtId === (court.id || court.name) &&
            b.date === selectedDate.toDateString() &&
            b.time === time
        );
        if (b) setViewBooking(b);
      }
    },
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

      <div className="lg:grid lg:grid-cols-[1fr_320px] gap-10 items-start">
        <div className="transition-all duration-500 min-w-0">
          {theme === "LIGHT" ? (
            <KineticLemonSchedule {...scheduleProps} />
          ) : theme === "DARK" ? (
            <VintageNoirSchedule {...scheduleProps} />
          ) : (
            <VintagePureSchedule {...scheduleProps} />
          )}
        </div>

        <aside className="mt-10 lg:mt-0">
          <UpcomingSection bookings={userBookings} theme={theme} onBookingClick={setViewBooking} />
        </aside>
      </div>

      <Modal
        isOpen={!!viewBooking}
        onClose={() => setViewBooking(null)}
        title="Reservation Details"
        theme={theme}
        width={480}
      >
        {viewBooking && (
          <BookingDetails
            booking={viewBooking}
            theme={theme}
            user={user}
            times={times}
            courts={courts}
            allBookings={bookings}
            onClose={() => setViewBooking(null)}
          />
        )}
      </Modal>

      <Modal
        isOpen={!!bookingModal}
        onClose={() => setBookingModal(null)}
        title="Book Court"
        theme={theme}
        width={480}
      >
        {bookingModal && (
          <BookingForm
            modal={bookingModal}
            onChange={setBookingModal}
            selectedDate={selectedDate}
            user={user}
            theme={theme}
            isSubmitting={isSubmitting}
            onConfirm={handleCreateBooking}
          />
        )}
      </Modal>
    </div>
  );
}

// ─── Booking Form ────────────────────────────────────────────────────────────

function BookingForm({
  modal, onChange, selectedDate, user, theme, isSubmitting, onConfirm,
}: {
  modal: BookingModal;
  onChange: (m: BookingModal) => void;
  selectedDate: Date;
  user: any;
  theme: string;
  isSubmitting: boolean;
  onConfirm: () => void;
}) {
  const isDark = theme === "DARK";
  const endTime = addMinutesToTime(modal.time, modal.duration * 60);

  const inputCls = `w-full border rounded-2xl px-4 py-3 text-sm font-bold outline-none transition-all ${
    isDark
      ? "bg-stone-900 border-stone-800 text-white focus:border-[#00E5FF]"
      : "bg-stone-50 border-stone-100 text-stone-900 focus:border-stone-400"
  }`;
  const labelCls = `text-[9px] font-black uppercase tracking-widest mb-2 block ${
    isDark ? "text-stone-500" : "text-stone-400"
  }`;
  const readonlyCls = `px-4 py-3 rounded-2xl text-sm font-bold border ${
    isDark ? "bg-stone-900 border-stone-800 text-white" : "bg-stone-50 border-stone-100 text-stone-900"
  }`;
  const btnBase = `flex-1 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border`;
  const btnActive =
    theme === "LIGHT"
      ? "bg-[#4f6b28] text-white border-[#4f6b28]"
      : theme === "DARK"
      ? "bg-[#00E5FF] text-stone-950 border-[#00E5FF]"
      : "bg-stone-900 text-white border-stone-900";
  const btnInactive = isDark
    ? "bg-transparent border-stone-800 text-stone-400 hover:border-stone-600 hover:text-white"
    : "bg-transparent border-stone-200 text-stone-500 hover:border-stone-400 hover:text-stone-900";

  const stepperBtn = `w-10 h-10 rounded-xl flex items-center justify-center text-lg font-black transition-all border ${
    isDark ? "border-stone-800 text-white hover:border-stone-600" : "border-stone-200 text-stone-900 hover:border-stone-400"
  }`;

  return (
    <div className="space-y-5">
      {/* Court info */}
      <div className={`p-4 rounded-2xl flex items-center gap-3 ${isDark ? "bg-stone-900" : "bg-stone-50"}`}>
        <span className={`material-symbols-outlined text-2xl opacity-30 ${isDark ? "text-white" : "text-stone-900"}`}>
          sports_tennis
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-base font-black tracking-tight truncate">{modal.court.name}</p>
          {modal.court.condition && (
            <p className={`text-[9px] font-black uppercase tracking-widest mt-0.5 ${isDark ? "text-stone-500" : "text-stone-400"}`}>
              {modal.court.condition}
            </p>
          )}
        </div>
        <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest flex-shrink-0 ${
          (modal.court.status || "Available") === "Available" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
        }`}>
          {modal.court.status || "Available"}
        </span>
      </div>

      {/* Date + time */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Date</label>
          <div className={readonlyCls}>
            {selectedDate.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
          </div>
        </div>
        <div>
          <label className={labelCls}>Time</label>
          <div className={readonlyCls}>{modal.time} – {endTime}</div>
        </div>
      </div>

      {/* Duration */}
      <div>
        <label className={labelCls}>Duration</label>
        <div className="flex gap-2">
          {[{ label: "1 hr", value: 1 }, { label: "1.5 hr", value: 1.5 }, { label: "2 hr", value: 2 }].map((d) => (
            <button
              key={d.value}
              onClick={() => onChange({ ...modal, duration: d.value })}
              className={`${btnBase} ${modal.duration === d.value ? btnActive : btnInactive}`}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>

      {/* Player info */}
      <div>
        <label className={labelCls}>Player</label>
        <div className={`${readonlyCls} flex items-center gap-3`}>
          <span className={`material-symbols-outlined text-base opacity-30 ${isDark ? "text-white" : "text-stone-900"}`}>person</span>
          <div className="min-w-0">
            <p className="text-sm font-bold truncate">{user?.displayName || user?.email}</p>
            {user?.displayName && (
              <p className={`text-[10px] font-bold truncate ${isDark ? "text-stone-500" : "text-stone-400"}`}>{user.email}</p>
            )}
          </div>
        </div>
      </div>

      {/* Number of players */}
      <div>
        <label className={labelCls}>Number of Players</label>
        <div className="flex items-center gap-3">
          <button onClick={() => onChange({ ...modal, playerCount: Math.max(1, modal.playerCount - 1) })} className={stepperBtn}>
            −
          </button>
          <span className="text-2xl font-black tabular-nums w-8 text-center">{modal.playerCount}</span>
          <button onClick={() => onChange({ ...modal, playerCount: Math.min(6, modal.playerCount + 1) })} className={stepperBtn}>
            +
          </button>
          <span className={`text-[10px] font-bold uppercase tracking-widest ${isDark ? "text-stone-500" : "text-stone-400"}`}>
            {modal.playerCount === 1 ? "solo" : `${modal.playerCount} players`}
          </span>
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className={labelCls}>Notes (optional)</label>
        <textarea
          value={modal.notes}
          onChange={(e) => onChange({ ...modal, notes: e.target.value })}
          placeholder="Add any special requests or notes..."
          rows={3}
          className={`${inputCls} resize-none`}
        />
      </div>

      {/* Confirm */}
      <button
        onClick={onConfirm}
        disabled={isSubmitting}
        className={`w-full py-4 rounded-2xl text-[10px] font-black tracking-widest transition-all uppercase shadow-lg disabled:opacity-50 hover:opacity-90 ${
          theme === "LIGHT"
            ? "bg-[#4f6b28] text-white"
            : theme === "DARK"
            ? "bg-[#00E5FF] text-stone-950"
            : "bg-stone-900 text-white"
        }`}
      >
        {isSubmitting ? "Processing..." : "Confirm Booking"}
      </button>
    </div>
  );
}

// ─── Schedule Navigation ─────────────────────────────────────────────────────

function ScheduleNavigation({
  weekDates, onPrevWeek, onNextWeek, onPrevMonth, onNextMonth, onToday, onJumpToMonth,
  selectedDate, onDateSelect, theme,
}: any) {
  const isDark = theme === "DARK";
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [pickerYear, setPickerYear] = useState(new Date().getFullYear());
  const pickerRef = useRef<HTMLDivElement>(null);

  const pivotDate: Date = weekDates[3]; // Wednesday — representative of the week

  useEffect(() => {
    if (!showMonthPicker) return;
    const handleOutside = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowMonthPicker(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [showMonthPicker]);

  const accentBg =
    theme === "LIGHT" ? "bg-[#4f6b28] text-white border-[#4f6b28]"
    : theme === "DARK" ? "bg-[#00E5FF] text-stone-950 border-[#00E5FF]"
    : "bg-stone-900 text-white border-stone-900";

  const navBtn = `p-2 rounded-xl transition-all ${
    isDark ? "bg-stone-900 text-white hover:bg-stone-800" : "bg-stone-100 text-stone-600 hover:bg-stone-200"
  }`;

  return (
    <div className="space-y-4 mb-8">
      {/* Row 1 — Month/year control */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          {/* Today button */}
          <button
            onClick={onToday}
            className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all ${
              isDark
                ? "border-stone-800 text-stone-400 hover:border-stone-600 hover:text-white"
                : "border-stone-200 text-stone-500 hover:border-stone-400 hover:text-stone-900"
            }`}
          >
            Today
          </button>

          <button onClick={onPrevMonth} className={navBtn}>
            <span className="material-symbols-outlined text-sm">chevron_left</span>
          </button>

          {/* Month/year label + popover */}
          <div className="relative" ref={pickerRef}>
            <button
              onClick={() => {
                setPickerYear(pivotDate.getFullYear());
                setShowMonthPicker((v) => !v);
              }}
              className={`flex items-center gap-1 px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${
                isDark ? "bg-stone-900 text-white hover:bg-stone-800" : "bg-stone-50 text-stone-900 hover:bg-stone-100"
              }`}
            >
              {MONTHS[pivotDate.getMonth()]} {pivotDate.getFullYear()}
              <span className="material-symbols-outlined text-xs">expand_more</span>
            </button>

            {showMonthPicker && (
              <div className={`absolute top-full left-0 mt-2 z-50 rounded-2xl border shadow-2xl p-4 w-60 ${
                isDark ? "bg-stone-950 border-stone-800" : "bg-white border-stone-100"
              }`}>
                {/* Year navigation */}
                <div className="flex items-center justify-between mb-3">
                  <button
                    onClick={() => setPickerYear((y) => y - 1)}
                    className={`p-1 rounded-lg transition-all ${isDark ? "text-stone-400 hover:text-white" : "text-stone-400 hover:text-stone-900"}`}
                  >
                    <span className="material-symbols-outlined text-sm">chevron_left</span>
                  </button>
                  <span className="text-sm font-black">{pickerYear}</span>
                  <button
                    onClick={() => setPickerYear((y) => y + 1)}
                    className={`p-1 rounded-lg transition-all ${isDark ? "text-stone-400 hover:text-white" : "text-stone-400 hover:text-stone-900"}`}
                  >
                    <span className="material-symbols-outlined text-sm">chevron_right</span>
                  </button>
                </div>
                {/* Month grid */}
                <div className="grid grid-cols-3 gap-1">
                  {MONTHS_SHORT.map((m, idx) => {
                    const isCurrent = idx === pivotDate.getMonth() && pickerYear === pivotDate.getFullYear();
                    return (
                      <button
                        key={m}
                        onClick={() => { onJumpToMonth(pickerYear, idx); setShowMonthPicker(false); }}
                        className={`py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${
                          isCurrent
                            ? accentBg
                            : isDark
                            ? "text-stone-400 hover:bg-stone-900 hover:text-white"
                            : "text-stone-500 hover:bg-stone-50 hover:text-stone-900"
                        }`}
                      >
                        {m}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <button onClick={onNextMonth} className={navBtn}>
            <span className="material-symbols-outlined text-sm">chevron_right</span>
          </button>
        </div>

        {/* Week range label */}
        <div className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex-shrink-0 ${
          isDark ? "bg-stone-900 text-stone-400" : "bg-stone-50 text-stone-500"
        }`}>
          {weekDates[0].toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          {" – "}
          {weekDates[6].toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
        </div>
      </div>

      {/* Row 2 — Week day picker */}
      <div className="flex items-center gap-2">
        <button onClick={onPrevWeek} className={navBtn}>
          <span className="material-symbols-outlined">chevron_left</span>
        </button>
        <div className="flex gap-2">
          {weekDates.map((date: Date) => {
            const isSelected = date.toDateString() === selectedDate.toDateString();
            const isToday = date.toDateString() === new Date().toDateString();
            return (
              <button
                key={date.toISOString()}
                onClick={() => onDateSelect(date)}
                className={`w-14 h-16 rounded-2xl flex flex-col items-center justify-center transition-all relative ${
                  isSelected
                    ? theme === "LIGHT"
                      ? "bg-[#4f6b28] text-white scale-110 shadow-xl"
                      : theme === "DARK"
                      ? "bg-[#00E5FF] text-stone-950 scale-110"
                      : "bg-stone-900 text-white scale-110"
                    : isDark
                    ? "bg-stone-900 text-stone-500 hover:text-white"
                    : "bg-stone-50 text-stone-400 hover:bg-stone-100"
                }`}
              >
                {isToday && !isSelected && (
                  <span className={`absolute top-2 right-2 w-1.5 h-1.5 rounded-full ${
                    theme === "LIGHT" ? "bg-[#4f6b28]" : theme === "DARK" ? "bg-[#00E5FF]" : "bg-stone-900"
                  }`} />
                )}
                <span className="text-[8px] font-black uppercase tracking-widest opacity-60">
                  {date.toLocaleDateString("en-US", { weekday: "short" })}
                </span>
                <span className="text-lg font-black mt-0.5 tracking-tighter">{date.getDate()}</span>
              </button>
            );
          })}
        </div>
        <button onClick={onNextWeek} className={navBtn}>
          <span className="material-symbols-outlined">chevron_right</span>
        </button>
      </div>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const getInitials = (name: string): string => {
  if (!name) return "?";
  // Email address — use first letter before @
  if (name.includes("@")) return name[0]!.toUpperCase();
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0]![0]!.toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
};

// ─── Slot Cell ───────────────────────────────────────────────────────────────

function SlotCell({ status, theme, booking }: { status: SlotStatus; theme: string; booking?: any }) {
  const isDark = theme === "DARK";

  if (status === "NOT_AVAILABLE") {
    return (
      <div className={`absolute inset-0 m-0.5 rounded-xl flex items-center justify-center ${
        isDark ? "bg-stone-900" : "bg-stone-100"
      }`}>
        <span className={`text-[7px] font-black uppercase tracking-widest ${isDark ? "text-stone-700" : "text-stone-300"}`}>
          N / A
        </span>
      </div>
    );
  }

  if (status === "CLOSED") {
    return (
      <div
        className={`absolute inset-0 m-0.5 rounded-xl flex items-center justify-center ${
          isDark ? "bg-stone-950/80" : "bg-stone-50"
        }`}
        style={{
          backgroundImage: isDark
            ? "repeating-linear-gradient(135deg, transparent, transparent 5px, rgba(255,255,255,0.015) 5px, rgba(255,255,255,0.015) 6px)"
            : "repeating-linear-gradient(135deg, transparent, transparent 5px, rgba(0,0,0,0.04) 5px, rgba(0,0,0,0.04) 6px)",
        }}
      >
        <span className={`text-[7px] font-black uppercase tracking-widest ${isDark ? "text-stone-800" : "text-stone-300"}`}>
          Closed
        </span>
      </div>
    );
  }

  if (status === "SCHEDULED") {
    const initials = getInitials(booking?.userName || "");
    const displayName = booking?.userName || "Booked";
    const endTime = booking?.endTime || "";
    const players = booking?.playerCount || 1;
    const duration = booking?.duration || 1;

    return (
      <div
        className="absolute inset-0 m-0.5 rounded-xl border-l-[4px] border-emerald-500 bg-emerald-500/15 flex flex-col justify-center gap-1 px-3 overflow-hidden z-20 shadow-sm"
        style={{ height: `calc(${duration * 200}% - 4px)` }}
      >
        <div className="flex items-center gap-2.5">
          {/* Avatar */}
          <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0 shadow-sm">
            <span className="text-[10px] font-black text-white leading-none">{initials}</span>
          </div>
          {/* Info */}
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-black text-emerald-700 truncate leading-tight">{displayName}</p>
            {endTime && (
              <p className="text-[8px] font-bold text-emerald-600/70 leading-tight mt-0.5">
                until {endTime}
              </p>
            )}
          </div>
        </div>
        {duration >= 1 && players > 1 && (
          <div className="pl-[42px]">
            <p className="text-[8px] font-bold text-emerald-600/70 leading-tight">
              {players} players
            </p>
          </div>
        )}
      </div>
    );
  }

  if (status === "BLOCKED") {
    return (
      <div className="absolute inset-0 m-0.5 rounded-xl border-l-[3px] border-amber-500 bg-amber-500/15 flex items-center justify-center">
        <span className="text-[8px] font-black uppercase tracking-widest text-amber-600">Blocked</span>
      </div>
    );
  }

  // AVAILABLE — show on hover only
  const hoverCls =
    theme === "LIGHT"
      ? "group-hover:bg-[#ccff00]/25 group-hover:border group-hover:border-[#ccff00]/60"
      : theme === "DARK"
      ? "group-hover:bg-[#00E5FF]/10 group-hover:border group-hover:border-[#00E5FF]/25"
      : "group-hover:bg-stone-50 group-hover:border group-hover:border-stone-200";

  const textCls =
    theme === "LIGHT" ? "text-[#4f6b28]" : theme === "DARK" ? "text-[#00E5FF]" : "text-stone-500";

  return (
    <div className={`absolute inset-0 m-0.5 rounded-xl flex flex-col items-center justify-center transition-all opacity-0 group-hover:opacity-100 ${hoverCls}`}>
      <span className={`material-symbols-outlined text-sm ${textCls}`}>add_circle</span>
      <span className={`text-[7px] font-black uppercase tracking-widest mt-0.5 ${textCls}`}>Book</span>
    </div>
  );
}

// ─── Court Column Header ──────────────────────────────────────────────────────

function CourtHeader({ court, theme }: { court: any; theme: string }) {
  const isDark = theme === "DARK";
  const fromDisplay = court.available_from
    ? (() => {
        const m = court.available_from.match(/^(\d{2}):(\d{2})$/);
        if (!m) return court.available_from;
        let h = parseInt(m[1], 10);
        const period = h >= 12 ? "PM" : "AM";
        if (h > 12) h -= 12;
        if (h === 0) h = 12;
        return `${h}:${m[2]} ${period}`;
      })()
    : null;
  const toDisplay = court.available_to
    ? (() => {
        const m = court.available_to.match(/^(\d{2}):(\d{2})$/);
        if (!m) return court.available_to;
        let h = parseInt(m[1], 10);
        const period = h >= 12 ? "PM" : "AM";
        if (h > 12) h -= 12;
        if (h === 0) h = 12;
        return `${h}:${m[2]} ${period}`;
      })()
    : null;

  const effectiveStatus = court.status || "Available";
  const statusDot =
    effectiveStatus === "Available"
      ? "bg-emerald-500"
      : effectiveStatus === "Blocked"
      ? "bg-amber-500"
      : "bg-stone-400";

  return (
    <div className="flex flex-col justify-end pb-3">
      <div className="flex items-center gap-1.5 mb-0.5">
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${statusDot}`} />
        <span className={`text-[10px] font-black uppercase tracking-tight truncate ${isDark ? "text-white" : "text-stone-900"}`}>
          {court.name}
        </span>
      </div>
      <span className={`text-[8px] font-black uppercase tracking-widest truncate ${isDark ? "text-stone-600" : "text-stone-400"}`}>
        {court.condition}
      </span>
      {fromDisplay && toDisplay && (
        <span className={`text-[7px] font-bold mt-1 truncate ${isDark ? "text-stone-700" : "text-stone-300"}`}>
          {fromDisplay} – {toDisplay}
        </span>
      )}
    </div>
  );
}

// ─── Grid (shared layout) ─────────────────────────────────────────────────────

function ScheduleGrid({ courts, bookings, selectedDate, theme, onSlotClick, timeLabelColor, borderColor, rowBorder, times }: any) {
  return (
    <div className="overflow-x-auto pb-4">
      <div className="inline-flex min-w-full gap-3">
        {/* Time column */}
        <div className="flex-shrink-0 w-16">
          <div className={`h-16 mb-1 border-b ${borderColor} flex items-end pb-3`}>
            <span className={`text-[9px] font-black uppercase tracking-[0.2em] ${timeLabelColor}`}>Time</span>
          </div>
          {times.map((t: string) => (
            <div key={t} className={`h-12 flex items-center border-b ${rowBorder}`}>
              <span className={`text-[10px] font-black tabular-nums ${timeLabelColor}`}>{t}</span>
            </div>
          ))}
        </div>

        {/* Court columns */}
        {courts.map((court: any) => {
          let skipUntil: number | null = null;
          return (
            <div key={court.id || court.name} className={`flex-shrink-0 w-48 border-l ${borderColor} pl-3`}>
              <div className={`h-16 mb-1 border-b ${borderColor}`}>
                <CourtHeader court={court} theme={theme} />
              </div>
              {times.map((t: string) => {
                const currentMinutes = timeToMinutes(t);
                
                if (skipUntil !== null && currentMinutes < skipUntil) {
                  return (
                    <div key={t} className={`h-12 border-b ${rowBorder} relative`} />
                  );
                }

                const status = getSlotStatus(court, t, bookings, selectedDate);
                const booking = status === "SCHEDULED"
                  ? bookings.find(
                      (b: any) =>
                        b.courtId === (court.id || court.name) &&
                        b.date === selectedDate.toDateString() &&
                        b.time === t
                    )
                  : undefined;
                
                if (booking) {
                  skipUntil = timeToMinutes(booking.time) + (booking.duration * 60);
                } else {
                  skipUntil = null;
                }

                return (
                  <div
                    key={t}
                    onClick={() => onSlotClick(court, t)}
                    className={`h-12 border-b ${rowBorder} group relative ${status === "AVAILABLE" ? "cursor-pointer" : "cursor-default"}`}
                  >
                    <SlotCell status={status} theme={theme} booking={booking} />
                  </div>
                );
              })}
            </div>
          );
        })}

        {courts.length === 0 && (
          <div className="flex-1 flex items-center justify-center py-20">
            <p className={`text-[10px] font-black uppercase tracking-widest opacity-30`}>No courts configured</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Theme Variants ───────────────────────────────────────────────────────────

function KineticLemonSchedule(props: any) {
  return (
    <div className="bg-white rounded-[2rem] p-10 shadow-sm border-t-[12px] border-[#ccff00] animate-in slide-in-from-bottom-4 duration-700">
      <ScheduleNavigation {...props} />
      <ScheduleGrid
        {...props}
        timeLabelColor="text-[#4f6b28]"
        borderColor="border-stone-200"
        rowBorder="border-stone-100"
      />
    </div>
  );
}

function VintagePureSchedule(props: any) {
  return (
    <div className="bg-white rounded-[2rem] p-10 shadow-sm border border-stone-100 animate-in slide-in-from-bottom-4 duration-700">
      <ScheduleNavigation {...props} />
      <ScheduleGrid
        {...props}
        timeLabelColor="text-stone-900"
        borderColor="border-stone-100"
        rowBorder="border-stone-50"
      />
    </div>
  );
}

function VintageNoirSchedule(props: any) {
  return (
    <div className="bg-stone-950 rounded-[2rem] p-10 shadow-2xl border border-stone-800 animate-in fade-in zoom-in-95 duration-700">
      <ScheduleNavigation {...props} />
      <ScheduleGrid
        {...props}
        timeLabelColor="text-stone-400"
        borderColor="border-stone-800"
        rowBorder="border-stone-900"
      />
    </div>
  );
}

// ─── Upcoming Section ────────────────────────────────────────────────────────
function UpcomingSection({ bookings, theme, onBookingClick }: { bookings: any[]; theme: string; onBookingClick: (b: any) => void }) {
  const isDark = theme === "DARK";
  const today = new Date();
  today.setHours(0,0,0,0);

  return (
    <div className={`p-8 rounded-[2rem] border animate-in fade-in slide-in-from-right-4 duration-1000 ${
      isDark ? "bg-stone-950 border-stone-800" : "bg-white border-stone-100 shadow-sm"
    }`}>
      <div className="flex items-center justify-between mb-8">
        <h4 className={`text-xs font-black uppercase tracking-[0.2em] ${isDark ? "text-white" : "text-stone-900"}`}>
          Upcoming Schedule
        </h4>
        <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${
          isDark ? "bg-stone-800 text-stone-400" : "bg-stone-50 text-stone-400"
        }`}>
          {bookings.length}
        </span>
      </div>

      <div className="space-y-4">
        {bookings.length === 0 ? (
          <div className="py-12 flex flex-col items-center justify-center text-center">
            <span className={`material-symbols-outlined text-3xl mb-3 opacity-10 ${isDark ? "text-white" : "text-stone-900"}`}>
              event_busy
            </span>
            <p className={`text-[9px] font-black uppercase tracking-widest opacity-30 ${isDark ? "text-white" : "text-stone-900"}`}>
              No upcoming sessions
            </p>
          </div>
        ) : (
          bookings.slice(0, 8).map((booking, idx) => {
            const bDate = new Date(booking.date);
            const isToday = bDate.getTime() === today.getTime();
            const isTomorrow = bDate.getTime() === (today.getTime() + 86400000);

            let dateLabel = bDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            if (isToday) dateLabel = "Today";
            else if (isTomorrow) dateLabel = "Tomorrow";

            return (
              <div
                key={booking.id}
                onClick={() => onBookingClick(booking)}
                className={`group relative p-4 rounded-2xl border transition-all hover:scale-[1.02] cursor-pointer ${
                  isDark
                    ? "bg-stone-900/40 border-stone-800 hover:border-[#00E5FF]/50"
                    : "bg-stone-50 border-stone-100 hover:border-stone-300"
                }`}
                style={{ animationDelay: `${idx * 100}ms` }}
              >
                <div className="flex justify-between items-start mb-2">
                  <span className={`text-[8px] font-black uppercase tracking-widest ${
                    isDark ? "text-stone-500" : "text-stone-400"
                  }`}>
                    {dateLabel} · {booking.time}
                  </span>
                  <div className={`w-1.5 h-1.5 rounded-full ${
                    theme === "LIGHT" ? "bg-[#ccff00]" : theme === "DARK" ? "bg-[#00E5FF]" : "bg-stone-900"
                  }`} />
                </div>
                <p className={`text-sm font-black tracking-tight mb-0.5 ${isDark ? "text-white" : "text-stone-900"}`}>
                  {booking.courtName}
                </p>
                <div className="flex items-center gap-2">
                  <span className={`text-[9px] font-bold ${isDark ? "text-stone-600" : "text-stone-400"}`}>
                    {booking.duration} hr session
                  </span>
                  {booking.playerCount > 1 && (
                    <>
                      <span className={`w-1 h-1 rounded-full ${isDark ? "bg-stone-800" : "bg-stone-200"}`} />
                      <span className={`text-[9px] font-bold ${isDark ? "text-stone-600" : "text-stone-400"}`}>
                        {booking.playerCount} players
                      </span>
                    </>
                  )}
                </div>
              </div>
            );
          })
        )}

        {bookings.length > 8 && (
          <p className={`text-[8px] font-black uppercase tracking-widest text-center mt-6 opacity-40 ${
            isDark ? "text-white" : "text-stone-900"
          }`}>
            + {bookings.length - 8} more bookings
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Booking Details ─────────────────────────────────────────────────────────
function BookingDetails({ booking, theme, user, onClose, times, allBookings, courts }: { 
  booking: any; 
  theme: string; 
  user: any; 
  onClose: () => void;
  times: string[];
  allBookings: any[];
  courts: any[];
}) {
  const [isCancelling, setIsCancelling] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Edit states
  const [editDate, setEditDate] = useState(booking.date);
  const [editTime, setEditTime] = useState(booking.time);
  const [editDuration, setEditDuration] = useState(booking.duration);
  const [editCourtId, setEditCourtId] = useState(booking.courtId);
  const [editPlayerCount, setEditPlayerCount] = useState(booking.playerCount || 1);

  const isDark = theme === "DARK";
  const isOwner = user?.uid === booking.userId;

  const handleCancel = async () => {
    try {
      await deleteDoc(doc(db, "bookings", booking.id));
      onClose();
    } catch (err) {
      console.error("Cancellation failed:", err);
    }
  };

  const handleSave = async () => {
    setIsSubmitting(true);
    
    // Overlap check
    const requestedStart = timeToMinutes(editTime);
    const requestedEnd = requestedStart + (editDuration * 60);

    const hasOverlap = allBookings.some((b: any) => {
      if (b.id === booking.id) return false; // Skip current booking
      if (b.courtId !== editCourtId || b.date !== new Date(editDate).toDateString()) return false;
      const bStart = timeToMinutes(b.time);
      const bEnd = bStart + (b.duration * 60);
      return requestedStart < bEnd && requestedEnd > bStart;
    });

    if (hasOverlap) {
      alert("This update overlaps with an existing reservation. Please choose a different time or duration.");
      setIsSubmitting(false);
      return;
    }

    try {
      const selectedCourt = courts.find((c: any) => (c.id || c.name) === editCourtId);
      await updateDoc(doc(db, "bookings", booking.id), {
        date: new Date(editDate).toDateString(),
        time: editTime,
        endTime: addMinutesToTime(editTime, editDuration * 60),
        duration: editDuration,
        courtId: editCourtId,
        courtName: selectedCourt?.name || booking.courtName,
        playerCount: editPlayerCount,
      });
      setIsEditing(false);
    } catch (err) {
      console.error("Update failed:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const labelCls = `text-[9px] font-black uppercase tracking-widest mb-2 block ${isDark ? "text-stone-500" : "text-stone-400"}`;
  const infoCls = `px-4 py-3 rounded-2xl text-sm font-bold border transition-all ${
    isDark ? "bg-stone-900 border-stone-800 text-white" : "bg-stone-50 border-stone-100 text-stone-900"
  }`;
  const inputCls = `${infoCls} w-full focus:outline-none focus:ring-2 ${
    isDark ? "focus:ring-[#00E5FF]/20 border-stone-800" : "focus:ring-stone-200 border-stone-100"
  }`;

  if (isCancelling) {
    return (
      <div className="space-y-8 py-4 animate-in fade-in zoom-in-95 duration-300">
        <div className={`w-20 h-20 rounded-3xl flex items-center justify-center mx-auto ${isDark ? "bg-red-500/10 text-red-500" : "bg-red-50 text-red-500"}`}>
          <span className="material-symbols-outlined text-4xl">delete_forever</span>
        </div>
        <div className="text-center space-y-2">
          <h4 className="text-xl font-black tracking-tight">Cancel Reservation?</h4>
          <p className={`text-xs font-medium leading-relaxed px-8 ${isDark ? "text-stone-500" : "text-stone-400"}`}>
            This action cannot be undone. The court will be immediately freed up for other players.
          </p>
        </div>
        <div className="flex gap-4 pt-4">
          <button
            onClick={() => setIsCancelling(false)}
            className={`flex-1 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition-all ${
              isDark ? "border-stone-800 text-white hover:bg-stone-900" : "border-stone-200 text-stone-900 hover:bg-stone-50"
            }`}
          >
            Go Back
          </button>
          <button
            onClick={handleCancel}
            className="flex-1 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest bg-red-500 text-white hover:bg-red-600 transition-all shadow-lg shadow-red-500/20"
          >
            Cancel Session
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Court Header */}
      <div className={`p-5 rounded-2xl flex items-center justify-between ${isDark ? "bg-stone-900" : "bg-stone-50"}`}>
        <div className="flex items-center gap-4 flex-1">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isDark ? "bg-stone-950" : "bg-white shadow-sm"}`}>
            <span className="material-symbols-outlined text-2xl opacity-40">sports_tennis</span>
          </div>
          <div className="flex-1 min-w-0">
            {isEditing ? (
              <div className="space-y-1">
                <label className={labelCls}>Select Court</label>
                <select
                  value={editCourtId}
                  onChange={(e) => setEditCourtId(e.target.value)}
                  className={inputCls}
                >
                  {courts.map(c => (
                    <option key={c.id || c.name} value={c.id || c.name}>{c.name}</option>
                  ))}
                </select>
              </div>
            ) : (
              <>
                <p className="text-lg font-black tracking-tight">{booking.courtName}</p>
                <p className={`text-[10px] font-black uppercase tracking-[0.2em] opacity-40`}>Scheduled Session</p>
              </>
            )}
          </div>
        </div>
        {isOwner && !isEditing && (
          <button
            onClick={() => setIsEditing(true)}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
              isDark ? "hover:bg-stone-800 text-stone-400" : "hover:bg-stone-200 text-stone-500"
            }`}
          >
            <span className="material-symbols-outlined text-xl">edit</span>
          </button>
        )}
      </div>

      {/* Time & Date */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Date</label>
          {isEditing ? (
            <input
              type="date"
              value={new Date(editDate).toISOString().split('T')[0]}
              onChange={(e) => setEditDate(new Date(e.target.value).toDateString())}
              className={inputCls}
            />
          ) : (
            <div className={infoCls}>{booking.date}</div>
          )}
        </div>
        <div>
          <label className={labelCls}>Time</label>
          {isEditing ? (
            <select
              value={editTime}
              onChange={(e) => setEditTime(e.target.value)}
              className={inputCls}
            >
              {times.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          ) : (
            <div className={infoCls}>{booking.time} – {booking.endTime}</div>
          )}
        </div>
      </div>

      {/* Duration & Players */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Duration</label>
          {isEditing ? (
            <select
              value={editDuration}
              onChange={(e) => setEditDuration(Number(e.target.value))}
              className={inputCls}
            >
              <option value={1}>1.0 Hour</option>
              <option value={1.5}>1.5 Hours</option>
              <option value={2}>2.0 Hours</option>
            </select>
          ) : (
            <div className={infoCls}>{booking.duration} hr</div>
          )}
        </div>
        <div>
          <label className={labelCls}>Players</label>
          {isEditing ? (
            <select
              value={editPlayerCount}
              onChange={(e) => setEditPlayerCount(Number(e.target.value))}
              className={inputCls}
            >
              {[1, 2, 3, 4, 5, 6, 7, 8].map(n => (
                <option key={n} value={n}>{n} {n === 1 ? 'Player' : 'Players'}</option>
              ))}
            </select>
          ) : (
            <div className={infoCls}>{booking.playerCount} {booking.playerCount === 1 ? 'Player' : 'Players'}</div>
          )}
        </div>
      </div>

      {/* Player info */}
      <div>
        <label className={labelCls}>Reserved By</label>
        <div className={`${infoCls} flex items-center gap-3`}>
          <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-[10px] font-black text-white">
            {getInitials(booking.userName)}
          </div>
          <div>
            <p className="text-sm font-bold">{booking.userName}</p>
            <p className={`text-[10px] font-bold opacity-40`}>{booking.userEmail}</p>
          </div>
        </div>
      </div>

      {/* QR Code Section */}
      {!isEditing && (
        <div className={`p-6 rounded-[2rem] flex flex-col items-center justify-center border-2 border-dashed transition-all animate-in fade-in zoom-in duration-500 ${
          isDark ? "bg-stone-900/50 border-stone-800" : "bg-stone-50 border-stone-200"
        }`}>
          <div className="mb-4 p-4 rounded-3xl bg-white shadow-xl shadow-black/5 ring-1 ring-black/5">
            <img 
              src={`https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${booking.id}&bgcolor=ffffff&color=000000&margin=0`} 
              alt="Booking QR Code"
              className="w-[140px] h-[140px] mix-blend-multiply"
            />
          </div>
          <div className="text-center">
            <p className={`text-[9px] font-black uppercase tracking-[0.2em] mb-1 ${isDark ? "text-stone-500" : "text-stone-400"}`}>
              Verification Pass
            </p>
            <p className={`text-[10px] font-black tabular-nums opacity-60 ${isDark ? "text-white" : "text-stone-900"}`}>
              ID: {booking.id?.substring(0, 12).toUpperCase()}
            </p>
          </div>
        </div>
      )}

      {booking.notes && !isEditing && (
        <div>
          <label className={labelCls}>Notes</label>
          <div className={`${infoCls} whitespace-pre-wrap font-medium leading-relaxed`}>{booking.notes}</div>
        </div>
      )}

      {/* Actions */}
      <div className="pt-4 space-y-3">
        {isEditing ? (
          <div className="flex gap-4">
            <button
              onClick={() => setIsEditing(false)}
              className={`flex-1 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition-all ${
                isDark ? "border-stone-800 text-white hover:bg-stone-900" : "border-stone-200 text-stone-900 hover:bg-stone-50"
              }`}
            >
              Cancel
            </button>
            <button
              disabled={isSubmitting}
              onClick={handleSave}
              className="flex-1 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest bg-emerald-500 text-white hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50"
            >
              {isSubmitting ? "Saving..." : "Save Changes"}
            </button>
          </div>
        ) : (
          isOwner && (
            <button
              onClick={() => setIsCancelling(true)}
              className="w-full py-4 rounded-2xl text-[10px] font-black tracking-widest uppercase transition-all border border-red-500/20 text-red-500 hover:bg-red-500 hover:text-white"
            >
              Cancel Reservation
            </button>
          )
        )}
      </div>
    </div>
  );
}
