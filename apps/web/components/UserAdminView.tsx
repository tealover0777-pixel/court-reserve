"use client";
import React, { useState, useMemo, useRef } from "react";
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

interface User {
  id: string;
  user_id: string;
  auth_uid?: string;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
  status: string;
  phone?: string;
  notes?: string;
  tenant_id?: string;
  address_street_1?: string;
  address_street_2?: string;
  address_city?: string;
  address_state?: string;
  address_zip?: string;
}

const US_STATES = [
  "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado", "Connecticut", "Delaware", "Florida", "Georgia", 
  "Hawaii", "Idaho", "Illinois", "Indiana", "Iowa", "Kansas", "Kentucky", "Louisiana", "Maine", "Maryland", 
  "Massachusetts", "Michigan", "Minnesota", "Mississippi", "Missouri", "Montana", "Nebraska", "Nevada", "New Hampshire", "New Jersey", 
  "New Mexico", "New York", "North Carolina", "North Dakota", "Ohio", "Oklahoma", "Oregon", "Pennsylvania", "Rhode Island", "South Carolina", 
  "South Dakota", "Tennessee", "Texas", "Utah", "Vermont", "Virginia", "Washington", "West Virginia", "Wisconsin", "Wyoming"
];



import { db, functions } from "../lib/firebase";
import { collection, onSnapshot, query, orderBy, doc, deleteDoc, setDoc, where, getDocs } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { useEffect } from "react";

