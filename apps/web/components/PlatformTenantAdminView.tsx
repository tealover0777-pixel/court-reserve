"use client";
import React, { useState, useRef, useEffect, useMemo } from "react";
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
  address_street_1?: string;
  address_street_2?: string;
  address_city?: string;
  address_state?: string;
  address_zip?: string;
  notes?: string;
  Notes?: string; // Support legacy capitalized field
}



const US_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY"
];

export default function PlatformTenantAdminView({ theme = "LIGHT" }: { theme?: "LIGHT" | "DARK" | "VINTAGE" }) {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const initialFormData = {
    tenant_id: "",
    tenant_name: "",
    owner_id: "",
    owner_email: "",
    owner_first_name: "",
    owner_last_name: "",
    owner_phone: "",
    owner_role: "Owner",
    invite_user: true,
    notes: "",
    address_street_1: "",
    address_street_2: "",
    address_city: "",
    address_state: "",
    address_zip: ""
  };
  const [formData, setFormData] = useState(initialFormData);
  const [editingTenantId, setEditingTenantId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isInviting, setIsInviting] = useState(false);
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
  const [tenantUsers, setTenantUsers] = useState<any[]>([]);
  const [showInviteSuccess, setShowInviteSuccess] = useState(false);
  const [invitationLink, setInvitationLink] = useState("");

  useEffect(() => {
    const q = query(collection(db, "tenants"));
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

    return () => {
      unsubscribe();
    };
  }, []);

  const tenantDocIdForModal = editingTenantId || formData.tenant_id;

  useEffect(() => {
    const tid = tenantDocIdForModal;
    if (!showNewModal || !tid) {
      setTenantUsers([]);
      return;
    }
    const unsub = onSnapshot(
      collection(db, "tenants", tid, "users"),
      (snapshot) => {
        setTenantUsers(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
      },
      (err) => console.error("Error fetching tenant users:", err)
    );
    return () => unsub();
  }, [showNewModal, tenantDocIdForModal]);

  const nextTenantId = (() => {
    if (tenants.length === 0) return "T10001";
    const maxNum = Math.max(...tenants.map(p => {
      const tid = p.tenant_id || p.id;
      const m = String(tid).match(/^T(\d+)$/);
      return m ? Number(m[1]) : 0;
    }));
    const baseNum = Math.max(10000, maxNum);
    return "T" + (baseNum + 1);
  })();

  const nextOwnerId = useMemo(() => {
    // Collect all owner IDs from all tenants to ensure platform-wide uniqueness
    const allOwnerIds = tenants.map(t => t.owner_id).filter(Boolean);
    // Also include any users fetched for the current tenant's context
    const userIds = tenantUsers.map((u) => u.user_id).filter(Boolean);
    
    const combinedIds = Array.from(new Set([...allOwnerIds, ...userIds]));
    
    if (combinedIds.length === 0) return "U10001";
    const ids = combinedIds.map((id) => {
      const match = String(id || "").match(/^U(\d+)$/);
      return match?.[1] ? parseInt(match[1], 10) : 0;
    });
    const max = ids.length ? Math.max(...ids) : 0;
    return `U${Math.max(10001, max + 1)}`;
  }, [tenants, tenantUsers]);

  useEffect(() => {
    if (showNewModal) {
      // If we are editing an existing tenant, do NOT auto-change the owner_id 
      // unless the email address has changed and matches an existing user.
      if (editingTenantId && formData.owner_id && !tenantUsers.some(u => u.email?.toLowerCase() === formData.owner_email?.toLowerCase())) {
        // Keep the existing owner_id if we are editing and no email match is found
        return;
      }

      const existingUser = tenantUsers.find(
        (u) => u.email?.toLowerCase() === formData.owner_email?.toLowerCase()
      );

      if (existingUser) {
        // If the email matches an existing user in this tenant, use their ID
        setFormData((prev) => (prev.owner_id !== existingUser.user_id ? { ...prev, owner_id: existingUser.user_id } : prev));
      } else if (!formData.owner_id || !editingTenantId) {
        // Only auto-generate if it's a new tenant or the field is empty
        setFormData((prev) => (prev.owner_id !== nextOwnerId ? { ...prev, owner_id: nextOwnerId } : prev));
      }
    }
  }, [formData.owner_email, tenantUsers, showNewModal, nextOwnerId, editingTenantId]);

  useEffect(() => {
    if (showNewModal && !editingTenantId) {
      setFormData(prev => ({ ...prev, tenant_id: nextTenantId }));
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
      showAppMessage("Failed to delete tenant.", "ERROR");
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
      invite_user: !tenant.owner_id,
      notes: tenant.notes || tenant.Notes || "",
      address_street_1: tenant.address_street_1 || "",
      address_street_2: tenant.address_street_2 || "",
      address_city: tenant.address_city || "",
      address_state: tenant.address_state || "",
      address_zip: tenant.address_zip || ""
    });
    setShowNewModal(true);
  };

  const resetForm = () => {
    setEditingTenantId(null);
    setFormData({
      ...initialFormData,
      owner_id: "" // Will be populated by nextOwnerId useEffect
    });
  };

  const handleSave = async () => {
    const tenantDocId = editingTenantId || formData.tenant_id;
    try {
      if (!formData.tenant_name || !formData.owner_email || !formData.tenant_id) {
        showAppMessage("Please fill in the tenant name, owner email, and ensure a tenant ID is generated.", "ERROR");
        return;
      }

      setIsSaving(true);

      // 1. Prepare Invitation Logic
      // Logic: Invite if explicitly checked OR if this is a brand new owner record
      const ownerExists = tenantUsers.some((u) => u.user_id === formData.owner_id);
      const shouldInvite = formData.invite_user || !ownerExists;

      // 2. Invite Owner FIRST (if needed)
      // This prevents "ghost tenants" if the email check or invitation fails
      if (shouldInvite) {
        const inviteUserFn = httpsCallable(functions, "inviteUser");
        const result: any = await inviteUserFn({
          email: formData.owner_email,
          role: "R10005",
          tenantId: tenantDocId,
          tenant_id: formData.tenant_id,
          user_id: formData.owner_id,
          first_name: formData.owner_first_name,
          last_name: formData.owner_last_name,
          phone: formData.owner_phone,
          notes: formData.notes,
          inviteUser: formData.invite_user,
          useTenantUserDoc: true,
        });

        if (result.data?.invitationLink) {
          setInvitationLink(result.data.invitationLink);
          setShowInviteSuccess(true);
        }
      }

      // 3. Create/Update Tenant in Firestore ONLY AFTER successful invitation/check
      const tenantUpdateData = {
        tenant_id: formData.tenant_id,
        name: formData.tenant_name,
        domain: `${formData.tenant_name.toLowerCase().replace(/\s+/g, '-')}.kinetic.com`,
        status: "Active",
        created_at: editingTenantId ? (tenants.find(t => t.id === editingTenantId) as any).created_at : new Date().toISOString().split('T')[0],
        notes: formData.notes,
        owner_id: formData.owner_id,
        owner_email: formData.owner_email,
        owner_first_name: formData.owner_first_name,
        owner_last_name: formData.owner_last_name,
        owner_phone: formData.owner_phone,
        address_street_1: formData.address_street_1,
        address_street_2: formData.address_street_2,
        address_city: formData.address_city,
        address_state: formData.address_state,
        address_zip: formData.address_zip
      };

      // Filter out undefined values
      const cleanTenantData = Object.fromEntries(
        Object.entries(tenantUpdateData).filter(([_, v]) => v !== undefined)
      );

      await setDoc(doc(db, "tenants", tenantDocId), cleanTenantData);

      // 4. ADD OWNER TO TENANT'S USERS COLLECTION (New requirement)
      // This ensures the owner user is stored under the tenant, not global_users
      const ownerUserDocData = {
        user_id: formData.owner_id,
        email: formData.owner_email,
        first_name: formData.owner_first_name,
        last_name: formData.owner_last_name,
        phone: formData.owner_phone,
        role: "R10005", // Owner role ID
        status: "Invited",
        tenant_id: formData.tenant_id,
        notes: formData.notes,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const ownerUserRef = doc(db, "tenants", tenantDocId, "users", formData.owner_id);
      await setDoc(ownerUserRef, ownerUserDocData, { merge: true });

      // 5. Cleanup legacy global user records if they exist to maintain tenant scoping
      // We only do this if we successfully saved the tenant-scoped record
      try {
        const legacyRef = doc(db, "global_users", formData.owner_id);
        const compositeRef = doc(db, "global_users", `${tenantDocId}_${formData.owner_id}`);
        await Promise.all([
          deleteDoc(legacyRef).catch(() => { }),
          deleteDoc(compositeRef).catch(() => { })
        ]);
      } catch (e) {
        console.warn("Cleanup of legacy global records skipped or failed:", e);
      }

      setShowNewModal(false);
      setEditingTenantId(null);
      setFormData(initialFormData);
    } catch (err) {
      console.error("Failed to save tenant:", err);
      showAppMessage("Failed to save tenant: " + (err instanceof Error ? err.message : "Unknown error"), "ERROR");
    } finally {
      setIsSaving(false);
    }
  };

  const handleInviteOwner = async (tenant: Tenant) => {
    if (!tenant.owner_email) {
      showAppMessage("Owner email is missing.", "ERROR");
      return;
    }
    setIsInviting(true);
    try {
      // 1. Explicitly ensure the owner is in the tenant's users collection (Requirement)
      if (tenant.owner_id) {
        const ownerUserDocData = {
          user_id: tenant.owner_id,
          email: tenant.owner_email,
          first_name: tenant.owner_first_name || "",
          last_name: tenant.owner_last_name || "",
          phone: tenant.owner_phone || "",
          role: "R10005",
          status: "Invited",
          tenant_id: tenant.tenant_id,
          updated_at: new Date().toISOString()
        };
        const ownerUserRef = doc(db, "tenants", tenant.id, "users", tenant.owner_id);
        await setDoc(ownerUserRef, ownerUserDocData, { merge: true });

        // 2. Cleanup legacy global records if any
        try {
          const legacyRef = doc(db, "global_users", tenant.owner_id);
          const compositeRef = doc(db, "global_users", `${tenant.id}_${tenant.owner_id}`);
          await Promise.all([
            deleteDoc(legacyRef).catch(() => { }),
            deleteDoc(compositeRef).catch(() => { })
          ]);
        } catch (e) {
          // Non-fatal
        }
      }

      // 3. Call invitation function
      const inviteUserFn = httpsCallable(functions, "inviteUser");
      const result: any = await inviteUserFn({
        email: tenant.owner_email,
        role: "R10005",
        tenantId: tenant.id,
        tenant_id: tenant.tenant_id,
        user_id: tenant.owner_id,
        first_name: tenant.owner_first_name,
        last_name: tenant.owner_last_name,
        phone: tenant.owner_phone,
        notes: tenant.notes || tenant.Notes || "",
        inviteUser: true,
        useTenantUserDoc: true,
      });

      if (result.data?.invitationLink) {
        setInvitationLink(result.data.invitationLink);
        setShowInviteSuccess(true);
      } else {
        showAppMessage("Invitation sent successfully.", "SUCCESS");
      }
    } catch (err) {
      console.error("Invite error:", err);
      showAppMessage("Failed to send invitation: " + (err instanceof Error ? err.message : "Unknown error"), "ERROR");
    } finally {
      setIsInviting(false);
    }
  };

  const columnHelper = createColumnHelper<Tenant>();
  const columns = [
    columnHelper.accessor("tenant_id", {
      header: "TENANT ID",
      size: 120,
      cell: info => <span className={`font-mono text-xs transition-colors duration-500 ${theme === "DARK" ? "text-stone-400" :
          theme === "VINTAGE" ? "text-stone-500" :
            "text-stone-900"
        }`}>{info.getValue()}</span>,
    }),
    columnHelper.accessor("name", {
      header: "NAME",
      size: 200,
      cell: info => <span className={`text-sm font-bold transition-colors duration-500 ${theme === "DARK" ? "text-white" :
          theme === "VINTAGE" ? "text-black" :
            "text-stone-900"
        }`}>{info.getValue()}</span>,
    }),
    columnHelper.accessor("domain", {
      header: "DOMAIN",
      size: 250,
      cell: info => <span className={`text-sm transition-colors duration-500 ${theme === "DARK" ? "text-stone-400" :
          theme === "VINTAGE" ? "text-stone-600 font-medium" :
            "text-stone-600"
        }`}>{info.getValue()}</span>,
    }),
    columnHelper.accessor("owner_email", {
      header: "OWNER EMAIL",
      size: 200,
      cell: info => <span className={`text-xs font-bold transition-colors duration-500 ${theme === "DARK" ? "text-stone-400" :
          theme === "VINTAGE" ? "text-stone-500" :
            "text-stone-700"
        }`}>{info.getValue() || "-"}</span>,
    }),
    columnHelper.accessor("owner_first_name", {
      header: "FIRST NAME",
      size: 150,
      cell: info => <span className={`text-xs font-bold transition-colors duration-500 ${theme === "DARK" ? "text-stone-400" :
          theme === "VINTAGE" ? "text-stone-500" :
            "text-stone-700"
        }`}>{info.getValue() || "-"}</span>,
    }),
    columnHelper.accessor("owner_last_name", {
      header: "LAST NAME",
      size: 150,
      cell: info => <span className={`text-xs font-bold transition-colors duration-500 ${theme === "DARK" ? "text-stone-400" :
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
          <span className={`text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest border transition-colors ${theme === "VINTAGE"
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
    columnHelper.accessor(row => row.notes || row.Notes, {
      id: "notes",
      header: "NOTES",
      size: 200,
      cell: info => <span className={`text-xs transition-colors duration-500 truncate max-w-[200px] block ${theme === "DARK" ? "text-stone-400" :
          theme === "VINTAGE" ? "text-stone-500" :
            "text-stone-600"
        }`}>{info.getValue() || "-"}</span>,
    }),
    columnHelper.accessor("created_at", {
      header: "CREATED AT",
      size: 150,
      cell: info => <span className={`text-xs uppercase font-bold transition-colors duration-500 ${theme === "DARK" ? "text-stone-500" :
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
                  className={`fixed border rounded-xl shadow-xl py-2 w-32 z-50 animate-in fade-in zoom-in-95 duration-200 transition-colors ${theme === "DARK" ? "bg-stone-900 border-stone-800" :
                      theme === "VINTAGE" ? "bg-white border-stone-100 shadow-xl" :
                        "bg-white border-stone-100"
                    }`}>
                  <button
                    onClick={() => {
                      handleInviteOwner(props.row.original);
                      setShowMenu(false);
                    }}
                    disabled={isInviting || isSaving}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-[10px] font-black uppercase tracking-widest transition-colors border-b ${(isInviting || isSaving) ? "opacity-30 cursor-not-allowed" :
                        theme === "DARK" ? "text-[#ccff00] border-stone-800 hover:bg-stone-800" :
                          theme === "VINTAGE" ? "text-black border-stone-50 hover:bg-stone-50" :
                            "text-[#4f6b28] border-stone-50 hover:bg-stone-50"
                      }`}
                  >
                    <span className="material-symbols-outlined text-base">mail</span>
                    Invite
                  </button>
                  <button
                    onClick={() => {
                      handleEditTenant(props.row.original);
                      setShowMenu(false);
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-[10px] font-black uppercase tracking-widest transition-colors ${theme === "DARK" ? "text-stone-400 hover:bg-stone-800" :
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
        <div className={`h-8 w-8 animate-spin rounded-full border-4 border-t-transparent ${theme === "DARK" ? "border-[#ccff00]" :
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
          <h2 className={`text-5xl font-black italic tracking-tighter uppercase transition-colors duration-500 ${theme === "DARK" ? "text-[#ccff00]" :
              theme === "VINTAGE" ? "text-black" :
                "text-[#4f6b28]"
            }`} style={{ fontFamily: 'Lexend, sans-serif' }}>
            PLATFORM Tenant Admin
          </h2>
          <p className={`font-bold uppercase tracking-widest text-xs mt-2 transition-colors duration-500 ${theme === "DARK" ? "text-stone-400" :
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
              className={`w-full border rounded-full pl-12 pr-6 py-3 text-sm font-medium outline-none transition-all shadow-sm ${theme === "DARK"
                  ? "bg-stone-900 border-stone-800 text-white focus:border-[#ccff00]"
                  : theme === "VINTAGE"
                    ? "bg-white border-stone-100 text-black focus:border-stone-400 shadow-md"
                    : "bg-white border-stone-200 text-stone-900 focus:border-[#4f6b28]"
                }`}
              onChange={(e) => table.setGlobalFilter(e.target.value)}
            />
          </div>

          <button
            onClick={() => {
              resetForm();
              setShowNewModal(true);
            }}
            className={`px-8 py-3 rounded-full font-black text-xs tracking-widest transition-all uppercase shadow-lg flex items-center gap-2 ${theme === "DARK"
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

      {(isSaving || isInviting) && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-stone-950/20 backdrop-blur-sm animate-in fade-in duration-300">
          <div className={`p-8 rounded-3xl shadow-2xl flex flex-col items-center gap-4 transition-colors ${theme === "DARK" ? "bg-stone-900 border border-stone-800" : "bg-white border border-stone-100"
            }`}>
            <div className={`h-12 w-12 animate-spin rounded-full border-4 border-t-transparent ${theme === "DARK" ? "border-[#ccff00]" :
                theme === "VINTAGE" ? "border-black" :
                  "border-[#4f6b28]"
              }`}></div>
            <p className={`text-[10px] font-black uppercase tracking-[0.2em] animate-pulse ${theme === "DARK" ? "text-stone-400" : "text-stone-500"
              }`}>
              Processing request...
            </p>
          </div>
        </div>
      )}

      <div className={`border rounded-xl shadow-sm transition-colors duration-500 ${theme === "DARK" ? "bg-stone-950 border-stone-800" :
          theme === "VINTAGE" ? "bg-white border-transparent shadow-md" :
            "bg-white border-stone-200"
        }`}>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className={`sticky top-0 z-10 border-b transition-colors duration-500 ${theme === "DARK" ? "bg-stone-900 border-stone-800" :
                theme === "VINTAGE" ? "bg-white border-stone-100" :
                  "bg-stone-100 border-stone-900"
              }`}>
              {table.getHeaderGroups().map(headerGroup => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map(header => (
                    <th
                      key={header.id}
                      className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest relative border-r last:border-r-0 transition-colors duration-500 ${theme === "DARK" ? "text-[#ccff00] border-stone-800 bg-stone-900" :
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
                              className={`w-full border rounded-md px-3 py-1.5 text-xs font-medium outline-none transition-all ${theme === "DARK"
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
                  className={`border-b transition-colors group ${theme === "DARK"
                      ? (i % 2 !== 0 ? 'bg-stone-900/40 border-stone-800' : 'bg-stone-950 border-stone-800 hover:bg-stone-900/60')
                      : theme === "VINTAGE"
                        ? (i % 2 !== 0 ? 'bg-[#f7f9fb]/50 border-stone-100' : 'bg-white border-stone-100 hover:bg-[#f7f9fb]/80')
                        : (i % 2 !== 0 ? 'bg-stone-50/50 border-stone-900' : 'bg-white border-stone-900 hover:bg-stone-50')
                    }`}
                >
                  {row.getVisibleCells().map(cell => (
                    <td
                      key={cell.id}
                      className={`px-4 py-1.5 text-sm font-medium border-r last:border-r-0 transition-colors duration-500 ${theme === "DARK" ? "text-stone-300 border-stone-800" :
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
        <div className={`px-6 py-4 border-t flex items-center justify-between transition-colors ${theme === "DARK" ? "border-stone-800" :
            theme === "VINTAGE" ? "border-stone-100" :
              "border-stone-200"
          }`}>
          <div className={`text-[10px] font-black uppercase tracking-widest ${theme === "DARK" ? "text-stone-500" : "text-stone-400"
            }`}>
            Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className={`p-2 rounded-lg border transition-all ${!table.getCanPreviousPage()
                  ? "opacity-30 cursor-not-allowed"
                  : theme === "DARK" ? "hover:bg-stone-900 border-stone-800 text-[#ccff00]" : "hover:bg-stone-50 border-stone-100 text-black"
                }`}
            >
              <span className="material-symbols-outlined text-base">chevron_left</span>
            </button>
            <button
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className={`p-2 rounded-lg border transition-all ${!table.getCanNextPage()
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
              className={`flex-1 py-4 border-2 rounded-2xl text-[10px] font-black tracking-widest transition-all uppercase ${theme === "DARK" ? "border-stone-800 text-stone-400 hover:bg-stone-900" :
                  theme === "VINTAGE" ? "border-stone-100 text-black hover:bg-stone-50" :
                    "border-stone-100 text-stone-400 hover:bg-stone-50"
                }`}
            >
              Go Back
            </button>
            <button
              onClick={() => handleDeleteTenant()}
              className={`flex-1 py-4 rounded-2xl text-[10px] font-black tracking-widest transition-all uppercase shadow-lg ${theme === "VINTAGE" ? "bg-black text-white hover:bg-stone-900 shadow-black/20" : "bg-red-500 text-white hover:bg-red-600 shadow-red-500/20"
                }`}
            >
              Delete Now
            </button>
          </div>
        }
      >
        <div className={`w-20 h-20 rounded-3xl flex items-center justify-center mb-8 mx-auto ${theme === "VINTAGE" ? "bg-stone-50 text-black" : "bg-red-50 text-red-500"
          }`}>
          <span className="material-symbols-outlined text-4xl">delete_forever</span>
        </div>
        <p className={`text-center font-medium leading-relaxed transition-colors ${theme === "DARK" ? "text-stone-400" : "text-stone-500"
          }`}>
          Are you sure you want to remove this tenant from the platform? This will revoke all access for their users.
        </p>
      </Modal>

      {/* Invite Success Modal */}
      <Modal
        isOpen={showInviteSuccess}
        onClose={() => setShowInviteSuccess(false)}
        title="Owner Invited Successfully"
        theme={theme}
        width={500}
        footer={
          <button
            onClick={() => setShowInviteSuccess(false)}
            className={`w-full py-4 rounded-2xl text-[10px] font-black tracking-widest transition-all uppercase shadow-lg ${theme === "DARK" ? "bg-[#ccff00] text-stone-950" : "bg-black text-white"
              }`}
          >
            Done
          </button>
        }
      >
        <div className="space-y-8 text-center py-4">
          <div className={`w-20 h-20 rounded-3xl flex items-center justify-center mx-auto ${theme === "DARK" ? "bg-[#ccff00]/10 text-[#ccff00]" : "bg-green-50 text-green-600"
            }`}>
            <span className="material-symbols-outlined text-4xl">mark_email_read</span>
          </div>

          <div className="space-y-2">
            <h4 className={`text-xl font-black transition-colors ${theme === "DARK" ? "text-white" : "text-black"}`}>Tenant & Owner Synchronized</h4>
            <p className={`text-sm font-medium transition-colors ${theme === "DARK" ? "text-stone-400" : "text-stone-500"}`}>
              The tenant record has been saved and the owner's authentication account is ready.
            </p>
          </div>

          <div className={`p-6 rounded-2xl border text-left space-y-4 ${theme === "DARK" ? "bg-stone-900 border-stone-800" : "bg-stone-50 border-stone-100"
            }`}>
            <div className={`text-[10px] font-black uppercase tracking-widest ${theme === "DARK" ? "text-stone-500" : "text-stone-400"}`}>
              Direct Password Setup Link for Owner
            </div>
            <div className={`p-4 rounded-xl font-mono text-[10px] break-all border transition-colors ${theme === "DARK" ? "bg-stone-950 border-stone-800 text-[#ccff00]" : "bg-white border-stone-200 text-blue-600"
              }`}>
              {invitationLink}
            </div>
            <button
              onClick={() => {
                navigator.clipboard.writeText(invitationLink);
                showAppMessage("Link copied to clipboard!", "SUCCESS");
              }}
              className={`w-full py-2 rounded-lg text-[8px] font-black tracking-widest uppercase transition-all ${theme === "DARK" ? "bg-stone-800 text-white hover:bg-stone-700" : "bg-white border text-stone-600 hover:bg-stone-50"
                }`}
            >
              Copy Link
            </button>
          </div>
        </div>
      </Modal>

      {/* New Tenant Modal */}
      <Modal
        isOpen={showNewModal}
        onClose={() => {
          setShowNewModal(false);
          setEditingTenantId(null);
        }}
        title={editingTenantId ? "Edit Tenant" : "Create New Tenant"}
        theme={theme}
        width={600}
        footer={
          <div className="flex gap-4">
            <button
              onClick={() => setShowNewModal(false)}
              disabled={isSaving}
              className={`flex-1 py-4 border-2 rounded-2xl text-[10px] font-black tracking-widest transition-all uppercase ${isSaving ? "opacity-30 cursor-not-allowed" :
                  theme === "DARK" ? "border-stone-800 text-stone-400 hover:bg-stone-900" :
                    theme === "VINTAGE" ? "border-stone-100 text-black hover:bg-stone-50" :
                      "border-stone-100 text-stone-400 hover:bg-stone-50"
                }`}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className={`flex-1 py-4 rounded-2xl text-[10px] font-black tracking-widest transition-all uppercase shadow-lg flex items-center justify-center gap-3 ${isSaving ? "opacity-70 cursor-not-allowed" : "hover:opacity-90"
                } ${theme === "DARK" ? "bg-[#ccff00] text-stone-950 shadow-[#ccff00]/20" :
                  theme === "VINTAGE" ? "bg-black text-white shadow-black/20" :
                    "bg-[#4f6b28] text-white shadow-[#4f6b28]/20"
                }`}
            >
              {isSaving ? (
                <>
                  <div className={`h-3 w-3 animate-spin rounded-full border-2 border-t-transparent ${theme === "DARK" ? "border-stone-950" : "border-white"
                    }`}></div>
                  Processing... Please wait
                </>
              ) : (
                "Save"
              )}
            </button>
          </div>
        }
      >
        <div className="space-y-6">
          <FormField label="TENANT ID" theme={theme}>
            <div className={`px-6 py-4 rounded-2xl font-mono text-sm transition-colors ${theme === "DARK" ? "bg-stone-900 text-stone-400" : "bg-stone-50 text-stone-500"
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

          <div className={`pt-4 pb-2 border-b transition-colors ${theme === "DARK" ? "border-stone-800" : "border-stone-100"
            }`}>
            <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${theme === "DARK" ? "text-stone-500" : "text-stone-400"
              }`}>Tenant Address</span>
          </div>

          <FormField label="STREET ADDRESS 1" theme={theme}>
            <input
              value={formData.address_street_1}
              onChange={e => setFormData({ ...formData, address_street_1: e.target.value })}
              placeholder="123 Main St"
              className={inputClasses(theme)}
            />
          </FormField>

          <FormField label="STREET ADDRESS 2 (APT, STE, ETC.)" theme={theme}>
            <input
              value={formData.address_street_2}
              onChange={e => setFormData({ ...formData, address_street_2: e.target.value })}
              placeholder="Apt 4B"
              className={inputClasses(theme)}
            />
          </FormField>

          <div className="grid grid-cols-3 gap-6">
            <FormField label="CITY" theme={theme}>
              <input
                value={formData.address_city}
                onChange={e => setFormData({ ...formData, address_city: e.target.value })}
                placeholder="New York"
                className={inputClasses(theme)}
              />
            </FormField>
            <FormField label="STATE" theme={theme}>
              <select
                value={formData.address_state}
                onChange={e => setFormData({ ...formData, address_state: e.target.value })}
                className={`${inputClasses(theme)} ${!formData.address_state ? '!text-stone-200' : ''}`}
              >
                <option value="">Select State</option>
                {US_STATES.map(state => (
                  <option key={state} value={state}>{state}</option>
                ))}
              </select>
            </FormField>
            <FormField label="ZIP" theme={theme}>
              <input
                value={formData.address_zip}
                onChange={e => setFormData({ ...formData, address_zip: e.target.value })}
                placeholder="10001"
                className={inputClasses(theme)}
              />
            </FormField>
          </div>

          <div className={`pt-4 pb-2 border-b transition-colors ${theme === "DARK" ? "border-stone-800" : "border-stone-100"
            }`}>
            <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${theme === "DARK" ? "text-stone-500" : "text-stone-400"
              }`}>Primary Owner Details</span>
          </div>

          <FormField label="OWNER ID" theme={theme}>
            <input
              value={formData.owner_id}
              onChange={e => setFormData({ ...formData, owner_id: e.target.value })}
              readOnly={!!editingTenantId}
              placeholder="e.g. U10001"
              className={`w-full border rounded-2xl px-6 py-4 text-sm font-bold placeholder:text-stone-200 outline-none transition-colors ${theme === "DARK"
                  ? (editingTenantId ? "bg-stone-900 text-stone-500 border-stone-800" : "bg-stone-950 text-white border-stone-800 focus:border-[#ccff00]")
                  : (editingTenantId ? "bg-stone-50 text-stone-400 border-stone-100" : "bg-white text-stone-900 border-stone-200 focus:border-stone-400")
                }`}
            />
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
            <div className={`px-6 py-4 rounded-2xl text-sm font-bold transition-colors ${theme === "DARK" ? "bg-stone-900 text-stone-400" : "bg-stone-50 text-stone-500"
              }`}>
              {formData.owner_role}
            </div>
            <p className="text-[10px] text-stone-500 mt-2 font-medium">Primary owner must be assigned the Owner role.</p>
          </FormField>

          <label className="flex items-center gap-4 cursor-pointer group">
            <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${formData.invite_user
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
            <span className={`text-sm font-bold transition-colors ${theme === "DARK" ? "text-white" : "text-stone-900"
              }`}>Invite user (Send verification email)</span>
          </label>

          <FormField label="NOTES" theme={theme}>
            <textarea
              value={formData.notes}
              onChange={e => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Private notes about this tenant/owner..."
              rows={4}
              className={inputClasses(theme)}
            />
          </FormField>
        </div>
      </Modal>

      {/* App Notification Toast */}
      {notification && (
        <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[9999] animate-in fade-in slide-in-from-top-4 duration-300">
          <div className={`px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-4 border ${notification.type === "SUCCESS"
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

function FormField({ label, children, theme }: { label: string; children: React.ReactNode; theme: string }) {
  return (
    <div>
      <label className={`text-[10px] font-black tracking-[0.2em] uppercase mb-3 block transition-colors ${theme === "DARK" ? "text-stone-400" : "text-stone-900"
        }`}>{label}</label>
      {children}
    </div>
  );
}

const inputClasses = (theme: string) => `w-full border-none rounded-2xl px-6 py-4 text-sm font-bold placeholder:text-stone-200 outline-none transition-colors ${theme === "DARK"
    ? "bg-stone-900 text-white focus:ring-2 focus:ring-[#ccff00]"
    : theme === "VINTAGE"
      ? "bg-[#f7f9fb] text-black focus:ring-2 focus:ring-black"
      : "bg-stone-50 text-stone-900 focus:ring-2 focus:ring-[#4f6b28]"
  }`;
