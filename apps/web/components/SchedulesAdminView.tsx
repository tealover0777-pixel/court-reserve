"use client";
import React, { useState, useEffect, useMemo } from "react";
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  orderBy, 
  doc, 
  deleteDoc, 
  updateDoc,
  serverTimestamp 
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { useTenant } from "../context/TenantContext";
import { 
  useReactTable, 
  getCoreRowModel, 
  flexRender, 
  createColumnHelper,
  getSortedRowModel,
  SortingState
} from "@tanstack/react-table";
import { Modal } from "@repo/ui/modal";
import { useAuth } from "../context/AuthContext";

// --- Utilities ---
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

const getInitials = (name: string) => {
  if (!name) return "??";
  return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
};

export default function SchedulesAdminView({ theme }: { theme: "LIGHT" | "DARK" | "VINTAGE" }) {
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const [bookings, setBookings] = useState<any[]>([]);
  const [courts, setCourts] = useState<any[]>([]);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [editingBooking, setEditingBooking] = useState<any | null>(null);

  const isDark = theme === "DARK";

  useEffect(() => {
    if (!tenantId) return;
    // Fetch courts for the dropdown in edit modal
    const unsubCourts = onSnapshot(doc(db, "tenants", tenantId), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setCourts(Array.isArray(data.courts) ? data.courts : []);
      }
    });

    // Fetch all bookings for this tenant
    const q = query(
      collection(db, "bookings"),
      where("tenantId", "==", tenantId)
    );
    
    const unsubBookings = onSnapshot(q, (snap) => {
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      // Sort by last updated (or created_at) descending
      all.sort((a: any, b: any) => {
        const tA = a.updatedAt?.toMillis() || a.createdAt?.toMillis() || 0;
        const tB = b.updatedAt?.toMillis() || b.createdAt?.toMillis() || 0;
        return tB - tA;
      });
      setBookings(all);
    });

    return () => {
      unsubCourts();
      unsubBookings();
    };
  }, [tenantId]);

  const columnHelper = createColumnHelper<any>();

  const columns = useMemo(() => [
    columnHelper.accessor("date", {
      header: "Date",
      cell: (info) => <span className="font-bold">{info.getValue()}</span>,
    }),
    columnHelper.accessor("time", {
      header: "Time",
      cell: (info) => (
        <div className="flex items-center gap-2">
          <span className="opacity-60">{info.getValue()}</span>
          <span className="opacity-20">—</span>
          <span className="opacity-60">{info.row.original.endTime}</span>
        </div>
      ),
    }),
    columnHelper.accessor("courtName", {
      header: "Court",
      cell: (info) => (
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-sm opacity-40">sports_tennis</span>
          <span>{info.getValue()}</span>
        </div>
      ),
    }),
    columnHelper.accessor("userName", {
      header: "Player",
      cell: (info) => (
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-stone-100 flex items-center justify-center text-[8px] font-black text-stone-600">
            {getInitials(info.getValue())}
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-bold">{info.getValue()}</span>
            <span className="text-[9px] opacity-40">{info.row.original.userEmail}</span>
          </div>
        </div>
      ),
    }),
    columnHelper.accessor("duration", {
      header: "Duration",
      cell: (info) => <span>{info.getValue()} hr</span>,
    }),
    columnHelper.accessor("id", {
      header: "Actions",
      cell: (info) => (
        <div className="flex gap-2">
          <button
            onClick={() => setEditingBooking(info.row.original)}
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
              isDark ? "bg-stone-800 hover:bg-stone-700 text-stone-400" : "bg-stone-100 hover:bg-stone-200 text-stone-500"
            }`}
          >
            <span className="material-symbols-outlined text-lg">edit</span>
          </button>
        </div>
      ),
    }),
  ], [isDark, columnHelper]);

  const table = useReactTable({
    data: bookings,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const borderColor = isDark ? "border-stone-800" : "border-stone-200";
  const headerBg = isDark ? "bg-stone-900" : "bg-stone-50";

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight mb-1">Schedules</h1>
          <p className={`text-sm font-medium ${isDark ? "text-stone-500" : "text-stone-400"}`}>
            Manage and monitor all court reservations.
          </p>
        </div>
        <div className={`px-4 py-2 rounded-2xl border text-[10px] font-black uppercase tracking-widest ${isDark ? "border-stone-800 bg-stone-900 text-stone-500" : "border-stone-200 bg-stone-50 text-stone-400"}`}>
          {bookings.length} Total Bookings
        </div>
      </div>

      <div className={`border rounded-[2rem] overflow-hidden ${borderColor}`}>
        <table className="w-full text-left border-collapse">
          <thead className={headerBg}>
            {table.getHeaderGroups().map(headerGroup => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map(header => (
                  <th 
                    key={header.id} 
                    className={`px-6 py-4 text-[10px] font-black uppercase tracking-widest ${isDark ? "text-stone-500" : "text-stone-400"}`}
                  >
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className={isDark ? "bg-black" : "bg-white"}>
            {table.getRowModel().rows.map(row => (
              <tr 
                key={row.id} 
                className={`border-t transition-all ${borderColor} ${isDark ? "hover:bg-stone-900/50" : "hover:bg-stone-50/50"}`}
              >
                {row.getVisibleCells().map(cell => (
                  <td key={cell.id} className="px-6 py-5 text-sm font-medium">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {bookings.length === 0 && (
          <div className="py-20 text-center space-y-4">
            <div className={`w-16 h-16 rounded-3xl flex items-center justify-center mx-auto ${isDark ? "bg-stone-900 text-stone-700" : "bg-stone-50 text-stone-200"}`}>
              <span className="material-symbols-outlined text-3xl">event_busy</span>
            </div>
            <p className={`text-sm font-bold ${isDark ? "text-stone-500" : "text-stone-400"}`}>No reservations found.</p>
          </div>
        )}
      </div>

      {editingBooking && (
        <Modal
          isOpen={!!editingBooking}
          onClose={() => setEditingBooking(null)}
          title="Edit Reservation"
          theme={theme}
        >
          <AdminBookingEdit 
            booking={editingBooking} 
            courts={courts} 
            theme={theme} 
            onClose={() => setEditingBooking(null)} 
          />
        </Modal>
      )}
    </div>
  );
}

function AdminBookingEdit({ booking, courts, theme, onClose }: any) {
  const [editDate, setEditDate] = useState(booking.date);
  const [editTime, setEditTime] = useState(booking.time);
  const [editDuration, setEditDuration] = useState(booking.duration);
  const [editCourtId, setEditCourtId] = useState(booking.courtId);
  const [editPlayerCount, setEditPlayerCount] = useState(booking.playerCount || 1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isDark = theme === "DARK";

  // Simple times for the admin edit (hourly + half hourly)
  const availableTimes = useMemo(() => {
    const slots = [];
    for (let h = 6; h <= 22; h++) {
      slots.push(`${h.toString().padStart(2, "0")}:00`);
      slots.push(`${h.toString().padStart(2, "0")}:30`);
    }
    return slots;
  }, []);

  const handleSave = async () => {
    setIsSubmitting(true);
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
        updatedAt: serverTimestamp(),
      });
      onClose();
    } catch (err) {
      console.error("Update failed:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const labelCls = `text-[9px] font-black uppercase tracking-widest mb-2 block ${isDark ? "text-stone-500" : "text-stone-400"}`;
  const inputCls = `w-full px-4 py-3 rounded-2xl text-sm font-bold border transition-all focus:outline-none focus:ring-2 ${
    isDark ? "bg-stone-900 border-stone-800 text-white focus:ring-[#00E5FF]/20" : "bg-stone-50 border-stone-100 text-stone-900 focus:ring-stone-200"
  }`;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Court</label>
          <select value={editCourtId} onChange={(e) => setEditCourtId(e.target.value)} className={inputCls}>
            {courts.map(c => (
              <option key={c.id || c.name} value={c.id || c.name}>{c.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>Date</label>
          <input 
            type="date" 
            value={new Date(editDate).toISOString().split('T')[0]} 
            onChange={(e) => setEditDate(new Date(e.target.value).toDateString())} 
            className={inputCls} 
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Start Time</label>
          <select value={editTime} onChange={(e) => setEditTime(e.target.value)} className={inputCls}>
            {availableTimes.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Duration</label>
          <select value={editDuration} onChange={(e) => setEditDuration(Number(e.target.value))} className={inputCls}>
            <option value={1}>1.0 Hour</option>
            <option value={1.5}>1.5 Hours</option>
            <option value={2}>2.0 Hours</option>
          </select>
        </div>
      </div>

      <div>
        <label className={labelCls}>Players</label>
        <select value={editPlayerCount} onChange={(e) => setEditPlayerCount(Number(e.target.value))} className={inputCls}>
          {[1, 2, 3, 4, 5, 6, 7, 8].map(n => <option key={n} value={n}>{n} {n === 1 ? 'Player' : 'Players'}</option>)}
        </select>
      </div>

      <div className="flex gap-4 pt-4">
        <button
          onClick={onClose}
          className={`flex-1 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition-all ${
            isDark ? "border-stone-800 text-white hover:bg-stone-900" : "border-stone-200 text-stone-900 hover:bg-stone-50"
          }`}
        >
          Cancel
        </button>
        <button
          disabled={isSubmitting}
          onClick={handleSave}
          className="flex-1 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest bg-emerald-500 text-white hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20"
        >
          {isSubmitting ? "Saving..." : "Save Changes"}
        </button>
      </div>
    </div>
  );
}
