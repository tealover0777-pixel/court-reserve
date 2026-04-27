"use client";
import React, { useState, useMemo } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  flexRender,
  createColumnHelper,
  ColumnFiltersState,
} from "@tanstack/react-table";

interface User {
  id: string;
  user_id: string;
  name: string;
  email: string;
  role: string;
  status: "Active" | "Inactive";
}

const MOCK_USERS: User[] = [
  { id: "1", user_id: "U10001", name: "Alex Sterling", email: "alex@kinetic.com", role: "Club Manager", status: "Active" },
  { id: "2", user_id: "U10002", name: "Sarah Chen", email: "sarah.c@kinetic.com", role: "Instructor", status: "Active" },
  { id: "3", user_id: "U10003", name: "Marcus Volkov", email: "marcus@kinetic.com", role: "Technician", status: "Active" },
  { id: "4", user_id: "U10004", name: "Elena Rodriguez", email: "elena@kinetic.com", role: "Front Desk", status: "Inactive" },
  { id: "5", user_id: "U10005", name: "David Kim", email: "david.k@kinetic.com", role: "Club Manager", status: "Active" },
];

export default function UserAdminView({ theme = "LIGHT" }: { theme?: "LIGHT" | "DARK" }) {
  const [users] = useState<User[]>(MOCK_USERS);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const columnHelper = createColumnHelper<User>();
  const columns = [
    columnHelper.accessor("user_id", {
      header: "USER ID",
      size: 120,
      cell: info => <span className={`font-mono text-xs transition-colors duration-500 ${theme === "DARK" ? "text-stone-400" : "text-stone-900"}`}>{info.getValue()}</span>,
    }),
    columnHelper.accessor("name", {
      header: "NAME",
      size: 200,
      cell: info => <span className={`text-sm font-bold transition-colors duration-500 ${theme === "DARK" ? "text-white" : "text-stone-900"}`}>{info.getValue()}</span>,
    }),
    columnHelper.accessor("email", {
      header: "EMAIL",
      size: 250,
      cell: info => <span className={`text-sm transition-colors duration-500 ${theme === "DARK" ? "text-stone-400" : "text-stone-600"}`}>{info.getValue()}</span>,
    }),
    columnHelper.accessor("role", {
      header: "ROLE",
      size: 150,
      cell: info => (
        <span className="text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest bg-blue-50 text-blue-600 border border-blue-200">
          {info.getValue()}
        </span>
      ),
    }),
    columnHelper.accessor("status", {
      header: "STATUS",
      size: 120,
      cell: info => (
        <span className={`text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest border ${
          info.getValue() === "Active" 
            ? "bg-green-50 text-green-600 border-green-200" 
            : "bg-red-50 text-red-600 border-red-200"
        }`}>
          {info.getValue()}
        </span>
      ),
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
                  theme === "DARK" ? "bg-stone-900 border-stone-800" : "bg-white border-stone-100"
                }`}>
                  <button 
                    onClick={() => setShowMenu(false)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-[10px] font-black uppercase tracking-widest transition-colors ${
                      theme === "DARK" ? "text-stone-400 hover:bg-stone-800" : "text-stone-600 hover:bg-stone-50"
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
    data: users,
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
          <h2 className={`text-5xl font-black italic tracking-tighter uppercase transition-colors duration-500 ${theme === "DARK" ? "text-[#ccff00]" : "text-[#4f6b28]"}`} style={{ fontFamily: 'Lexend, sans-serif' }}>
            User Admin
          </h2>
          <p className={`font-bold uppercase tracking-widest text-xs mt-2 transition-colors duration-500 ${theme === "DARK" ? "text-stone-400" : "text-stone-900"}`}>
            Platform Management · <span className={theme === "DARK" ? "text-[#ccff00]" : "text-[#4f6b28]"}>{users.length}</span> Users Active
          </p>
        </div>
        <div className="flex gap-4">
          <div className="relative w-80">
            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-stone-400 text-lg">search</span>
            <input 
              type="text"
              placeholder="Search users..."
              className={`w-full border rounded-full pl-12 pr-6 py-3 text-sm font-medium outline-none transition-all shadow-sm ${
                theme === "DARK" 
                  ? "bg-stone-900 border-stone-800 text-white focus:border-[#ccff00]" 
                  : "bg-white border-stone-200 text-stone-900 focus:border-[#4f6b28]"
              }`}
              onChange={(e) => table.setGlobalFilter(e.target.value)}
            />
          </div>
          <button className={`px-8 py-3 rounded-full font-black text-xs tracking-widest transition-all uppercase shadow-lg flex items-center gap-2 ${
            theme === "DARK"
              ? "bg-[#ccff00] text-stone-950 shadow-[#ccff00]/10 hover:opacity-90"
              : "bg-[#4f6b28] text-white shadow-[#4f6b28]/20 hover:opacity-90"
          }`}>
            <span className="material-symbols-outlined text-sm">person_add</span>
            New User
          </button>
        </div>
      </div>

      <div className={`border rounded-xl overflow-hidden shadow-sm transition-colors duration-500 ${
        theme === "DARK" ? "bg-stone-950 border-stone-800" : "bg-white border-stone-200"
      }`}>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-stone-100 sticky top-0 z-10 border-b border-stone-900">
              {table.getHeaderGroups().map(headerGroup => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map(header => (
                    <th 
                      key={header.id} 
                      className={`px-6 py-4 text-[10px] font-black uppercase tracking-widest relative border-r last:border-r-0 transition-colors duration-500 ${
                        theme === "DARK" ? "text-[#ccff00] border-stone-800 bg-stone-900" : "text-black border-stone-900 bg-stone-100"
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
                      : (i % 2 !== 0 ? 'bg-stone-50/50 border-stone-900' : 'bg-white border-stone-900 hover:bg-stone-50')
                  }`}
                >
                  {row.getVisibleCells().map(cell => (
                    <td 
                      key={cell.id} 
                      className={`px-6 py-3 text-sm font-medium border-r last:border-r-0 transition-colors duration-500 ${
                        theme === "DARK" ? "text-stone-300 border-stone-800" : "text-stone-900 border-stone-900"
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
          <div className="relative bg-white rounded-[40px] w-full max-w-md p-12 shadow-2xl animate-in zoom-in-95 duration-300 overflow-hidden">
            {theme === "DARK" && <div className="absolute inset-0 bg-stone-950/90 z-0"></div>}
            <div className="relative z-10">
              <div className="w-20 h-20 bg-red-50 rounded-3xl flex items-center justify-center text-red-500 mb-8 mx-auto">
                <span className="material-symbols-outlined text-4xl">delete_forever</span>
              </div>
              <h3 className={`text-3xl font-black italic tracking-tighter uppercase text-center mb-4 transition-colors ${
                theme === "DARK" ? "text-white" : "text-stone-900"
              }`}>
                Delete User?
              </h3>
              <p className={`text-center font-medium leading-relaxed mb-10 transition-colors ${
                theme === "DARK" ? "text-stone-400" : "text-stone-500"
              }`}>
                Are you sure you want to remove this user from the platform? This action cannot be undone.
              </p>
              <div className="flex gap-4">
                <button 
                  onClick={() => setConfirmDelete(null)}
                  className={`flex-1 py-4 border-2 rounded-2xl text-[10px] font-black tracking-widest transition-all uppercase ${
                    theme === "DARK" ? "border-stone-800 text-stone-400 hover:bg-stone-900" : "border-stone-100 text-stone-400 hover:bg-stone-50"
                  }`}
                >
                  Go Back
                </button>
                <button 
                  onClick={() => setConfirmDelete(null)}
                  className="flex-1 py-4 bg-red-500 text-white rounded-2xl text-[10px] font-black tracking-widest hover:bg-red-600 transition-all uppercase shadow-lg shadow-red-500/20"
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
