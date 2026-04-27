"use client";
import React, { useState, useEffect } from "react";
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
  serverTimestamp 
} from "firebase/firestore";

import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  flexRender,
  createColumnHelper,
  ColumnFiltersState,
} from "@tanstack/react-table";

interface Dimension {
  id: string;
  category: string;
  items: string[];
}

export default function DimensionsView() {
  const [dimensions, setDimensions] = useState<Dimension[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewModal, setShowNewModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [newValuesStr, setNewValuesStr] = useState("");
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [newValueInput, setNewValueInput] = useState<{ [key: string]: string }>({});
  const [editingItem, setEditingItem] = useState<{ categoryId: string; index: number; value: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

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

    return () => unsubscribe();
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

  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const columnHelper = createColumnHelper<Dimension>();

  const columns = [
    columnHelper.accessor("category", {
      header: "CATEGORY",
      size: 250,
      cell: info => <span className="text-base font-bold text-stone-900 uppercase tracking-tight">{info.getValue()}</span>,
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
            <span key={i} className="text-[10px] font-bold bg-stone-100 text-stone-900 border border-stone-200 px-3 py-1 rounded-full uppercase tracking-wider">{item}</span>
          ))}
        </div>
      ),
    }),
    columnHelper.display({
      id: "actions",
      header: "ACTIONS",
      size: 120,
      cell: props => (
        <div className="flex justify-end items-center gap-2 pr-2">
          <button 
            onClick={() => setEditingCategoryId(editingCategoryId === props.row.original.id ? null : props.row.original.id)}
            className="text-stone-400 hover:text-stone-900 transition-colors"
          >
            <span className="material-symbols-outlined text-xl">edit</span>
          </button>
          <button 
            onClick={() => setConfirmDelete(props.row.original.id)}
            className="text-stone-400 hover:text-red-500 transition-colors"
          >
            <span className="material-symbols-outlined text-xl">delete</span>
          </button>
        </div>
      ),
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
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#4f6b28] border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex justify-between items-end mb-10">
        <div>
          <h2 className="text-5xl font-black italic tracking-tighter text-[#4f6b28] uppercase" style={{ fontFamily: 'Lexend, sans-serif' }}>
            Dimensions
          </h2>
          <p className="text-stone-900 font-bold uppercase tracking-widest text-xs mt-2">
            Reference data · <span className="text-[#4f6b28]">{dimensions.length}</span> categories · <span className="text-[#4f6b28]">{dimensions.reduce((acc, d) => acc + d.items.length, 0)}</span> values
          </p>
        </div>
        <button 
          onClick={() => setShowNewModal(true)}
          className="bg-[#4f6b28] text-white px-8 py-3 rounded-full font-black text-xs tracking-widest hover:opacity-90 transition-all uppercase shadow-lg shadow-[#4f6b28]/20 flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-sm">add</span>
          New Dimension
        </button>
      </div>

      <div className="bg-white border border-stone-200 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-white sticky top-0 z-10 border-b border-stone-900">
              {table.getHeaderGroups().map(headerGroup => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map(header => (
                    <th 
                      key={header.id} 
                      className="px-6 py-4 text-[10px] font-black text-stone-400 uppercase tracking-widest relative border-r border-stone-900 last:border-r-0"
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
                              className="w-full bg-white border border-stone-100 rounded-md px-3 py-1.5 text-xs font-medium text-stone-900 outline-none focus:border-stone-400 transition-all"
                            />
                          </div>
                        ) : null}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.getRowModel().rows.map(row => (
                  <tr 
                    key={row.id} 
                    className="border-b border-stone-900 hover:bg-stone-50 transition-colors group"
                  >
                    {row.getVisibleCells().map(cell => (
                      <td 
                        key={cell.id} 
                        className="px-6 py-3 text-sm font-medium text-stone-900 border-r border-stone-900 last:border-r-0"
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

      {/* Inline Editing Drawer or Modal could go here if category matches editingCategoryId */}
      {editingCategoryId && (
        <div className="mt-8 p-8 bg-stone-50 border border-stone-900 rounded-[32px] animate-in fade-in slide-in-from-top-4">
          <div className="flex justify-between items-center mb-6">
            <h4 className="text-xl font-black uppercase tracking-tight text-[#4f6b28]">
              Manage {dimensions.find(d => d.id === editingCategoryId)?.category}
            </h4>
            <button onClick={() => setEditingCategoryId(null)} className="text-stone-400 hover:text-stone-900">
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
          
          <div className="flex flex-wrap gap-3 mb-8">
            {dimensions.find(d => d.id === editingCategoryId)?.items.map((item, index) => (
              <div key={index} className="flex items-center gap-2 bg-white border border-stone-300 rounded-full px-5 py-2 text-xs font-bold text-stone-900 group">
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
              className="flex-1 bg-white border border-stone-300 rounded-xl px-5 py-3 text-sm font-medium outline-none focus:border-[#4f6b28] transition-colors"
            />
            <button 
              onClick={() => handleAddValue(editingCategoryId)}
              className="px-6 py-3 bg-[#4f6b28] text-white rounded-xl font-black text-xs uppercase tracking-widest hover:opacity-90"
            >
              Add
            </button>
          </div>
        </div>
      )}

      {/* New Dimension Modal */}
      {showNewModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm" onClick={() => setShowNewModal(false)}></div>
          <div className="relative bg-white rounded-[40px] w-full max-w-xl p-12 shadow-2xl animate-in zoom-in-95 duration-300">
            <h3 className="text-4xl font-black italic tracking-tighter text-[#4f6b28] uppercase mb-8">
              New Dimension
            </h3>
            
            <div className="space-y-8">
              <div>
                <label className="text-[10px] font-black text-stone-400 tracking-[0.2em] uppercase mb-3 block">Category Name</label>
                <input 
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="e.g. Skill Level, Membership Type..."
                  className="w-full bg-stone-50 border-none rounded-2xl px-6 py-4 text-sm font-bold placeholder:text-stone-300 focus:ring-2 focus:ring-[#4f6b28] outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-black text-stone-900 tracking-[0.2em] uppercase mb-3 block">Initial Values</label>
                <textarea 
                  value={newValuesStr}
                  onChange={e => setNewValuesStr(e.target.value)}
                  placeholder="High, Medium, Low (comma separated)"
                  rows={4}
                  className="w-full bg-stone-100 border-none rounded-2xl px-6 py-4 text-sm font-bold placeholder:text-stone-400 focus:ring-2 focus:ring-[#4f6b28] outline-none resize-none"
                />
                <p className="text-[10px] text-stone-600 mt-2 font-medium">Separate items with commas to create multiple values at once.</p>
              </div>
            </div>

            <div className="flex gap-4 mt-12">
              <button 
                onClick={() => setShowNewModal(false)}
                className="flex-1 py-4 border-2 border-stone-100 text-stone-400 rounded-2xl text-[10px] font-black tracking-widest hover:bg-stone-50 transition-all uppercase"
              >
                Cancel
              </button>
              <button 
                onClick={handleCreate}
                className="flex-1 py-4 bg-[#4f6b28] text-white rounded-2xl text-[10px] font-black tracking-widest hover:opacity-90 transition-all uppercase shadow-lg shadow-[#4f6b28]/20"
              >
                Create Category
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm" onClick={() => setConfirmDelete(null)}></div>
          <div className="relative bg-white rounded-[40px] w-full max-w-md p-12 shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="w-20 h-20 bg-red-50 rounded-3xl flex items-center justify-center text-red-500 mb-8 mx-auto">
              <span className="material-symbols-outlined text-4xl">delete_forever</span>
            </div>
            <h3 className="text-3xl font-black italic tracking-tighter text-stone-900 uppercase text-center mb-4">
              Delete Dimension?
            </h3>
            <p className="text-stone-500 text-center font-medium leading-relaxed mb-10">
              Are you sure you want to delete this category? This action will remove all associated values and cannot be undone.
            </p>
            <div className="flex gap-4">
              <button 
                onClick={() => setConfirmDelete(null)}
                className="flex-1 py-4 border-2 border-stone-100 text-stone-400 rounded-2xl text-[10px] font-black tracking-widest hover:bg-stone-50 transition-all uppercase"
              >
                Go Back
              </button>
              <button 
                onClick={() => handleDeleteCategory(confirmDelete)}
                className="flex-1 py-4 bg-red-500 text-white rounded-2xl text-[10px] font-black tracking-widest hover:bg-red-600 transition-all uppercase shadow-lg shadow-red-500/20"
              >
                Delete Now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
