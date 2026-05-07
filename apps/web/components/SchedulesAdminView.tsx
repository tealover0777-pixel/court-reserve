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
  getFilteredRowModel,
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

function toDisplayTime(value: string | null | undefined): string {
  if (!value) return "—";
  const str = String(value).trim();
  if (/^\d{1,2}:\d{2}$/.test(str)) {
    const parts = str.split(":");
    let h = parseInt(parts[0] || "0", 10);
    const min = parts[1] || "00";
    const period = h >= 12 ? "PM" : "AM";
    if (h === 0) h = 12;
    else if (h > 12) h -= 12;
    return `${h}:${min} ${period}`;
  }
  return str;
}

export default function SchedulesAdminView({ theme }: { theme: "LIGHT" | "DARK" | "VINTAGE" }) {
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const [bookings, setBookings] = useState<any[]>([]);
  const [courts, setCourts] = useState<any[]>([]);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [editingBooking, setEditingBooking] = useState<any | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [tenantConfig, setTenantConfig] = useState<any>(null);
  const [hidePast, setHidePast] = useState(false);
  const [rowSelection, setRowSelection] = useState({});
  const [globalFilter, setGlobalFilter] = useState("");

  const isDark = theme === "DARK";

  useEffect(() => {
    if (!tenantId) return;
    // Fetch courts for the dropdown in edit modal
    const unsubCourts = onSnapshot(doc(db, "tenants", tenantId), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setCourts(Array.isArray(data.courts) ? data.courts : []);
        setTenantConfig(data);
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
    columnHelper.display({
      id: "select",
      header: ({ table }) => (
        <input
          type="checkbox"
          className="w-4 h-4 rounded border-stone-300 text-emerald-500 focus:ring-emerald-500 bg-transparent"
          checked={table.getIsAllPageRowsSelected()}
          onChange={table.getToggleAllPageRowsSelectedHandler()}
        />
      ),
      cell: ({ row }) => (
        <input
          type="checkbox"
          className="w-4 h-4 rounded border-stone-300 text-emerald-500 focus:ring-emerald-500 bg-transparent"
          checked={row.getIsSelected()}
          disabled={!row.getCanSelect()}
          onChange={row.getToggleSelectedHandler()}
        />
      ),
    }),
    columnHelper.accessor("date", {
      header: "Date",
      cell: (info) => <span className="font-bold tabular-nums">{info.getValue()}</span>,
    }),
    columnHelper.accessor("time", {
      header: "Time",
      cell: (info) => (
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-sm opacity-20">schedule</span>
          <span className="font-bold tabular-nums">{toDisplayTime(info.getValue())}</span>
        </div>
      ),
    }),
    columnHelper.accessor("courtName", {
      header: "Court",
      cell: (info) => (
        <button 
          onClick={() => setEditingBooking(info.row.original)}
          className="flex items-center gap-2 group hover:text-emerald-500 transition-colors"
        >
          <span className="material-symbols-outlined text-sm opacity-40 group-hover:opacity-100 group-hover:text-emerald-500">sports_tennis</span>
          <span className="underline decoration-dotted underline-offset-4 decoration-stone-300 group-hover:decoration-emerald-500 font-bold">{info.getValue()}</span>
        </button>
      ),
    }),
    columnHelper.accessor("userName", {
      header: "Player",
      cell: (info) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-[10px] font-black text-white">
            {getInitials(info.getValue())}
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-bold leading-none mb-1">{info.getValue()}</span>
            <span className="text-[10px] opacity-40 font-bold">{info.row.original.userEmail}</span>
          </div>
        </div>
      ),
    }),
    columnHelper.accessor("duration", {
      header: "Duration",
      cell: (info) => <span className="font-black opacity-40 text-[10px] uppercase tracking-widest">{info.getValue()} hr</span>,
    }),
    columnHelper.display({
      id: "actions",
      header: "Actions",
      cell: (info) => (
        <div className="flex justify-end gap-2">
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

  const filteredBookings = useMemo(() => {
    if (!hidePast) return bookings;
    const now = new Date();
    
    return bookings.filter(b => {
      try {
        const bDate = new Date(b.date);
        const [h, m] = b.time.split(':').map(Number);
        bDate.setHours(h || 0, m || 0, 0, 0);
        return bDate >= now;
      } catch (e) {
        return true; // Keep if date is malformed
      }
    });
  }, [bookings, hidePast]);

  const table = useReactTable({
    data: filteredBookings,
    columns,
    state: { sorting, rowSelection, globalFilter },
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  const handleBulkDelete = async () => {
    const selectedRows = table.getSelectedRowModel().rows;
    if (selectedRows.length === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedRows.length} reservations?`)) return;

    for (const row of selectedRows) {
      await deleteDoc(doc(db, "bookings", row.original.id));
    }
    setRowSelection({});
  };

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
        <div className="flex items-center gap-3">
          <div className="relative">
            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-lg opacity-20 pointer-events-none">search</span>
            <input
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              placeholder="Search reservations..."
              className={`pl-11 pr-6 h-10 rounded-2xl border text-[10px] font-black uppercase tracking-widest outline-none transition-all ${
                isDark ? "bg-stone-900 border-stone-800 text-white focus:border-[#ccff00]" : "bg-stone-50 border-stone-100 text-stone-900 focus:border-stone-400 shadow-sm"
              }`}
            />
          </div>

          <button
            onClick={() => setHidePast(!hidePast)}
            className={`px-4 h-10 rounded-2xl flex items-center gap-2 border transition-all ${
              hidePast 
                ? (isDark ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500" : "bg-emerald-50 border-emerald-100 text-emerald-600")
                : (isDark ? "border-stone-800 bg-stone-900 text-stone-400 hover:text-white" : "border-stone-200 bg-stone-50 text-stone-500 hover:text-stone-900 shadow-sm")
            }`}
          >
            <span className="material-symbols-outlined text-lg">{hidePast ? "visibility_off" : "visibility"}</span>
            <span className="text-[10px] font-black uppercase tracking-widest">{hidePast ? "Past Hidden" : "Hide Past"}</span>
          </button>

          <button
            onClick={() => setShowSettings(true)}
            className={`px-4 h-10 rounded-2xl flex items-center gap-2 border transition-all ${
              isDark ? "border-stone-800 bg-stone-900 text-stone-400 hover:text-white" : "border-stone-200 bg-stone-50 text-stone-500 hover:text-stone-900 shadow-sm"
            }`}
          >
            <span className="material-symbols-outlined text-lg">settings</span>
            <span className="text-[10px] font-black uppercase tracking-widest">Schedule Policy</span>
          </button>
          <div className={`px-4 py-2 rounded-2xl border text-[10px] font-black uppercase tracking-widest ${isDark ? "border-stone-800 bg-stone-900 text-stone-500" : "border-stone-200 bg-stone-50 text-stone-400"}`}>
            {table.getFilteredRowModel().rows.length} {hidePast ? "Upcoming" : "Total"} Bookings
          </div>
        </div>
      </div>

      {table.getSelectedRowModel().rows.length > 0 && (
        <div className="mb-6 flex items-center justify-between p-4 rounded-3xl bg-red-500/5 border border-red-500/10 animate-in fade-in slide-in-from-top-4 duration-300">
          <p className="text-[10px] font-black uppercase tracking-widest text-red-500 pl-2">
            {table.getSelectedRowModel().rows.length} Reservations Selected
          </p>
          <button
            onClick={handleBulkDelete}
            className="px-6 py-2.5 rounded-xl bg-red-500 text-white text-[10px] font-black uppercase tracking-widest hover:bg-red-600 transition-all shadow-lg shadow-red-500/20"
          >
            Delete Selected
          </button>
        </div>
      )}

      <div className={`border rounded-[2rem] overflow-hidden ${borderColor}`}>
        <table className="w-full text-left border-collapse">
          <thead className={headerBg}>
            {table.getHeaderGroups().map((headerGroup: any) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header: any) => (
                  <th 
                    key={header.id} 
                    className={`px-6 py-4 text-[10px] font-black uppercase tracking-widest transition-colors ${
                      header.column.getCanSort() ? "cursor-pointer hover:text-stone-900" : ""
                    } ${isDark ? "text-stone-500" : "text-stone-400"}`}
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    <div className="flex items-center gap-2">
                      {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                      {header.column.getIsSorted() === "asc" && <span className="material-symbols-outlined text-sm">arrow_upward</span>}
                      {header.column.getIsSorted() === "desc" && <span className="material-symbols-outlined text-sm">arrow_downward</span>}
                    </div>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className={isDark ? "bg-black" : "bg-white"}>
            {table.getRowModel().rows.map((row: any) => (
              <tr 
                key={row.id} 
                className={`border-t transition-all ${borderColor} ${isDark ? "hover:bg-stone-900/50" : "hover:bg-stone-50/50"}`}
              >
                {row.getVisibleCells().map((cell: any) => (
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

      {showSettings && (
        <Modal
          isOpen={showSettings}
          onClose={() => setShowSettings(false)}
          title="Schedule Policy"
          theme={theme}
          width={400}
        >
          <ScheduleSettings 
            config={tenantConfig} 
            tenantId={tenantId}
            theme={theme} 
            onClose={() => setShowSettings(false)} 
          />
        </Modal>
      )}
    </div>
  );
}

function ScheduleSettings({ config, tenantId, theme, onClose }: any) {
  const isDark = theme === "DARK";
  const [isSaving, setIsSaving] = useState(false);
  const [allowChange, setAllowChange] = useState(config?.allowScheduleChange ?? true);
  const [leadTime, setLeadTime] = useState(config?.changeLeadTime ?? "START");

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateDoc(doc(db, "tenants", tenantId), {
        allowScheduleChange: allowChange,
        changeLeadTime: leadTime,
        updatedAt: serverTimestamp(),
      });
      onClose();
    } catch (err) {
      console.error("Failed to save policy:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const labelCls = `text-[10px] font-black uppercase tracking-widest mb-2 block ${isDark ? "text-stone-500" : "text-stone-400"}`;
  const inputCls = `w-full px-4 py-3 rounded-2xl text-sm font-bold border transition-all focus:outline-none ${
    isDark ? "bg-stone-900 border-stone-800 text-white focus:border-[#00E5FF]" : "bg-stone-50 border-stone-100 text-stone-900 focus:border-stone-900"
  }`;

  return (
    <div className="space-y-8 py-2">
      <div className="space-y-6">
        <div className="flex items-center justify-between p-4 rounded-3xl border border-dashed border-stone-200 dark:border-stone-800">
          <div className="space-y-1">
            <h4 className={`text-xs font-black uppercase tracking-tight ${isDark ? "text-white" : "text-stone-900"}`}>Allow Schedule Changes</h4>
            <p className="text-[10px] text-stone-400 font-medium italic">Users can move or edit their own bookings</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input 
              type="checkbox" 
              className="sr-only peer" 
              checked={allowChange}
              onChange={(e) => setAllowChange(e.target.checked)}
            />
            <div className="w-11 h-6 bg-stone-200 peer-focus:outline-none rounded-full peer dark:bg-stone-800 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-emerald-500"></div>
          </label>
        </div>

        <div className={`space-y-4 transition-all duration-500 ${allowChange ? "opacity-100" : "opacity-30 pointer-events-none grayscale"}`}>
          <div>
            <label className={labelCls}>Change Lead Time Requirement</label>
            <select 
              value={leadTime} 
              onChange={(e) => setLeadTime(e.target.value)}
              className={inputCls}
            >
              <option value="1_DAY">1 Day Before Start</option>
              <option value="4_HOURS">4 Hours Before Start</option>
              <option value="START">Until Reservation Starts</option>
              <option value="END">Until Reservation Ends</option>
            </select>
            <p className="text-[9px] mt-2 text-stone-400 font-bold leading-relaxed">
              Define how much in advance players must commit to changes.
            </p>
          </div>
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={isSaving}
        className="w-full py-5 rounded-2xl bg-stone-900 text-white dark:bg-[#ccff00] dark:text-stone-950 text-[11px] font-black uppercase tracking-widest transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
      >
        {isSaving ? "Saving Policy..." : "Update Schedule Policy"}
      </button>
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
            {courts.map((c: any) => (
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
            {availableTimes.map((t: string) => <option key={t} value={t}>{t}</option>)}
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

      {/* QR Code Section */}
      <div className={`mt-8 p-6 rounded-[2rem] flex flex-col items-center justify-center border-2 border-dashed transition-all animate-in fade-in zoom-in duration-500 ${
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
    </div>
  );
}