export default function UserAdminView({ theme = "LIGHT" }: { theme?: "LIGHT" | "DARK" | "VINTAGE" }) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showInviteSuccess, setShowInviteSuccess] = useState(false);
  const [invitationLink, setInvitationLink] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [userStatuses, setUserStatuses] = useState<string[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [tenants, setTenants] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    user_id: "",
    auth_uid: "",
    first_name: "",
    last_name: "",
    email: "",
    role: "",
    status: "Invited",
    phone: "",
    notes: "",
    tenant_id: "",
    invite_user: true,
    address_street_1: "",
    address_street_2: "",
    address_city: "",
    address_state: "",
    address_zip: ""
  });
  const [notification, setNotification] = useState<{ message: string; type: "SUCCESS" | "ERROR" | "INFO" } | null>(null);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const showAppMessage = (message: string, type: "SUCCESS" | "ERROR" | "INFO" = "INFO") => {
    setNotification({ message, type });
  };

  const nextUserId = useMemo(() => {
    if (!formData.tenant_id) return "U10001";
    const tenantUsers = users.filter(u => u.tenant_id === formData.tenant_id);
    if (tenantUsers.length === 0) return "U10001";
    const ids = tenantUsers.map(u => {
      const match = u.user_id?.match(/^U(\d+)$/);
      return (match && match[1]) ? parseInt(match[1]) : 0;
    });
    const max = Math.max(...ids);
    const nextNum = Math.max(10001, max + 1);
    return `U${nextNum}`;
  }, [users, formData.tenant_id]);

  useEffect(() => {
    const q = query(collection(db, "global_users"), orderBy("user_id", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as User[];
      setUsers(data);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching users:", error);
      setLoading(false);
    });

    const unsubscribeStatus = onSnapshot(query(collection(db, "dimensions"), orderBy("category", "asc")), (snapshot) => {
      const statusDim = snapshot.docs.find(doc => doc.data().category?.toUpperCase() === "USERSTATUS");
      if (statusDim) {
        setUserStatuses(statusDim.data().items || []);
      } else {
        setUserStatuses([]); // Fallback to empty if not found
      }
    });

    const unsubscribeRoles = onSnapshot(query(collection(db, "role_types"), orderBy("role_id", "asc")), (snapshot) => {
      const roleData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setRoles(roleData);
    });

    const unsubscribeTenants = onSnapshot(collection(db, "tenants"), (snapshot) => {
      setTenants(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubscribe();
      unsubscribeStatus();
      unsubscribeRoles();
      unsubscribeTenants();
    };
  }, []);

  useEffect(() => {
    const auth = getAuth();
    const unsub = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });
    return () => unsub();
  }, []);

  const filteredUsers = useMemo(() => {
    const superEmail = "kyuahn@yahoo.com";
    // Only show the super user if the logged in user is that super user
    if (currentUser?.email === superEmail) return users;
    return users.filter(u => u.email !== superEmail);
  }, [users, currentUser]);

  useEffect(() => {
    const superEmail = "kyuahn@yahoo.com";
    if (currentUser?.email === superEmail && !loading && users.length > 0) {
      const exists = users.find(u => u.email === superEmail);
      if (!exists) {
        const provisionSuper = async () => {
          try {
            const superId = "U00001";
            const superRef = doc(db, "global_users", superId);
            await setDoc(superRef, {
              user_id: superId,
              auth_uid: currentUser.uid,
              email: superEmail,
              first_name: "Kyu",
              last_name: "Ahn",
              role: "R10010",
              status: "Active",
              created_at: new Date()
            }, { merge: true });
            console.log("Super Admin profile auto-provisioned.");
          } catch (err) {
            console.error("Failed to auto-provision super admin:", err);
          }
        };
        provisionSuper();
      }
    }
  }, [currentUser, users, loading]);

  const handleDeleteUser = async () => {
    if (!confirmDelete) return;
    setIsSaving(true);
    try {
      const userToDelete = users.find(u => u.id === confirmDelete);
      const deleteFn = httpsCallable(functions, "deleteUserAccount");
      await deleteFn({
        user_id: confirmDelete,
        auth_uid: userToDelete?.auth_uid
      });
      setConfirmDelete(null);
    } catch (err) {
      console.error("Failed to delete user:", err);
      showAppMessage("Failed to delete user account synchronization.", "ERROR");
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setFormData({
      user_id: user.user_id || "",
      auth_uid: user.auth_uid || "",
      first_name: user.first_name || "",
      last_name: user.last_name || "",
      email: user.email || "",
      role: user.role || "",
      status: user.status || "Invited",
      phone: user.phone || "",
      notes: user.notes || "",
      tenant_id: user.tenant_id || "",
      invite_user: false,
      address_street_1: user.address_street_1 || "",
      address_street_2: user.address_street_2 || "",
      address_city: user.address_city || "",
      address_state: user.address_state || "",
      address_zip: user.address_zip || ""
    });
    setShowEditModal(true);
  };

  const handleSaveUser = async () => {
    if (!editingUser) return;
    setIsSaving(true);
    try {
      const compositeId = `${formData.tenant_id}_${formData.user_id}`;
      const userRef = doc(db, "global_users", compositeId);
      await setDoc(userRef, {
        ...formData,
        updated_at: new Date().toISOString()
      }, { merge: true });
      setShowEditModal(false);
      setEditingUser(null);

      // Sync reverse to tenants if this user owns any
      const tenantsQuery = query(collection(db, "tenants"), where("owner_id", "==", editingUser.user_id));
      const tenantSnaps = await getDocs(tenantsQuery);
      for (const tDoc of tenantSnaps.docs) {
        await setDoc(doc(db, "tenants", tDoc.id), {
          address_street_1: formData.address_street_1,
          address_street_2: formData.address_street_2,
          address_city: formData.address_city,
          address_state: formData.address_state,
          address_zip: formData.address_zip
        }, { merge: true });
      }
    } catch (err) {
      console.error("Failed to save user:", err);
      showAppMessage("Failed to save user.", "ERROR");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateUser = async () => {
    if (!formData.email) {
      showAppMessage("Email is required.", "ERROR");
      return;
    }
    setIsSaving(true);
    try {
      const newUserId = nextUserId;
      const compositeId = `${formData.tenant_id}_${newUserId}`;
      const userRef = doc(db, "global_users", compositeId);
      
      const userData = {
        user_id: newUserId,
        tenant_id: formData.tenant_id,
        first_name: formData.first_name,
        last_name: formData.last_name,
        email: formData.email,
        role: formData.role,
        status: "Invited",
        phone: formData.phone,
        notes: formData.notes,
        address_street_1: formData.address_street_1,
        address_street_2: formData.address_street_2,
        address_city: formData.address_city,
        address_state: formData.address_state,
        address_zip: formData.address_zip,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      await setDoc(userRef, userData);

      if (formData.invite_user) {
        const inviteUserFn = httpsCallable(functions, "inviteUser");
        const result: any = await inviteUserFn({
          email: formData.email,
          role: formData.role,
          user_id: newUserId,
          first_name: formData.first_name,
          last_name: formData.last_name,
          phone: formData.phone,
          notes: formData.notes,
          tenantId: formData.tenant_id,
          address_street_1: formData.address_street_1,
          address_street_2: formData.address_street_2,
          address_city: formData.address_city,
          address_state: formData.address_state,
          address_zip: formData.address_zip,
          inviteUser: true
        });
        
        if (result.data?.invitationLink) {
          setInvitationLink(result.data.invitationLink);
          setShowInviteSuccess(true);
        }
      }

      // Sync reverse to tenants if this user owns any (shouldn't happen on create but for safety)
      const tenantsQuery = query(collection(db, "tenants"), where("owner_id", "==", newUserId));
      const tenantSnaps = await getDocs(tenantsQuery);
      for (const tDoc of tenantSnaps.docs) {
        await setDoc(doc(db, "tenants", tDoc.id), {
          address_street_1: formData.address_street_1,
          address_street_2: formData.address_street_2,
          address_city: formData.address_city,
          address_state: formData.address_state,
          address_zip: formData.address_zip
        }, { merge: true });
      }

      setShowCreateModal(false);
      resetForm();
    } catch (err) {
      console.error("Failed to create user:", err);
      showAppMessage("Failed to create user.", "ERROR");
    } finally {
      setIsSaving(false);
    }
  };

  const handleInviteUser = async (user: User) => {
    setIsSaving(true);
    try {
      const inviteUserFn = httpsCallable(functions, "inviteUser");
      const result: any = await inviteUserFn({
        email: user.email,
        role: user.role,
        user_id: user.user_id,
        first_name: user.first_name,
        last_name: user.last_name,
        phone: user.phone,
        notes: user.notes,
        address_street_1: user.address_street_1,
        address_street_2: user.address_street_2,
        address_city: user.address_city,
        address_state: user.address_state,
        address_zip: user.address_zip,
        inviteUser: true
      });
      
      if (result.data?.invitationLink) {
        setInvitationLink(result.data.invitationLink);
        setShowInviteSuccess(true);
        if (result.data?.success) {
          showAppMessage(`Invitation sent to ${user.email}`, "SUCCESS");
        }
      }
    } catch (err) {
      console.error("Resend error:", err);
      showAppMessage("Failed to send invitation.", "ERROR");
    } finally {
      setIsSaving(false);
    }
  };

  const resetForm = () => {
    setFormData({
      user_id: "",
      auth_uid: "",
      first_name: "",
      last_name: "",
      email: "",
      role: "",
      status: "Invited",
      phone: "",
      notes: "",
      tenant_id: "",
      invite_user: true,
      address_street_1: "",
      address_street_2: "",
      address_city: "",
      address_state: "",
      address_zip: ""
    });
  };

  const columnHelper = createColumnHelper<User>();
  const columns = [
    columnHelper.accessor("user_id", {
      header: "USER ID",
      size: 120,
      cell: info => <span className={`font-mono text-xs transition-colors duration-500 ${
        theme === "DARK" ? "text-stone-400" : 
        theme === "VINTAGE" ? "text-stone-600" :
        "text-stone-900"
      }`}>{info.getValue()}</span>,
    }),
    columnHelper.accessor("tenant_id", {
      header: "TENANT",
      size: 160,
      cell: info => {
        const tid = info.getValue();
        if (!tid) return (
          <span className={`font-mono text-[10px] font-black transition-colors duration-500 ${
            theme === "DARK" ? "text-stone-500" : 
            theme === "VINTAGE" ? "text-stone-400" :
            "text-stone-400"
          }`}>Global</span>
        );
        const tenant = tenants.find(t => t.tenant_id === tid);
        return (
          <div className="flex flex-col gap-0.5">
            <span className={`text-[11px] font-bold tracking-tight transition-colors duration-500 ${
              theme === "DARK" ? "text-[#ccff00]" : 
              theme === "VINTAGE" ? "text-stone-900" :
              "text-stone-900"
            }`}>
              {tenant?.name || "Unknown"}
            </span>
            <span className={`font-mono text-[9px] font-black transition-colors duration-500 opacity-40 ${
              theme === "DARK" ? "text-white" : 
              theme === "VINTAGE" ? "text-stone-600" :
              "text-stone-500"
            }`}>
              {tid}
            </span>
          </div>
        );
      },
      filterFn: (row, columnId, filterValue) => {
        const tid = row.getValue(columnId) as string;
        const search = filterValue.toLowerCase();
        
        if (!tid) return "global".includes(search);
        
        const tenant = tenants.find(t => t.tenant_id === tid);
        const nameMatch = tenant?.name?.toLowerCase().includes(search);
        const idMatch = tid.toLowerCase().includes(search);
        
        return !!(nameMatch || idMatch);
      }
    }),
    columnHelper.accessor("first_name", {
      header: "FIRST NAME",
      size: 150,
      cell: info => <span className={`text-sm font-bold transition-colors duration-500 ${
        theme === "DARK" ? "text-white" : 
        theme === "VINTAGE" ? "text-black" :
        "text-stone-900"
      }`}>{info.getValue() || "-"}</span>,
    }),
    columnHelper.accessor("last_name", {
      header: "LAST NAME",
      size: 150,
      cell: info => <span className={`text-sm font-bold transition-colors duration-500 ${
        theme === "DARK" ? "text-white" : 
        theme === "VINTAGE" ? "text-black" :
        "text-stone-900"
      }`}>{info.getValue() || "-"}</span>,
    }),
    columnHelper.accessor("email", {
      header: "EMAIL",
      size: 250,
      cell: info => <span className={`text-sm transition-colors duration-500 ${
        theme === "DARK" ? "text-stone-400" : 
        theme === "VINTAGE" ? "text-stone-500" :
        "text-stone-600"
      }`}>{info.getValue()}</span>,
    }),
    columnHelper.accessor("role", {
      header: "ROLE",
      size: 200,
      cell: info => {
        const roleId = info.getValue();
        const roleMatch = roles.find(r => r.role_id === roleId || r.id === roleId);
        if (!roleMatch) return <span className="text-xs text-stone-400">{roleId || "-"}</span>;
        
        return (
          <div className="flex flex-col py-1">
            <span className={`text-[10px] font-mono uppercase tracking-tight mb-0.5 ${
              theme === "DARK" ? "text-stone-500" : "text-stone-400"
            }`}>
              {roleMatch.role_id}
            </span>
            <div className="flex items-center gap-2">
              <span className={`text-sm font-bold leading-tight ${
                theme === "DARK" ? "text-white" : "text-stone-900"
              }`}>
                {roleMatch.role_name}
              </span>
              {roleMatch.is_global && (
                <span className="text-[8px] font-black bg-[#eef2ff] text-[#4f46e5] px-2 py-0.5 rounded-full border border-[#e0e7ff] uppercase tracking-widest shadow-sm">
                  Global
                </span>
              )}
            </div>
          </div>
        );
      },
    }),
    columnHelper.accessor("status", {
      header: "STATUS",
      size: 120,
      cell: info => {
        const val = (info.getValue() || "").toString().toLowerCase();
        return (
          <span className={`text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest border ${
            val === "active" 
              ? (theme === "VINTAGE" ? "bg-stone-50 text-stone-900 border-stone-200" : "bg-green-50 text-green-600 border-green-200")
              : val === "invited"
                ? "bg-amber-50 text-amber-600 border-amber-200"
                : "bg-red-50 text-red-600 border-red-200"
          }`}>
            {info.getValue()}
          </span>
        );
      },
    }),
    columnHelper.accessor("phone", {
      header: "PHONE",
      size: 150,
      cell: info => <span className={`text-xs transition-colors duration-500 ${
        theme === "DARK" ? "text-stone-400" : "text-stone-600"
      }`}>{info.getValue() || "-"}</span>,
    }),
    columnHelper.accessor("notes", {
      header: "NOTES",
      size: 200,
      cell: info => <span className={`text-xs transition-colors duration-500 truncate max-w-[200px] block ${
        theme === "DARK" ? "text-stone-500" : "text-stone-400"
      }`}>{info.getValue() || "-"}</span>,
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
                  theme === "VINTAGE" ? "bg-white border-stone-100" :
                  "bg-white border-stone-100"
                }`}>
                  <button 
                    onClick={() => {
                      handleEditUser(props.row.original);
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
                      handleInviteUser(props.row.original);
                      setShowMenu(false);
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-[10px] font-black uppercase tracking-widest transition-colors ${
                      theme === "DARK" ? "text-[#ccff00] hover:bg-stone-800" : 
                      "text-[#6348eb] hover:bg-stone-50"
                    }`}
                  >
                    <span className="material-symbols-outlined text-base">mail</span>
                    Invite
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
    data: filteredUsers,
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
            User Admin
          </h2>
          <p className={`font-bold uppercase tracking-widest text-xs mt-2 transition-colors duration-500 ${
            theme === "DARK" ? "text-stone-400" : 
            theme === "VINTAGE" ? "text-stone-500" :
            "text-stone-900"
          }`}>
            Platform Management · <span className={
              theme === "DARK" ? "text-[#ccff00]" : 
              theme === "VINTAGE" ? "text-black" :
              "text-[#4f6b28]"
            }>{users.length}</span> Users Active
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
                  : theme === "VINTAGE"
                    ? "bg-white border-stone-100 text-black focus:border-black shadow-md"
                    : "bg-white border-stone-200 text-stone-900 focus:border-[#4f6b28]"
              }`}
              onChange={(e) => table.setGlobalFilter(e.target.value)}
            />
          </div>
          <button 
            onClick={() => {
              resetForm();
              setShowCreateModal(true);
            }}
            className={`px-8 py-3 rounded-full font-black text-xs tracking-widest transition-all uppercase shadow-lg flex items-center gap-2 ${
            theme === "DARK"
              ? "bg-[#ccff00] text-stone-950 shadow-[#ccff00]/10 hover:opacity-90"
              : theme === "VINTAGE"
                ? "bg-black text-white shadow-black/10 hover:opacity-90"
                : "bg-[#4f6b28] text-white shadow-[#4f6b28]/20 hover:opacity-90"
          }`}>
            <span className="material-symbols-outlined text-sm">person_add</span>
            New User
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
                    >
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className={header.column.id === 'actions' ? 'text-left w-full' : ''}>
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
      <Modal
        isOpen={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title="Delete User?"
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
              onClick={handleDeleteUser}
              className={`flex-1 py-4 rounded-2xl text-[10px] font-black tracking-widest transition-all uppercase shadow-lg ${
                theme === "VINTAGE" ? "bg-black text-white hover:bg-stone-900 shadow-black/20" : "bg-red-500 text-white hover:bg-red-600 shadow-red-500/20"
              }`}
            >
              Delete Now
            </button>
          </div>
        }
      >
        <div className="relative z-10">
          <div className={`w-20 h-20 rounded-3xl flex items-center justify-center mb-8 mx-auto ${
            theme === "VINTAGE" ? "bg-stone-50 text-black" : "bg-red-50 text-red-500"
          }`}>
            <span className="material-symbols-outlined text-4xl">delete_forever</span>
          </div>
          <p className={`text-center font-medium leading-relaxed transition-colors ${
            theme === "DARK" ? "text-stone-400" : "text-stone-500"
          }`}>
            Are you sure you want to remove this user from the platform? This action cannot be undone.
          </p>
        </div>
      </Modal>

      {/* Invite Success Modal */}
      <Modal
        isOpen={showInviteSuccess}
        onClose={() => setShowInviteSuccess(false)}
        title="Invitation Sent"
        theme={theme}
        width={500}
        footer={
          <button 
            onClick={() => setShowInviteSuccess(false)}
            className={`w-full py-4 rounded-2xl text-[10px] font-black tracking-widest transition-all uppercase shadow-lg ${
              theme === "DARK" ? "bg-[#ccff00] text-stone-950" : "bg-black text-white"
            }`}
          >
            Done
          </button>
        }
      >
        <div className="space-y-8 text-center py-4">
          <div className={`w-20 h-20 rounded-3xl flex items-center justify-center mx-auto ${
            theme === "DARK" ? "bg-[#ccff00]/10 text-[#ccff00]" : "bg-green-50 text-green-600"
          }`}>
            <span className="material-symbols-outlined text-4xl">mark_email_read</span>
          </div>
          
          <div className="space-y-2">
            <h4 className={`text-xl font-black transition-colors ${theme === "DARK" ? "text-white" : "text-black"}`}>Success!</h4>
            <p className={`text-sm font-medium transition-colors ${theme === "DARK" ? "text-stone-400" : "text-stone-500"}`}>
              The user has been created in both the platform and authentication records.
            </p>
          </div>

          <div className={`p-6 rounded-2xl border text-left space-y-4 ${
            theme === "DARK" ? "bg-stone-900 border-stone-800" : "bg-stone-50 border-stone-100"
          }`}>
            <div className={`text-[10px] font-black uppercase tracking-widest ${theme === "DARK" ? "text-stone-500" : "text-stone-400"}`}>
              Direct Password Setup Link
            </div>
            <div className={`p-4 rounded-xl font-mono text-[10px] break-all border transition-colors ${
              theme === "DARK" ? "bg-stone-950 border-stone-800 text-[#ccff00]" : "bg-white border-stone-200 text-blue-600"
            }`}>
              {invitationLink}
            </div>
            <button 
              onClick={() => {
                navigator.clipboard.writeText(invitationLink);
                showAppMessage("Link copied to clipboard!", "SUCCESS");
              }}
              className={`w-full py-2 rounded-lg text-[8px] font-black tracking-widest uppercase transition-all ${
                theme === "DARK" ? "bg-stone-800 text-white hover:bg-stone-700" : "bg-white border text-stone-600 hover:bg-stone-50"
              }`}
            >
              Copy Link
            </button>
          </div>
        </div>
      </Modal>

      {/* Existing modals below... */}
      <Modal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setEditingUser(null);
        }}
        title="Edit User Profile"
        theme={theme}
        width={600}
        footer={
          <div className="flex gap-4">
            <button 
              onClick={() => {
                setShowEditModal(false);
                setEditingUser(null);
              }}
              disabled={isSaving}
              className={`flex-1 py-4 border rounded-2xl text-[10px] font-black tracking-widest transition-all uppercase ${
                theme === "DARK" ? "border-stone-800 text-stone-400 hover:bg-stone-900" : 
                "bg-white border-stone-200 text-stone-900 hover:bg-stone-50 shadow-sm"
              } ${isSaving ? "opacity-30 cursor-not-allowed" : ""}`}
            >
              Cancel
            </button>
            <button 
              onClick={handleSaveUser}
              disabled={isSaving}
              className={`flex-1 py-4 rounded-2xl text-[10px] font-black tracking-widest transition-all uppercase shadow-lg flex items-center justify-center gap-3 ${
                theme === "DARK" ? "bg-[#ccff00] text-stone-950 shadow-[#ccff00]/20" : 
                "bg-[#6348eb] text-white shadow-[#6348eb]/20"
              } ${isSaving ? "opacity-70 cursor-not-allowed" : "hover:opacity-90"}`}
            >
              {isSaving ? (
                <>
                  <div className={`h-3 w-3 animate-spin rounded-full border-2 border-t-transparent ${
                    theme === "DARK" ? "border-stone-950" : "border-white"
                  }`}></div>
                  Processing...
                </>
              ) : "Save Changes"}
            </button>
          </div>
        }
      >
        <div className="space-y-6">
          <div>
            <label className={`text-[10px] font-black tracking-widest uppercase mb-3 block ${theme === "DARK" ? "text-stone-500" : "text-stone-400"}`}>User ID</label>
            <div className={`w-full border rounded-2xl px-6 py-4 text-sm font-bold transition-colors ${
              theme === "DARK" ? "bg-stone-900 text-stone-400 border-stone-800" : "bg-stone-50 text-stone-500 border-stone-100"
            }`}>
              {formData.user_id}
            </div>
          </div>

          <div>
            <label className={`text-[10px] font-black tracking-widest uppercase mb-3 block ${theme === "DARK" ? "text-stone-500" : "text-stone-400"}`}>Auth UID (Firebase)</label>
            <div className={`w-full border rounded-2xl px-6 py-4 text-sm font-bold transition-colors break-all ${
              theme === "DARK" ? "bg-stone-900 text-stone-500 border-stone-800" : "bg-stone-50 text-stone-400 border-stone-100"
            }`}>
              {formData.auth_uid || "No UID Linked"}
            </div>
          </div>

          <div>
            <label className={`text-[10px] font-black tracking-widest uppercase mb-3 block ${theme === "DARK" ? "text-stone-500" : "text-stone-400"}`}>Tenant ID</label>
            <input 
              value={formData.tenant_id}
              onChange={e => setFormData({ ...formData, tenant_id: e.target.value })}
              readOnly={!!editingUser}
              placeholder="e.g. T10001"
              className={`w-full border rounded-2xl px-6 py-4 text-sm font-bold outline-none transition-colors ${
                theme === "DARK" 
                  ? (editingUser ? "bg-stone-900 text-stone-500 border-stone-800" : "bg-stone-950 text-white border-stone-800 focus:border-[#ccff00]") 
                  : (editingUser ? "bg-stone-50 text-stone-400 border-stone-100" : "bg-white text-stone-900 border-stone-200 focus:border-stone-400 shadow-sm")
              }`}
            />
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className={`text-[10px] font-black tracking-widest uppercase mb-3 block ${theme === "DARK" ? "text-stone-500" : "text-stone-400"}`}>First Name</label>
              <input 
                value={formData.first_name}
                onChange={e => setFormData({ ...formData, first_name: e.target.value })}
                className={`w-full border rounded-2xl px-6 py-4 text-sm font-bold outline-none transition-colors ${
                  theme === "DARK" ? "bg-stone-950 text-white border-stone-800 focus:border-[#ccff00]" : "bg-white text-stone-900 border-stone-200 focus:border-stone-400"
                }`}
              />
            </div>
            <div>
              <label className={`text-[10px] font-black tracking-widest uppercase mb-3 block ${theme === "DARK" ? "text-stone-500" : "text-stone-400"}`}>Last Name</label>
              <input 
                value={formData.last_name}
                onChange={e => setFormData({ ...formData, last_name: e.target.value })}
                className={`w-full border rounded-2xl px-6 py-4 text-sm font-bold outline-none transition-colors ${
                  theme === "DARK" ? "bg-stone-950 text-white border-stone-800 focus:border-[#ccff00]" : "bg-white text-stone-900 border-stone-200 focus:border-stone-400"
                }`}
              />
            </div>
          </div>

          <div>
            <label className={`text-[10px] font-black tracking-widest uppercase mb-3 block ${theme === "DARK" ? "text-stone-500" : "text-stone-400"}`}>Email</label>
            <input 
              value={formData.email}
              onChange={e => setFormData({ ...formData, email: e.target.value })}
              className={`w-full border rounded-2xl px-6 py-4 text-sm font-bold outline-none transition-colors ${
                theme === "DARK" ? "bg-stone-950 text-white border-stone-800 focus:border-[#ccff00]" : "bg-white text-stone-900 border-stone-200 focus:border-stone-400"
              }`}
            />
          </div>

          <div>
            <label className={`text-[10px] font-black tracking-widest uppercase mb-3 block ${theme === "DARK" ? "text-stone-500" : "text-stone-400"}`}>Role</label>
            <select 
              value={formData.role}
              onChange={e => setFormData({ ...formData, role: e.target.value })}
              className={`w-full border rounded-2xl px-6 py-4 text-sm font-bold outline-none transition-colors appearance-none cursor-pointer ${
                theme === "DARK" ? "bg-stone-950 text-white border-stone-800 focus:border-[#ccff00]" : "bg-white text-stone-900 border-stone-200 focus:border-stone-400"
              }`}
            >
              <option value="">Select Role...</option>
              {roles.map(r => (
                <option key={r.id} value={r.role_id || r.id}>
                  {r.role_id} - {r.role_name} {r.is_global ? "[GLOBAL]" : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={`text-[10px] font-black tracking-widest uppercase mb-3 block ${theme === "DARK" ? "text-stone-500" : "text-stone-400"}`}>Status</label>
            <select 
              value={formData.status}
              onChange={e => setFormData({ ...formData, status: e.target.value })}
              className={`w-full border rounded-2xl px-6 py-4 text-sm font-bold outline-none transition-colors appearance-none cursor-pointer ${
                theme === "DARK" ? "bg-stone-950 text-white border-stone-800 focus:border-[#ccff00]" : "bg-white text-stone-900 border-stone-200 focus:border-stone-400"
              }`}
            >
              {userStatuses.length === 0 ? (
                <option value="" disabled className="text-red-500 italic">Error: USERSTATUS dimension missing</option>
              ) : (
                <>
                  <option value="">Select status...</option>
                  {userStatuses.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </>
              )}
            </select>
          </div>

          <div>
            <label className={`text-[10px] font-black tracking-widest uppercase mb-3 block ${theme === "DARK" ? "text-stone-500" : "text-stone-400"}`}>Phone</label>
            <input 
              value={formData.phone}
              onChange={e => setFormData({ ...formData, phone: e.target.value })}
              placeholder="e.g. 123-456-7890"
              className={`w-full border rounded-2xl px-6 py-4 text-sm font-bold outline-none transition-colors ${
                theme === "DARK" ? "bg-stone-950 text-white border-stone-800 focus:border-[#ccff00]" : "bg-white text-stone-900 border-stone-200 focus:border-stone-400"
              }`}
            />
          </div>

          <div className={`pt-4 pb-2 border-b transition-colors ${
            theme === "DARK" ? "border-stone-800" : "border-stone-100"
          }`}>
            <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${
              theme === "DARK" ? "text-stone-500" : "text-stone-400"
            }`}>Mailing Address</span>
          </div>

          <div>
            <label className={`text-[10px] font-black tracking-widest uppercase mb-3 block ${theme === "DARK" ? "text-stone-500" : "text-stone-400"}`}>Street Address 1</label>
            <input 
              value={formData.address_street_1}
              onChange={e => setFormData({ ...formData, address_street_1: e.target.value })}
              placeholder="123 Main St"
              className={`w-full border rounded-2xl px-6 py-4 text-sm font-bold outline-none transition-colors ${
                theme === "DARK" ? "bg-stone-950 text-white border-stone-800 focus:border-[#ccff00]" : "bg-white text-stone-900 border-stone-200 focus:border-stone-400"
              }`}
            />
          </div>

          <div>
            <label className={`text-[10px] font-black tracking-widest uppercase mb-3 block ${theme === "DARK" ? "text-stone-500" : "text-stone-400"}`}>Street Address 2</label>
            <input 
              value={formData.address_street_2}
              onChange={e => setFormData({ ...formData, address_street_2: e.target.value })}
              placeholder="Apt 4B"
              className={`w-full border rounded-2xl px-6 py-4 text-sm font-bold outline-none transition-colors ${
                theme === "DARK" ? "bg-stone-950 text-white border-stone-800 focus:border-[#ccff00]" : "bg-white text-stone-900 border-stone-200 focus:border-stone-400"
              }`}
            />
          </div>

          <div className="grid grid-cols-3 gap-6">
            <div>
              <label className={`text-[10px] font-black tracking-widest uppercase mb-3 block ${theme === "DARK" ? "text-stone-500" : "text-stone-400"}`}>City</label>
              <input 
                value={formData.address_city}
                onChange={e => setFormData({ ...formData, address_city: e.target.value })}
                placeholder="New York"
                className={`w-full border rounded-2xl px-6 py-4 text-sm font-bold outline-none transition-colors ${
                  theme === "DARK" ? "bg-stone-950 text-white border-stone-800 focus:border-[#ccff00]" : "bg-white text-stone-900 border-stone-200 focus:border-stone-400"
                }`}
              />
            </div>
            <div>
              <label className={`text-[10px] font-black tracking-widest uppercase mb-3 block ${theme === "DARK" ? "text-stone-500" : "text-stone-400"}`}>State</label>
              <select 
                value={formData.address_state}
                onChange={e => setFormData({ ...formData, address_state: e.target.value })}
                className={`w-full border rounded-2xl px-6 py-4 text-sm font-bold outline-none transition-colors appearance-none cursor-pointer ${
                  theme === "DARK" ? "bg-stone-950 text-white border-stone-800 focus:border-[#ccff00]" : "bg-white text-stone-900 border-stone-200 focus:border-stone-400"
                }`}
              >
                <option value="">Select State...</option>
                {US_STATES.map(state => (
                  <option key={state} value={state}>{state}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={`text-[10px] font-black tracking-widest uppercase mb-3 block ${theme === "DARK" ? "text-stone-500" : "text-stone-400"}`}>Zip</label>
              <input 
                value={formData.address_zip}
                onChange={e => setFormData({ ...formData, address_zip: e.target.value })}
                placeholder="10001"
                className={`w-full border rounded-2xl px-6 py-4 text-sm font-bold outline-none transition-colors ${
                  theme === "DARK" ? "bg-stone-950 text-white border-stone-800 focus:border-[#ccff00]" : "bg-white text-stone-900 border-stone-200 focus:border-stone-400"
                }`}
              />
            </div>
          </div>

          <div>
            <label className={`text-[10px] font-black tracking-widest uppercase mb-3 block ${theme === "DARK" ? "text-stone-500" : "text-stone-400"}`}>Internal Notes</label>
            <textarea 
              value={formData.notes}
              onChange={e => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Private notes..."
              rows={4}
              className={`w-full border rounded-2xl px-6 py-4 text-sm font-bold outline-none transition-colors resize-none ${
                theme === "DARK" ? "bg-stone-950 text-white border-stone-800 focus:border-[#ccff00]" : "bg-white text-stone-900 border-stone-200 focus:border-stone-400"
              }`}
            />
          </div>
        </div>
      </Modal>

      {/* Create User Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          resetForm();
        }}
        title="Create New User"
        theme={theme}
        width={600}
        footer={
          <div className="flex gap-4">
            <button 
              onClick={() => {
                setShowCreateModal(false);
                resetForm();
              }}
              disabled={isSaving}
              className={`flex-1 py-4 border rounded-2xl text-[10px] font-black tracking-widest transition-all uppercase ${
                theme === "DARK" ? "border-stone-800 text-stone-400 hover:bg-stone-900" : 
                "bg-white border-stone-200 text-stone-900 hover:bg-stone-50 shadow-sm"
              } ${isSaving ? "opacity-30 cursor-not-allowed" : ""}`}
            >
              Cancel
            </button>
            <button 
              onClick={handleCreateUser}
              disabled={isSaving}
              className={`flex-1 py-4 rounded-2xl text-[10px] font-black tracking-widest transition-all uppercase shadow-lg flex items-center justify-center gap-3 ${
                theme === "DARK" ? "bg-[#ccff00] text-stone-950 shadow-[#ccff00]/20" : 
                "bg-[#6348eb] text-white shadow-[#6348eb]/20"
              } ${isSaving ? "opacity-70 cursor-not-allowed" : "hover:opacity-90"}`}
            >
              {isSaving ? (
                <>
                  <div className={`h-3 w-3 animate-spin rounded-full border-2 border-t-transparent ${
                    theme === "DARK" ? "border-stone-950" : "border-white"
                  }`}></div>
                  Processing...
                </>
              ) : "Create User"}
            </button>
          </div>
        }
      >
        <div className="space-y-6">
          <p className={`text-sm leading-relaxed ${theme === "DARK" ? "text-stone-400" : "text-stone-500"}`}>
            This will create a user in your organization responsible for monitoring operations and managing users associated with your business processes.
          </p>

          <div>
            <label className={`text-[10px] font-black tracking-widest uppercase mb-3 block ${theme === "DARK" ? "text-stone-500" : "text-stone-400"}`}>Upcoming User ID</label>
            <div className={`w-full border rounded-2xl px-6 py-4 text-sm font-bold transition-colors ${
              theme === "DARK" ? "bg-stone-900 text-stone-400 border-stone-800" : "bg-stone-50 text-stone-500 border-stone-100"
            }`}>
              {nextUserId}
            </div>
          </div>

          <div>
            <label className={`text-[10px] font-black tracking-widest uppercase mb-3 block ${theme === "DARK" ? "text-stone-500" : "text-stone-400"}`}>Tenant ID</label>
            <input 
              value={formData.tenant_id}
              onChange={e => setFormData({ ...formData, tenant_id: e.target.value })}
              placeholder="e.g. T10001"
              className={`w-full border rounded-2xl px-6 py-4 text-sm font-bold outline-none transition-colors ${
                theme === "DARK" ? "bg-stone-950 text-white border-stone-800 focus:border-[#ccff00]" : "bg-white text-stone-900 border-stone-200 focus:border-stone-400 shadow-sm"
              }`}
            />
          </div>

          <div>
            <label className={`text-[10px] font-black tracking-widest uppercase mb-3 block ${theme === "DARK" ? "text-stone-500" : "text-stone-400"}`}>Email Address</label>
            <input 
              value={formData.email}
              onChange={e => setFormData({ ...formData, email: e.target.value })}
              placeholder="user@company.com"
              className={`w-full border rounded-2xl px-6 py-4 text-sm font-bold outline-none transition-colors ${
                theme === "DARK" ? "bg-stone-950 text-white border-stone-800 focus:border-[#ccff00]" : "bg-white text-stone-900 border-stone-200 focus:border-stone-400 shadow-sm"
              }`}
            />
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className={`text-[10px] font-black tracking-widest uppercase mb-3 block ${theme === "DARK" ? "text-stone-500" : "text-stone-400"}`}>First Name (Optional)</label>
              <input 
                value={formData.first_name}
                onChange={e => setFormData({ ...formData, first_name: e.target.value })}
                placeholder="Jane"
                className={`w-full border rounded-2xl px-6 py-4 text-sm font-bold outline-none transition-colors ${
                  theme === "DARK" ? "bg-stone-950 text-white border-stone-800 focus:border-[#ccff00]" : "bg-white text-stone-900 border-stone-200 focus:border-stone-400 shadow-sm"
                }`}
              />
            </div>
            <div>
              <label className={`text-[10px] font-black tracking-widest uppercase mb-3 block ${theme === "DARK" ? "text-stone-500" : "text-stone-400"}`}>Last Name (Optional)</label>
              <input 
                value={formData.last_name}
                onChange={e => setFormData({ ...formData, last_name: e.target.value })}
                placeholder="Doe"
                className={`w-full border rounded-2xl px-6 py-4 text-sm font-bold outline-none transition-colors ${
                  theme === "DARK" ? "bg-stone-950 text-white border-stone-800 focus:border-[#ccff00]" : "bg-white text-stone-900 border-stone-200 focus:border-stone-400 shadow-sm"
                }`}
              />
            </div>
          </div>

          <div>
            <label className={`text-[10px] font-black tracking-widest uppercase mb-3 block ${theme === "DARK" ? "text-stone-500" : "text-stone-400"}`}>Phone (Optional)</label>
            <input 
              value={formData.phone}
              onChange={e => setFormData({ ...formData, phone: e.target.value })}
              placeholder="+1 555 000 0000"
              className={`w-full border rounded-2xl px-6 py-4 text-sm font-bold outline-none transition-colors ${
                theme === "DARK" ? "bg-stone-950 text-white border-stone-800 focus:border-[#ccff00]" : "bg-white text-stone-900 border-stone-200 focus:border-stone-400 shadow-sm"
              }`}
            />
          </div>

          <div className={`pt-4 pb-2 border-b transition-colors ${
            theme === "DARK" ? "border-stone-800" : "border-stone-100"
          }`}>
            <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${
              theme === "DARK" ? "text-stone-500" : "text-stone-400"
            }`}>Mailing Address</span>
          </div>

          <div>
            <label className={`text-[10px] font-black tracking-widest uppercase mb-3 block ${theme === "DARK" ? "text-stone-500" : "text-stone-400"}`}>Street Address 1</label>
            <input 
              value={formData.address_street_1}
              onChange={e => setFormData({ ...formData, address_street_1: e.target.value })}
              placeholder="123 Main St"
              className={`w-full border rounded-2xl px-6 py-4 text-sm font-bold outline-none transition-colors ${
                theme === "DARK" ? "bg-stone-950 text-white border-stone-800 focus:border-[#ccff00]" : "bg-white text-stone-900 border-stone-200 focus:border-stone-400 shadow-sm"
              }`}
            />
          </div>

          <div>
            <label className={`text-[10px] font-black tracking-widest uppercase mb-3 block ${theme === "DARK" ? "text-stone-500" : "text-stone-400"}`}>Street Address 2</label>
            <input 
              value={formData.address_street_2}
              onChange={e => setFormData({ ...formData, address_street_2: e.target.value })}
              placeholder="Apt 4B"
              className={`w-full border rounded-2xl px-6 py-4 text-sm font-bold outline-none transition-colors ${
                theme === "DARK" ? "bg-stone-950 text-white border-stone-800 focus:border-[#ccff00]" : "bg-white text-stone-900 border-stone-200 focus:border-stone-400 shadow-sm"
              }`}
            />
          </div>

          <div className="grid grid-cols-3 gap-6">
            <div>
              <label className={`text-[10px] font-black tracking-widest uppercase mb-3 block ${theme === "DARK" ? "text-stone-500" : "text-stone-400"}`}>City</label>
              <input 
                value={formData.address_city}
                onChange={e => setFormData({ ...formData, address_city: e.target.value })}
                placeholder="New York"
                className={`w-full border rounded-2xl px-6 py-4 text-sm font-bold outline-none transition-colors ${
                  theme === "DARK" ? "bg-stone-950 text-white border-stone-800 focus:border-[#ccff00]" : "bg-white text-stone-900 border-stone-200 focus:border-stone-400 shadow-sm"
                }`}
              />
            </div>
            <div>
              <label className={`text-[10px] font-black tracking-widest uppercase mb-3 block ${theme === "DARK" ? "text-stone-500" : "text-stone-400"}`}>State</label>
              <select 
                value={formData.address_state}
                onChange={e => setFormData({ ...formData, address_state: e.target.value })}
                className={`w-full border rounded-2xl px-6 py-4 text-sm font-bold outline-none transition-colors appearance-none cursor-pointer ${
                  theme === "DARK" ? "bg-stone-950 text-white border-stone-800 focus:border-[#ccff00]" : "bg-white text-stone-900 border-stone-200 focus:border-stone-400 shadow-sm"
                }`}
              >
                <option value="">Select State...</option>
                {US_STATES.map(state => (
                  <option key={state} value={state}>{state}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={`text-[10px] font-black tracking-widest uppercase mb-3 block ${theme === "DARK" ? "text-stone-500" : "text-stone-400"}`}>Zip</label>
              <input 
                value={formData.address_zip}
                onChange={e => setFormData({ ...formData, address_zip: e.target.value })}
                placeholder="10001"
                className={`w-full border rounded-2xl px-6 py-4 text-sm font-bold outline-none transition-colors ${
                  theme === "DARK" ? "bg-stone-950 text-white border-stone-800 focus:border-[#ccff00]" : "bg-white text-stone-900 border-stone-200 focus:border-stone-400 shadow-sm"
                }`}
              />
            </div>
          </div>

          <div>
            <label className={`text-[10px] font-black tracking-widest uppercase mb-3 block ${theme === "DARK" ? "text-stone-500" : "text-stone-400"}`}>Role</label>
            <select 
              value={formData.role}
              onChange={e => setFormData({ ...formData, role: e.target.value })}
              className={`w-full border rounded-2xl px-6 py-4 text-sm font-bold outline-none transition-colors appearance-none cursor-pointer ${
                theme === "DARK" ? "bg-stone-950 text-white border-stone-800 focus:border-[#ccff00]" : "bg-white text-stone-900 border-stone-200 focus:border-stone-400 shadow-sm"
              }`}
            >
              <option value="">Select a role...</option>
              {roles.map(r => (
                <option key={r.id} value={r.role_id || r.id}>
                  {r.role_id} - {r.role_name} {r.is_global ? "[GLOBAL]" : ""}
                </option>
              ))}
            </select>
          </div>

          <label className="flex items-center gap-4 cursor-pointer group">
            <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${
              formData.invite_user 
                ? "bg-[#6348eb] border-[#6348eb]" 
                : (theme === "DARK" ? "border-stone-800" : "border-stone-200 shadow-sm")
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

          <div>
            <label className={`text-[10px] font-black tracking-widest uppercase mb-3 block ${theme === "DARK" ? "text-stone-500" : "text-stone-400"}`}>Internal Notes</label>
            <textarea 
              value={formData.notes}
              onChange={e => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Private notes about this user..."
              rows={4}
              className={`w-full border rounded-2xl px-6 py-4 text-sm font-bold outline-none transition-colors resize-none ${
                theme === "DARK" ? "bg-stone-950 text-white border-stone-800 focus:border-[#ccff00]" : "bg-white text-stone-900 border-stone-200 focus:border-stone-400 shadow-sm"
              }`}
            />
          </div>
        </div>
      </Modal>

      {/* App Notification Toast */}
      {notification && (
        <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[9999] animate-in fade-in slide-in-from-top-4 duration-300">
          <div className={`px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-4 border ${
            notification.type === "SUCCESS" 
              ? (theme === "DARK" ? "bg-[#ccff00] text-stone-950 border-[#ccff00]" : "bg-green-600 text-white border-green-500")
              : notification.type === "ERROR"
              ? "bg-red-600 text-white border-red-500"
              : (theme === "DARK" ? "bg-stone-800 text-white border-stone-700" : "bg-white text-stone-900 border-stone-200")
          }`}>
            <span className="material-symbols-outlined text-xl">
              {notification.type === "SUCCESS" ? "check_circle" : notification.type === "ERROR" ? "error" : "info"}
            </span>
            <span className="text-sm font-bold tracking-tight">{notification.message}</span>
            <button onClick={() => setNotification(null)} className="ml-2 hover:opacity-70">
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
