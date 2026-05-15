"use client";
import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  flexRender,
  createColumnHelper,
  ColumnFiltersState,
} from "@tanstack/react-table";
import { Modal } from "@repo/ui/modal";
import { db, storage } from "../lib/firebase";
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  addDoc,
  getDocs,
  where
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { format, addDays, addWeeks, addMonths } from "date-fns";

import { Event } from "../lib/types";

// User interface for leader selection
interface User {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
  portrait_url?: string;
}

const getOccurrences = (
  start: Date,
  type: "none" | "daily" | "weekly" | "monthly",
  until: "date" | "occurrences",
  count: number,
  endDateStr: string
): Date[] => {
  if (type === "none") return [start];
  if (isNaN(start.getTime())) return [];
  
  const occurrences: Date[] = [];
  let current = new Date(start);
  const max = 30;
  
  let limitDate: Date | null = null;
  if (until === "date" && endDateStr) {
    limitDate = new Date(`${endDateStr}T23:59:59`);
    if (isNaN(limitDate.getTime())) limitDate = null;
  }

  while (occurrences.length < max) {
    if (until === "date" && limitDate && current > limitDate) break;
    if (until === "occurrences" && occurrences.length >= count) break;
    
    occurrences.push(new Date(current));
    
    if (type === "daily") current = addDays(current, 1);
    else if (type === "weekly") current = addWeeks(current, 1);
    else if (type === "monthly") current = addMonths(current, 1);
    
    if (isNaN(current.getTime())) break;
  }
  
  return occurrences;
};

const timeToMinutes = (timeStr: string): number => {
  if (!timeStr) return 0;
  const match = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!match || !match[1] || !match[2]) {
    // Try 24h format HH:mm
    const [hStr, mStr] = timeStr.split(":");
    if (hStr && mStr) {
      return parseInt(hStr, 10) * 60 + parseInt(mStr, 10);
    }
    return 0;
  }
  let h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  const period = match[3]?.toUpperCase();
  if (period === "PM" && h !== 12) h += 12;
  if (period === "AM" && h === 12) h = 0;
  return h * 60 + m;
};

