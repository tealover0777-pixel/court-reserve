"use client";
import React, { useState } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  flexRender,
  createColumnHelper,
  ColumnFiltersState,
} from "@tanstack/react-table";

interface Tenant {
  id: string;
  tenant_id: string;
  name: string;
  domain: string;
  status: "Active" | "Suspended" | "Pending";
  created_at: string;
}

const MOCK_TENANTS: Tenant[] = [
  { id: "1", tenant_id: "T10001", name: "Elite Tennis Club", domain: "elite-tennis.kinetic.com", status: "Active", created_at: "2024-01-15" },
  { id: "2", tenant_id: "T10002", name: "Peak Padel Center", domain: "peak-padel.kinetic.com", status: "Active", created_at: "2024-02-10" },
  { id: "3", tenant_id: "T10003", name: "Harbor Courts", domain: "harbor-courts.kinetic.com", status: "Suspended", created_at: "2024-02-22" },
  { id: "4", tenant_id: "T10004", name: "Vantage Sports", domain: "vantage.kinetic.com", status: "Pending", created_at: "2024-03-05" },
];

export default function PlatformTenantAdminView({ theme = "LIGHT" }: { theme?: "LIGHT" | "DARK" | "VINTAGE" }) {
  const [tenants] = useState<Tenant[]>(MOCK_TENANTS);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

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
                    onClick={() => setShowMenu(false)}
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
  });

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
          <button className={`px-8 py-3 rounded-full font-black text-xs tracking-widest transition-all uppercase shadow-lg flex items-center gap-2 ${
            theme === "DARK"
              ? "bg-[#ccff00] text-stone-950 shadow-[#ccff00]/10 hover:opacity-90"
              : theme === "VINTAGE"
                ? "bg-black text-white shadow-black/10 hover:opacity-90"
                : "bg-[#4f6b28] text-white shadow-[#4f6b28]/20 hover:opacity-90"
          }`}>
            <span className="material-symbols-outlined text-sm">add_business</span>
            New Tenant
          </button>
        </div>
      </div>

      <div className={`border rounded-xl overflow-hidden shadow-sm transition-colors duration-500 ${
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

      {/* Delete Confirmation Modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm" onClick={() => setConfirmDelete(null)}></div>
          <div className={`relative rounded-[40px] w-full max-w-md p-12 shadow-2xl animate-in zoom-in-95 duration-300 overflow-hidden transition-colors ${
            theme === "DARK" ? "bg-stone-950" : "bg-white"
          }`}>
            <div className="relative z-10">
              <div className={`w-20 h-20 rounded-3xl flex items-center justify-center mb-8 mx-auto ${
                theme === "VINTAGE" ? "bg-stone-50 text-black" : "bg-red-50 text-red-500"
              }`}>
                <span className="material-symbols-outlined text-4xl">delete_forever</span>
              </div>
              <h3 className={`text-3xl font-black italic tracking-tighter uppercase text-center mb-4 transition-colors ${
                theme === "DARK" ? "text-white" : "text-stone-900"
              }`}>
                Delete Tenant?
              </h3>
              <p className={`text-center font-medium leading-relaxed mb-10 transition-colors ${
                theme === "DARK" ? "text-stone-400" : "text-stone-500"
              }`}>
                Are you sure you want to remove this tenant from the platform? This will revoke all access for their users.
              </p>
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
                  onClick={() => setConfirmDelete(null)}
                  className={`flex-1 py-4 rounded-2xl text-[10px] font-black tracking-widest transition-all uppercase shadow-lg ${
                    theme === "VINTAGE" ? "bg-black text-white hover:bg-stone-900 shadow-black/20" : "bg-red-500 text-white hover:bg-red-600 shadow-red-500/20"
                  }`}
                >
                  Delete Now
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
