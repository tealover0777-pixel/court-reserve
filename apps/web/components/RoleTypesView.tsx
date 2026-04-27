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
  getFilteredRowModel,
  getSortedRowModel,
  flexRender,
  createColumnHelper,
  ColumnFiltersState,
} from "@tanstack/react-table";

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

export default function RoleTypesView() {
  const [roles, setRoles] = useState<RoleType[]>([]);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [globalPermissions, setGlobalPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [showPermsModal, setShowPermsModal] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleType | null>(null);
  const [newPerm, setNewPerm] = useState("");
  const [permToggles, setPermToggles] = useState({ VIEW: true, UPDATE: true, CREATE: true, DELETE: true });
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

  const handleDeleteRole = async (id: string) => {
    try {
      await deleteDoc(doc(db, "role_types", id));
      setConfirmDelete(null);
    } catch (err) {
      console.error("Error deleting role:", err);
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

  // TanStack Table Configuration
  const columnHelper = createColumnHelper<RoleType>();
  const columns = [
    columnHelper.accessor("role_id", {
      header: "ROLEID",
      size: 120,
      cell: info => <span className="font-mono text-xs text-stone-900">{info.getValue()}</span>,
    }),
    columnHelper.accessor("role_name", {
      header: "ROLENAME",
      size: 200,
      cell: info => <span className="text-sm font-bold text-stone-900">{info.getValue()}</span>,
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
            <span key={i} className="text-[10px] font-bold bg-blue-50 text-blue-600 border border-blue-200 px-3 py-1 rounded-full uppercase tracking-wider">{p}</span>
          ))}
        </div>
      ),
    }),
    columnHelper.display({
      id: "actions",
      header: "ACTIONS",
      size: 100,
      cell: props => (
        <div className="flex justify-center items-center h-full">
          <button 
            onClick={() => handleOpenEdit(props.row.original)}
            className="text-stone-400 hover:text-stone-900 transition-colors"
          >
            <span className="material-symbols-outlined text-xl">more_horiz</span>
          </button>
        </div>
      ),
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
    columnResizeMode: 'onChange',
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
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
            Role Types
          </h2>
          <p className="text-stone-900 font-bold uppercase tracking-widest text-xs mt-2">
            System Administration · <span className="text-[#4f6b28]">{roles.length}</span> Roles · <span className="text-[#4f6b28]">{permissions.length + globalPermissions.length}</span> Permissions
          </p>
        </div>
        <div className="flex gap-4">
          <div className="relative w-80">
            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-stone-400 text-lg">search</span>
            <input 
              type="text"
              placeholder="Search roles..."
              className="w-full bg-white border border-stone-200 rounded-full pl-12 pr-6 py-3 text-sm font-medium text-stone-900 focus:border-[#4f6b28] outline-none transition-all shadow-sm"
              onChange={(e) => table.setGlobalFilter(e.target.value)}
            />
          </div>
          <button 
            onClick={() => setShowPermsModal(true)}
            className="border-2 border-stone-200 text-stone-900 px-8 py-3 rounded-full font-black text-xs tracking-widest hover:bg-stone-50 transition-all uppercase flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-sm">settings_suggest</span>
            Manage Permissions
          </button>
          <button 
            onClick={handleOpenAdd}
            className="bg-[#4f6b28] text-white px-8 py-3 rounded-full font-black text-xs tracking-widest hover:opacity-90 transition-all uppercase shadow-lg shadow-[#4f6b28]/20 flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-sm">add</span>
            New Role
          </button>
        </div>
      </div>

      <div className="bg-white border border-stone-300 rounded-[32px] overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse" style={{ width: table.getCenterTotalSize(), tableLayout: 'fixed' }}>
            <thead className="bg-white sticky top-0 z-10 border-b border-stone-800">
              {table.getHeaderGroups().map(headerGroup => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map(header => (
                    <th 
                      key={header.id} 
                      className="px-8 py-5 text-sm font-black text-stone-900 uppercase tracking-widest relative border-r border-stone-900 last:border-r-0"
                      style={{ width: header.getSize() }}
                    >
                      {header.isPlaceholder ? null : (
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <div
                              className={header.column.getCanSort() ? 'cursor-pointer select-none flex items-center gap-2 flex-1' : 'flex-1'}
                              onClick={header.column.getToggleSortingHandler()}
                            >
                              {flexRender(header.column.columnDef.header, header.getContext())}
                              {{
                                asc: <span className="material-symbols-outlined text-sm text-[#4f6b28]">arrow_upward</span>,
                                desc: <span className="material-symbols-outlined text-sm text-[#4f6b28]">arrow_downward</span>,
                              }[header.column.getIsSorted() as string] ?? null}
                            </div>
                            
                            {/* Resizer */}
                            <div
                              onMouseDown={header.getResizeHandler()}
                              onTouchStart={header.getResizeHandler()}
                              className={`absolute right-0 top-0 h-full w-1 cursor-col-resize select-none touch-none hover:bg-[#4f6b28]/50 transition-colors ${
                                header.column.getIsResizing() ? 'bg-[#4f6b28] w-1' : 'bg-transparent'
                              }`}
                            />
                          </div>

                          {/* Filter Input */}
                          {header.column.getCanFilter() ? (
                            <div className="relative mt-2">
                              <input
                                value={(header.column.getFilterValue() as string) ?? ""}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  header.column.setFilterValue(e.target.value);
                                }}
                                onClick={(e) => e.stopPropagation()}
                                placeholder="..."
                                className="w-full bg-white border border-stone-300 rounded-md px-3 py-2 text-sm font-medium text-stone-900 outline-none focus:border-stone-900 transition-all shadow-sm"
                              />
                            </div>
                          ) : (
                            <div className="h-8" /> 
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
                  className="border-b border-stone-900 hover:bg-stone-50 transition-colors group"
                >
                  {row.getVisibleCells().map(cell => (
                    <td 
                      key={cell.id} 
                      className="px-8 py-6 text-base font-medium text-stone-900 border-r border-stone-900 last:border-r-0"
                      style={{ width: cell.column.getSize() }}
                    >
                      <div className="flex items-center min-h-[40px]">
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
      {showRoleModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm" onClick={() => setShowRoleModal(false)}></div>
          <div className="relative bg-white rounded-[40px] w-full max-w-3xl p-12 shadow-2xl animate-in zoom-in-95 duration-300 overflow-y-auto max-h-[90vh]">
            <h3 className="text-4xl font-black italic tracking-tighter text-[#4f6b28] uppercase mb-8">
              {editingRole ? 'Edit Role' : 'New Role'}
            </h3>
            
            <div className="grid grid-cols-2 gap-8">
              <div>
                <label className="text-[10px] font-black text-stone-900 tracking-[0.2em] uppercase mb-3 block">Role ID</label>
                <div className="w-full bg-stone-100 border-none rounded-2xl px-6 py-4 text-sm font-mono font-bold text-stone-900 select-none">
                  {roleId}
                </div>
              </div>
              <div>
                <label className="text-[10px] font-black text-stone-900 tracking-[0.2em] uppercase mb-3 block">Role Name</label>
                <input 
                  value={roleName}
                  onChange={e => setRoleName(e.target.value)}
                  placeholder="e.g. Club Manager, Instructor..."
                  className="w-full bg-stone-100 border-none rounded-2xl px-6 py-4 text-sm font-bold placeholder:text-stone-400 focus:ring-2 focus:ring-[#4f6b28] outline-none"
                />
              </div>
            </div>

            <div className="mt-8">
              <label className="flex items-center gap-3 cursor-pointer group">
                <div 
                  className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${isGlobal ? 'bg-[#4f6b28] border-[#4f6b28] text-white' : 'border-stone-200 bg-white group-hover:border-stone-300'}`}
                  onClick={() => setIsGlobal(!isGlobal)}
                >
                  {isGlobal && <span className="material-symbols-outlined text-sm font-bold">check</span>}
                </div>
                <span className="text-xs font-black uppercase tracking-widest text-stone-900">Global Role (Access to all tenants)</span>
              </label>
            </div>

            <div className="mt-8">
              <label className="text-[10px] font-black text-stone-900 tracking-[0.2em] uppercase mb-3 block">Permissions</label>
              <div className="bg-stone-100 rounded-[32px] p-6 max-h-64 overflow-y-auto border border-stone-200 flex flex-wrap gap-2">
                {permissions.map(p => (
                  <button
                    key={p}
                    onClick={() => {
                      if (selectedPerms.includes(p)) setSelectedPerms(prev => prev.filter(x => x !== p));
                      else setSelectedPerms(prev => [...prev, p]);
                    }}
                    className={`px-4 py-2 rounded-full text-[10px] font-black tracking-tight transition-all uppercase ${selectedPerms.includes(p) ? 'bg-[#4f6b28] text-white shadow-md shadow-[#4f6b28]/20' : 'bg-white text-stone-900 border border-stone-200 hover:border-[#4f6b28]/30'}`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {isGlobal && (
              <div className="mt-8 animate-in fade-in slide-in-from-top-2">
                <label className="text-[10px] font-black text-stone-900 tracking-[0.2em] uppercase mb-3 block">Platform Admin Permissions</label>
                <div className="bg-amber-100/30 rounded-[32px] p-6 max-h-48 overflow-y-auto border border-amber-200 flex flex-wrap gap-2">
                  {globalPermissions.map(p => (
                    <button
                      key={p}
                      onClick={() => {
                        if (selectedPerms.includes(p)) setSelectedPerms(prev => prev.filter(x => x !== p));
                        else setSelectedPerms(prev => [...prev, p]);
                      }}
                      className={`px-4 py-2 rounded-full text-[10px] font-black tracking-tight transition-all uppercase ${selectedPerms.includes(p) ? 'bg-amber-600 text-white shadow-md shadow-amber-600/20' : 'bg-white text-amber-800 border border-amber-200 hover:border-amber-600/30'}`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-4 mt-12">
              <button 
                onClick={() => setShowRoleModal(false)}
                className="flex-1 py-4 border-2 border-stone-200 text-stone-900 rounded-2xl text-[10px] font-black tracking-widest hover:bg-stone-50 transition-all uppercase"
              >
                Cancel
              </button>
              <button 
                onClick={handleSaveRole}
                className="flex-1 py-4 bg-[#4f6b28] text-white rounded-2xl text-[10px] font-black tracking-widest hover:opacity-90 transition-all uppercase shadow-lg shadow-[#4f6b28]/20"
              >
                {editingRole ? 'Update Role' : 'Create Role'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Permissions Modal */}
      {showPermsModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm" onClick={() => setShowPermsModal(false)}></div>
          <div className="relative bg-white rounded-[40px] w-full max-w-xl p-12 shadow-2xl animate-in zoom-in-95 duration-300">
            <h3 className="text-4xl font-black italic tracking-tighter text-[#4f6b28] uppercase mb-4">
              Permissions
            </h3>
            <p className="text-stone-400 font-bold uppercase tracking-widest text-[10px] mb-8">Manage application-wide permission keys</p>

            <div className="bg-stone-50 p-8 rounded-[32px] border border-stone-100 mb-8">
              <div className="flex gap-4 mb-6">
                <input 
                  value={newPerm}
                  onChange={e => setNewPerm(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleAddPermission()}
                  placeholder="e.g. INVOICE, COURT_BOOKING..."
                  className="flex-1 bg-white border border-stone-200 rounded-2xl px-6 py-4 text-sm font-bold placeholder:text-stone-300 focus:border-[#4f6b28] outline-none transition-colors"
                />
                <button 
                  onClick={handleAddPermission}
                  className="bg-[#4f6b28] text-white px-8 rounded-2xl font-black text-xs tracking-widest hover:opacity-90 transition-all uppercase"
                >
                  Add
                </button>
              </div>
              <div className="flex flex-wrap gap-6 pl-2">
                {Object.keys(permToggles).map(k => (
                  <label key={k} className="flex items-center gap-2 cursor-pointer group">
                    <div 
                      className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${permToggles[k as keyof typeof permToggles] ? 'bg-[#4f6b28] border-[#4f6b28] text-white' : 'border-stone-200 bg-white group-hover:border-stone-300'}`}
                      onClick={() => setPermToggles(prev => ({ ...prev, [k]: !prev[k as keyof typeof prev] }))}
                    >
                      {permToggles[k as keyof typeof permToggles] && <span className="material-symbols-outlined text-[10px] font-bold">check</span>}
                    </div>
                    <span className={`text-[10px] font-black uppercase tracking-widest ${permToggles[k as keyof typeof permToggles] ? 'text-[#4f6b28]' : 'text-stone-300'}`}>{k}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="max-h-64 overflow-y-auto pr-4 grid grid-cols-2 gap-3">
              {permissions.sort().map(p => (
                <div key={p} className="flex items-center justify-between bg-stone-50 border border-stone-100 rounded-2xl px-5 py-3 group">
                  <span className="text-[10px] font-mono font-bold text-stone-500">{p}</span>
                  <button onClick={() => handleRemovePermission(p)} className="text-stone-300 hover:text-red-500 transition-colors">
                    <span className="material-symbols-outlined text-lg">close</span>
                  </button>
                </div>
              ))}
            </div>

            <div className="mt-12">
              <button 
                onClick={() => setShowPermsModal(false)}
                className="w-full py-4 bg-stone-900 text-white rounded-2xl text-[10px] font-black tracking-widest hover:opacity-90 transition-all uppercase"
              >
                Close
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
              Delete Role?
            </h3>
            <p className="text-stone-500 text-center font-medium leading-relaxed mb-10">
              Are you sure you want to delete this role type? Users assigned to this role may lose their permissions.
            </p>
            <div className="flex gap-4">
              <button 
                onClick={() => setConfirmDelete(null)}
                className="flex-1 py-4 border-2 border-stone-100 text-stone-400 rounded-2xl text-[10px] font-black tracking-widest hover:bg-stone-50 transition-all uppercase"
              >
                Go Back
              </button>
              <button 
                onClick={() => handleDeleteRole(confirmDelete)}
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
