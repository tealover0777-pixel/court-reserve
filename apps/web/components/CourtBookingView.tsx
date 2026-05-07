"use client";
import React, { useState, useEffect, useMemo, useRef } from "react";
import { db } from "../lib/firebase";
import { doc, onSnapshot, collection, query, where, addDoc, serverTimestamp } from "firebase/firestore";
import { useTenant } from "../context/TenantContext";
import { useAuth } from "../context/AuthContext";
import { Modal } from "@repo/ui/modal";

const TIMES = Array.from({ length: 17 }, (_, i) => `${(i + 6).toString().padStart(2, "0")}:00`);

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
  if (court.status === "Blocked") return "BLOCKED";
  if (court.status !== "Available") return "NOT_AVAILABLE";

  const slotMinutes = timeToMinutes(timeStr);
  const fromMinutes = timeToMinutes(court.available_from || court.availableFrom || "06:00");
  const toMinutes = timeToMinutes(court.available_to || court.availableTo || "23:00");

  if (slotMinutes < fromMinutes || slotMinutes >= toMinutes) return "CLOSED";

  const dateStr = selectedDate.toDateString();
  const isBooked = bookings.some(
    (b) => b.courtId === (court.id || court.name) && b.date === dateStr && b.time === timeStr
  );
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
  const [bookingModal, setBookingModal] = useState<BookingModal | null>(null);
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

  const scheduleProps = {
    selectedDate,
    onDateSelect: setSelectedDate,
    weekDates,
    ...navHandlers,
    courts,
    bookings,
    theme,
    onSlotClick: (court: any, time: string) => {
      const status = getSlotStatus(court, time, bookings, selectedDate);
      if (status === "AVAILABLE") {
        setBookingModal({ court, time, duration: 1, notes: "", playerCount: 1 });
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
          modal.court.status === "Available" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
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

// ─── Slot Cell ───────────────────────────────────────────────────────────────

function SlotCell({ status, theme }: { status: SlotStatus; theme: string }) {
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
    return (
      <div className="absolute inset-0 m-0.5 rounded-xl border-l-[3px] border-emerald-500 bg-emerald-500/15 flex items-center justify-center">
        <span className="text-[8px] font-black uppercase tracking-widest text-emerald-600">Scheduled</span>
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

  const statusDot =
    court.status === "Available"
      ? "bg-emerald-500"
      : court.status === "Blocked"
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

function ScheduleGrid({ courts, bookings, selectedDate, theme, onSlotClick, timeLabelColor, borderColor, rowBorder }: any) {
  return (
    <div className="overflow-x-auto pb-4">
      <div className="inline-flex min-w-full gap-3">
        {/* Time column */}
        <div className="flex-shrink-0 w-16">
          <div className={`h-16 mb-1 border-b ${borderColor} flex items-end pb-3`}>
            <span className={`text-[9px] font-black uppercase tracking-[0.2em] ${timeLabelColor}`}>Time</span>
          </div>
          {TIMES.map((t) => (
            <div key={t} className={`h-20 flex items-center border-b ${rowBorder}`}>
              <span className={`text-[10px] font-black tabular-nums ${timeLabelColor}`}>{t}</span>
            </div>
          ))}
        </div>

        {/* Court columns */}
        {courts.map((court: any) => (
          <div key={court.id || court.name} className={`flex-shrink-0 w-44 border-l ${borderColor} pl-3`}>
            <div className={`h-16 mb-1 border-b ${borderColor}`}>
              <CourtHeader court={court} theme={theme} />
            </div>
            {TIMES.map((t) => {
              const status = getSlotStatus(court, t, bookings, selectedDate);
              return (
                <div
                  key={t}
                  onClick={() => onSlotClick(court, t)}
                  className={`h-20 border-b ${rowBorder} group relative ${status === "AVAILABLE" ? "cursor-pointer" : "cursor-default"}`}
                >
                  <SlotCell status={status} theme={theme} />
                </div>
              );
            })}
          </div>
        ))}

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
