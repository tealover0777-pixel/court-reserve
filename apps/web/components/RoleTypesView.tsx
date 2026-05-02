"use client";
import React, { useState, useEffect, useMemo } from "react";
import { db } from "../lib/firebase";
import { 
  collection, 
  onSnapshot, 
  doc, 
  setDoc, 
  deleteDoc, 
  query, 
  orderBy,
  serverTimestamp 
} from "firebase/firestore";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  createColumnHelper,
  ColumnFiltersState,
} from "@tanstack/react-table";
import { Modal } from "@repo/ui/modal";

interface RoleType {
  id: string;
  role_id: string;
  role_name: string;
  permissions: string[];
  IsGlobal: boolean;
}

interface Dimension {
  id: string;
  category: string;
  items: string[];
}

export default function RoleTypesView({ theme = "LIGHT" }: { theme?: "LIGHT" | "DARK" | "VINTAGE" }) {
  const [roles, setRoles] = useState<RoleType[]>([]);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [globalPermissions, setGlobalPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleType | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  // Form State
  const [roleName, setRoleName] = useState("");
  const [roleId, setRoleId] = useState("");
  const [selectedPerms, setSelectedPerms] = useState<string[]>([]);
  const [isGlobal, setIsGlobal] = useState(false);

  useEffect(() => {
    // Listen to Roles
    const rolesRef = collection(db, "role_types");
    const rolesQuery = query(rolesRef, orderBy("role_id", "asc"));
    const unsubRoles = onSnapshot(rolesQuery, (snap) => {
      setRoles(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as RoleType)));
      setLoading(false);
    });

    // Listen to Permissions Dimensions
    const unsubPerms = onSnapshot(doc(db, "dimensions", "Permissions"), (snap) => {
      if (snap.exists()) setPermissions(snap.data().items || []);
    });
    const unsubGlobalPerms = onSnapshot(doc(db, "dimensions", "Permissions_Global"), (snap) => {
      if (snap.exists()) setGlobalPermissions(snap.data().items || []);
    });

    return () => {
      unsubRoles();
      unsubPerms();
      unsubGlobalPerms();
    };
  }, []);

  const nextRoleId = useMemo(() => {
    if (roles.length === 0) return "R10001";
    const nums = roles.map(r => {
      const m = r.role_id.match(/R(\d+)/);
      return (m && m[1]) ? parseInt(m[1]) : 10000;
    });
    return `R${Math.max(...nums) + 1}`;
  }, [roles]);

  const handleOpenAdd = () => {
    setEditingRole(null);
    setRoleId(nextRoleId);
    setRoleName("");
    setSelectedPerms([]);
    setIsGlobal(false);
    setShowRoleModal(true);
  };

  const handleOpenEdit = (role: RoleType) => {
    setEditingRole(role);
    setRoleId(role.role_id);
    setRoleName(role.role_name);
    setSelectedPerms(role.permissions || []);
    setIsGlobal(role.IsGlobal || false);
    setShowRoleModal(true);
  };

  const handleSaveRole = async () => {
    if (!roleName.trim()) return;
    const id = editingRole?.id || roleId || nextRoleId;
    const payload = {
      role_id: roleId || nextRoleId,
      role_name: roleName.trim(),
      permissions: selectedPerms,
      IsGlobal: isGlobal,
      updated_at: serverTimestamp(),
      ...(editingRole ? {} : { created_at: serverTimestamp() })
    };

    try {
      await setDoc(doc(db, "role_types", id), payload, { merge: true });
      setShowRoleModal(false);
      
      // Sync to Dimensions (Role category)
      const allRoleNames = [...new Set([...roles.map(r => r.role_name), roleName.trim()])];
      await setDoc(doc(db, "dimensions", "Role"), {
        category: "Role",
        items: allRoleNames.sort()
      }, { merge: true });

    } catch (err) {
      console.error("Error saving role:", err);
    }
  };

  const handleCopyFromRole = (fromRoleId: string) => {
    const fromRole = roles.find(r => r.id === fromRoleId);
    if (fromRole) {
      setSelectedPerms([...new Set([...selectedPerms, ...(fromRole.permissions || [])])]);
    }
  };

  const handleSelectAll = (permsList: string[]) => {
    setSelectedPerms(prev => [...new Set([...prev, ...permsList])]);
  };

  const handleUnselectAll = (permsList: string[]) => {
    setSelectedPerms(prev => prev.filter(p => !permsList.includes(p)));
  };

  const handleDeleteRole = async (id: string) => {
    try {
      await deleteDoc(doc(db, "role_types", id));
      setConfirmDelete(null);
    } catch (err) {
      console.error("Error deleting role:", err);
    }
  };

  // TanStack Table Configuration
  const columnHelper = createColumnHelper<RoleType>();
  const columns = [
    columnHelper.accessor("role_id", {
      header: "ROLE ID",
      size: 120,
      cell: info => <span className={`font-mono text-xs transition-colors duration-500 ${
        theme === "DARK" ? "text-stone-400" : 
        theme === "VINTAGE" ? "text-stone-600" :
        "text-stone-900"
      }`}>{info.getValue()}</span>,
    }),
    columnHelper.accessor("role_name", {
      header: "ROLE NAME",
      size: 200,
      cell: info => <span className={`text-sm font-bold transition-colors duration-500 ${
        theme === "DARK" ? "text-white" : 
        theme === "VINTAGE" ? "text-black" :
        "text-stone-900"
      }`}>{info.getValue()}</span>,
    }),
    columnHelper.accessor("IsGlobal", {
      header: "TYPE",
      size: 100,
      filterFn: (row, columnId, filterValue) => {
        if (!filterValue) return true;
        const isGlobal = !!row.getValue(columnId);
        const label = isGlobal ? "global" : "tenant";
        return label.includes(String(filterValue).toLowerCase());
      },
      cell: info => (
        <span className={`text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest border transition-all ${
          info.getValue() 
            ? (theme === "VINTAGE" ? "bg-stone-50 text-stone-900 border-stone-200" : "bg-purple-50 text-purple-600 border-purple-200")
            : (theme === "VINTAGE" ? "bg-white text-stone-400 border-stone-100" : "bg-stone-50 text-stone-600 border-stone-200")
        }`}>
          {info.getValue() ? "Global" : "Tenant"}
        </span>
      ),
    }),
    columnHelper.accessor("permissions", {
      header: "PERMISSIONS",
      size: 600,
      filterFn: (row, columnId, filterValue) => {
        const rowValue = row.getValue(columnId) as string[];
        if (!rowValue || !filterValue) return true;
        const search = String(filterValue).toLowerCase();
        return rowValue.some(p => p.toLowerCase().includes(search));
      },
      cell: info => (
        <div className="flex flex-wrap gap-1.5 py-1">
          {(info.getValue() || []).map((p, i) => (
            <span key={i} className={`text-[10px] font-bold border px-3 py-1 rounded-full uppercase tracking-wider transition-colors ${
              theme === "VINTAGE" 
                ? "bg-white text-black border-stone-100 shadow-sm" 
                : "bg-blue-50 text-blue-600 border-blue-200"
            }`}>{p}</span>
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
        return (
          <div className="flex justify-end items-center h-full pr-2 relative">
            <button 
              onClick={() => setShowMenu(!showMenu)}
              className="text-stone-400 hover:text-stone-900 transition-colors p-2"
            >
              <span className="material-symbols-outlined text-xl">more_horiz</span>
            </button>
            
            {showMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)}></div>
                <div className={`absolute right-0 top-10 border rounded-xl shadow-xl py-2 w-32 z-50 animate-in fade-in zoom-in-95 duration-200 transition-colors ${
                  theme === "DARK" ? "bg-stone-900 border-stone-800" : 
                  theme === "VINTAGE" ? "bg-white border-stone-100 shadow-xl" :
                  "bg-white border-stone-100"
                }`}>
                  <button 
                    onClick={() => {
                      handleOpenEdit(props.row.original);
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

  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const table = useReactTable({
    data: roles,
    columns,
    state: {
      columnFilters,
    },
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
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
            Role Types
          </h2>
          <p className={`font-bold uppercase tracking-widest text-xs mt-2 transition-colors duration-500 ${
            theme === "DARK" ? "text-stone-400" : 
            theme === "VINTAGE" ? "text-stone-500" :
            "text-stone-900"
          }`}>
            System Administration · <span className={
              theme === "DARK" ? "text-[#ccff00]" : 
              theme === "VINTAGE" ? "text-black" :
              "text-[#4f6b28]"
            }>{roles.length}</span> Roles · <span className={
              theme === "DARK" ? "text-[#ccff00]" : 
              theme === "VINTAGE" ? "text-black" :
              "text-[#4f6b28]"
            }>{permissions.length + globalPermissions.length}</span> Permissions
          </p>
        </div>
        <div className="flex gap-4">
          <div className="relative w-80">
            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-stone-400 text-lg">search</span>
            <input 
              type="text"
              placeholder="Search roles..."
              className={`w-full border rounded-full pl-12 pr-6 py-3 text-sm font-medium outline-none transition-all shadow-sm ${
                theme === "DARK" 
                  ? "bg-stone-900 border-stone-800 text-white focus:border-[#ccff00]" 
                  : theme === "VINTAGE"
                    ? "bg-white border-stone-100 text-black focus:border-black shadow-md"
                    : "bg-white border-stone-200 text-stone-900 focus:border-[#4f6b28]"
              }`}
              onChange={(e) => table.setGlobalFilter(e.target.value)}
            />
          </div>
          <button 
            onClick={handleOpenAdd}
            className={`px-8 py-3 rounded-full font-black text-xs tracking-widest transition-all uppercase shadow-lg flex items-center gap-2 ${
              theme === "DARK"
                ? "bg-[#ccff00] text-stone-950 shadow-[#ccff00]/10 hover:opacity-90"
                : theme === "VINTAGE"
                  ? "bg-black text-white shadow-black/10 hover:opacity-90"
                  : "bg-[#4f6b28] text-white shadow-[#4f6b28]/20 hover:opacity-90"
            }`}
          >
            <span className="material-symbols-outlined text-sm">add</span>
            New Role
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
                      style={{ width: header.getSize() === 100 ? '100px' : 'auto' }}
                    >
                      {header.isPlaceholder ? null : (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <div
                              className={header.column.getCanSort() ? 'cursor-pointer select-none flex items-center gap-2 flex-1' : 'flex-1'}
                              onClick={header.column.getToggleSortingHandler()}
                            >
                              <div className={header.column.id === 'actions' ? 'text-right w-full' : ''}>
                                {flexRender(header.column.columnDef.header, header.getContext())}
                              </div>
                            </div>
                          </div>

                          {/* Filter Input */}
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
                                    ? "bg-stone-950 border-stone-800 text-white focus:border-[#ccff00]" 
                                    : theme === "VINTAGE"
                                      ? "bg-[#f7f9fb] border-transparent text-black focus:border-stone-200"
                                      : "bg-white border-stone-100 text-stone-900 focus:border-stone-400"
                                }`}
                              />
                            </div>
                          ) : (
                            <div className="h-6" /> 
                          )}
                        </div>
                      )}
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
        {roles.length === 0 && (
          <div className="py-20 text-center">
            <span className="material-symbols-outlined text-4xl text-stone-300 mb-4 block">assignment_ind</span>
            <p className="text-stone-900 font-bold uppercase tracking-widest text-[10px]">No roles defined yet</p>
          </div>
        )}
      </div>

      {/* Role Modal */}
      <Modal
        isOpen={showRoleModal}
        onClose={() => setShowRoleModal(false)}
        title={editingRole ? 'Edit Role' : 'New Role'}
        theme={theme}
        width={700}
        footer={
          <div className="flex gap-4">
            <button 
              onClick={() => setShowRoleModal(false)}
              className={`flex-1 py-4 border-2 rounded-2xl text-[10px] font-black tracking-widest transition-all uppercase ${
                theme === "DARK" ? "border-stone-800 text-stone-400 hover:bg-stone-900" : 
                theme === "VINTAGE" ? "border-stone-100 text-black hover:bg-stone-50" :
                "border-stone-200 text-stone-900 hover:bg-stone-50"
              }`}
            >
              Cancel
            </button>
            <button 
              onClick={handleSaveRole}
              className={`flex-1 py-4 rounded-2xl text-[10px] font-black tracking-widest transition-all uppercase shadow-lg ${
                theme === "DARK" ? "bg-[#ccff00] text-stone-950 shadow-[#ccff00]/20" : 
                theme === "VINTAGE" ? "bg-black text-white shadow-black/20" :
                "bg-[#4f6b28] text-white shadow-[#4f6b28]/20"
              } hover:opacity-90`}
            >
              {editingRole ? 'Update Role' : 'Create Role'}
            </button>
          </div>
        }
      >
        <div className="grid grid-cols-2 gap-8">
          <div>
            <label className={`text-[10px] font-black tracking-[0.2em] uppercase mb-3 block transition-colors ${
              theme === "DARK" ? "text-stone-400" : "text-stone-900"
            }`}>Role ID</label>
            <div className={`w-full border-none rounded-2xl px-6 py-4 text-sm font-mono font-bold select-none transition-colors ${
              theme === "DARK" ? "bg-stone-900 text-white" : 
              theme === "VINTAGE" ? "bg-[#f7f9fb] text-black" :
              "bg-stone-100 text-stone-900"
            }`}>
              {roleId}
            </div>
          </div>
          <div>
            <label className={`text-[10px] font-black tracking-[0.2em] uppercase mb-3 block transition-colors ${
              theme === "DARK" ? "text-stone-400" : "text-stone-900"
            }`}>Role Name</label>
            <input 
              value={roleName}
              onChange={e => setRoleName(e.target.value)}
              placeholder="e.g. Club Manager, Instructor..."
              className={`w-full border-none rounded-2xl px-6 py-4 text-sm font-bold placeholder:text-stone-400 outline-none transition-colors ${
                theme === "DARK" 
                  ? "bg-stone-900 text-white focus:ring-2 focus:ring-[#ccff00]" 
                  : theme === "VINTAGE"
                    ? "bg-[#f7f9fb] text-black focus:ring-2 focus:ring-black"
                    : "bg-stone-100 text-stone-900 focus:ring-2 focus:ring-[#4f6b28]"
              }`}
            />
          </div>
        </div>

        <div className="mt-8">
          <label className="flex items-center gap-3 cursor-pointer group">
            <div 
              className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${
                isGlobal 
                  ? (theme === "DARK" ? "bg-[#ccff00] border-[#ccff00] text-stone-950" : theme === "VINTAGE" ? "bg-black border-black text-white" : "bg-[#4f6b28] border-[#4f6b28] text-white")
                  : (theme === "DARK" ? "border-stone-800 bg-stone-900" : "border-stone-200 bg-white")
              }`}
              onClick={() => setIsGlobal(!isGlobal)}
            >
              {isGlobal && <span className="material-symbols-outlined text-sm font-bold">check</span>}
            </div>
            <span className={`text-xs font-black uppercase tracking-widest transition-colors ${
              theme === "DARK" ? "text-stone-400" : "text-stone-900"
            }`}>Global Role (Access to all tenants)</span>
          </label>
        </div>

        <div className="mt-8 border-t pt-8">
          <label className={`text-[10px] font-black tracking-[0.2em] uppercase mb-3 block transition-colors ${
            theme === "DARK" ? "text-stone-400" : "text-stone-900"
          }`}>Copy Permissions From Role</label>
          <select 
            onChange={(e) => handleCopyFromRole(e.target.value)}
            value=""
            className={`w-full border-none rounded-2xl px-6 py-4 text-sm font-bold outline-none transition-colors appearance-none cursor-pointer ${
              theme === "DARK" 
                ? "bg-stone-900 text-white focus:ring-2 focus:ring-[#ccff00]" 
                : theme === "VINTAGE"
                  ? "bg-[#f7f9fb] text-black focus:ring-2 focus:ring-black shadow-sm"
                  : "bg-stone-100 text-stone-900 focus:ring-2 focus:ring-[#4f6b28]"
            }`}
          >
            <option value="" disabled>Select a role to copy permissions from...</option>
            {roles.filter(r => r.id !== editingRole?.id).map(r => (
              <option key={r.id} value={r.id}>{r.role_name} ({r.role_id})</option>
            ))}
          </select>
        </div>

        <div className="mt-8">
          <div className="flex justify-between items-end mb-3">
            <label className={`text-[10px] font-black tracking-[0.2em] uppercase transition-colors ${
              theme === "DARK" ? "text-stone-400" : "text-stone-900"
            }`}>Permissions</label>
            <div className="flex gap-4">
              <button 
                onClick={() => handleSelectAll(permissions)}
                className={`text-[9px] font-black uppercase tracking-widest hover:underline transition-colors ${
                  theme === "DARK" ? "text-[#ccff00]" : theme === "VINTAGE" ? "text-stone-900" : "text-[#4f6b28]"
                }`}
              >
                Select All
              </button>
              <button 
                onClick={() => handleUnselectAll(permissions)}
                className="text-[9px] font-black uppercase tracking-widest text-stone-400 hover:text-red-500 hover:underline transition-colors"
              >
                Unselect All
              </button>
            </div>
          </div>
          <div className={`rounded-[32px] p-6 max-h-64 overflow-y-auto border flex flex-wrap gap-2 transition-colors ${
            theme === "DARK" ? "bg-stone-900 border-stone-800" : 
            theme === "VINTAGE" ? "bg-[#f7f9fb] border-stone-100" :
            "bg-stone-100 border-stone-200"
          }`}>
            {permissions.map(p => (
              <button
                key={p}
                onClick={() => {
                  if (selectedPerms.includes(p)) setSelectedPerms(prev => prev.filter(x => x !== p));
                  else setSelectedPerms(prev => [...prev, p]);
                }}
                className={`px-4 py-2 rounded-full text-[10px] font-black tracking-tight transition-all uppercase ${
                  selectedPerms.includes(p) 
                    ? (theme === "DARK" ? "bg-[#ccff00] text-stone-950 shadow-md shadow-[#ccff00]/20" : theme === "VINTAGE" ? "bg-black text-white shadow-md shadow-black/20" : "bg-[#4f6b28] text-white shadow-md shadow-[#4f6b28]/20")
                    : (theme === "DARK" ? "bg-stone-800 text-stone-400 border border-stone-700 hover:border-[#ccff00]/30" : "bg-white text-stone-900 border border-stone-200 hover:border-[#4f6b28]/30")
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {isGlobal && (
          <div className="mt-8 animate-in fade-in slide-in-from-top-2 border-t pt-8">
            <div className="flex justify-between items-end mb-3">
              <label className={`text-[10px] font-black tracking-[0.2em] uppercase transition-colors ${
                theme === "DARK" ? "text-stone-400" : "text-stone-900"
              }`}>Platform Admin Permissions</label>
              <div className="flex gap-4">
                <button 
                  onClick={() => handleSelectAll(globalPermissions)}
                  className={`text-[9px] font-black uppercase tracking-widest hover:underline transition-colors ${
                    theme === "DARK" ? "text-[#ccff00]" : theme === "VINTAGE" ? "text-stone-900" : "text-[#4f6b28]"
                  }`}
                >
                  Select All
                </button>
                <button 
                  onClick={() => handleUnselectAll(globalPermissions)}
                  className="text-[9px] font-black uppercase tracking-widest text-stone-400 hover:text-red-500 hover:underline transition-colors"
                >
                  Unselect All
                </button>
              </div>
            </div>
            <div className={`rounded-[32px] p-6 max-h-48 overflow-y-auto border flex flex-wrap gap-2 transition-colors ${
              theme === "DARK" ? "bg-stone-900 border-stone-800" : 
              theme === "VINTAGE" ? "bg-amber-50/30 border-amber-100" :
              "bg-amber-100/30 border-amber-200"
            }`}>
              {globalPermissions.map(p => (
                <button
                  key={p}
                  onClick={() => {
                    if (selectedPerms.includes(p)) setSelectedPerms(prev => prev.filter(x => x !== p));
                    else setSelectedPerms(prev => [...prev, p]);
                  }}
                  className={`px-4 py-2 rounded-full text-[10px] font-black tracking-tight transition-all uppercase ${
                    selectedPerms.includes(p) 
                      ? "bg-amber-600 text-white shadow-md shadow-amber-600/20" 
                      : "bg-white text-amber-800 border border-amber-200 hover:border-amber-600/30"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title="Delete Role?"
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
              onClick={() => confirmDelete && handleDeleteRole(confirmDelete)}
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
          Are you sure you want to delete this role type? Users assigned to this role may lose their permissions.
        </p>
      </Modal>
    </div>
  );
}
