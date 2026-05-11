"use client";
import React, { useState, useEffect, useRef } from "react";
import { db } from "../lib/firebase";
import { 
  collection, 
  onSnapshot, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  orderBy,
  setDoc,
  serverTimestamp 
} from "firebase/firestore";

import { 
  createColumnHelper,
  ColumnFiltersState,
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
} from "@tanstack/react-table";
import { Modal } from "@repo/ui/modal";

interface Dimension {
  id: string;
  category: string;
  items: string[];
}

export default function DimensionsView({ theme = "LIGHT" }: { theme?: "LIGHT" | "DARK" | "VINTAGE" }) {
  const [dimensions, setDimensions] = useState<Dimension[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewModal, setShowNewModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [newValuesStr, setNewValuesStr] = useState("");
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [newValueInput, setNewValueInput] = useState<{ [key: string]: string }>({});
  const [editingItem, setEditingItem] = useState<{ categoryId: string; index: number; value: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [showPermsModal, setShowPermsModal] = useState(false);
  const [newPerm, setNewPerm] = useState("");
  const [permToggles, setPermToggles] = useState({ VIEW: true, UPDATE: true, CREATE: true, DELETE: true });
  const [permissions, setPermissions] = useState<string[]>([]);

  useEffect(() => {
    const colRef = collection(db, "dimensions");
    const q = query(colRef, orderBy("category", "asc"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Dimension[];
      setDimensions(docs);
      setLoading(false);
    }, (err) => {
      console.error("Error fetching dimensions:", err);
      setLoading(false);
    });

    const unsubscribePerms = onSnapshot(doc(db, "dimensions", "Permissions"), (snap) => {
      if (snap.exists()) setPermissions(snap.data().items || []);
    });

    return () => {
      unsubscribe();
      unsubscribePerms();
    };
  }, []);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      const items = newValuesStr.split(",").map(v => v.trim()).filter(Boolean);
      await addDoc(collection(db, "dimensions"), {
        category: newName.trim(),
        items: items,
        created_at: serverTimestamp()
      });
      setShowNewModal(false);
      setNewName("");
      setNewValuesStr("");
    } catch (err) {
      console.error("Error creating dimension:", err);
    }
  };

  const handleAddValue = async (categoryId: string) => {
    const val = (newValueInput[categoryId] || "").trim();
    if (!val) return;
    
    const dim = dimensions.find(d => d.id === categoryId);
    if (!dim || dim.items.includes(val)) return;

    try {
      await updateDoc(doc(db, "dimensions", categoryId), {
        items: [...dim.items, val]
      });
      setNewValueInput(prev => ({ ...prev, [categoryId]: "" }));
    } catch (err) {
      console.error("Error adding value:", err);
    }
  };

  const handleRemoveValue = async (categoryId: string, valueToRemove: string) => {
    const dim = dimensions.find(d => d.id === categoryId);
    if (!dim) return;

    try {
      await updateDoc(doc(db, "dimensions", categoryId), {
        items: dim.items.filter(v => v !== valueToRemove)
      });
    } catch (err) {
      console.error("Error removing value:", err);
    }
  };

  const handleRenameItem = async (categoryId: string, index: number, newValue: string) => {
    const trimmed = newValue.trim();
    const dim = dimensions.find(d => d.id === categoryId);
    if (!dim || !trimmed || dim.items[index] === trimmed) {
      setEditingItem(null);
      return;
    }

    try {
      const newItems = [...dim.items];
      newItems[index] = trimmed;
      await updateDoc(doc(db, "dimensions", categoryId), {
        items: newItems
      });
      setEditingItem(null);
    } catch (err) {
      console.error("Error renaming item:", err);
    }
  };

  const handleDeleteCategory = async (id: string) => {
    try {
      await deleteDoc(doc(db, "dimensions", id));
      setConfirmDelete(null);
    } catch (err) {
      console.error("Error deleting dimension:", err);
    }
  };

  const handleAddPermission = async () => {
    const base = newPerm.trim().toUpperCase();
    if (!base) return;

    const toAdd = Object.keys(permToggles)
      .filter(k => permToggles[k as keyof typeof permToggles])
      .map(k => `${base}_${k}`);

    if (toAdd.length === 0) toAdd.push(base);

    const newPerms = [...new Set([...permissions, ...toAdd])].sort();
    try {
      await setDoc(doc(db, "dimensions", "Permissions"), {
        category: "Permissions",
        items: newPerms
      }, { merge: true });
      setNewPerm("");
    } catch (err) {
      console.error("Error adding permissions:", err);
    }
  };

  const handleRemovePermission = async (p: string) => {
    const newPerms = permissions.filter(item => item !== p);
    try {
      await setDoc(doc(db, "dimensions", "Permissions"), {
        category: "Permissions",
        items: newPerms
      }, { merge: true });
    } catch (err) {
      console.error("Error removing permission:", err);
    }
  };

  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const columnHelper = createColumnHelper<Dimension>();

  const columns = [
    columnHelper.accessor("category", {
      header: "CATEGORY",
      size: 250,
      cell: info => <span className={`text-base font-bold uppercase tracking-tight transition-colors duration-500 ${
        theme === "DARK" ? "text-white" : 
        theme === "VINTAGE" ? "text-black" :
        "text-stone-900"
      }`}>{info.getValue()}</span>,
    }),
    columnHelper.accessor("items", {
      header: "VALUES",
      size: 600,
      filterFn: (row, columnId, filterValue) => {
        const rowValue = row.getValue(columnId) as string[];
        if (!rowValue || !filterValue) return true;
        const search = String(filterValue).toLowerCase();
        return rowValue.some(p => p.toLowerCase().includes(search));
      },
      cell: info => (
        <div className="flex flex-wrap gap-2 py-1">
          {(info.getValue() || []).map((item, i) => (
            <span key={i} className={`text-[10px] font-bold border px-3 py-1 rounded-full uppercase tracking-wider transition-colors ${
              theme === "VINTAGE" 
                ? "bg-white text-black border-stone-100 shadow-sm" 
                : "bg-stone-100 text-stone-900 border-stone-200"
            }`}>{item}</span>
          ))}
        </div>
      ),
    }),
    columnHelper.display({
      id: "actions",
      header: "ACTIONS",
      size: 120,
      cell: props => {
        const [showMenu, setShowMenu] = useState(false);
        const [menuPos, setMenuPos] = useState({ top: 0, right: 0 });
        const buttonRef = useRef<HTMLButtonElement>(null);

        const handleToggle = () => {
          if (!showMenu && buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect();
            setMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
          }
          setShowMenu(!showMenu);
        };

        return (
          <div className="flex justify-end items-center h-full pr-2">
            <button
              ref={buttonRef}
              onClick={handleToggle}
              className={`transition-colors p-2 ${theme === "DARK" ? "text-stone-400 hover:text-[#ccff00]" : "text-stone-500 hover:text-stone-900"}`}
            >
              <span className="material-symbols-outlined text-xl">more_horiz</span>
            </button>

            {showMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)}></div>
                <div
                  style={{ top: menuPos.top, right: menuPos.right }}
                  className={`fixed border rounded-xl shadow-xl py-2 w-32 z-50 animate-in fade-in zoom-in-95 duration-200 transition-colors ${
                  theme === "DARK" ? "bg-stone-900 border-stone-800" :
                  theme === "VINTAGE" ? "bg-white border-stone-100 shadow-xl" :
                  "bg-white border-stone-100"
                }`}>
                  <button 
                    onClick={() => {
                      setEditingCategoryId(editingCategoryId === props.row.original.id ? null : props.row.original.id);
                      setShowMenu(false);
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-[10px] font-black uppercase tracking-widest transition-colors ${
                      theme === "DARK" ? "text-stone-300 hover:bg-stone-800" : 
                      theme === "VINTAGE" ? "text-black hover:bg-stone-50" :
                      "text-stone-900 hover:bg-stone-50"
                    }`}
                  >
                    <span className="material-symbols-outlined text-base">edit</span>
                    Edit
                  </button>
                  <button 
                    onClick={() => {
                      setConfirmDelete(props.row.original.id);
                      setShowMenu(false);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-red-500 hover:bg-red-50 transition-colors"
                  >
                    <span className="material-symbols-outlined text-base">delete</span>
                    Delete
                  </button>
                </div>
              </>
            )}
          </div>
        );
      },
    }),
  ];

  const table = useReactTable({
    data: dimensions,
    columns,
    state: {
      columnFilters,
    },
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className={`h-8 w-8 animate-spin rounded-full border-4 border-t-transparent ${
          theme === "DARK" ? "border-[#ccff00]" : 
          theme === "VINTAGE" ? "border-black" :
          "border-[#4f6b28]"
        }`}></div>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex justify-between items-end mb-10">
        <div>
          <h2 className={`text-5xl font-black italic tracking-tighter uppercase transition-colors duration-500 ${
            theme === "DARK" ? "text-[#ccff00]" : 
            theme === "VINTAGE" ? "text-black" :
            "text-[#4f6b28]"
          }`} style={{ fontFamily: 'Lexend, sans-serif' }}>
            Dimensions
          </h2>
          <p className={`font-bold uppercase tracking-widest text-xs mt-2 transition-colors duration-500 ${
            theme === "DARK" ? "text-stone-300" : 
            theme === "VINTAGE" ? "text-stone-800" :
            "text-stone-800"
          }`}>
            System Architecture · <span className={
              theme === "DARK" ? "text-[#ccff00]" : 
              theme === "VINTAGE" ? "text-black" :
              "text-[#4f6b28]"
            }>{dimensions.length}</span> Categories · <span className={
              theme === "DARK" ? "text-[#ccff00]" : 
              theme === "VINTAGE" ? "text-black" :
              "text-[#4f6b28]"
            }>{dimensions.reduce((acc, curr) => acc + curr.items.length, 0)}</span> Parameters
          </p>
        </div>
        <div className="flex gap-4">
          <button 
            onClick={() => setShowNewModal(true)}
            className={`px-8 py-3 rounded-full font-black text-xs tracking-widest transition-all uppercase shadow-lg flex items-center gap-2 ${
              theme === "DARK"
                ? "bg-[#ccff00] text-stone-950 shadow-[#ccff00]/10 hover:opacity-90"
                : theme === "VINTAGE"
                  ? "bg-black text-white shadow-black/10 hover:opacity-90"
                  : "bg-[#4f6b28] text-white shadow-[#4f6b28]/20 hover:opacity-90"
            }`}
          >
            <span className="material-symbols-outlined text-sm">add_box</span>
            New Category
          </button>
          <button 
            onClick={() => setShowPermsModal(true)}
            className={`px-8 py-3 rounded-full font-black text-xs tracking-widest transition-all uppercase border-2 flex items-center gap-2 ${
              theme === "DARK" 
                ? "border-stone-800 text-stone-300 hover:bg-stone-900" 
                : theme === "VINTAGE"
                  ? "border-stone-100 text-black hover:bg-stone-50"
                  : "border-stone-200 text-stone-900 hover:bg-stone-50"
            }`}
          >
            <span className="material-symbols-outlined text-sm">settings_suggest</span>
            Manage Permissions
          </button>
        </div>
      </div>

      <div className={`border rounded-xl shadow-sm transition-colors duration-500 ${
        theme === "DARK" ? "bg-stone-950 border-stone-800" : 
        theme === "VINTAGE" ? "bg-white border-transparent shadow-md" :
        "bg-white border-stone-200"
      }`}>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className={`sticky top-0 z-10 border-b transition-colors duration-500 ${
              theme === "DARK" ? "bg-stone-900 border-stone-800" : 
              theme === "VINTAGE" ? "bg-white border-stone-100" :
              "bg-stone-100 border-stone-900"
            }`}>
              {table.getHeaderGroups().map(headerGroup => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map(header => (
                    <th 
                      key={header.id} 
                      className={`px-6 py-4 text-[10px] font-black uppercase tracking-widest relative border-r last:border-r-0 transition-colors duration-500 ${
                        theme === "DARK" ? "text-[#ccff00] border-stone-800" : 
                        theme === "VINTAGE" ? "text-black border-stone-100" :
                        "text-black border-stone-900"
                      }`}
                      style={{ width: header.getSize() === 120 ? '120px' : 'auto' }}
                    >
                      <div className="flex flex-col gap-2">
                        <div className={header.column.id === 'actions' ? 'text-right' : ''}>
                          {flexRender(header.column.columnDef.header, header.getContext())}
                        </div>
                        {header.column.getCanFilter() ? (
                          <div className="relative">
                            <input
                              value={(header.column.getFilterValue() as string) ?? ""}
                              onChange={(e) => {
                                e.stopPropagation();
                                header.column.setFilterValue(e.target.value);
                              }}
                              onClick={(e) => e.stopPropagation()}
                              placeholder="..."
                              className={`w-full border rounded-md px-3 py-1.5 text-xs font-medium outline-none transition-all ${
                                theme === "DARK" 
                                  ? "bg-stone-950 border-stone-800 text-stone-100 focus:border-[#ccff00]" 
                                  : theme === "VINTAGE"
                                    ? "bg-[#f7f9fb] border-transparent text-black focus:border-stone-200"
                                    : "bg-white border-stone-100 text-stone-900 focus:border-stone-400"
                              }`}
                            />
                          </div>
                        ) : null}
                      </div>
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row, i) => (
                  <tr 
                    key={row.id} 
                    className={`border-b transition-colors group ${
                      theme === "DARK" 
                        ? (i % 2 !== 0 ? 'bg-stone-900/40 border-stone-800' : 'bg-stone-950 border-stone-800 hover:bg-stone-900/60') 
                        : theme === "VINTAGE"
                          ? (i % 2 !== 0 ? 'bg-[#f7f9fb]/50 border-stone-100' : 'bg-white border-stone-100 hover:bg-[#f7f9fb]/80')
                          : (i % 2 !== 0 ? 'bg-stone-50/50 border-stone-900' : 'bg-white border-stone-900 hover:bg-stone-50')
                    }`}
                  >
                    {row.getVisibleCells().map(cell => (
                      <td 
                        key={cell.id} 
                        className={`px-6 py-3 text-sm font-medium border-r last:border-r-0 transition-colors duration-500 ${
                          theme === "DARK" ? "text-stone-300 border-stone-800" : 
                          theme === "VINTAGE" ? "text-black border-stone-100" :
                          "text-stone-900 border-stone-900"
                        }`}
                      >
                        <div className="flex items-center min-h-[32px]">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      {/* Inline Editing Drawer or Modal could go here if category matches editingCategoryId */}
      {editingCategoryId && (
        <div className={`mt-8 p-8 border rounded-[32px] animate-in fade-in slide-in-from-top-4 transition-colors ${
          theme === "DARK" ? "bg-stone-950 border-stone-800" : 
          theme === "VINTAGE" ? "bg-white border-stone-100 shadow-md" :
          "bg-stone-50 border-stone-900"
        }`}>
          <div className="flex justify-between items-center mb-6">
            <h4 className={`text-xl font-black uppercase tracking-tight transition-colors ${
              theme === "DARK" ? "text-[#ccff00]" : 
              theme === "VINTAGE" ? "text-black" :
              "text-[#4f6b28]"
            }`}>
              Manage {dimensions.find(d => d.id === editingCategoryId)?.category}
            </h4>
            <button onClick={() => setEditingCategoryId(null)} className={`${theme === "DARK" ? "text-stone-300 hover:text-[#ccff00]" : "text-stone-600 hover:text-stone-900"}`}>
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
          
          <div className="flex flex-wrap gap-3 mb-8">
            {dimensions.find(d => d.id === editingCategoryId)?.items.map((item, index) => (
              <div key={index} className={`flex items-center gap-2 border rounded-full px-5 py-2 text-xs font-bold group transition-colors ${
                theme === "DARK" ? "bg-stone-900 border-stone-800 text-white" : 
                theme === "VINTAGE" ? "bg-[#f7f9fb] border-stone-50 text-black" :
                "bg-white border-stone-300 text-stone-900"
              }`}>
                <span>{item}</span>
                <button 
                  onClick={() => handleRemoveValue(editingCategoryId, item)}
                  className="opacity-0 group-hover:opacity-100 text-red-500 transition-opacity"
                >
                  <span className="material-symbols-outlined text-xs">close</span>
                </button>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2 max-w-md">
            <input 
              value={newValueInput[editingCategoryId] || ""}
              onChange={e => setNewValueInput(prev => ({ ...prev, [editingCategoryId]: e.target.value }))}
              onKeyDown={e => e.key === "Enter" && handleAddValue(editingCategoryId)}
              placeholder="Add new value..."
              className={`flex-1 border rounded-xl px-5 py-3 text-sm font-medium outline-none transition-all ${
                theme === "DARK" 
                  ? "bg-stone-900 border-stone-800 text-white focus:border-[#ccff00]" 
                  : theme === "VINTAGE"
                    ? "bg-[#f7f9fb] border-transparent text-black focus:border-stone-200"
                    : "bg-white border-stone-300 text-stone-900 focus:border-[#4f6b28]"
              }`}
            />
            <button 
              onClick={() => handleAddValue(editingCategoryId)}
              className={`px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${
                theme === "DARK" ? "bg-[#ccff00] text-stone-950" : 
                theme === "VINTAGE" ? "bg-black text-white" :
                "bg-[#4f6b28] text-white"
              } hover:opacity-90`}
            >
              Add
            </button>
          </div>
        </div>
      )}

      {/* New Dimension Modal */}
      <Modal
        isOpen={showNewModal}
        onClose={() => setShowNewModal(false)}
        title="New Dimension"
        theme={theme}
        width={600}
        footer={
          <div className="flex gap-4">
            <button 
              onClick={() => setShowNewModal(false)}
              className={`flex-1 py-4 border-2 rounded-2xl text-[10px] font-black tracking-widest transition-all uppercase ${
                theme === "DARK" ? "border-stone-800 text-stone-300 hover:bg-stone-900" : 
                theme === "VINTAGE" ? "border-stone-100 text-black hover:bg-stone-50" :
                "border-stone-100 text-stone-700 hover:bg-stone-50"
              }`}
            >
              Cancel
            </button>
            <button 
              onClick={handleCreate}
              className={`flex-1 py-4 rounded-2xl text-[10px] font-black tracking-widest transition-all uppercase shadow-lg ${
                theme === "DARK" ? "bg-[#ccff00] text-stone-950 shadow-[#ccff00]/20" : 
                theme === "VINTAGE" ? "bg-black text-white shadow-black/20" :
                "bg-[#4f6b28] text-white shadow-[#4f6b28]/20"
              } hover:opacity-90`}
            >
              Create Category
            </button>
          </div>
        }
      >
        <div className="space-y-8">
          <div>
            <label className={`text-[10px] font-black tracking-[0.2em] uppercase mb-3 block transition-colors ${
              theme === "DARK" ? "text-stone-300" : "text-stone-900"
            }`}>Category Name</label>
            <input 
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="e.g. Skill Level, Membership Type..."
              className={`w-full border-none rounded-2xl px-6 py-4 text-sm font-bold placeholder:text-stone-300 outline-none transition-colors ${
                theme === "DARK" 
                  ? "bg-stone-900 text-white focus:ring-2 focus:ring-[#ccff00]" 
                  : theme === "VINTAGE"
                    ? "bg-[#f7f9fb] text-black focus:ring-2 focus:ring-black"
                    : "bg-stone-50 text-stone-900 focus:ring-2 focus:ring-[#4f6b28]"
              }`}
            />
          </div>

          <div>
            <label className={`text-[10px] font-black tracking-[0.2em] uppercase mb-3 block transition-colors ${
              theme === "DARK" ? "text-stone-300" : "text-stone-900"
            }`}>Initial Values</label>
            <textarea 
              value={newValuesStr}
              onChange={e => setNewValuesStr(e.target.value)}
              placeholder="High, Medium, Low (comma separated)"
              rows={4}
              className={`w-full border-none rounded-2xl px-6 py-4 text-sm font-bold placeholder:text-stone-400 outline-none resize-none transition-colors ${
                theme === "DARK" 
                  ? "bg-stone-900 text-white focus:ring-2 focus:ring-[#ccff00]" 
                  : theme === "VINTAGE"
                    ? "bg-[#f7f9fb] text-black focus:ring-2 focus:ring-black"
                    : "bg-stone-100 text-stone-900 focus:ring-2 focus:ring-[#4f6b28]"
              }`}
            />
            <p className={`text-[10px] mt-2 font-medium ${theme === "DARK" ? "text-stone-300" : "text-stone-700"}`}>Separate items with commas to create multiple values at once.</p>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title="Delete Dimension?"
        theme={theme}
        width={400}
        footer={
          <div className="flex gap-4">
            <button 
              onClick={() => setConfirmDelete(null)}
              className={`flex-1 py-4 border-2 rounded-2xl text-[10px] font-black tracking-widest transition-all uppercase ${
                theme === "DARK" ? "border-stone-800 text-stone-300 hover:bg-stone-900" : 
                theme === "VINTAGE" ? "border-stone-100 text-black hover:bg-stone-50" :
                "border-stone-100 text-stone-700 hover:bg-stone-50"
              }`}
            >
              Go Back
            </button>
            <button 
              onClick={() => confirmDelete && handleDeleteCategory(confirmDelete)}
              className={`flex-1 py-4 rounded-2xl text-[10px] font-black tracking-widest transition-all uppercase shadow-lg ${
                theme === "VINTAGE" ? "bg-black text-white hover:bg-stone-900 shadow-black/20" : "bg-red-500 text-white hover:bg-red-600 shadow-red-500/20"
              }`}
            >
              Delete Now
            </button>
          </div>
        }
      >
        <div className={`w-20 h-20 rounded-3xl flex items-center justify-center mb-8 mx-auto ${
          theme === "VINTAGE" ? "bg-stone-50 text-black" : "bg-red-50 text-red-500"
        }`}>
          <span className="material-symbols-outlined text-4xl">delete_forever</span>
        </div>
        <p className={`text-center font-medium leading-relaxed transition-colors ${
          theme === "DARK" ? "text-stone-200" : "text-stone-800"
        }`}>
          Are you sure you want to delete this category? This action will remove all associated values and cannot be undone.
        </p>
      </Modal>
      {/* Permissions Modal */}
      <Modal
        isOpen={showPermsModal}
        onClose={() => setShowPermsModal(false)}
        title="Permissions"
        theme={theme}
        width={600}
        footer={
          <button 
            onClick={() => setShowPermsModal(false)}
            className={`w-full py-4 rounded-2xl text-[10px] font-black tracking-widest transition-all uppercase shadow-lg ${
              theme === "DARK" ? "bg-stone-800 text-white hover:bg-stone-700" : 
              theme === "VINTAGE" ? "bg-black text-white hover:opacity-90" :
              "bg-stone-900 text-white hover:opacity-90"
            }`}
          >
            Close
          </button>
        }
      >
        <p className={`${theme === "DARK" ? "text-stone-300" : "text-stone-800"} font-bold uppercase tracking-widest text-[10px] mb-8`}>Manage application-wide permission keys</p>

        <div className={`p-8 rounded-[32px] border mb-8 transition-colors ${
          theme === "DARK" ? "bg-stone-900 border-stone-800" : 
          theme === "VINTAGE" ? "bg-[#f7f9fb] border-stone-100" :
          "bg-stone-50 border-stone-100"
        }`}>
          <div className="flex gap-4 mb-6">
            <input 
              value={newPerm}
              onChange={e => setNewPerm(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleAddPermission()}
              placeholder="e.g. INVOICE, COURT_BOOKING..."
              className={`flex-1 border rounded-2xl px-6 py-4 text-sm font-bold placeholder:text-stone-300 outline-none transition-all ${
                theme === "DARK" 
                  ? "bg-stone-950 border-stone-800 text-white focus:border-[#ccff00]" 
                  : theme === "VINTAGE"
                    ? "bg-white border-stone-100 text-black focus:border-black"
                    : "bg-white border-stone-200 text-stone-900 focus:border-[#4f6b28]"
              }`}
            />
            <button 
              onClick={handleAddPermission}
              className={`px-8 rounded-2xl font-black text-xs tracking-widest transition-all uppercase ${
                theme === "DARK" ? "bg-[#ccff00] text-stone-950" : 
                theme === "VINTAGE" ? "bg-black text-white" :
                "bg-[#4f6b28] text-white"
              } hover:opacity-90`}
            >
              Add
            </button>
          </div>
          <div className="flex flex-wrap gap-6 pl-2">
            {Object.keys(permToggles).map(k => (
              <label key={k} className="flex items-center gap-2 cursor-pointer group">
                <div 
                  className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                    permToggles[k as keyof typeof permToggles] 
                      ? (theme === "DARK" ? "bg-[#ccff00] border-[#ccff00] text-stone-950" : theme === "VINTAGE" ? "bg-black border-black text-white" : "bg-[#4f6b28] border-[#4f6b28] text-white")
                      : (theme === "DARK" ? "border-stone-800 bg-stone-950" : "border-stone-200 bg-white")
                  }`}
                  onClick={() => setPermToggles(prev => ({ ...prev, [k]: !prev[k as keyof typeof prev] }))}
                >
                  {permToggles[k as keyof typeof permToggles] && <span className="material-symbols-outlined text-[10px] font-bold">check</span>}
                </div>
                <span className={`text-[10px] font-black uppercase tracking-widest transition-colors ${
                  permToggles[k as keyof typeof permToggles] 
                    ? (theme === "DARK" ? "text-[#ccff00]" : theme === "VINTAGE" ? "text-black" : "text-[#4f6b28]") 
                    : (theme === "DARK" ? "text-stone-500" : "text-stone-400")
                }`}>{k}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="max-h-64 overflow-y-auto pr-4 grid grid-cols-2 gap-3">
          {permissions.sort().map(p => (
            <div key={p} className={`flex items-center justify-between border rounded-2xl px-5 py-3 group transition-colors ${
              theme === "DARK" ? "bg-stone-900 border-stone-800" : 
              theme === "VINTAGE" ? "bg-[#f7f9fb] border-stone-100" :
              "bg-stone-50 border-stone-100"
            }`}>
              <span className={`text-[10px] font-mono font-bold transition-colors ${
                theme === "DARK" ? "text-stone-300" : "text-stone-700"
              }`}>{p}</span>
              <button onClick={() => handleRemovePermission(p)} className="text-stone-300 hover:text-red-500 transition-colors">
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>
          ))}
        </div>
      </Modal>
    </div>
  );
}