export default function EventsAdminView({ theme = "LIGHT", tenantId }: { theme?: "LIGHT" | "DARK" | "VINTAGE", tenantId: string }) {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [tenantUsers, setTenantUsers] = useState<User[]>([]);
  const [conflicts, setConflicts] = useState<any[]>([]);
  const [showConflictModal, setShowConflictModal] = useState(false);
  const initialFormState = {
    title: "",
    description: "",
    start_date: format(new Date(), "yyyy-MM-dd"),
    start_time: "09:00",
    end_date: format(new Date(), "yyyy-MM-dd"),
    end_time: "11:00",
    type: "one-time" as "one-time" | "regular",
    max_participants: 20,
    cancellation_policy: "24-hour notice required for full refund.",
    cancellation_deadline: "",
    image_url: "",
    tag: "",
    event_leaders: [] as string[],
    save_to_schedules: false,
    court_id: "",
    repeat_type: "none" as "none" | "daily" | "weekly" | "monthly",
    repeat_until: "occurrences" as "date" | "occurrences",
    repeat_end_date: "",
    repeat_count: 1
  };

  const [formData, setFormData] = useState(initialFormState);

  const resetForm = () => {
    setFormData(initialFormState);
  };

  const [sorting, setSorting] = useState([]);
  const [globalFilter, setGlobalFilter] = useState("");

  const [courts, setCourts] = useState<any[]>([]);
  const [categories, setCategories] = useState<string[]>([]);

  // Common UI classes
  const inputCls = `w-full border rounded-2xl px-5 py-3.5 text-sm font-bold outline-none transition-all ${theme === "DARK" ? "bg-stone-950 text-white border-stone-800 focus:border-[#ccff00]" : "bg-white text-stone-900 border-stone-200 focus:border-stone-400 shadow-sm"
    }`;
  const labelCls = `text-[10px] font-black tracking-widest uppercase mb-2 block ${theme === "DARK" ? "text-stone-200" : "text-stone-950"
    }`;

  useEffect(() => {
    if (!tenantId) return;

    const q = query(collection(db, "tenants", tenantId, "events"), orderBy("date", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const eventData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Event[];
      setEvents(eventData);
      setLoading(false);
    });

    // Fetch tenant users for leader selection
    const fetchUsers = async () => {
      const userSnap = await getDocs(collection(db, "tenants", tenantId, "users"));
      const userData = userSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as User[];
      setTenantUsers(userData);
    };
    fetchUsers();

    // Fetch event categories from global dimensions
    const fetchCategories = async () => {
      const q = query(collection(db, "dimensions"), where("category", "==", "EventCategory"));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const firstDoc = snap.docs[0];
        if (firstDoc) {
          const data = firstDoc.data();
          setCategories(data.items || []);
          if (data.items?.length > 0 && !formData.tag) {
            setFormData(prev => ({ ...prev, tag: data.items[0] }));
          }
        }
      } else {
        // Fallback if not found
        setCategories(["Social", "Training", "Tournament", "Youth", "Clinic"]);
      }
    };
    fetchCategories();

    // Fetch tenant configuration (including courts)
    const unsubTenant = onSnapshot(doc(db, "tenants", tenantId), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setCourts(data.courts || []);
      }
    });
 
    return () => {
      unsubscribe();
      unsubTenant();
    };
  }, [tenantId]);

  const handleSaveEvent = async (force = false) => {
    if (!formData.title || !formData.start_date || !tenantId) {
      console.warn("[handleSaveEvent] Missing required fields:", { title: !!formData.title, start_date: !!formData.start_date, tenantId: !!tenantId });
      return;
    }

    const startDateTime = new Date(`${formData.start_date}T${formData.start_time}`);
    const endDateTime = new Date(`${formData.end_date}T${formData.end_time}`);

    if (isNaN(startDateTime.getTime()) || isNaN(endDateTime.getTime())) {
      console.error("[handleSaveEvent] Invalid Date:", { startDateTime, endDateTime, start_date: formData.start_date, start_time: formData.start_time, end_date: formData.end_date, end_time: formData.end_time });
      alert("Invalid date or time selected.");
      return;
    }

    const durationHours = (endDateTime.getTime() - startDateTime.getTime()) / (60 * 60 * 1000);

    const occurrenceDates = getOccurrences(
      startDateTime,
      formData.repeat_type,
      formData.repeat_until,
      formData.repeat_count,
      formData.repeat_end_date
    );

    // Check for conflicts if saving to schedules and not forcing
    if (formData.save_to_schedules && formData.court_id && !force) {
      const bookingsSnap = await getDocs(collection(db, "tenants", tenantId, "bookings"));
      const allBookings = bookingsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      const overlapping = allBookings.filter((b: any) => {
        if (editingEvent && b.eventId === editingEvent.id) return false;
        if (b.courtId !== formData.court_id) return false;
        
        const bStart = new Date(`${b.date}T${b.time}`);
        const bEnd = b.endTime 
          ? new Date(`${b.date}T${b.endTime}`)
          : new Date(bStart.getTime() + (Number(b.duration) || 1) * 60 * 60 * 1000);

        return occurrenceDates.some(occStart => {
          const occEnd = new Date(occStart.getTime() + durationHours * 60 * 60 * 1000);
          
          // Since occurrenceDates are generated from startDateTime (which has the date), 
          // they already represent the specific date of each occurrence.
          return (occStart < bEnd && occEnd > bStart);
        });
      });

      if (overlapping.length > 0) {
        setConflicts(overlapping);
        setShowConflictModal(true);
        return;
      }
    }

    setIsSaving(true);
    try {
      const payload = {
        ...formData,
        date: startDateTime, // Legacy field for some views
        start_date: formData.start_date,
        end_date: formData.end_date,
        start_time: formData.start_time,
        end_time: formData.end_time,
        cancellation_deadline: formData.cancellation_deadline ? new Date(formData.cancellation_deadline) : null,
        max_participants: Number(formData.max_participants),
        updated_at: serverTimestamp(),
        tenant_id: tenantId,
        court_name: courts.find(c => (c.id || c.name) === formData.court_id)?.name || "",
      };
 
      let eventId = editingEvent?.id;
      if (editingEvent) {
        await updateDoc(doc(db, "tenants", tenantId, "events", editingEvent.id), payload);
      } else {
        const docRef = await addDoc(collection(db, "tenants", tenantId, "events"), {
          ...payload,
          signups: [],
          waiting_list: [],
          created_at: serverTimestamp()
        });
        eventId = docRef.id;
      }

      // Handle Scheduling Sync
      if (formData.save_to_schedules && formData.court_id) {
        const selectedCourt = courts.find(c => (c.id || c.name) === formData.court_id);
        
        // Delete ALL existing bookings for this event first to sync correctly
        const bQuery = query(collection(db, "tenants", tenantId, "bookings"), where("eventId", "==", eventId));
        const bSnap = await getDocs(bQuery);
        for (const bDoc of bSnap.docs) {
          await deleteDoc(doc(db, "tenants", tenantId, "bookings", bDoc.id));
        }

        // Create new bookings for each occurrence
        for (const occDate of occurrenceDates) {
          const occEnd = new Date(occDate.getTime() + durationHours * 60 * 60 * 1000);
          const bookingData = {
            date: format(occDate, "yyyy-MM-dd"), // Standard format
            time: format(occDate, "HH:mm"),
            endTime: format(occEnd, "HH:mm"),
            duration: durationHours,
            courtId: formData.court_id,
            courtName: selectedCourt?.name || "Unknown Court",
            userId: "CLUB_EVENT",
            userName: `Event: ${formData.title}`,
            userEmail: "club@event.com",
            eventId: eventId,
            type: "event",
            updatedAt: serverTimestamp(),
            createdAt: serverTimestamp()
          };
          await addDoc(collection(db, "tenants", tenantId, "bookings"), bookingData);
        }
      } else {
        // If not saving to schedules, delete all existing bookings for this event
        const bQuery = query(collection(db, "tenants", tenantId, "bookings"), where("eventId", "==", eventId));
        const bSnap = await getDocs(bQuery);
        for (const bDoc of bSnap.docs) {
          await deleteDoc(doc(db, "tenants", tenantId, "bookings", bDoc.id));
        }
      }

      // If we forced save, cancel the conflicts
      if (force && conflicts.length > 0) {
        for (const conflict of conflicts) {
          await deleteDoc(doc(db, "tenants", tenantId, "bookings", conflict.id));
          // TODO: Notify user (e.g. add to notifications collection)
          await addDoc(collection(db, "tenants", tenantId, "notifications"), {
            userId: conflict.userId,
            title: "Booking Cancelled",
            message: `Your booking on ${conflict.date} at ${conflict.time} was cancelled due to a club event: ${formData.title}.`,
            type: "alert",
            created_at: serverTimestamp(),
            read: false
          });
        }
      }

      setShowCreateModal(false);
      setShowEditModal(false);
      setShowConflictModal(false);
      setEditingEvent(null);
      setConflicts([]);
      resetForm();
    } catch (err) {
      console.error("Failed to save event:", err);
      alert("Failed to save event.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteEvent = async () => {
    if (!confirmDelete || !tenantId) return;
    try {
      // Also delete ALL linked bookings
      const bQuery = query(collection(db, "tenants", tenantId, "bookings"), where("eventId", "==", confirmDelete));
      const bSnap = await getDocs(bQuery);
      for (const bDoc of bSnap.docs) {
        await deleteDoc(doc(db, "tenants", tenantId, "bookings", bDoc.id));
      }

      await deleteDoc(doc(db, "tenants", tenantId, "events", confirmDelete));
      setConfirmDelete(null);
    } catch (err) {
      console.error("Failed to delete event:", err);
      alert("Failed to delete event.");
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !tenantId) return;

    setIsUploading(true);
    try {
      const storageRef = ref(storage, `tenants/${tenantId}/events/${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      setFormData(prev => ({ ...prev, image_url: url }));
    } catch (err) {
      console.error("Image upload failed:", err);
      alert("Failed to upload image.");
    } finally {
      setIsUploading(false);
    }
  };

  const columnHelper = createColumnHelper<Event>();
  const columns = [
    {
      accessorKey: "title",
      header: "EVENT",
      cell: (info: any) => (
        <div className="flex flex-col">
          <span className="font-black uppercase tracking-tight">{info.getValue()}</span>
          <span className="text-[10px] opacity-40 uppercase font-bold">{info.row.original.tag}</span>
        </div>
      ),
    },
    {
      accessorKey: "start_date",
      header: "DATE & TIME",
      cell: (info: any) => {
        const start = info.row.original.start_date;
        const startTime = info.row.original.start_time;
        const endTime = info.row.original.end_time;
        return (
          <div className="flex flex-col">
            <span className="font-bold">{start}</span>
            <span className="text-[10px] opacity-50 font-medium">
              {startTime} - {info.row.original.use_end_date ? endTime : "No End"}
            </span>
          </div>
        );
      },
    },
    {
      accessorKey: "type",
      header: "TYPE",
      cell: (info: any) => (
        <span className={`px-2 py-1 rounded text-[10px] font-black uppercase ${
          info.getValue() === "regular" 
            ? "bg-[#ccff00] text-stone-900" 
            : (theme === "DARK" ? "bg-stone-800 text-stone-400" : "bg-stone-900 text-white")
        }`}>
          {info.getValue()}
        </span>
      ),
    },
    {
      accessorKey: "signups",
      header: "SIGNUPS",
      cell: (info: any) => (
        <div className="flex items-center gap-2">
          <div className="w-16 h-1.5 bg-stone-100 dark:bg-stone-800 rounded-full overflow-hidden">
            <div 
              className="h-full bg-[#ccff00]" 
              style={{ width: `${Math.min(100, (info.getValue()?.length || 0) / (info.row.original.max_participants || 1) * 100)}%` }}
            />
          </div>
          <span className="text-[10px] font-bold">
            {info.getValue()?.length || 0}/{info.row.original.max_participants}
          </span>
        </div>
      ),
    },
    {
      id: "actions",
      header: "",
      cell: (info: any) => (
        <div className="flex justify-end gap-2">
          <button
            onClick={() => {
              setEditingEvent(info.row.original);
              setFormData({
                ...info.row.original,
                start_date: info.row.original.start_date || format(new Date(), "yyyy-MM-dd"),
                end_date: info.row.original.end_date || info.row.original.start_date || format(new Date(), "yyyy-MM-dd"),
              });
              setShowEditModal(true);
            }}
            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
          >
            <span className="material-symbols-outlined text-sm">edit</span>
          </button>
          <button
            onClick={() => setConfirmDelete(info.row.original.id)}
            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-red-50 text-red-500 transition-colors"
          >
            <span className="material-symbols-outlined text-sm">delete</span>
          </button>
        </div>
      ),
    },
  ];

  const table = useReactTable({
    data: events,
    columns,
    state: {
      sorting,
      globalFilter,
    },
    onSortingChange: setSorting as any,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className={`min-h-screen ${theme === "DARK" ? "bg-black text-white" : "bg-stone-50 text-stone-900"}`}>
      <div className="max-w-[1600px] mx-auto p-12 space-y-12">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-8">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-1.5 bg-[#ccff00] rounded-full" />
              <span className="text-[10px] font-black tracking-[0.2em] uppercase opacity-40">Admin Control</span>
            </div>
            <h1 className={`text-7xl md:text-8xl font-black tracking-tighter uppercase leading-[0.85] ${theme === "DARK" ? "text-white" : "text-stone-900"}`}>
              EVENTS<br />
              <span className={theme === "DARK" ? "text-stone-800" : "text-stone-300"}>MANAGEMENT</span>
            </h1>
            <p className={`text-sm font-medium max-w-md ${theme === "DARK" ? "text-stone-400" : "text-stone-500"}`}>
              Design, schedule, and oversee club activities. All events synced to court bookings automatically.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
            {/* Search Bar */}
            <div className={`relative flex-1 sm:w-80 group ${theme === "DARK" ? "text-white" : "text-stone-900"}`}>
              <span className="material-symbols-outlined absolute left-5 top-1/2 -translate-y-1/2 opacity-20 group-focus-within:opacity-100 transition-opacity">search</span>
              <input
                value={globalFilter ?? ""}
                onChange={e => setGlobalFilter(e.target.value)}
                placeholder="SEARCH EVENTS..."
                className={`w-full pl-14 pr-6 py-4 rounded-2xl text-[10px] font-black tracking-widest uppercase outline-none transition-all border ${
                  theme === "DARK" 
                    ? "bg-stone-950 border-stone-800 focus:border-[#ccff00] focus:ring-4 focus:ring-[#ccff00]/10" 
                    : "bg-white border-stone-200 focus:border-stone-400 focus:ring-4 focus:ring-stone-100 shadow-sm"
                }`}
              />
            </div>
            
            <button
              onClick={() => {
                resetForm();
                setShowCreateModal(true);
              }}
              className={`w-full sm:w-auto px-8 py-4 rounded-2xl text-[10px] font-black tracking-widest uppercase transition-all shadow-2xl flex items-center justify-center gap-3 ${
                theme === "DARK" 
                  ? "bg-[#ccff00] text-stone-950 hover:scale-[1.02] active:scale-[0.98] shadow-[#ccff00]/20" 
                  : "bg-stone-900 text-white hover:bg-stone-800 shadow-black/20"
              }`}
            >
              <span className="material-symbols-outlined text-lg">add_circle</span>
              CREATE NEW EVENT
            </button>
          </div>
        </div>

        {/* Data Table */}
        <div className={`rounded-[2.5rem] border overflow-hidden transition-all duration-500 ${
          theme === "DARK" ? "bg-stone-950 border-stone-800 shadow-2xl" : "bg-white border-stone-200 shadow-xl"
        }`}>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                {table.getHeaderGroups().map(headerGroup => (
                  <tr key={headerGroup.id} className={`${theme === "DARK" ? "bg-stone-900/30" : "bg-stone-50/50"}`}>
                    {headerGroup.headers.map(header => (
                      <th 
                        key={header.id} 
                        className="px-10 py-8 text-[10px] font-black uppercase tracking-[0.2em] text-stone-400 border-b border-stone-100 dark:border-stone-800"
                        onClick={header.column.getToggleSortingHandler()}
                        style={{ cursor: header.column.getCanSort() ? 'pointer' : 'default' }}
                      >
                        <div className="flex items-center gap-2">
                          {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                          {{
                            asc: <span className="material-symbols-outlined text-xs">arrow_upward</span>,
                            desc: <span className="material-symbols-outlined text-xs">arrow_downward</span>,
                          }[header.column.getIsSorted() as string] ?? null}
                        </div>
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody className="divide-y divide-stone-50 dark:divide-stone-900">
                {table.getRowModel().rows.map(row => (
                  <tr 
                    key={row.id} 
                    className="group hover:bg-stone-50/50 dark:hover:bg-stone-900/50 transition-all duration-300"
                  >
                    {row.getVisibleCells().map(cell => (
                      <td key={cell.id} className="px-10 py-7">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {events.length === 0 && (
            <div className="py-32 flex flex-col items-center justify-center gap-6">
              <div className={`w-24 h-24 rounded-full flex items-center justify-center ${theme === "DARK" ? "bg-stone-900" : "bg-stone-50"}`}>
                <span className="material-symbols-outlined text-4xl opacity-20">event_busy</span>
              </div>
              <div className="text-center space-y-2">
                <p className="text-[10px] font-black uppercase tracking-widest opacity-40">No records found</p>
                <p className="text-xs text-stone-400 font-medium italic">Start by creating your first club event.</p>
              </div>
            </div>
          )}
        </div>
      </div>
      {/* Create/Edit Modal */}
      <Modal
        isOpen={showCreateModal || showEditModal}
        onClose={() => {
          setShowCreateModal(false);
          setShowEditModal(false);
          setEditingEvent(null);
        }}
        title={editingEvent ? "Edit Event" : "Create Event"}
        theme={theme}
        width={800}
        footer={
          <div className="flex gap-4">
            <button
              onClick={() => {
                setShowCreateModal(false);
                setShowEditModal(false);
                setEditingEvent(null);
              }}
              className={`flex-1 py-4 rounded-2xl text-[10px] font-black tracking-widest uppercase transition-colors border ${theme === "DARK" ? "border-stone-800 text-white hover:bg-stone-800" : "border-stone-200 text-stone-900 hover:bg-stone-50"
                }`}
            >
              CANCEL
            </button>
            <button
              onClick={() => handleSaveEvent(false)}
              disabled={isSaving}
              className={`flex-1 py-4 rounded-2xl text-[10px] font-black tracking-widest uppercase transition-all shadow-xl flex items-center justify-center gap-3 ${theme === "DARK" ? "bg-[#ccff00] text-stone-950 shadow-[#ccff00]/20" : "bg-stone-900 text-white shadow-black/20"
                }`}
            >
              {isSaving ? "SAVING..." : "SAVE EVENT"}
            </button>
          </div>
        }
      >
        <div className="grid grid-cols-2 gap-8">
          {/* Scheduling Block at the Top */}
          <div className="col-span-2 p-6 rounded-3xl bg-stone-50 dark:bg-stone-900/50 border border-stone-200 dark:border-stone-800 space-y-8">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-stone-400">calendar_month</span>
              <h3 className="text-xs font-black uppercase tracking-widest">Date & Time Settings</h3>
            </div>

            <div className="grid grid-cols-3 gap-8">
              {/* Event Date */}
              <div className="space-y-4">
                <h4 className="text-[10px] font-black uppercase text-stone-400 tracking-tighter">Event Schedule</h4>
                <div>
                  <label className={labelCls}>Event Date</label>
                  <input
                    type="date"
                    value={formData.start_date}
                    onChange={e => setFormData({ ...formData, start_date: e.target.value, end_date: e.target.value })}
                    className={inputCls}
                  />
                </div>
              </div>

              {/* Start Time */}
              <div className="space-y-4">
                <h4 className="text-[10px] font-black uppercase text-stone-400 tracking-tighter">&nbsp;</h4>
                <div>
                  <label className={labelCls}>Start Time</label>
                  <TimePicker
                    value={formData.start_time}
                    onChange={val => setFormData({ ...formData, start_time: val })}
                    theme={theme}
                  />
                </div>
              </div>

              {/* End Time */}
              <div className="space-y-4">
                <h4 className="text-[10px] font-black uppercase text-stone-400 tracking-tighter">&nbsp;</h4>
                <div>
                  <label className={labelCls}>End Time</label>
                  <TimePicker
                    value={formData.end_time}
                    onChange={val => setFormData({ ...formData, end_time: val })}
                    theme={theme}
                  />
                </div>
              </div>
            </div>

            {/* Toggles on the same line */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center justify-between p-4 rounded-2xl border border-dashed border-stone-200 dark:border-stone-800">
                <div className="space-y-1">
                  <h4 className={`text-xs font-black uppercase tracking-tight ${theme === "DARK" ? "text-white" : "text-stone-900"}`}>
                    {formData.save_to_schedules ? "SAVE ON SCHEDULES" : "NO SAVE ON SCHEDULES"}
                  </h4>
                  <p className="text-[10px] text-stone-400 font-medium italic">Blocks court for this event</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    className="sr-only peer" 
                    checked={formData.save_to_schedules}
                    onChange={(e) => setFormData({ ...formData, save_to_schedules: e.target.checked })}
                  />
                  <div className="w-11 h-6 bg-stone-200 peer-focus:outline-none rounded-full peer dark:bg-stone-800 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-[#ccff00]"></div>
                </label>
              </div>

              <div className="p-4 rounded-2xl border border-dashed border-stone-200 dark:border-stone-800 opacity-50 flex items-center justify-center">
                <p className="text-[10px] text-stone-400 font-black uppercase">Schedule Sync Active</p>
              </div>
            </div>

            {/* Recurrence Settings inside the block */}
            <div className="pt-4 border-t border-stone-200 dark:border-stone-800 grid grid-cols-2 gap-8">
              <div className="col-span-2 flex items-center gap-2 mb-2">
                <span className="material-symbols-outlined text-stone-400">repeat</span>
                <h3 className="text-xs font-black uppercase tracking-widest">Recurrence Settings</h3>
              </div>
              
              <div>
                <label className={labelCls}>Repeat Type</label>
                <select
                  value={formData.repeat_type}
                  onChange={e => setFormData({ ...formData, repeat_type: e.target.value as any })}
                  className={inputCls}
                >
                  <option value="none">DO NOT REPEAT</option>
                  <option value="daily">DAILY</option>
                  <option value="weekly">WEEKLY</option>
                  <option value="monthly">MONTHLY</option>
                </select>
              </div>

              {formData.repeat_type !== "none" && (
                <>
                  <div>
                    <label className={labelCls}>End Recurrence By</label>
                    <select
                      value={formData.repeat_until}
                      onChange={e => setFormData({ ...formData, repeat_until: e.target.value as any })}
                      className={inputCls}
                    >
                      <option value="occurrences">NUMBER OF EVENTS</option>
                      <option value="date">SPECIFIC DATE</option>
                    </select>
                  </div>

                  {formData.repeat_until === "occurrences" ? (
                    <div>
                      <label className={labelCls}>Number of Events (Max 30)</label>
                      <input
                        type="number"
                        min={1}
                        max={30}
                        value={formData.repeat_count}
                        onChange={e => setFormData({ ...formData, repeat_count: Math.min(30, parseInt(e.target.value) || 1) })}
                        className={inputCls}
                      />
                    </div>
                  ) : (
                    <div>
                      <label className={labelCls}>Repeat End Date</label>
                      <input
                        type="date"
                        value={formData.repeat_end_date}
                        onChange={e => setFormData({ ...formData, repeat_end_date: e.target.value })}
                        className={inputCls}
                      />
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="col-span-2">
            <label className={labelCls}>Event Title</label>
            <input
              value={formData.title}
              onChange={e => setFormData({ ...formData, title: e.target.value })}
              className={inputCls}
              placeholder="e.g. Summer Tennis Camp 2024"
            />
          </div>

          <div className="col-span-2">
            <label className={labelCls}>Description</label>
            <textarea
              value={formData.description}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
              className={`${inputCls} h-32 resize-none`}
              placeholder="Describe the event details, activities, and requirements..."
            />
          </div>

          <div>
            <label className={labelCls}>Max Participants</label>
            <input
              type="number"
              value={formData.max_participants}
              onChange={e => setFormData({ ...formData, max_participants: parseInt(e.target.value) })}
              className={inputCls}
            />
          </div>

          <div>
            <label className={labelCls}>Tag / Category</label>
            <select
              value={formData.tag}
              onChange={e => setFormData({ ...formData, tag: e.target.value })}
              className={inputCls}
            >
              <option value="" disabled>Select Category</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <div className="col-span-2">
            <label className={labelCls}>Event Leaders</label>
            <div className={`mt-2 p-4 rounded-2xl border flex flex-wrap gap-2 ${theme === "DARK" ? "bg-stone-950 border-stone-800" : "bg-stone-50 border-stone-200"
              }`}>
              {tenantUsers.map(user => {
                const isSelected = formData.event_leaders.includes(user.id);
                return (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => {
                      const newLeaders = isSelected
                        ? formData.event_leaders.filter(id => id !== user.id)
                        : [...formData.event_leaders, user.id];
                      setFormData({ ...formData, event_leaders: newLeaders });
                    }}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all border ${isSelected
                        ? (theme === "DARK" ? "bg-[#ccff00] border-[#ccff00] text-stone-900" : "bg-stone-900 border-stone-900 text-white")
                        : (theme === "DARK" ? "bg-stone-900 border-stone-800 text-stone-400" : "bg-white border-stone-200 text-stone-600")
                      }`}
                  >
                    {user.portrait_url ? (
                      <img src={user.portrait_url} className="w-5 h-5 rounded-full object-cover" alt="" />
                    ) : (
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${isSelected ? "bg-black/10" : "bg-stone-200"
                        }`}>
                        {user.first_name?.[0]}{user.last_name?.[0]}
                      </div>
                    )}
                    <span className="text-[10px] font-black uppercase">{user.first_name} {user.last_name}</span>
                    {isSelected && <span className="material-symbols-outlined text-xs">close</span>}
                  </button>
                );
              })}
              {tenantUsers.length === 0 && (
                <p className="text-[10px] opacity-40 uppercase font-black italic">No users found in this tenant</p>
              )}
            </div>
          </div>

          <div className="col-span-2 grid grid-cols-2 gap-8">
            <div>
              <label className={labelCls}>Cancellation Policy</label>
              <input
                value={formData.cancellation_policy}
                onChange={e => setFormData({ ...formData, cancellation_policy: e.target.value })}
                className={inputCls}
                placeholder="e.g. No refunds within 24 hours"
              />
            </div>
            <div>
              <label className={labelCls}>Cancellation Deadline</label>
              <PremiumDateTimePicker
                value={formData.cancellation_deadline}
                onChange={val => setFormData({ ...formData, cancellation_deadline: val })}
                theme={theme}
                placeholder="Set deadline..."
              />
            </div>
          </div>

          <div className="col-span-2">
            <label className={labelCls}>Event Image</label>
            <div className="flex gap-6 items-start">
              <div className={`w-40 h-40 rounded-3xl border-2 border-dashed flex flex-col items-center justify-center gap-2 overflow-hidden relative group transition-colors ${theme === "DARK" ? "border-stone-800 bg-stone-950/50" : "border-stone-200 bg-stone-50"
                }`}>
                {formData.image_url ? (
                  <>
                    <img src={formData.image_url} className="w-full h-full object-cover" alt="Hero" />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <button onClick={() => setFormData(prev => ({ ...prev, image_url: "" }))} className="text-white">
                        <span className="material-symbols-outlined">delete</span>
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined opacity-20 text-4xl">image</span>
                    <p className="text-[8px] font-black uppercase tracking-widest opacity-40">No Image</p>
                  </>
                )}
                {isUploading && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                    <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  </div>
                )}
              </div>
              <div className="flex-1 space-y-4">
                <p className={`text-[10px] font-medium leading-relaxed ${theme === "DARK" ? "text-stone-400" : "text-stone-500"}`}>
                  Recommended size: 1200x600px. This image will be displayed on the dashboard and programs view.
                </p>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className={`px-6 py-3 rounded-xl text-[10px] font-black tracking-widest uppercase transition-colors ${theme === "DARK" ? "bg-stone-800 text-white hover:bg-stone-700" : "bg-white border border-stone-200 hover:bg-stone-50"
                    }`}
                >
                  UPLOAD IMAGE
                </button>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleImageUpload}
                  className="hidden"
                  accept="image/*"
                />
              </div>
            </div>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title="Delete Event"
        theme={theme}
        width={400}
        footer={
          <div className="flex gap-4">
            <button
              onClick={() => setConfirmDelete(null)}
              className={`flex-1 py-4 rounded-xl text-[10px] font-black tracking-widest uppercase border ${theme === "DARK" ? "border-stone-800 text-white" : "border-stone-200 text-stone-900"
                }`}
            >
              CANCEL
            </button>
            <button
              onClick={handleDeleteEvent}
              className="flex-1 py-4 rounded-xl text-[10px] font-black tracking-widest uppercase bg-red-500 text-white shadow-lg shadow-red-500/20"
            >
              DELETE
            </button>
          </div>
        }
      >
        <p className={`text-sm font-medium ${theme === "DARK" ? "text-stone-300" : "text-stone-600"}`}>
          Are you sure you want to delete this event? This action cannot be undone and will remove all sign-up data.
        </p>
      </Modal>

      {/* Conflict Modal */}
      <Modal
        isOpen={showConflictModal}
        onClose={() => setShowConflictModal(false)}
        title="Booking Conflicts Detected"
        theme={theme}
        width={500}
        footer={
          <div className="flex gap-4">
            <button
              onClick={() => setShowConflictModal(false)}
              className={`flex-1 py-4 rounded-xl text-[10px] font-black tracking-widest uppercase border ${theme === "DARK" ? "border-stone-800 text-white" : "border-stone-200 text-stone-900"
                }`}
            >
              CANCEL
            </button>
            <button
              onClick={() => handleSaveEvent(true)}
              className="flex-1 py-4 rounded-xl text-[10px] font-black tracking-widest uppercase bg-[#ccff00] text-stone-900 shadow-lg shadow-[#ccff00]/20"
            >
              NOTIFY & CANCEL ALL
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <p className={`text-sm font-medium ${theme === "DARK" ? "text-stone-300" : "text-stone-600"}`}>
            The following bookings overlap with this event. Saving will cancel these bookings and notify the users.
          </p>
          <div className={`rounded-2xl border overflow-hidden ${theme === "DARK" ? "bg-stone-950 border-stone-800" : "bg-stone-50 border-stone-200"
            }`}>
            {conflicts.map((c, i) => (
              <div key={i} className={`p-4 flex justify-between items-center ${i !== 0 ? (theme === "DARK" ? "border-t border-stone-800" : "border-t border-stone-200") : ""
                }`}>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-tight">{c.userName || "Unknown Player"}</p>
                  <p className={`text-[10px] opacity-60 ${theme === "DARK" ? "text-white" : "text-black"}`}>
                    Court: {c.courtName || c.courtId} | {c.time} ({c.duration}h)
                  </p>
                </div>
                <span className="material-symbols-outlined text-red-500 text-sm">warning</span>
              </div>
            ))}
          </div>
        </div>
      </Modal>
    </div>
  );
}

function TimePicker({ value, onChange, theme }: { value: string; onChange: (val: string) => void; theme: string }) {
  const isDark = theme === "DARK";
  
  const containerCls = `flex items-center gap-2 border rounded-2xl px-4 py-3.5 transition-all ${
    isDark ? "bg-stone-950 border-stone-800 text-white" : "bg-white border-stone-200 text-stone-900 shadow-sm"
  }`;
  const selectCls = `bg-transparent outline-none font-bold text-sm cursor-pointer appearance-none w-full transition-colors ${
    theme === "DARK" 
      ? "hover:bg-stone-800 hover:text-white focus:bg-stone-800 focus:text-white text-white" 
      : theme === "VINTAGE"
        ? "hover:bg-stone-100 focus:bg-stone-100 text-stone-900"
        : "hover:bg-stone-100 focus:bg-stone-100 text-[#4f6b28]" // Kinetic Lemon
  }`;

  const times = Array.from({ length: 48 }).map((_, i) => {
    const h = Math.floor(i / 2).toString().padStart(2, "0");
    const m = (i % 2 === 0 ? "00" : "30");
    return `${h}:${m}`;
  });

  return (
    <div className={containerCls}>
      <select
        value={value || "09:00"}
        onChange={e => onChange(e.target.value)}
        className={selectCls}
      >
        {times.map(t => (
          <option 
            key={t} 
            value={t} 
            className={
              theme === "DARK" ? "bg-stone-900 text-white" : 
              theme === "LIGHT" ? "bg-white text-[#4f6b28]" : 
              "bg-white text-stone-900"
            }
          >
            {t}
          </option>
        ))}
      </select>
    </div>
  );
}

function PremiumDateTimePicker({ value, onChange, theme, placeholder }: { 
  value: string; 
  onChange: (val: string) => void; 
  theme: "LIGHT" | "DARK" | "VINTAGE";
  placeholder?: string;
}) {
  const isDark = theme === "DARK";
  
  // Parse incoming YYYY-MM-DDTHH:mm
  const [datePart, timePart] = value ? value.split("T") : ["", ""];
  const [hourPart, minutePart] = timePart ? timePart.split(":") : ["00", "00"];

  const handleDateChange = (newDate: string) => {
    if (!newDate) {
      onChange("");
      return;
    }
    onChange(`${newDate}T${hourPart}:${minutePart}`);
  };

  const containerCls = `flex items-center gap-2 border rounded-2xl px-4 py-2 transition-all ${
    isDark ? "bg-stone-950 border-stone-800 text-white" : "bg-white border-stone-200 text-stone-900 shadow-sm"
  }`;

  const selectCls = `bg-transparent outline-none font-bold text-sm cursor-pointer appearance-none px-2 py-1 rounded-lg transition-colors ${
    theme === "DARK" 
      ? "hover:bg-stone-800 hover:text-white focus:bg-stone-800 focus:text-white text-white" 
      : theme === "VINTAGE"
        ? "hover:bg-stone-100 focus:bg-stone-100 text-stone-900"
        : "hover:bg-stone-100 focus:bg-stone-100 text-[#4f6b28]" // Kinetic Lemon
  }`;

  return (
    <div className={containerCls}>
      <input
        type="date"
        value={datePart}
        onChange={e => handleDateChange(e.target.value)}
        className="bg-transparent outline-none font-bold text-sm flex-1 min-w-0"
      />
      <div className="flex items-center gap-1 border-l pl-2 border-stone-100 dark:border-stone-800">
        <select
          value={`${hourPart}:${minutePart}`}
          onChange={e => {
            const [nh, nm] = e.target.value.split(":");
            const d = datePart || format(new Date(), "yyyy-MM-dd");
            onChange(`${d}T${nh}:${nm}`);
          }}
          className={selectCls}
        >
          {Array.from({ length: 48 }).map((_, i) => {
            const h = Math.floor(i / 2).toString().padStart(2, "0");
            const m = (i % 2 === 0 ? "00" : "30");
            const t = `${h}:${m}`;
            return (
              <option 
                key={t} 
                value={t} 
                className={
                  theme === "DARK" ? "bg-stone-900 text-white" : 
                  theme === "LIGHT" ? "bg-white text-[#4f6b28]" : 
                  "bg-white text-stone-900"
                }
              >
                {t}
              </option>
            );
          })}
        </select>
      </div>
    </div>
  );
}
