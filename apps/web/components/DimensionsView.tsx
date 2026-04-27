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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {dimensions.map((dim) => (
          <div key={dim.id} className="bg-white border border-stone-300 rounded-[32px] overflow-hidden shadow-sm hover:shadow-md transition-all group">
            <div className="px-8 py-6 border-b border-stone-200 bg-stone-100/50 flex justify-between items-center">
              <div>
                <h3 className="font-black tracking-tighter uppercase text-xl text-[#4f6b28]">{dim.category}</h3>
                <p className="text-[10px] font-bold text-stone-900 uppercase tracking-widest">{dim.items.length} values</p>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => setEditingCategoryId(editingCategoryId === dim.id ? null : dim.id)}
                  className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${editingCategoryId === dim.id ? 'bg-[#4f6b28] text-white' : 'bg-white text-stone-900 hover:text-[#4f6b28] border border-stone-200'}`}
                >
                  <span className="material-symbols-outlined text-xl">
                    {editingCategoryId === dim.id ? 'check' : 'edit'}
                  </span>
                </button>
                <button 
                  onClick={() => setConfirmDelete(dim.id)}
                  className="w-10 h-10 rounded-xl bg-white text-stone-900 hover:text-red-500 border border-stone-200 flex items-center justify-center transition-all"
                >
                  <span className="material-symbols-outlined text-xl">delete</span>
                </button>
              </div>
            </div>
            
            <div className="p-8 flex flex-wrap gap-3">
              {dim.items.map((item, index) => {
                const isEditingThis = editingItem?.categoryId === dim.id && editingItem?.index === index;
                
                if (isEditingThis) {
                  return (
                    <input
                      key={index}
                      autoFocus
                      value={editingItem.value}
                      onChange={e => setEditingItem(prev => prev ? { ...prev, value: e.target.value } : null)}
                      onKeyDown={e => {
                        if (e.key === "Enter") handleRenameItem(dim.id, index, editingItem.value);
                        if (e.key === "Escape") setEditingItem(null);
                      }}
                      onBlur={() => handleRenameItem(dim.id, index, editingItem.value)}
                      className="bg-white border-2 border-[#4f6b28] rounded-full px-4 py-1 text-sm font-bold text-[#4f6b28] outline-none min-w-[100px]"
                    />
                  );
                }

                return (
                  <div 
                    key={index} 
                    className="flex items-center gap-2 bg-[#f7f8f2] text-[#4f6b28] border border-[#4f6b28]/10 rounded-full px-5 py-2 text-xs font-black tracking-tight group/tag"
                  >
                    <span>{item}</span>
                    {editingCategoryId === dim.id && (
                      <div className="flex items-center gap-1 ml-1">
                        <button 
                          onClick={() => setEditingItem({ categoryId: dim.id, index, value: item })}
                          className="opacity-40 hover:opacity-100 transition-opacity"
                        >
                          <span className="material-symbols-outlined text-xs">edit</span>
                        </button>
                        <button 
                          onClick={() => handleRemoveValue(dim.id, item)}
                          className="opacity-40 hover:opacity-100 text-red-500 transition-opacity"
                        >
                          <span className="material-symbols-outlined text-xs">close</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
              
              {editingCategoryId === dim.id && (
                <div className="flex items-center gap-2 w-full mt-4 animate-in fade-in slide-in-from-top-2">
                  <input 
                    value={newValueInput[dim.id] || ""}
                    onChange={e => setNewValueInput(prev => ({ ...prev, [dim.id]: e.target.value }))}
                    onKeyDown={e => e.key === "Enter" && handleAddValue(dim.id)}
                    placeholder="Add value..."
                    className="flex-1 bg-white border border-stone-200 rounded-2xl px-5 py-3 text-sm font-medium outline-none focus:border-[#4f6b28] transition-colors"
                  />
                  <button 
                    onClick={() => handleAddValue(dim.id)}
                    className="w-12 h-12 bg-[#4f6b28] text-white rounded-2xl flex items-center justify-center hover:opacity-90 transition-all shadow-md"
                  >
                    <span className="material-symbols-outlined">add</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

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
