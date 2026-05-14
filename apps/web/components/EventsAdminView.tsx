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
import { format } from "date-fns";

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
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    date: format(new Date(new Date().setMinutes(0, 0, 0)), "yyyy-MM-dd'T'HH:mm"),
    end_date: "",
    type: "one-time" as "one-time" | "regular",
    max_participants: 20,
    cancellation_policy: "24-hour notice required for full refund.",
    cancellation_deadline: "",
    image_url: "",
    tag: "",
    event_leaders: [] as string[]
  });
  const [categories, setCategories] = useState<string[]>([]);

  // Common UI classes
  const inputCls = `w-full border rounded-2xl px-5 py-3.5 text-sm font-bold outline-none transition-all ${
    theme === "DARK" ? "bg-stone-950 text-white border-stone-800 focus:border-[#ccff00]" : "bg-white text-stone-900 border-stone-200 focus:border-stone-400 shadow-sm"
  }`;
  const labelCls = `text-[10px] font-black tracking-widest uppercase mb-2 block ${
    theme === "DARK" ? "text-stone-200" : "text-stone-950"
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

    return () => unsubscribe();
  }, [tenantId]);

  const handleSaveEvent = async (force = false) => {
    if (!formData.title || !formData.date || !tenantId) return;

    // Check for conflicts if not forcing
    if (!force) {
      const eventStart = new Date(formData.date);
      const eventEnd = formData.end_date ? new Date(formData.end_date) : new Date(eventStart.getTime() + 2 * 60 * 60 * 1000); // Default 2h
      
      const bookingsSnap = await getDocs(collection(db, "tenants", tenantId, "bookings"));
      const overlapping = bookingsSnap.docs.filter(doc => {
        const b = doc.data();
        const bDate = b.date; // Assuming yyyy-MM-dd
        const bTime = b.time; // Assuming HH:mm
        const bDuration = Number(b.duration) || 1;
        
        // Construct booking start/end
        const [year, month, day] = bDate.split("-");
        const [hour, min] = bTime.split(":");
        const bStart = new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(min));
        const bEnd = new Date(bStart.getTime() + bDuration * 60 * 60 * 1000);
        
        return (bStart < eventEnd && bEnd > eventStart);
      }).map(doc => ({ id: doc.id, ...doc.data() }));

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
        date: new Date(formData.date),
        end_date: formData.end_date ? new Date(formData.end_date) : null,
        cancellation_deadline: formData.cancellation_deadline ? new Date(formData.cancellation_deadline) : null,
        max_participants: Number(formData.max_participants),
        updated_at: serverTimestamp(),
        tenant_id: tenantId
      };

      if (editingEvent) {
        await updateDoc(doc(db, "tenants", tenantId, "events", editingEvent.id), payload);
      } else {
        await addDoc(collection(db, "tenants", tenantId, "events"), {
          ...payload,
          signups: [],
          waiting_list: [],
          created_at: serverTimestamp()
        });
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

  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      date: format(new Date(new Date().setMinutes(0, 0, 0)), "yyyy-MM-dd'T'HH:mm"),
      end_date: "",
      type: "one-time",
      max_participants: 20,
      cancellation_policy: "24-hour notice required for full refund.",
      cancellation_deadline: "",
      image_url: "",
      tag: categories[0] || "",
      event_leaders: []
    });
  };

  const columnHelper = createColumnHelper<Event>();
  const columns = [
    columnHelper.accessor("image_url", {
      header: "IMAGE",
      cell: info => (
        <div className="w-12 h-12 rounded-lg overflow-hidden bg-stone-100 flex items-center justify-center">
          {info.getValue() ? (
            <img src={info.getValue()} className="w-full h-full object-cover" alt="Event" />
          ) : (
            <span className="material-symbols-outlined text-stone-400">image</span>
          )}
        </div>
      )
    }),
    columnHelper.accessor("title", {
      header: "TITLE",
      cell: info => <span className="font-black uppercase tracking-tight">{info.getValue()}</span>
    }),
    columnHelper.accessor("tag", {
      header: "TAG",
      cell: info => (
        <span className={`px-3 py-1 rounded-full text-[8px] font-black tracking-widest uppercase ${
          theme === "DARK" ? "bg-stone-800 text-[#ccff00]" : "bg-stone-100 text-stone-600"
        }`}>
          {info.getValue()}
        </span>
      )
    }),
    columnHelper.accessor("date", {
      header: "DATE/TIME",
      cell: info => {
        const d = info.getValue()?.toDate ? info.getValue().toDate() : new Date(info.getValue());
        return <span className="font-mono text-xs">{format(d, "MMM dd, yyyy HH:mm")}</span>;
      }
    }),
    columnHelper.accessor("signups", {
      header: "PARTICIPANTS",
      cell: info => {
        const count = info.getValue()?.length || 0;
        const max = info.row.original.max_participants;
        return (
          <div className="flex flex-col gap-1">
            <div className="flex justify-between items-center text-[10px] font-black">
              <span>{count}/{max}</span>
              <span className="opacity-40">{Math.round((count / max) * 100)}%</span>
            </div>
            <div className={`w-24 h-1 rounded-full overflow-hidden ${theme === "DARK" ? "bg-stone-800" : "bg-stone-100"}`}>
              <div 
                className={`h-full transition-all ${theme === "DARK" ? "bg-[#ccff00]" : "bg-stone-900"}`}
                style={{ width: `${Math.min((count / max) * 100, 100)}%` }}
              />
            </div>
          </div>
        );
      }
    }),
    columnHelper.display({
      id: "actions",
      cell: info => (
        <div className="flex justify-end gap-2">
          <button
            onClick={() => {
              const ev = info.row.original;
              setEditingEvent(ev);
              setFormData({
                title: ev.title,
                description: ev.description,
                date: ev.date?.toDate ? format(ev.date.toDate(), "yyyy-MM-dd'T'HH:mm") : format(new Date(ev.date), "yyyy-MM-dd'T'HH:mm"),
                end_date: ev.end_date?.toDate ? format(ev.end_date.toDate(), "yyyy-MM-dd'T'HH:mm") : (ev.end_date ? format(new Date(ev.end_date), "yyyy-MM-dd'T'HH:mm") : ""),
                type: ev.type,
                max_participants: ev.max_participants,
                cancellation_policy: ev.cancellation_policy,
                cancellation_deadline: ev.cancellation_deadline?.toDate ? format(ev.cancellation_deadline.toDate(), "yyyy-MM-dd'T'HH:mm") : (ev.cancellation_deadline ? format(new Date(ev.cancellation_deadline), "yyyy-MM-dd'T'HH:mm") : ""),
                image_url: ev.image_url || "",
                tag: ev.tag || "Social",
                event_leaders: ev.event_leaders || []
              });
              setShowEditModal(true);
            }}
            className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
              theme === "DARK" ? "hover:bg-stone-800 text-stone-400" : "hover:bg-stone-50 text-stone-400"
            }`}
          >
            <span className="material-symbols-outlined text-sm">edit</span>
          </button>
          <button
            onClick={() => setConfirmDelete(info.row.original.id)}
            className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
              theme === "DARK" ? "hover:bg-red-500/20 text-red-500/50 hover:text-red-500" : "hover:bg-red-50 text-red-400 hover:text-red-600"
            }`}
          >
            <span className="material-symbols-outlined text-sm">delete</span>
          </button>
        </div>
      )
    })
  ];

  const table = useReactTable({
    data: events,
    columns,
    state: { columnFilters },
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="flex flex-col h-full animate-in fade-in duration-700">
      <div className="flex justify-between items-center mb-12">
        <div>
          <h1 className={`text-6xl font-black tracking-tighter uppercase ${theme === "DARK" ? "text-white" : "text-black"}`}>
            Events <span className="opacity-20">&</span> Programs
          </h1>
          <p className={`mt-2 font-medium ${theme === "DARK" ? "text-stone-400" : "text-stone-500"}`}>
            Plan and manage club tournaments, clinics, and social events.
          </p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowCreateModal(true);
          }}
          className={`px-8 py-4 rounded-2xl text-[10px] font-black tracking-widest uppercase transition-all shadow-xl flex items-center gap-3 ${
            theme === "DARK" ? "bg-[#ccff00] text-stone-950 shadow-[#ccff00]/20" : "bg-stone-900 text-white shadow-black/20"
          }`}
        >
          <span className="material-symbols-outlined">add</span>
          NEW EVENT
        </button>
      </div>

      <div className={`rounded-3xl border overflow-hidden ${
        theme === "DARK" ? "bg-stone-950 border-stone-800" : "bg-white border-stone-200 shadow-sm"
      }`}>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              {table.getHeaderGroups().map(headerGroup => (
                <tr key={headerGroup.id} className={theme === "DARK" ? "border-b border-stone-800" : "border-b border-stone-50"}>
                  {headerGroup.headers.map(header => (
                    <th key={header.id} className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em] opacity-40">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map(row => (
                <tr key={row.id} className={`group transition-colors ${
                  theme === "DARK" ? "hover:bg-stone-800/50 border-b border-stone-800/50" : "hover:bg-stone-50 border-b border-stone-50"
                }`}>
                  {row.getVisibleCells().map(cell => (
                    <td key={cell.id} className="px-8 py-6">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
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
              className={`flex-1 py-4 rounded-2xl text-[10px] font-black tracking-widest uppercase transition-colors border ${
                theme === "DARK" ? "border-stone-800 text-white hover:bg-stone-800" : "border-stone-200 text-stone-900 hover:bg-stone-50"
              }`}
            >
              CANCEL
            </button>
            <button
              onClick={() => handleSaveEvent(false)}
              disabled={isSaving}
              className={`flex-1 py-4 rounded-2xl text-[10px] font-black tracking-widest uppercase transition-all shadow-xl flex items-center justify-center gap-3 ${
                theme === "DARK" ? "bg-[#ccff00] text-stone-950 shadow-[#ccff00]/20" : "bg-stone-900 text-white shadow-black/20"
              }`}
            >
              {isSaving ? "SAVING..." : "SAVE EVENT"}
            </button>
          </div>
        }
      >
        <div className="grid grid-cols-2 gap-8">
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
            <label className={labelCls}>Start Date & Time</label>
            <input
              type="datetime-local"
              step="600"
              value={formData.date}
              onChange={e => setFormData({ ...formData, date: e.target.value })}
              className={inputCls}
            />
          </div>

          <div>
            <label className={labelCls}>End Date & Time (Optional)</label>
            <input
              type="datetime-local"
              step="600"
              value={formData.end_date}
              onChange={e => setFormData({ ...formData, end_date: e.target.value })}
              className={inputCls}
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
            <div className={`mt-2 p-4 rounded-2xl border flex flex-wrap gap-2 ${
              theme === "DARK" ? "bg-stone-950 border-stone-800" : "bg-stone-50 border-stone-200"
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
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all border ${
                      isSelected
                        ? (theme === "DARK" ? "bg-[#ccff00] border-[#ccff00] text-stone-900" : "bg-stone-900 border-stone-900 text-white")
                        : (theme === "DARK" ? "bg-stone-900 border-stone-800 text-stone-400" : "bg-white border-stone-200 text-stone-600")
                    }`}
                  >
                    {user.portrait_url ? (
                      <img src={user.portrait_url} className="w-5 h-5 rounded-full object-cover" alt="" />
                    ) : (
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${
                        isSelected ? "bg-black/10" : "bg-stone-200"
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
              <input
                type="datetime-local"
                step="600"
                value={formData.cancellation_deadline}
                onChange={e => setFormData({ ...formData, cancellation_deadline: e.target.value })}
                className={inputCls}
              />
            </div>
          </div>

          <div className="col-span-2">
            <label className={labelCls}>Hero Image</label>
            <div className="flex gap-6 items-start">
              <div className={`w-40 h-40 rounded-3xl border-2 border-dashed flex flex-col items-center justify-center gap-2 overflow-hidden relative group transition-colors ${
                theme === "DARK" ? "border-stone-800 bg-stone-950/50" : "border-stone-200 bg-stone-50"
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
                  className={`px-6 py-3 rounded-xl text-[10px] font-black tracking-widest uppercase transition-colors ${
                    theme === "DARK" ? "bg-stone-800 text-white hover:bg-stone-700" : "bg-white border border-stone-200 hover:bg-stone-50"
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
              className={`flex-1 py-4 rounded-xl text-[10px] font-black tracking-widest uppercase border ${
                theme === "DARK" ? "border-stone-800 text-white" : "border-stone-200 text-stone-900"
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
              className={`flex-1 py-4 rounded-xl text-[10px] font-black tracking-widest uppercase border ${
                theme === "DARK" ? "border-stone-800 text-white" : "border-stone-200 text-stone-900"
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
          <div className={`rounded-2xl border overflow-hidden ${
            theme === "DARK" ? "bg-stone-950 border-stone-800" : "bg-stone-50 border-stone-200"
          }`}>
            {conflicts.map((c, i) => (
              <div key={i} className={`p-4 flex justify-between items-center ${
                i !== 0 ? (theme === "DARK" ? "border-t border-stone-800" : "border-t border-stone-200") : ""
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
