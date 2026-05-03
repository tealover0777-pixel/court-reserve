"use client";
import React, { useState, useRef } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  createColumnHelper,
  ColumnFiltersState,
} from "@tanstack/react-table";
import { Modal } from "@repo/ui/modal";
import { db, functions } from "../lib/firebase";
import { 
  collection, 
  onSnapshot, 
  doc, 
  setDoc, 
  deleteDoc,
  serverTimestamp, 
  query, 
  orderBy 
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { useEffect } from "react";

interface Tenant {
  id: string;
  tenant_id: string;
  name: string;
  domain: string;
  status: "Active" | "Suspended" | "Pending";
  created_at: string;
  owner_id?: string;
  owner_email?: string;
  owner_first_name?: string;
  owner_last_name?: string;
  owner_phone?: string;
  Notes?: string;
}



export default function PlatformTenantAdminView({ theme = "LIGHT" }: { theme?: "LIGHT" | "DARK" | "VINTAGE" }) {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    tenant_id: "",
    tenant_name: "",
    owner_id: "",
    owner_email: "",
    owner_first_name: "",
    owner_last_name: "",
    owner_phone: "",
    owner_role: "Owner",
    invite_user: true,
    internal_notes: ""
  });
  const [editingTenantId, setEditingTenantId] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, "tenants"), orderBy("tenant_id", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Tenant[];
      setTenants(data);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching tenants:", error);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const nextTenantId = (() => {
    if (tenants.length === 0) return "T10001";
    const maxNum = Math.max(...tenants.map(p => {
      const m = String(p.tenant_id).match(/^T(\d+)$/);
      return m ? Number(m[1]) : 0;
    }));
    return "T" + (maxNum + 1);
  })();

  const nextOwnerId = "U10001"; // Simplify for now or fetch from global_users count

  useEffect(() => {
    if (showNewModal && !editingTenantId) {
      setFormData(prev => ({ ...prev, tenant_id: nextTenantId, owner_id: nextOwnerId }));
    }
  }, [showNewModal, nextTenantId, editingTenantId]);

  const handleDeleteTenant = async (id?: string) => {
    const targetId = id || confirmDelete;
    if (!targetId) return;
    try {
      await deleteDoc(doc(db, "tenants", targetId));
      if (!id) setConfirmDelete(null);
    } catch (err) {
      console.error("Failed to delete tenant:", err);
      alert("Failed to delete tenant.");
    }
  };

  const cleanupSamples = async () => {
    const samples = ["T10001", "T10002", "T10003", "T10004"];
    try {
      for (const id of samples) {
        await deleteDoc(doc(db, "tenants", id));
      }
      alert("Samples cleaned up successfully.");
    } catch (err) {
      console.error("Cleanup failed:", err);
    }
  };

  const handleEditTenant = (tenant: Tenant) => {
    setEditingTenantId(tenant.id);
    setFormData({
      tenant_id: tenant.tenant_id,
      tenant_name: tenant.name,
      owner_id: tenant.owner_id || "",
      owner_email: tenant.owner_email || "",
      owner_first_name: tenant.owner_first_name || "",
      owner_last_name: tenant.owner_last_name || "",
      owner_phone: tenant.owner_phone || "",
      owner_role: "Owner",
      invite_user: false,
      internal_notes: tenant.Notes || ""
    });
    setShowNewModal(true);
  };

  const handleSave = async () => {
    try {
      const tenantDocId = editingTenantId || formData.tenant_id;
      if (!formData.tenant_name || !formData.owner_email) {
        alert("Please fill in the tenant name and owner email.");
        return;
      }
      
      // 1. Create/Update Tenant in Firestore
      await setDoc(doc(db, "tenants", tenantDocId), {
        tenant_id: formData.tenant_id,
        name: formData.tenant_name,
        domain: `${formData.tenant_name.toLowerCase().replace(/\s+/g, '-')}.kinetic.com`,
        status: "Active",
        created_at: editingTenantId ? (tenants.find(t => t.id === editingTenantId) as any).created_at : new Date().toISOString().split('T')[0],
        Notes: formData.internal_notes,
        owner_id: formData.owner_id,
        owner_email: formData.owner_email,
        owner_first_name: formData.owner_first_name,
        owner_last_name: formData.owner_last_name,
        owner_phone: formData.owner_phone
      });

      // 2. Invite Owner via Cloud Function (Only if new or explicitly requested)
      if (!editingTenantId || formData.invite_user) {
        const inviteUserFn = httpsCallable(functions, "inviteUser");
        await inviteUserFn({
          email: formData.owner_email,
          role: "R10005",
          tenantId: tenantDocId,
          user_id: formData.owner_id,
          first_name: formData.owner_first_name,
          last_name: formData.owner_last_name,
          phone: formData.owner_phone,
          notes: formData.internal_notes || `Created with New Tenant: ${tenantDocId}`,
          inviteUser: formData.invite_user
        });
      }

      setShowNewModal(false);
      setEditingTenantId(null);
      setFormData({
        tenant_id: "",
        tenant_name: "",
        owner_id: "",
        owner_email: "",
        owner_first_name: "",
        owner_last_name: "",
        owner_phone: "",
        owner_role: "Owner",
        invite_user: true,
        internal_notes: ""
      });
    } catch (err) {
      console.error("Failed to save tenant:", err);
      alert("Failed to save tenant: " + (err instanceof Error ? err.message : "Unknown error"));
    }
  };

  const columnHelper = createColumnHelper<Tenant>();
  const columns = [
    columnHelper.accessor("tenant_id", {
      header: "TENANT ID",
      size: 120,
      cell: info => <span className={`font-mono text-xs transition-colors duration-500 ${
        theme === "DARK" ? "text-stone-400" : 
        theme === "VINTAGE" ? "text-stone-500" :
        "text-stone-900"
      }`}>{info.getValue()}</span>,
    }),
    columnHelper.accessor("name", {
      header: "NAME",
      size: 200,
      cell: info => <span className={`text-sm font-bold transition-colors duration-500 ${
        theme === "DARK" ? "text-white" : 
        theme === "VINTAGE" ? "text-black" :
        "text-stone-900"
      }`}>{info.getValue()}</span>,
    }),
    columnHelper.accessor("domain", {
      header: "DOMAIN",
      size: 250,
      cell: info => <span className={`text-sm transition-colors duration-500 ${
        theme === "DARK" ? "text-stone-400" : 
        theme === "VINTAGE" ? "text-stone-600 font-medium" :
        "text-stone-600"
      }`}>{info.getValue()}</span>,
    }),
    columnHelper.accessor("owner_email", {
      header: "OWNER",
      size: 200,
      cell: info => <span className={`text-xs font-bold transition-colors duration-500 ${
        theme === "DARK" ? "text-stone-400" : 
        theme === "VINTAGE" ? "text-stone-500" :
        "text-stone-700"
      }`}>{info.getValue() || "-"}</span>,
    }),
    columnHelper.accessor("status", {
      header: "STATUS",
      size: 120,
      cell: info => {
        const val = info.getValue();
        return (
          <span className={`text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest border transition-colors ${
            theme === "VINTAGE"
              ? "bg-[#f7f9fb] text-black border-stone-50"
              : val === "Active" ? "bg-green-50 text-green-600 border-green-200" :
                val === "Suspended" ? "bg-amber-50 text-amber-600 border-amber-200" :
                "bg-stone-50 text-stone-600 border-stone-200"
          }`}>
            {val}
          </span>
        );
      },
    }),
    columnHelper.accessor("created_at", {
      header: "CREATED AT",
      size: 150,
      cell: info => <span className={`text-xs uppercase font-bold transition-colors duration-500 ${
        theme === "DARK" ? "text-stone-500" : 
        theme === "VINTAGE" ? "text-stone-400" :
        "text-stone-500"
      }`}>{info.getValue()}</span>,
    }),
    columnHelper.display({
      id: "actions",
      header: "ACTIONS",
      size: 100,
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
              className="text-stone-400 hover:text-stone-900 transition-colors p-2"
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
                      handleEditTenant(props.row.original);
                      setShowMenu(false);
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-[10px] font-black uppercase tracking-widest transition-colors ${
                      theme === "DARK" ? "text-stone-400 hover:bg-stone-800" : 
                      theme === "VINTAGE" ? "text-black hover:bg-stone-50" :
                      "text-stone-600 hover:bg-stone-50"
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
    data: tenants,
    columns,
    state: {
      columnFilters,
    },
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: {
        pageSize: 20,
      },
    },
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
            Tenant Admin
          </h2>
          <p className={`font-bold uppercase tracking-widest text-xs mt-2 transition-colors duration-500 ${
            theme === "DARK" ? "text-stone-400" : 
            theme === "VINTAGE" ? "text-stone-500" :
            "text-stone-900"
          }`}>
            Platform Infrastructure · <span className={
              theme === "DARK" ? "text-[#ccff00]" : 
              theme === "VINTAGE" ? "text-black" :
              "text-[#4f6b28]"
            }>{tenants.length}</span> Registered Tenants
          </p>
        </div>
        <div className="flex gap-4">
          <div className="relative w-80">
            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-stone-400 text-lg">search</span>
            <input 
              type="text"
              placeholder="Search tenants..."
              className={`w-full border rounded-full pl-12 pr-6 py-3 text-sm font-medium outline-none transition-all shadow-sm ${
                theme === "DARK" 
                  ? "bg-stone-900 border-stone-800 text-white focus:border-[#ccff00]" 
                  : theme === "VINTAGE"
                    ? "bg-white border-stone-100 text-black focus:border-stone-400 shadow-md"
                    : "bg-white border-stone-200 text-stone-900 focus:border-[#4f6b28]"
              }`}
              onChange={(e) => table.setGlobalFilter(e.target.value)}
            />
          </div>
          <button 
            onClick={cleanupSamples}
            className={`px-4 py-3 rounded-full font-black text-[10px] tracking-widest transition-all uppercase border-2 flex items-center gap-2 ${
              theme === "DARK" ? "border-stone-800 text-stone-400 hover:bg-stone-900" : 
              theme === "VINTAGE" ? "border-stone-100 text-stone-500 hover:bg-stone-50" :
              "border-stone-100 text-stone-400 hover:bg-stone-50"
            }`}
          >
            <span className="material-symbols-outlined text-sm">cleaning_services</span>
            Cleanup Samples
          </button>
          <button 
            onClick={() => {
              console.log("Opening New Tenant Modal");
              setShowNewModal(true);
            }}
            className={`px-8 py-3 rounded-full font-black text-xs tracking-widest transition-all uppercase shadow-lg flex items-center gap-2 ${
              theme === "DARK"
                ? "bg-[#ccff00] text-stone-950 shadow-[#ccff00]/10 hover:opacity-90"
                : theme === "VINTAGE"
                  ? "bg-black text-white shadow-black/10 hover:opacity-90"
                  : "bg-[#4f6b28] text-white shadow-[#4f6b28]/20 hover:opacity-90"
            }`}
          >
            <span className="material-symbols-outlined text-sm">add_business</span>
            New Tenant
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
                      className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest relative border-r last:border-r-0 transition-colors duration-500 ${
                        theme === "DARK" ? "text-[#ccff00] border-stone-800 bg-stone-900" : 
                        theme === "VINTAGE" ? "text-black border-stone-100 bg-white" :
                        "text-black border-stone-900 bg-stone-100"
                      }`}
                    >
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className={header.column.id === 'actions' ? 'text-right w-full' : ''}>
                              {flexRender(header.column.columnDef.header, header.getContext())}
                            </div>
                          </div>
                        </div>
                        {header.column.getCanFilter() ? (
                          <div className="relative">
                            <input
                              value={(header.column.getFilterValue() as string) ?? ""}
                              onChange={(e) => header.column.setFilterValue(e.target.value)}
                              placeholder="..."
                              className={`w-full border rounded-md px-3 py-1.5 text-xs font-medium outline-none transition-all ${
                                theme === "DARK" 
                                  ? "bg-stone-950 border-stone-800 text-white focus:border-[#ccff00]" 
                                  : theme === "VINTAGE"
                                    ? "bg-[#f7f9fb] border-transparent text-black focus:border-stone-200"
                                    : "bg-white border-stone-100 text-stone-900 focus:border-stone-400"
                              }`}
                            />
                          </div>
                        ) : <div className="h-6" />}
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
                      className={`px-4 py-1.5 text-sm font-medium border-r last:border-r-0 transition-colors duration-500 ${
                        theme === "DARK" ? "text-stone-300 border-stone-800" : 
                        theme === "VINTAGE" ? "text-black border-stone-100" :
                        "text-stone-900 border-stone-900"
                      }`}
                    >
                      <div className="flex items-center min-h-[24px]">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {/* Pagination Controls */}
        <div className={`px-6 py-4 border-t flex items-center justify-between transition-colors ${
          theme === "DARK" ? "border-stone-800" : 
          theme === "VINTAGE" ? "border-stone-100" :
          "border-stone-200"
        }`}>
          <div className={`text-[10px] font-black uppercase tracking-widest ${
            theme === "DARK" ? "text-stone-500" : "text-stone-400"
          }`}>
            Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className={`p-2 rounded-lg border transition-all ${
                !table.getCanPreviousPage() 
                  ? "opacity-30 cursor-not-allowed" 
                  : theme === "DARK" ? "hover:bg-stone-900 border-stone-800 text-[#ccff00]" : "hover:bg-stone-50 border-stone-100 text-black"
              }`}
            >
              <span className="material-symbols-outlined text-base">chevron_left</span>
            </button>
            <button
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className={`p-2 rounded-lg border transition-all ${
                !table.getCanNextPage() 
                  ? "opacity-30 cursor-not-allowed" 
                  : theme === "DARK" ? "hover:bg-stone-900 border-stone-800 text-[#ccff00]" : "hover:bg-stone-50 border-stone-100 text-black"
              }`}
            >
              <span className="material-symbols-outlined text-base">chevron_right</span>
            </button>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title="Delete Tenant?"
        theme={theme}
        width={400}
        footer={
          <div className="flex gap-4">
            <button 
              onClick={() => setConfirmDelete(null)}
              className={`flex-1 py-4 border-2 rounded-2xl text-[10px] font-black tracking-widest transition-all uppercase ${
                theme === "DARK" ? "border-stone-800 text-stone-400 hover:bg-stone-900" : 
                theme === "VINTAGE" ? "border-stone-100 text-black hover:bg-stone-50" :
                "border-stone-100 text-stone-400 hover:bg-stone-50"
              }`}
            >
              Go Back
            </button>
            <button 
              onClick={() => handleDeleteTenant()}
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
          theme === "DARK" ? "text-stone-400" : "text-stone-500"
        }`}>
          Are you sure you want to remove this tenant from the platform? This will revoke all access for their users.
        </p>
      </Modal>

      {/* New Tenant Modal */}
      <Modal
        isOpen={showNewModal}
        onClose={() => {
          setShowNewModal(false);
          setEditingTenantId(null);
        }}
        title={editingTenantId ? "Edit Tenant" : "New Tenant"}
        theme={theme}
        width={600}
        footer={
          <div className="flex gap-4">
            <button 
              onClick={() => setShowNewModal(false)}
              className={`flex-1 py-4 border-2 rounded-2xl text-[10px] font-black tracking-widest transition-all uppercase ${
                theme === "DARK" ? "border-stone-800 text-stone-400 hover:bg-stone-900" : 
                theme === "VINTAGE" ? "border-stone-100 text-black hover:bg-stone-50" :
                "border-stone-100 text-stone-400 hover:bg-stone-50"
              }`}
            >
              Cancel
            </button>
            <button 
              onClick={handleSave}
              className={`flex-1 py-4 rounded-2xl text-[10px] font-black tracking-widest transition-all uppercase shadow-lg ${
                theme === "DARK" ? "bg-[#ccff00] text-stone-950 shadow-[#ccff00]/20" : 
                theme === "VINTAGE" ? "bg-black text-white shadow-black/20" :
                "bg-[#4f6b28] text-white shadow-[#4f6b28]/20"
              } hover:opacity-90`}
            >
              Save
            </button>
          </div>
        }
      >
        <div className="space-y-6">
          <FormField label="TENANT ID" theme={theme}>
            <div className={`px-6 py-4 rounded-2xl font-mono text-sm transition-colors ${
              theme === "DARK" ? "bg-stone-900 text-stone-400" : "bg-stone-50 text-stone-500"
            }`}>
              {formData.tenant_id}
            </div>
          </FormField>

          <FormField label="TENANT NAME" theme={theme}>
            <input 
              value={formData.tenant_name}
              onChange={e => setFormData({ ...formData, tenant_name: e.target.value })}
              placeholder="e.g. AVG Real Estate"
              className={inputClasses(theme)}
            />
          </FormField>

          <div className={`pt-4 pb-2 border-b transition-colors ${
            theme === "DARK" ? "border-stone-800" : "border-stone-100"
          }`}>
            <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${
              theme === "DARK" ? "text-stone-500" : "text-stone-400"
            }`}>Primary Owner Details</span>
          </div>

          <FormField label="OWNER ID (UPCOMING)" theme={theme}>
            <div className={`px-6 py-4 rounded-2xl font-mono text-sm transition-colors ${
              theme === "DARK" ? "bg-stone-900 text-stone-400" : "bg-stone-50 text-stone-500"
            }`}>
              {formData.owner_id}
            </div>
          </FormField>

          <FormField label="EMAIL ADDRESS" theme={theme}>
            <input 
              value={formData.owner_email}
              onChange={e => setFormData({ ...formData, owner_email: e.target.value })}
              placeholder="owner@company.com"
              className={inputClasses(theme)}
            />
          </FormField>

          <div className="grid grid-cols-2 gap-6">
            <FormField label="FIRST NAME" theme={theme}>
              <input 
                value={formData.owner_first_name}
                onChange={e => setFormData({ ...formData, owner_first_name: e.target.value })}
                placeholder="Jane"
                className={inputClasses(theme)}
              />
            </FormField>
            <FormField label="LAST NAME" theme={theme}>
              <input 
                value={formData.owner_last_name}
                onChange={e => setFormData({ ...formData, owner_last_name: e.target.value })}
                placeholder="Doe"
                className={inputClasses(theme)}
              />
            </FormField>
          </div>

          <FormField label="PHONE" theme={theme}>
            <input 
              value={formData.owner_phone}
              onChange={e => setFormData({ ...formData, owner_phone: e.target.value })}
              placeholder="+1 555 000 0000"
              className={inputClasses(theme)}
            />
          </FormField>

          <FormField label="ROLE" theme={theme}>
            <div className={`px-6 py-4 rounded-2xl text-sm font-bold transition-colors ${
              theme === "DARK" ? "bg-stone-900 text-stone-400" : "bg-stone-50 text-stone-500"
            }`}>
              {formData.owner_role}
            </div>
            <p className="text-[10px] text-stone-500 mt-2 font-medium">Primary owner must be assigned the Owner role.</p>
          </FormField>

          <label className="flex items-center gap-4 cursor-pointer group">
            <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${
              formData.invite_user 
                ? (theme === "DARK" ? "bg-[#ccff00] border-[#ccff00]" : "bg-black border-black")
                : (theme === "DARK" ? "border-stone-800" : "border-stone-200")
            }`}>
              {formData.invite_user && <span className="material-symbols-outlined text-white text-lg">check</span>}
            </div>
            <input 
              type="checkbox"
              className="hidden"
              checked={formData.invite_user}
              onChange={e => setFormData({ ...formData, invite_user: e.target.checked })}
            />
            <span className={`text-sm font-bold transition-colors ${
              theme === "DARK" ? "text-white" : "text-stone-900"
            }`}>Invite user (Send verification email)</span>
          </label>

          <FormField label="INTERNAL NOTES" theme={theme}>
            <textarea 
              value={formData.internal_notes}
              onChange={e => setFormData({ ...formData, internal_notes: e.target.value })}
              placeholder="Private notes about this tenant/owner..."
              rows={4}
              className={inputClasses(theme)}
            />
          </FormField>
        </div>
      </Modal>
    </div>
  );
}

function FormField({ label, children, theme }: { label: string; children: React.ReactNode; theme: string }) {
  return (
    <div>
      <label className={`text-[10px] font-black tracking-[0.2em] uppercase mb-3 block transition-colors ${
        theme === "DARK" ? "text-stone-400" : "text-stone-900"
      }`}>{label}</label>
      {children}
    </div>
  );
}

const inputClasses = (theme: string) => `w-full border-none rounded-2xl px-6 py-4 text-sm font-bold placeholder:text-stone-300 outline-none transition-colors ${
  theme === "DARK" 
    ? "bg-stone-900 text-white focus:ring-2 focus:ring-[#ccff00]" 
    : theme === "VINTAGE"
      ? "bg-[#f7f9fb] text-black focus:ring-2 focus:ring-black"
      : "bg-stone-50 text-stone-900 focus:ring-2 focus:ring-[#4f6b28]"
}`;
