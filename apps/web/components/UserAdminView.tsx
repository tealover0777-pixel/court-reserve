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
  roles?: string[];
  status: string;
  phone?: string;
  notes?: string;
  company_user_id?: string;
  portrait_url?: string;
  tenant_id?: string;
  address_street_1?: string;
  address_street_2?: string;
  address_city?: string;
  address_state?: string;
  address_zip?: string;
  coach_description?: string;
  birth_date?: string;
  sex?: string;
  tennis_hand?: string;
  coaching_for?: string[];
  availability?: Record<string, string[]>;
  availability_from?: string;
  availability_to?: string;
  availability_enabled?: boolean;
  is_global?: boolean;
}

const US_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY"
];



import { db, functions, storage } from "../lib/firebase";
import { collection, onSnapshot, query, orderBy, doc, setDoc, where, getDocs, collectionGroup } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { useEffect } from "react";

export default function UserAdminView({ theme = "LIGHT", tenantId }: { theme?: "LIGHT" | "DARK" | "VINTAGE", tenantId?: string | null }) {
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
  const [defaultPortraits, setDefaultPortraits] = useState<{ id: string; url: string; label: string }[]>([]);
  const [showPortraitSelectorModal, setShowPortraitSelectorModal] = useState(false);
  const [formData, setFormData] = useState({
    user_id: "",
    auth_uid: "",
    first_name: "",
    last_name: "",
    email: "",
    role: "",
    roles: [] as string[],
    status: "Invited",
    phone: "",
    notes: "",
    company_user_id: "",
    portrait_url: "",
    tenant_id: "",
    invite_user: true,
    address_street_1: "",
    address_street_2: "",
    address_city: "",
    address_state: "",
    address_zip: "",
    coach_description: "",
    birth_date: "",
    sex: "",
    tennis_hand: "",
    coaching_for: [] as string[],
    availability: {} as Record<string, string[]>,
    availability_from: "",
    availability_to: "",
    availability_enabled: false
  });
  const [isUploadingPortrait, setIsUploadingPortrait] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: "SUCCESS" | "ERROR" | "INFO" } | null>(null);

  // Common UI classes
  const inputCls = `w-full border rounded-2xl px-5 py-3.5 text-sm font-bold outline-none transition-all placeholder:text-stone-200 ${theme === "DARK" ? "bg-stone-950 text-white border-stone-800 focus:border-[#ccff00]" : "bg-white text-stone-900 border-stone-200 focus:border-stone-400 shadow-sm"
    }`;
  const readonlyCls = `w-full border rounded-2xl px-5 py-3.5 text-sm font-bold transition-colors ${theme === "DARK" ? "bg-stone-900 text-stone-400 border-stone-800" : "bg-stone-50 text-stone-500 border-stone-100"
    }`;
  const labelCls = `text-[10px] font-black tracking-widest uppercase mb-2 block ${theme === "DARK" ? "text-stone-300" : "text-stone-800"
    }`;

  const sectionDivider = (title: string) => (
    <div className={`col-span-2 pt-2 pb-1 border-b flex items-center gap-3 transition-colors ${theme === "DARK" ? "border-stone-800" : "border-stone-100"}`}>
      <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${theme === "DARK" ? "text-stone-300" : "text-stone-800"
        }`}>{title}</span>
    </div>
  );

  const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const SLOTS = ["Morning", "Afternoon", "Evening"];

  const toggleAvailability = (day: string, slot: string) => {
    const current = formData.availability[day] || [];
    const next = current.includes(slot) ? current.filter(s => s !== slot) : [...current, slot];
    setFormData(prev => ({ ...prev, availability: { ...prev.availability, [day]: next } }));
  };

  const toggleCoachingFor = (val: string) => {
    const current = formData.coaching_for || [];
    const next = current.includes(val) ? current.filter(v => v !== val) : [...current, val];
    setFormData(prev => ({ ...prev, coaching_for: next }));
  };

  const handOptions = ["Right", "Left"];
  const coachingGroups = ["Kids", "Young Adult", "Adult", "Senior", "Group Lesson", "Private Lesson"];

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
    let qGlobal: any;
    let qTenantScoped: any = null;

    if (tenantId === null) {
      // Platform User View: show only global platform users
      qGlobal = query(collection(db, "global_users"), orderBy("user_id", "asc"));
    } else if (tenantId === "" || tenantId === "consolidated" || tenantId === "Global") {
      // Global User Admin View: show all tenant-scoped users across the platform
      qTenantScoped = query(collectionGroup(db, "users"), orderBy("user_id", "asc"));
    } else if (typeof tenantId === "string" && tenantId) {
      // Tenant-specific view: show only this tenant's users
      qTenantScoped = query(collection(db, "tenants", tenantId, "users"), orderBy("user_id", "asc"));
    }

    let unsubGlobal = () => {};
    if (qGlobal) {
      unsubGlobal = onSnapshot(qGlobal, (snap: any) => {
        setGlobalUsers(snap.docs.map((d: any) => ({ id: d.id, ...d.data(), is_global: true } as User)));
      });
    } else {
      setGlobalUsers([]);
    }

    let unsubTenant = () => {};
    if (qTenantScoped) {
      unsubTenant = onSnapshot(qTenantScoped, (snap: any) => {
        setScopedUsers(snap.docs.map((d: any) => {
          const data = d.data();
          return { 
            id: d.id, 
            ...data, 
            is_global: false,
            // Ensure tenant_id is available even if not in document data
            tenant_id: data.tenant_id || d.ref.parent.parent.id 
          } as User;
        }));
      }, (error) => {
        console.warn("Snapshot error (likely missing index for collectionGroup orderBy):", error);
        // Fallback to un-ordered query
        if (tenantId === "" || tenantId === "consolidated" || tenantId === "Global") {
          const fallbackQ = query(collectionGroup(db, "users"));
          unsubTenant = onSnapshot(fallbackQ, (snap: any) => {
            setScopedUsers(snap.docs.map((d: any) => {
              const data = d.data();
              return { 
                id: d.id, 
                ...data, 
                is_global: false,
                tenant_id: data.tenant_id || d.ref.parent.parent?.id 
              } as User;
            }));
          });
        }
      });
    } else {
      setScopedUsers([]);
    }

    return () => {
      unsubGlobal();
      unsubTenant();
    };
  }, [tenantId]);

  const [globalUsers, setGlobalUsers] = useState<User[]>([]);
  const [scopedUsers, setScopedUsers] = useState<User[]>([]);

  useEffect(() => {
    // Merge and deduplicate using a globally unique key
    const all = [...globalUsers, ...scopedUsers];
    const unique = Array.from(new Map(all.map((u: User) => {
      const key = u.is_global ? `global_${u.id}` : `scoped_${u.tenant_id}_${u.id}`;
      return [key, u];
    })).values());
    setUsers(unique.sort((a, b) => (a.user_id || "").localeCompare(b.user_id || "")));
    setLoading(false);
  }, [globalUsers, scopedUsers]);

  useEffect(() => {
    const unsubscribeStatus = onSnapshot(query(collection(db, "dimensions"), orderBy("category", "asc")), (snapshot: any) => {
      const statusDim = snapshot.docs.find((doc: any) => doc.data().category?.toUpperCase() === "USERSTATUS");
      if (statusDim) {
        setUserStatuses(statusDim.data().items || []);
      } else {
        setUserStatuses([]); // Fallback to empty if not found
      }
    });

    const unsubscribeRoles = onSnapshot(query(collection(db, "role_types"), orderBy("role_id", "asc")), (snapshot: any) => {
      const roleData = snapshot.docs.map((doc: any) => ({
        id: doc.id,
        ...doc.data()
      }));
      setRoles(roleData);
    });

    const unsubscribeTenants = onSnapshot(collection(db, "tenants"), (snapshot: any) => {
      setTenants(snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() })));
    });

    const unsubscribeDefaultPortraits = onSnapshot(collection(db, "platform_company", "defaults", "portraits"), (snapshot: any) => {
      const data = snapshot.docs.map((doc: any) => ({
        id: doc.id,
        ...doc.data()
      })) as any[];
      setDefaultPortraits(data);
    });

    return () => {
      unsubscribeStatus();
      unsubscribeRoles();
      unsubscribeTenants();
      unsubscribeDefaultPortraits();
    };
  }, [tenantId]);

  useEffect(() => {
    const auth = getAuth();
    const unsub = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });
    return () => unsub();
  }, []);

  const filteredUsers = useMemo(() => {
    return users;
  }, [users]);

  useEffect(() => {
    const superEmail = "kyuahn@yahoo.com";
    if (currentUser?.email === superEmail && !loading) {
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

  useEffect(() => {
    const seedDefaults = async () => {
      try {
        const q = query(collection(db, "platform_company", "defaults", "portraits"));
        const snap = await getDocs(q);
        if (snap.empty) {
          const initial = [
            { id: 'DEF_1', label: 'Male Light', url: '/images/defaults/male_light.png' },
            { id: 'DEF_2', label: 'Female Light', url: '/images/defaults/female_light.png' },
            { id: 'DEF_3', label: 'Male Dark', url: '/images/defaults/male_dark.png' },
            { id: 'DEF_4', label: 'Female Dark', url: '/images/defaults/female_dark.png' },
          ];
          for (const item of initial) {
            await setDoc(doc(db, "platform_company", "defaults", "portraits", item.id), {
              label: item.label,
              url: item.url,
              created_at: new Date().toISOString()
            });
          }
        }
      } catch (err) {
        console.error("Failed to seed default portraits:", err);
      }
    };
    seedDefaults();
  }, []);

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
      roles: user.roles || (user.role ? [user.role] : []),
      status: user.status || "Invited",
      phone: user.phone || "",
      notes: user.notes || (user as any).Notes || "",
      company_user_id: user.company_user_id || "",
      portrait_url: user.portrait_url || "",
      tenant_id: user.tenant_id || "",
      invite_user: false,
      address_street_1: user.address_street_1 || "",
      address_street_2: user.address_street_2 || "",
      address_city: user.address_city || "",
      address_state: user.address_state || "",
      address_zip: user.address_zip || "",
      coach_description: user.coach_description || "",
      birth_date: user.birth_date || "",
      sex: user.sex || "",
      tennis_hand: user.tennis_hand || "",
      coaching_for: user.coaching_for || [],
      availability: user.availability || {},
      availability_from: user.availability_from || "",
      availability_to: user.availability_to || "",
      availability_enabled: user.availability_enabled || false
    });
    setShowEditModal(true);
  };

  const handlePortraitSync = async (url: string) => {
    if (!editingUser) return;
    setIsUploadingPortrait(true);
    try {
      const userRef = doc(db, "global_users", editingUser.id);
      await setDoc(userRef, {
        portrait_url: url,
        updated_at: new Date().toISOString()
      }, { merge: true });

      setFormData(prev => ({ ...prev, portrait_url: url }));
      showAppMessage("Profile photo synchronized!", "SUCCESS");
    } catch (err) {
      console.error("Portrait sync failed:", err);
      showAppMessage("Failed to sync portrait.", "ERROR");
    } finally {
      setIsUploadingPortrait(false);
    }
  };

  const handlePortraitUpload = async (file: File, compositeId: string) => {
    setIsUploadingPortrait(true);
    try {
      const storageRef = ref(storage, `users/${compositeId}/portrait`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);

      if (editingUser) {
        await handlePortraitSync(url);
      } else {
        setFormData(prev => ({ ...prev, portrait_url: url }));
      }
      return url;
    } catch (err) {
      console.error("Portrait upload failed:", err);
      showAppMessage("Failed to upload portrait image.", "ERROR");
      return null;
    } finally {
      setIsUploadingPortrait(false);
    }
  };

  const handleSaveUser = async () => {
    if (!editingUser) return;
    setIsSaving(true);
    try {
      // Use the correct document path based on whether the user is global or tenant-scoped
      // @ts-ignore
      const isGlobal = editingUser.is_global;
      const userRef = isGlobal 
        ? doc(db, "global_users", editingUser.id)
        : doc(db, "tenants", (editingUser as any).tenantId || editingUser.tenant_id, "users", editingUser.id);

      // Destructure to exclude fields that shouldn't be saved to the database
      // @ts-ignore
      const { invite_user, is_global, ...savableData } = formData;

      const updateData = {
        ...savableData,
        updated_at: new Date().toISOString()
      };

      // Filter out undefined values
      const cleanUpdateData = Object.fromEntries(
        Object.entries(updateData).filter(([_, v]) => v !== undefined)
      );

      await setDoc(userRef, cleanUpdateData, { merge: true });

      // Capture the user ID for tenant sync before clearing the state
      const targetUserId = editingUser.user_id;

      setShowEditModal(false);
      setEditingUser(null);
      showAppMessage("User saved successfully.", "SUCCESS");

      // Sync reverse to tenants if this user owns any
      try {
        const tenantsQuery = query(collection(db, "tenants"), where("owner_id", "==", targetUserId));
        const tenantSnaps = await getDocs(tenantsQuery);
        for (const tDoc of tenantSnaps.docs) {
          await setDoc(doc(db, "tenants", tDoc.id), {
            owner_email: formData.email,
            owner_first_name: formData.first_name,
            owner_last_name: formData.last_name,
            owner_phone: formData.phone,
            address_street_1: formData.address_street_1,
            address_street_2: formData.address_street_2,
            address_city: formData.address_city,
            address_state: formData.address_state,
            address_zip: formData.address_zip
          }, { merge: true });
        }
      } catch (syncErr) {
        console.error("Tenant sync failed:", syncErr);
      }
    } catch (err: any) {
      const detail = err?.message || err?.code || String(err);
      console.error("handleSaveUser failed:", err);
      showAppMessage(`Save failed: ${detail}`, "ERROR");
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
      const compositeId = formData.tenant_id ? `${formData.tenant_id}_${newUserId}` : newUserId;
      
      // Determine the correct reference: tenants/{id}/users/{uid} or global_users/{uid}
      const userRef = formData.tenant_id 
        ? doc(db, "tenants", formData.tenant_id, "users", newUserId)
        : doc(db, "global_users", newUserId);

      const userData = {
        user_id: newUserId,
        tenant_id: formData.tenant_id || "Global",
        first_name: formData.first_name,
        last_name: formData.last_name,
        email: formData.email,
        role: formData.role,
        roles: formData.roles,
        status: "Invited",
        phone: formData.phone,
        notes: formData.notes,
        company_user_id: formData.company_user_id,
        portrait_url: formData.portrait_url,
        address_street_1: formData.address_street_1,
        address_street_2: formData.address_street_2,
        address_city: formData.address_city,
        address_state: formData.address_state,
        address_zip: formData.address_zip,
        coach_description: formData.coach_description,
        birth_date: formData.birth_date,
        sex: formData.sex,
        tennis_hand: formData.tennis_hand,
        coaching_for: formData.coaching_for,
        availability: formData.availability,
        availability_from: formData.availability_from,
        availability_to: formData.availability_to,
        availability_enabled: formData.availability_enabled,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      // Filter out undefined values
      const cleanUserData = Object.fromEntries(
        Object.entries(userData).filter(([_, v]) => v !== undefined)
      );

      await setDoc(userRef, cleanUserData);

      // If portrait was uploaded to a temp path, move it to the real compositeId path
      if (formData.portrait_url && formData.portrait_url.includes("temp_")) {
        // Re-fetch the blob and re-upload to correct path (can't "move" in Storage)
        try {
          const response = await fetch(formData.portrait_url);
          const blob = await response.blob();
          const storageRef = ref(storage, `users/${compositeId}/portrait`);
          await uploadBytes(storageRef, blob);
          const realUrl = await getDownloadURL(storageRef);
          await setDoc(userRef, { portrait_url: realUrl }, { merge: true });
        } catch {
          // Non-fatal: portrait url stays as temp path
        }
      }

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
          company_user_id: formData.company_user_id,
          tenantId: formData.tenant_id,
          address_street_1: formData.address_street_1,
          address_street_2: formData.address_street_2,
          address_city: formData.address_city,
          address_state: formData.address_state,
          address_zip: formData.address_zip,
          inviteUser: true,
          useTenantUserDoc: !!formData.tenant_id // Use tenant-scoped document if tenant_id is present
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
        tenantId: user.tenant_id,
        useTenantUserDoc: !!user.tenant_id,
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
      roles: [],
      status: "Invited",
      phone: "",
      notes: "",
      company_user_id: "",
      portrait_url: "",
      tenant_id: tenantId && tenantId !== "consolidated" && tenantId !== "Global" ? tenantId : "",
      invite_user: true,
      address_street_1: "",
      address_street_2: "",
      address_city: "",
      address_state: "",
      address_zip: "",
      coach_description: "",
      birth_date: "",
      sex: "",
      tennis_hand: "",
      coaching_for: [],
      availability: {},
      availability_from: "",
      availability_to: "",
      availability_enabled: false
    });
  };

  const columnHelper = createColumnHelper<User>();
  const columns = [
    columnHelper.accessor("portrait_url", {
      header: "PORTRAIT",
      size: 80,
      cell: info => {
        const url = info.getValue();
        return (
          <div className="flex justify-center">
            <div className={`w-10 h-10 rounded-full overflow-hidden border-2 transition-colors ${theme === "DARK" ? "border-stone-800" : "border-stone-100"
              }`}>
              {url ? (
                <img src={url} alt="User" className="w-full h-full object-cover" />
              ) : (
                <div className={`w-full h-full flex items-center justify-center ${theme === "DARK" ? "bg-stone-900 text-stone-700" : "bg-stone-50 text-stone-300"
                  }`}>
                  <span className="material-symbols-outlined text-xl">person</span>
                </div>
              )}
            </div>
          </div>
        );
      }
    }),
    columnHelper.accessor("user_id", {
      header: "USER ID",
      size: 120,
      cell: info => <span className={`font-mono text-xs transition-colors duration-500 ${theme === "DARK" ? "text-stone-300" : "text-stone-800"
        }`}>{info.getValue()}</span>,
    }),
    columnHelper.accessor("company_user_id", {
      header: "COMPANY USER ID",
      size: 160,
      cell: info => <span className={`font-mono text-xs transition-colors duration-500 ${theme === "DARK" ? "text-stone-200" : "text-stone-700"
        }`}>{info.getValue() || "—"}</span>,
    }),
    ...(tenantId && tenantId !== "consolidated" ? [] : [columnHelper.accessor("tenant_id", {
      header: "COMPANY NAME",
      size: 160,
      cell: info => {
        const tid = info.getValue();
        if (!tid) return (
          <span className={`font-mono text-[10px] font-black transition-colors duration-500 ${theme === "DARK" ? "text-stone-300" : "text-stone-800"
            }`}>Global</span>
        );
        const tenant = tenants.find(t => t.tenant_id === tid);
        return (
          <div className="flex flex-col gap-0.5">
            <span className={`text-[11px] font-bold tracking-tight transition-colors duration-500 ${theme === "DARK" ? "text-[#ccff00]" :
                theme === "VINTAGE" ? "text-stone-900" :
                  "text-stone-900"
              }`}>
              {tenant?.name || "Unknown"}
            </span>
            <span className={`font-mono text-[9px] font-black transition-colors duration-500 opacity-40 ${theme === "DARK" ? "text-white" :
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
    })]),
    columnHelper.accessor("first_name", {
      header: "FIRST NAME",
      size: 150,
      cell: info => <span className={`text-sm font-bold transition-colors duration-500 ${theme === "DARK" ? "text-white" :
          theme === "VINTAGE" ? "text-black" :
            "text-stone-900"
        }`}>{info.getValue() || "-"}</span>,
    }),
    columnHelper.accessor("last_name", {
      header: "LAST NAME",
      size: 150,
      cell: info => <span className={`text-sm font-bold transition-colors duration-500 ${theme === "DARK" ? "text-white" :
          theme === "VINTAGE" ? "text-black" :
            "text-stone-900"
        }`}>{info.getValue() || "-"}</span>,
    }),
    columnHelper.accessor("phone", {
      header: "PHONE",
      size: 150,
      cell: info => <span className={`text-xs transition-colors duration-500 ${theme === "DARK" ? "text-stone-300" : "text-stone-800"
        }`}>{info.getValue() || "-"}</span>,
    }),
    columnHelper.accessor("email", {
      header: "EMAIL",
      size: 250,
      cell: info => <span className={`text-sm transition-colors duration-500 ${theme === "DARK" ? "text-stone-300" : "text-stone-800"
        }`}>{info.getValue()}</span>,
    }),
    columnHelper.accessor("roles", {
      header: "ROLES",
      size: 240,
      cell: info => {
        const roleIds = info.getValue() as string[] || [];
        const singleRole = info.row.original.role;
        const allRoleIds = roleIds.length > 0 ? roleIds : (singleRole ? [singleRole] : []);

        if (allRoleIds.length === 0) return <span className={`text-xs ${theme === "DARK" ? "text-stone-300" : "text-stone-800"
          }`}>—</span>;

        return (
          <div className="flex flex-wrap gap-1 py-1">
            {allRoleIds.map(rid => {
              const roleMatch = roles.find(r => r.role_id === rid || r.id === rid);
              if (!roleMatch) return (
                <span key={rid} className={`text-[9px] font-mono px-2 py-0.5 rounded-full border ${theme === "DARK" ? "border-stone-800 text-stone-300" : "border-stone-200 text-stone-800"
                  }`}>{rid}</span>
              );

              return (
                <div key={rid} className="flex flex-col">
                  <span className={`text-[10px] font-black uppercase tracking-tight px-2 py-0.5 rounded-full border transition-colors ${theme === "DARK"
                      ? "border-stone-800 text-[#ccff00] bg-[#ccff00]/5"
                      : "border-stone-200 text-[#6348eb] bg-[#6348eb]/5"
                    }`}>
                    {roleMatch.role_name}
                  </span>
                </div>
              );
            })}
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
          <span className={`text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest border ${val === "active"
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
    columnHelper.accessor(row => (row as any).notes || (row as any).Notes, {
      id: "notes",
      header: "NOTES",
      size: 200,
      cell: info => <span className={`text-xs transition-colors duration-500 truncate max-w-[200px] block ${theme === "DARK" ? "text-stone-200" : "text-stone-700"
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
              className={`transition-colors p-2 ${theme === "DARK" ? "text-stone-300 hover:text-white" : "text-stone-500 hover:text-stone-900"
                }`}
            >
              <span className="material-symbols-outlined text-xl">more_horiz</span>
            </button>

            {showMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)}></div>
                <div
                  style={{ top: menuPos.top, right: menuPos.right }}
                  className={`fixed border rounded-xl shadow-xl py-2 w-32 z-50 animate-in fade-in zoom-in-95 duration-200 transition-colors ${theme === "DARK" ? "bg-stone-900 border-stone-800" :
                      theme === "VINTAGE" ? "bg-white border-stone-100" :
                        "bg-white border-stone-100"
                    }`}>
                  <button
                    onClick={() => {
                      handleEditUser(props.row.original);
                      setShowMenu(false);
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-[10px] font-black uppercase tracking-widest transition-colors ${theme === "DARK" ? "text-stone-300 hover:bg-stone-800" :
                        theme === "VINTAGE" ? "text-stone-900 hover:bg-stone-50" :
                          "text-stone-800 hover:bg-stone-50"
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
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-[10px] font-black uppercase tracking-widest transition-colors ${theme === "DARK" ? "text-[#ccff00] hover:bg-stone-800" :
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
            USER ADMIN
          </h2>
          <p className={`font-bold uppercase tracking-widest text-xs mt-2 transition-colors duration-500 ${theme === "DARK" ? "text-stone-300" :
              theme === "VINTAGE" ? "text-stone-800" :
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
            <span className={`material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-lg ${theme === "DARK" ? "text-stone-300" : "text-stone-500"
              }`}>search</span>
            <input
              type="text"
              placeholder="Search users..."
              className={`w-full border rounded-full pl-12 pr-6 py-3 text-sm font-medium outline-none transition-all shadow-sm ${theme === "DARK"
                  ? "bg-stone-900 border-stone-800 text-white focus:border-[#ccff00]"
                  : theme === "VINTAGE"
                    ? "bg-white border-stone-100 text-black focus:border-black shadow-md placeholder:text-stone-200"
                    : "bg-white border-stone-200 text-stone-900 focus:border-[#4f6b28] placeholder:text-stone-200"
                }`}
              onChange={(e) => table.setGlobalFilter(e.target.value)}
            />
          </div>
          <button
            onClick={() => {
              resetForm();
              setShowCreateModal(true);
            }}
            className={`px-8 py-3 rounded-full font-black text-xs tracking-widest transition-all uppercase shadow-lg flex items-center gap-2 ${theme === "DARK"
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
                      className={`px-6 py-4 text-[10px] font-black uppercase tracking-widest relative border-r last:border-r-0 transition-colors duration-500 ${theme === "DARK" ? "text-[#ccff00] border-stone-800" :
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
                      className={`px-6 py-3 text-sm font-medium border-r last:border-r-0 transition-colors duration-500 ${theme === "DARK" ? "text-stone-300 border-stone-800" :
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
              className={`flex-1 py-4 border-2 rounded-2xl text-[10px] font-black tracking-widest transition-all uppercase ${theme === "DARK" ? "border-stone-800 text-stone-300 hover:bg-stone-900" :
                  theme === "VINTAGE" ? "border-stone-100 text-stone-900 hover:bg-stone-50" :
                    "border-stone-100 text-stone-800 hover:bg-stone-50"
                }`}
            >
              Go Back
            </button>
            <button
              onClick={handleDeleteUser}
              className={`flex-1 py-4 rounded-2xl text-[10px] font-black tracking-widest transition-all uppercase shadow-lg ${theme === "VINTAGE" ? "bg-black text-white hover:bg-stone-900 shadow-black/20" : "bg-red-500 text-white hover:bg-red-600 shadow-red-500/20"
                }`}
            >
              Delete Now
            </button>
          </div>
        }
      >
        <div className="relative z-10">
          <div className={`w-20 h-20 rounded-3xl flex items-center justify-center mb-8 mx-auto ${theme === "VINTAGE" ? "bg-stone-50 text-black" : "bg-red-50 text-red-500"
            }`}>
            <span className="material-symbols-outlined text-4xl">delete_forever</span>
          </div>
          <p className={`text-center font-medium leading-relaxed transition-colors ${theme === "DARK" ? "text-stone-300" : "text-stone-800"
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
            <h4 className={`text-xl font-black transition-colors ${theme === "DARK" ? "text-white" : "text-black"}`}>Success!</h4>
            <p className={`text-sm font-medium transition-colors ${theme === "DARK" ? "text-stone-400" : "text-stone-500"}`}>
              The user has been created in both the platform and authentication records.
            </p>
          </div>

          <div className={`p-6 rounded-2xl border text-left space-y-4 ${theme === "DARK" ? "bg-stone-900 border-stone-800" : "bg-stone-50 border-stone-100"
            }`}>
            <div className={`text-[10px] font-black uppercase tracking-widest ${theme === "DARK" ? "text-stone-500" : "text-stone-400"}`}>
              Direct Password Setup Link
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

      {/* Existing modals below... */}
      <Modal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setEditingUser(null);
        }}
        title="Edit User Profile"
        theme={theme}
        width={860}
        footer={
          <div className="flex gap-4">
            <button
              onClick={() => {
                setShowEditModal(false);
                setEditingUser(null);
              }}
              disabled={isSaving}
              className={`flex-1 py-4 border rounded-2xl text-[10px] font-black tracking-widest transition-all uppercase ${theme === "DARK" ? "border-stone-800 text-stone-400 hover:bg-stone-900" :
                  "bg-white border-stone-200 text-stone-900 hover:bg-stone-50 shadow-sm"
                } ${isSaving ? "opacity-30 cursor-not-allowed" : ""}`}
            >
              Cancel
            </button>
            <button
              onClick={handleSaveUser}
              disabled={isSaving}
              className={`flex-1 py-4 rounded-2xl text-[10px] font-black tracking-widest transition-all uppercase shadow-lg flex items-center justify-center gap-3 ${theme === "DARK" ? "bg-[#ccff00] text-stone-950 shadow-[#ccff00]/20" :
                  "bg-[#6348eb] text-white shadow-[#6348eb]/20"
                } ${isSaving ? "opacity-70 cursor-not-allowed" : "hover:opacity-90"}`}
            >
              {isSaving ? (
                <>
                  <div className={`h-3 w-3 animate-spin rounded-full border-2 border-t-transparent ${theme === "DARK" ? "border-stone-950" : "border-white"
                    }`}></div>
                  Processing...
                </>
              ) : "Save Changes"}
            </button>
          </div>
        }
      >
        {(() => {
          const isCoach = (formData.roles || []).includes("R10002") || formData.role === "R10002";
          const inputCls = `w-full border rounded-2xl px-5 py-3.5 text-sm font-bold outline-none transition-colors ${theme === "DARK" ? "bg-stone-950 text-white border-stone-800 focus:border-[#ccff00]" : "bg-white text-stone-900 border-stone-200 focus:border-stone-400"
            }`;
          const readonlyCls = `w-full border rounded-2xl px-5 py-3.5 text-sm font-bold transition-colors ${theme === "DARK" ? "bg-stone-900 text-stone-400 border-stone-800" : "bg-stone-50 text-stone-500 border-stone-100"
            }`;
          const labelCls = `text-[10px] font-black tracking-widest uppercase mb-2 block ${theme === "DARK" ? "text-stone-500" : "text-stone-400"}`;
          const sectionDivider = (title: string) => (
            <div className={`col-span-2 pt-2 pb-1 border-b flex items-center gap-3 transition-colors ${theme === "DARK" ? "border-stone-800" : "border-stone-100"}`}>
              <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${theme === "DARK" ? "text-stone-500" : "text-stone-400"}`}>{title}</span>
            </div>
          );
          const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
          const SLOTS = ["Morning", "Afternoon", "Evening"];
          const toggleAvailability = (day: string, slot: string) => {
            const current = formData.availability[day] || [];
            const next = current.includes(slot) ? current.filter(s => s !== slot) : [...current, slot];
            setFormData(prev => ({ ...prev, availability: { ...prev.availability, [day]: next } }));
          };
          const toggleCoachingFor = (val: string) => {
            const current = formData.coaching_for || [];
            const next = current.includes(val) ? current.filter(v => v !== val) : [...current, val];
            setFormData(prev => ({ ...prev, coaching_for: next }));
          };

          return (
            <div className="space-y-6">
              {/* Portrait — centered above grid */}
              <div className="flex flex-col items-center gap-4">
                <div className="relative group">
                  <div className={`w-32 h-32 rounded-full overflow-hidden flex items-center justify-center border-4 shadow-2xl transition-all relative ${theme === "DARK" ? "border-stone-800 bg-stone-900" : "border-stone-100 bg-stone-50"
                    }`}>
                    {formData.portrait_url ? (
                      <img
                        src={formData.portrait_url}
                        alt="Portrait"
                        className={`w-full h-full object-cover transition-all ${isUploadingPortrait ? "opacity-30 blur-sm" : "group-hover:scale-110 group-hover:opacity-40"}`}
                      />
                    ) : (
                      <div className={`flex flex-col items-center gap-2 transition-all ${isUploadingPortrait ? "opacity-30 blur-sm" : "group-hover:opacity-20"}`}>
                        <span className={`text-4xl font-black select-none ${theme === "DARK" ? "text-stone-700" : "text-stone-300"}`}>
                          {(formData.first_name?.[0] || formData.email?.[0] || "?").toUpperCase()}
                        </span>
                      </div>
                    )}

                    {/* Hover Overlay */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-all text-white z-10 gap-4">
                      <button
                        onClick={() => {
                          const fileInput = document.getElementById('user-portrait-upload') as HTMLInputElement;
                          fileInput?.click();
                        }}
                        disabled={isUploadingPortrait}
                        className="flex flex-col items-center hover:scale-110 transition-transform bg-black/40 w-12 h-12 rounded-full justify-center backdrop-blur-sm"
                        title="Upload Custom Photo"
                      >
                        <span className="material-symbols-outlined text-xl">photo_camera</span>
                      </button>

                      <button
                        onClick={() => setShowPortraitSelectorModal(true)}
                        disabled={isUploadingPortrait}
                        className="flex flex-col items-center hover:scale-110 transition-transform bg-black/40 w-12 h-12 rounded-full justify-center backdrop-blur-sm"
                        title="Select Default Portrait"
                      >
                        <span className="material-symbols-outlined text-xl">face</span>
                      </button>
                    </div>

                    {isUploadingPortrait && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full">
                        <div className="h-6 w-6 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                      </div>
                    )}
                  </div>

                  <input
                    id="user-portrait-upload"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={isUploadingPortrait}
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const id = editingUser ? `${formData.tenant_id}_${formData.user_id}` : `temp_${Date.now()}`;
                      await handlePortraitUpload(file, id);
                    }}
                  />
                </div>

                <div className="flex items-center gap-6">
                  {formData.portrait_url && (
                    <button
                      onClick={() => setFormData(prev => ({ ...prev, portrait_url: "" }))}
                      className="text-[9px] font-black tracking-[0.2em] uppercase text-red-400 hover:text-red-500 transition-all flex items-center gap-2 px-4 py-2 rounded-full border border-red-400/20 hover:bg-red-400/10"
                    >
                      <span className="material-symbols-outlined text-xs">delete</span>
                      Remove Photo
                    </button>
                  )}
                  <button
                    onClick={() => setShowPortraitSelectorModal(true)}
                    className={`text-[9px] font-black tracking-[0.2em] uppercase transition-all flex items-center gap-2 px-4 py-2 rounded-full border ${theme === "DARK"
                        ? "border-[#ccff00]/20 text-[#ccff00] hover:bg-[#ccff00]/10"
                        : "border-[#6348eb]/20 text-[#6348eb] hover:bg-[#6348eb]/10"
                      }`}
                  >
                    <span className="material-symbols-outlined text-xs">auto_fix_high</span>
                    Choose Default
                  </button>
                </div>
              </div>

              {/* 2-column grid */}
              <div className="grid grid-cols-2 gap-x-8 gap-y-5">

                {sectionDivider("Identity")}

                <div>
                  <label className={labelCls}>User ID</label>
                  <div className={readonlyCls}>{formData.user_id}</div>
                </div>
                <div>
                  <label className={labelCls}>Company User ID</label>
                  <input value={formData.company_user_id} onChange={e => setFormData({ ...formData, company_user_id: e.target.value })} placeholder="e.g. EMP-0042" className={inputCls} />
                </div>

                {!tenantId || tenantId === "consolidated" || tenantId === "Global" ? (
                  <>
                    <div>
                      <label className={labelCls}>Tenant</label>
                      <select
                        value={formData.tenant_id}
                        onChange={e => setFormData({ ...formData, tenant_id: e.target.value })}
                        disabled={!!editingUser}
                        className={editingUser ? readonlyCls : inputCls}
                      >
                        <option value="">Platform Admin (Global)</option>
                        {tenants.map(t => (
                          <option key={t.id} value={t.tenant_id}>{t.name} ({t.tenant_id})</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>Auth UID (Firebase)</label>
                      <div className={`${readonlyCls} break-all text-xs`}>{formData.auth_uid || "No UID Linked"}</div>
                    </div>
                  </>
                ) : <div className="col-span-2" />}

                {sectionDivider("Personal Info")}

                <div>
                  <label className={labelCls}>First Name</label>
                  <input value={formData.first_name} onChange={e => setFormData({ ...formData, first_name: e.target.value })} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Last Name</label>
                  <input value={formData.last_name} onChange={e => setFormData({ ...formData, last_name: e.target.value })} className={inputCls} />
                </div>

                <div>
                  <label className={labelCls}>Email</label>
                  <input value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Phone</label>
                  <input value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} placeholder="e.g. 123-456-7890" className={inputCls} />
                </div>

                {sectionDivider("Account")}

                <div className="col-span-2">
                  <label className={labelCls}>Assigned Roles</label>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {roles.map(r => {
                      const rid = r.role_id || r.id;
                      const active = (formData.roles || []).includes(rid) || formData.role === rid;
                      return (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => {
                            const current = formData.roles || [];
                            const next = active
                              ? current.filter(v => v !== rid)
                              : [...current, rid];
                            setFormData(prev => ({ ...prev, roles: next, role: next[0] || "" }));
                          }}
                          className={`px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border-2 transition-all flex items-center gap-2 ${active
                              ? (theme === "DARK" ? "bg-[#ccff00] text-stone-950 border-[#ccff00]" : "bg-[#6348eb] text-white border-[#6348eb]")
                              : (theme === "DARK" ? "border-stone-800 text-stone-400 hover:border-stone-600" : "border-stone-200 text-stone-500 hover:border-stone-400")
                            }`}
                        >
                          <span className="material-symbols-outlined text-sm">
                            {active ? "check_circle" : "circle"}
                          </span>
                          {r.role_name}
                          {r.is_global && <span className="opacity-50 ml-1">[G]</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Status</label>
                  <select value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value })} className={`${inputCls} appearance-none cursor-pointer ${!formData.status ? '!text-stone-200' : ''}`}>
                    {userStatuses.length === 0 ? (
                      <option value="" disabled>Error: USERSTATUS missing</option>
                    ) : (
                      <>
                        <option value="">Select status...</option>
                        {userStatuses.map(s => <option key={s} value={s}>{s}</option>)}
                      </>
                    )}
                  </select>
                </div>

                {sectionDivider("Mailing Address")}

                <div>
                  <label className={labelCls}>Street Address 1</label>
                  <input value={formData.address_street_1} onChange={e => setFormData({ ...formData, address_street_1: e.target.value })} placeholder="123 Main St" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Street Address 2</label>
                  <input value={formData.address_street_2} onChange={e => setFormData({ ...formData, address_street_2: e.target.value })} placeholder="Apt 4B" className={inputCls} />
                </div>

                <div>
                  <label className={labelCls}>City</label>
                  <input value={formData.address_city} onChange={e => setFormData({ ...formData, address_city: e.target.value })} placeholder="New York" className={inputCls} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>State</label>
                    <select value={formData.address_state} onChange={e => setFormData({ ...formData, address_state: e.target.value })} className={`${inputCls} appearance-none cursor-pointer ${!formData.address_state ? '!text-stone-200' : ''}`}>
                      <option value="">State...</option>
                      {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Zip</label>
                    <input value={formData.address_zip} onChange={e => setFormData({ ...formData, address_zip: e.target.value })} placeholder="10001" className={inputCls} />
                  </div>
                </div>

                {sectionDivider("Notes")}

                <div className="col-span-2">
                  <textarea
                    value={formData.notes}
                    onChange={e => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Private notes..."
                    rows={3}
                    className={`${inputCls} resize-none`}
                  />
                </div>

                {/* Coach Details — toggled by role */}
                <div className={`col-span-2 pt-2 pb-1 border-b flex items-center justify-between transition-colors ${theme === "DARK" ? "border-stone-800" : "border-stone-100"}`}>
                  <div className="flex items-center gap-3">
                    <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${theme === "DARK" ? "text-stone-500" : "text-stone-400"}`}>Coach Details</span>
                    {isCoach && (
                      <span className={`text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest ${theme === "DARK" ? "bg-[#ccff00]/10 text-[#ccff00]" : "bg-[#6348eb]/10 text-[#6348eb]"
                        }`}>Coach Role Active</span>
                    )}
                  </div>
                  {!isCoach && (
                    <span className={`text-[9px] font-medium ${theme === "DARK" ? "text-stone-600" : "text-stone-400"}`}>Assign role R10002 to enable</span>
                  )}
                </div>

                {isCoach && (
                  <>
                    <div className="col-span-2">
                      <label className={labelCls}>Coach Description</label>
                      <textarea
                        value={formData.coach_description}
                        onChange={e => setFormData({ ...formData, coach_description: e.target.value })}
                        placeholder="Brief bio visible to members..."
                        rows={3}
                        className={`${inputCls} resize-none`}
                      />
                    </div>

                    <div>
                      <label className={labelCls}>Birth Date</label>
                      <input
                        type="date"
                        value={formData.birth_date}
                        onChange={e => setFormData({ ...formData, birth_date: e.target.value })}
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Gender</label>
                      <select value={formData.sex} onChange={e => setFormData({ ...formData, sex: e.target.value })} className={`${inputCls} appearance-none cursor-pointer ${!formData.sex ? '!text-stone-200' : ''}`}>
                        <option value="">Select...</option>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Non-binary">Non-binary</option>
                        <option value="Prefer not to say">Prefer not to say</option>
                      </select>
                    </div>

                    <div>
                      <label className={labelCls}>Tennis Hand</label>
                      <div className="flex gap-3 mt-1">
                        {handOptions.map(hand => (
                          <button
                            key={hand}
                            type="button"
                            onClick={() => setFormData({ ...formData, tennis_hand: hand })}
                            className={`flex-1 py-3.5 rounded-2xl text-xs font-black uppercase tracking-widest border-2 transition-all ${formData.tennis_hand === hand
                                ? (theme === "DARK" ? "bg-[#ccff00] text-stone-950 border-[#ccff00]" : "bg-[#6348eb] text-white border-[#6348eb]")
                                : (theme === "DARK" ? "border-stone-800 text-stone-400 hover:border-stone-600" : "border-stone-200 text-stone-500 hover:border-stone-400")
                              }`}
                          >
                            <span className="material-symbols-outlined text-sm mr-1" style={{ verticalAlign: "middle" }}>
                              {hand === "Right" ? "back_hand" : "front_hand"}
                            </span>
                            {hand}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className={labelCls}>Coaching For</label>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {coachingGroups.map(group => {
                          const active = (formData.coaching_for || []).includes(group);
                          return (
                            <button
                              key={group}
                              type="button"
                              onClick={() => toggleCoachingFor(group)}
                              className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest border-2 transition-all ${active
                                  ? (theme === "DARK" ? "bg-[#ccff00] text-stone-950 border-[#ccff00]" : "bg-[#6348eb] text-white border-[#6348eb]")
                                  : (theme === "DARK" ? "border-stone-800 text-stone-400 hover:border-stone-600" : "border-stone-200 text-stone-500 hover:border-stone-400")
                                }`}
                            >
                              {group}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="col-span-2">
                      <div className="flex items-center justify-between mb-2">
                        <label className={labelCls}>Weekly Availability</label>
                        <label className="flex items-center gap-2 cursor-pointer group">
                          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${formData.availability_enabled
                              ? (theme === "DARK" ? "bg-[#ccff00] border-[#ccff00]" : "bg-[#6348eb] border-[#6348eb]")
                              : (theme === "DARK" ? "border-stone-800" : "border-stone-200")
                            }`}>
                            {formData.availability_enabled && <span className={`material-symbols-outlined text-sm ${theme === "DARK" ? "text-stone-950" : "text-white"}`}>check</span>}
                          </div>
                          <input
                            type="checkbox"
                            className="hidden"
                            checked={formData.availability_enabled}
                            onChange={e => setFormData({ ...formData, availability_enabled: e.target.checked })}
                          />
                          <span className={`text-[10px] font-black uppercase tracking-widest ${formData.availability_enabled
                              ? (theme === "DARK" ? "text-[#ccff00]" : "text-[#6348eb]")
                              : (theme === "DARK" ? "text-stone-500" : "text-stone-400")
                            }`}>Enable Dates</span>
                        </label>
                      </div>

                      {/* Date span — controlled by checkbox */}
                      <div className={`flex items-center gap-4 mb-3 mt-1 transition-opacity ${!formData.availability_enabled ? "opacity-30 pointer-events-none grayscale" : "opacity-100"}`}>
                        <div className="flex-1">
                          <label className={`text-[9px] font-black tracking-widest uppercase mb-1 block ${theme === "DARK" ? "text-stone-600" : "text-stone-400"}`}>From</label>
                          <input
                            type="date"
                            disabled={!formData.availability_enabled}
                            value={formData.availability_from}
                            onChange={e => setFormData(prev => ({ ...prev, availability_from: e.target.value }))}
                            className={inputCls}
                          />
                        </div>
                        <div className={`text-xs font-black mt-5 ${theme === "DARK" ? "text-stone-600" : "text-stone-400"}`}>—</div>
                        <div className="flex-1">
                          <label className={`text-[9px] font-black tracking-widest uppercase mb-1 block ${theme === "DARK" ? "text-stone-600" : "text-stone-400"}`}>To</label>
                          <input
                            type="date"
                            disabled={!formData.availability_enabled}
                            value={formData.availability_to}
                            onChange={e => setFormData(prev => ({ ...prev, availability_to: e.target.value }))}
                            className={inputCls}
                          />
                        </div>
                      </div>

                      {/* Grid — always enabled */}
                      <div className={`rounded-2xl border overflow-hidden mt-1 ${theme === "DARK" ? "border-stone-800" : "border-stone-200"}`}>
                        {/* Header row */}
                        <div className={`grid border-b ${theme === "DARK" ? "border-stone-800 bg-stone-900" : "border-stone-100 bg-stone-50"}`} style={{ gridTemplateColumns: "80px repeat(7, 1fr)" }}>
                          <div className={`px-3 py-2 text-[9px] font-black uppercase tracking-widest ${theme === "DARK" ? "text-stone-600" : "text-stone-400"}`}></div>
                          {DAYS.map(d => (
                            <div key={d} className={`px-2 py-2 text-center text-[9px] font-black uppercase tracking-widest ${theme === "DARK" ? "text-stone-400" : "text-stone-600"}`}>{d}</div>
                          ))}
                        </div>
                        {/* Slot rows */}
                        {SLOTS.map((slot, si) => (
                          <div
                            key={slot}
                            className={`grid ${si < SLOTS.length - 1 ? `border-b ${theme === "DARK" ? "border-stone-800" : "border-stone-100"}` : ""}`}
                            style={{ gridTemplateColumns: "80px repeat(7, 1fr)" }}
                          >
                            <div className={`px-3 py-3 text-[9px] font-black uppercase tracking-widest flex items-center ${theme === "DARK" ? "text-stone-500 bg-stone-900/50" : "text-stone-400 bg-stone-50/50"}`}>
                              {slot}
                            </div>
                            {DAYS.map(day => {
                              const active = (formData.availability[day] || []).includes(slot);
                              return (
                                <div key={day} className="flex items-center justify-center py-3">
                                  <button
                                    type="button"
                                    onClick={() => toggleAvailability(day, slot)}
                                    className={`w-7 h-7 rounded-lg border-2 flex items-center justify-center transition-all ${active
                                        ? (theme === "DARK" ? "bg-[#ccff00] border-[#ccff00]" : "bg-[#6348eb] border-[#6348eb]")
                                        : (theme === "DARK" ? "border-stone-700 hover:border-stone-500" : "border-stone-200 hover:border-stone-400")
                                      }`}
                                  >
                                    {active && <span className={`material-symbols-outlined text-sm ${theme === "DARK" ? "text-stone-950" : "text-white"}`}>check</span>}
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}

              </div>
            </div>
          );
        })()}
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
        width={860}
        footer={
          <div className="flex gap-4">
            <button
              onClick={() => {
                setShowCreateModal(false);
                resetForm();
              }}
              disabled={isSaving}
              className={`flex-1 py-4 border rounded-2xl text-[10px] font-black tracking-widest transition-all uppercase ${theme === "DARK" ? "border-stone-800 text-stone-400 hover:bg-stone-900" :
                  "bg-white border-stone-200 text-stone-900 hover:bg-stone-50 shadow-sm"
                } ${isSaving ? "opacity-30 cursor-not-allowed" : ""}`}
            >
              Cancel
            </button>
            <button
              onClick={handleCreateUser}
              disabled={isSaving}
              className={`flex-1 py-4 rounded-2xl text-[10px] font-black tracking-widest transition-all uppercase shadow-lg flex items-center justify-center gap-3 ${theme === "DARK" ? "bg-[#ccff00] text-stone-950 shadow-[#ccff00]/20" :
                  "bg-[#6348eb] text-white shadow-[#6348eb]/20"
                } ${isSaving ? "opacity-70 cursor-not-allowed" : "hover:opacity-90"}`}
            >
              {isSaving ? (
                <>
                  <div className={`h-3 w-3 animate-spin rounded-full border-2 border-t-transparent ${theme === "DARK" ? "border-stone-950" : "border-white"
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
            This will create a user in your company responsible for monitoring operations and managing users associated with your business processes.
          </p>

          {/* Use the same 2-column layout logic as Edit modal */}
          {(() => {
            const isCoach = (formData.roles || []).includes("R10002") || formData.role === "R10002";

            return (
              <div className="space-y-6">
                {/* Portrait — centered above grid */}
                <div className="flex flex-col items-center gap-4">
                  <div className="relative group">
                    <div className={`w-32 h-32 rounded-full overflow-hidden flex items-center justify-center border-4 shadow-2xl transition-all relative ${theme === "DARK" ? "border-stone-800 bg-stone-900" : "border-stone-100 bg-stone-50"
                      }`}>
                      {formData.portrait_url ? (
                        <img
                          src={formData.portrait_url}
                          alt="Portrait"
                          className={`w-full h-full object-cover transition-all ${isUploadingPortrait ? "opacity-30 blur-sm" : "group-hover:scale-110 group-hover:opacity-40"}`}
                        />
                      ) : (
                        <div className={`flex flex-col items-center gap-2 transition-all ${isUploadingPortrait ? "opacity-30 blur-sm" : "group-hover:opacity-20"}`}>
                          <span className={`text-4xl font-black select-none ${theme === "DARK" ? "text-stone-700" : "text-stone-300"}`}>
                            {(formData.first_name?.[0] || formData.email?.[0] || "?").toUpperCase()}
                          </span>
                        </div>
                      )}

                      {/* Hover Overlay */}
                      <div className="absolute inset-0 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-all text-white z-10 gap-4">
                        <button
                          onClick={() => {
                            const fileInput = document.getElementById('create-user-portrait-upload') as HTMLInputElement;
                            fileInput?.click();
                          }}
                          disabled={isUploadingPortrait}
                          className="flex flex-col items-center hover:scale-110 transition-transform bg-black/40 w-12 h-12 rounded-full justify-center backdrop-blur-sm"
                          title="Upload Custom Photo"
                        >
                          <span className="material-symbols-outlined text-xl">photo_camera</span>
                        </button>

                        <button
                          onClick={() => setShowPortraitSelectorModal(true)}
                          disabled={isUploadingPortrait}
                          className="flex flex-col items-center hover:scale-110 transition-transform bg-black/40 w-12 h-12 rounded-full justify-center backdrop-blur-sm"
                          title="Select Default Portrait"
                        >
                          <span className="material-symbols-outlined text-xl">face</span>
                        </button>
                      </div>

                      {isUploadingPortrait && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full">
                          <div className="h-6 w-6 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                        </div>
                      )}
                    </div>

                    <input
                      id="create-user-portrait-upload"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={isUploadingPortrait}
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        await handlePortraitUpload(file, `temp_${Date.now()}`);
                      }}
                    />
                  </div>

                  <div className="flex items-center gap-6">
                    {formData.portrait_url && (
                      <button
                        onClick={() => setFormData(prev => ({ ...prev, portrait_url: "" }))}
                        className="text-[9px] font-black tracking-[0.2em] uppercase text-red-400 hover:text-red-500 transition-all flex items-center gap-2 px-4 py-2 rounded-full border border-red-400/20 hover:bg-red-400/10"
                      >
                        <span className="material-symbols-outlined text-xs">delete</span>
                        Remove Photo
                      </button>
                    )}
                    <button
                      onClick={() => setShowPortraitSelectorModal(true)}
                      className={`text-[9px] font-black tracking-[0.2em] uppercase transition-all flex items-center gap-2 px-4 py-2 rounded-full border ${theme === "DARK"
                          ? "border-[#ccff00]/20 text-[#ccff00] hover:bg-[#ccff00]/10"
                          : "border-[#6348eb]/20 text-[#6348eb] hover:bg-[#6348eb]/10"
                        }`}
                    >
                      <span className="material-symbols-outlined text-xs">auto_fix_high</span>
                      Choose Default
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-x-8 gap-y-5">
                  {sectionDivider("Identity")}

                  {tenantId ? (
                    <div className="col-span-2">
                      <label className={labelCls}>Company</label>
                      <div className={readonlyCls}>{tenants.find(t => t.id === tenantId)?.name || "Current Company"}</div>
                    </div>
                  ) : (
                    <>
                      <div>
                        <label className={labelCls}>Tenant ID</label>
                        <input value={formData.tenant_id} onChange={e => setFormData({ ...formData, tenant_id: e.target.value })} placeholder="e.g. T10001" className={inputCls} />
                      </div>
                      <div>
                        <label className={labelCls}>Upcoming User ID</label>
                        <div className={readonlyCls}>{nextUserId}</div>
                      </div>
                    </>
                  )}

                  <div>
                    <label className={labelCls}>Company User ID</label>
                    <input value={formData.company_user_id} onChange={e => setFormData({ ...formData, company_user_id: e.target.value })} placeholder="e.g. EMP-0042" className={inputCls} />
                  </div>
                  <div />

                  {sectionDivider("Personal Info")}

                  <div>
                    <label className={labelCls}>First Name</label>
                    <input value={formData.first_name} onChange={e => setFormData({ ...formData, first_name: e.target.value })} placeholder="Jane" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Last Name</label>
                    <input value={formData.last_name} onChange={e => setFormData({ ...formData, last_name: e.target.value })} placeholder="Doe" className={inputCls} />
                  </div>

                  <div>
                    <label className={labelCls}>Email Address</label>
                    <input value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} placeholder="user@company.com" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Phone</label>
                    <input value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} placeholder="123-456-7890" className={inputCls} />
                  </div>

                  {sectionDivider("Account")}

                  <div className="col-span-2">
                    <label className={labelCls}>Assigned Roles</label>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {roles.map(r => {
                        const rid = r.role_id || r.id;
                        const active = (formData.roles || []).includes(rid) || formData.role === rid;
                        return (
                          <button
                            key={r.id}
                            type="button"
                            onClick={() => {
                              const current = formData.roles || [];
                              const next = active
                                ? current.filter(v => v !== rid)
                                : [...current, rid];
                              setFormData(prev => ({ ...prev, roles: next, role: next[0] || "" }));
                            }}
                            className={`px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border-2 transition-all flex items-center gap-2 ${active
                                ? (theme === "DARK" ? "bg-[#ccff00] text-stone-950 border-[#ccff00]" : "bg-[#6348eb] text-white border-[#6348eb]")
                                : (theme === "DARK" ? "border-stone-800 text-stone-400 hover:border-stone-600" : "border-stone-200 text-stone-500 hover:border-stone-400")
                              }`}
                          >
                            <span className="material-symbols-outlined text-sm">
                              {active ? "check_circle" : "circle"}
                            </span>
                            {r.role_name}
                            {r.is_global && <span className="opacity-50 ml-1">[G]</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="col-span-2">
                    <label className="flex items-center gap-4 cursor-pointer group mt-2">
                      <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${formData.invite_user
                          ? (theme === "DARK" ? "bg-[#ccff00] border-[#ccff00]" : "bg-[#6348eb] border-[#6348eb]")
                          : (theme === "DARK" ? "border-stone-800" : "border-stone-200 shadow-sm")
                        }`}>
                        {formData.invite_user && <span className={`material-symbols-outlined text-lg ${theme === "DARK" ? "text-stone-950" : "text-white"}`}>check</span>}
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
                  </div>

                  {sectionDivider("Mailing Address")}

                  <div>
                    <label className={labelCls}>Street Address 1</label>
                    <input value={formData.address_street_1} onChange={e => setFormData({ ...formData, address_street_1: e.target.value })} placeholder="123 Main St" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Street Address 2</label>
                    <input value={formData.address_street_2} onChange={e => setFormData({ ...formData, address_street_2: e.target.value })} placeholder="Apt 4B" className={inputCls} />
                  </div>

                  <div>
                    <label className={labelCls}>City</label>
                    <input value={formData.address_city} onChange={e => setFormData({ ...formData, address_city: e.target.value })} placeholder="New York" className={inputCls} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={labelCls}>State</label>
                      <select value={formData.address_state} onChange={e => setFormData({ ...formData, address_state: e.target.value })} className={`${inputCls} appearance-none cursor-pointer ${!formData.address_state ? '!text-stone-200' : ''}`}>
                        <option value="">State...</option>
                        {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>Zip</label>
                      <input value={formData.address_zip} onChange={e => setFormData({ ...formData, address_zip: e.target.value })} placeholder="10001" className={inputCls} />
                    </div>
                  </div>

                  {sectionDivider("Notes")}

                  <div className="col-span-2">
                    <textarea
                      value={formData.notes}
                      onChange={e => setFormData({ ...formData, notes: e.target.value })}
                      placeholder="Private notes..."
                      rows={3}
                      className={`${inputCls} resize-none`}
                    />
                  </div>

                  {/* Coach Details — toggled by role */}
                  <div className={`col-span-2 pt-2 pb-1 border-b flex items-center justify-between transition-colors ${theme === "DARK" ? "border-stone-800" : "border-stone-100"}`}>
                    <div className="flex items-center gap-3">
                      <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${theme === "DARK" ? "text-stone-500" : "text-stone-400"}`}>Coach Details</span>
                      {isCoach && (
                        <span className={`text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest ${theme === "DARK" ? "bg-[#ccff00]/10 text-[#ccff00]" : "bg-[#6348eb]/10 text-[#6348eb]"
                          }`}>Coach Role Active</span>
                      )}
                    </div>
                    {!isCoach && (
                      <span className={`text-[9px] font-medium ${theme === "DARK" ? "text-stone-600" : "text-stone-400"}`}>Assign role R10002 to enable</span>
                    )}
                  </div>

                  {isCoach && (
                    <>
                      <div className="col-span-2">
                        <label className={labelCls}>Coach Description</label>
                        <textarea
                          value={formData.coach_description}
                          onChange={e => setFormData({ ...formData, coach_description: e.target.value })}
                          placeholder="Brief bio visible to members..."
                          rows={3}
                          className={`${inputCls} resize-none`}
                        />
                      </div>

                      <div>
                        <label className={labelCls}>Birth Date</label>
                        <input
                          type="date"
                          value={formData.birth_date}
                          onChange={e => setFormData({ ...formData, birth_date: e.target.value })}
                          className={inputCls}
                        />
                      </div>
                      <div>
                        <label className={labelCls}>Gender</label>
                        <select value={formData.sex} onChange={e => setFormData({ ...formData, sex: e.target.value })} className={`${inputCls} appearance-none cursor-pointer ${!formData.sex ? '!text-stone-200' : ''}`}>
                          <option value="">Select...</option>
                          <option value="Male">Male</option>
                          <option value="Female">Female</option>
                          <option value="Non-binary">Non-binary</option>
                          <option value="Prefer not to say">Prefer not to say</option>
                        </select>
                      </div>

                      <div>
                        <label className={labelCls}>Tennis Hand</label>
                        <div className="flex gap-3 mt-1">
                          {handOptions.map(hand => (
                            <button
                              key={hand}
                              type="button"
                              onClick={() => setFormData({ ...formData, tennis_hand: hand })}
                              className={`flex-1 py-3.5 rounded-2xl text-xs font-black uppercase tracking-widest border-2 transition-all ${formData.tennis_hand === hand
                                  ? (theme === "DARK" ? "bg-[#ccff00] text-stone-950 border-[#ccff00]" : "bg-[#6348eb] text-white border-[#6348eb]")
                                  : (theme === "DARK" ? "border-stone-800 text-stone-400 hover:border-stone-600" : "border-stone-200 text-stone-500 hover:border-stone-400")
                                }`}
                            >
                              <span className="material-symbols-outlined text-sm mr-1" style={{ verticalAlign: "middle" }}>
                                {hand === "Right" ? "back_hand" : "front_hand"}
                              </span>
                              {hand}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className={labelCls}>Coaching For</label>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {coachingGroups.map(group => {
                            const active = (formData.coaching_for || []).includes(group);
                            return (
                              <button
                                key={group}
                                type="button"
                                onClick={() => toggleCoachingFor(group)}
                                className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest border-2 transition-all ${active
                                    ? (theme === "DARK" ? "bg-[#ccff00] text-stone-950 border-[#ccff00]" : "bg-[#6348eb] text-white border-[#6348eb]")
                                    : (theme === "DARK" ? "border-stone-800 text-stone-400 hover:border-stone-600" : "border-stone-200 text-stone-500 hover:border-stone-400")
                                  }`}
                              >
                                {group}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="col-span-2">
                        <div className="flex items-center justify-between mb-2">
                          <label className={labelCls}>Weekly Availability</label>
                          <label className="flex items-center gap-2 cursor-pointer group">
                            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${formData.availability_enabled
                                ? (theme === "DARK" ? "bg-[#ccff00] border-[#ccff00]" : "bg-[#6348eb] border-[#6348eb]")
                                : (theme === "DARK" ? "border-stone-800" : "border-stone-200")
                              }`}>
                              {formData.availability_enabled && <span className={`material-symbols-outlined text-sm ${theme === "DARK" ? "text-stone-950" : "text-white"}`}>check</span>}
                            </div>
                            <input
                              type="checkbox"
                              className="hidden"
                              checked={formData.availability_enabled}
                              onChange={e => setFormData({ ...formData, availability_enabled: e.target.checked })}
                            />
                            <span className={`text-[10px] font-black uppercase tracking-widest ${formData.availability_enabled
                                ? (theme === "DARK" ? "text-[#ccff00]" : "text-[#6348eb]")
                                : (theme === "DARK" ? "text-stone-500" : "text-stone-400")
                              }`}>Enable Dates</span>
                          </label>
                        </div>

                        {/* Date span — controlled by checkbox */}
                        <div className={`flex items-center gap-4 mb-3 mt-1 transition-opacity ${!formData.availability_enabled ? "opacity-30 pointer-events-none grayscale" : "opacity-100"}`}>
                          <div className="flex-1">
                            <label className={`text-[9px] font-black tracking-widest uppercase mb-1 block ${theme === "DARK" ? "text-stone-600" : "text-stone-400"}`}>From</label>
                            <input
                              type="date"
                              disabled={!formData.availability_enabled}
                              value={formData.availability_from}
                              onChange={e => setFormData(prev => ({ ...prev, availability_from: e.target.value }))}
                              className={inputCls}
                            />
                          </div>
                          <div className={`text-xs font-black mt-5 ${theme === "DARK" ? "text-stone-600" : "text-stone-400"}`}>—</div>
                          <div className="flex-1">
                            <label className={`text-[9px] font-black tracking-widest uppercase mb-1 block ${theme === "DARK" ? "text-stone-600" : "text-stone-400"}`}>To</label>
                            <input
                              type="date"
                              disabled={!formData.availability_enabled}
                              value={formData.availability_to}
                              onChange={e => setFormData(prev => ({ ...prev, availability_to: e.target.value }))}
                              className={inputCls}
                            />
                          </div>
                        </div>

                        {/* Grid — always enabled */}
                        <div className={`rounded-2xl border overflow-hidden mt-1 ${theme === "DARK" ? "border-stone-800" : "border-stone-200"}`}>
                          <div className={`grid border-b ${theme === "DARK" ? "border-stone-800 bg-stone-900" : "border-stone-100 bg-stone-50"}`} style={{ gridTemplateColumns: "80px repeat(7, 1fr)" }}>
                            <div className={`px-3 py-2 text-[9px] font-black uppercase tracking-widest ${theme === "DARK" ? "text-stone-600" : "text-stone-400"}`}></div>
                            {DAYS.map(d => (
                              <div key={d} className={`px-2 py-2 text-center text-[9px] font-black uppercase tracking-widest ${theme === "DARK" ? "text-stone-400" : "text-stone-600"}`}>{d}</div>
                            ))}
                          </div>
                          {SLOTS.map((slot, si) => (
                            <div
                              key={slot}
                              className={`grid ${si < SLOTS.length - 1 ? `border-b ${theme === "DARK" ? "border-stone-800" : "border-stone-100"}` : ""}`}
                              style={{ gridTemplateColumns: "80px repeat(7, 1fr)" }}
                            >
                              <div className={`px-3 py-3 text-[9px] font-black uppercase tracking-widest flex items-center ${theme === "DARK" ? "text-stone-500 bg-stone-900/50" : "text-stone-400 bg-stone-50/50"}`}>
                                {slot}
                              </div>
                              {DAYS.map(day => {
                                const active = (formData.availability[day] || []).includes(slot);
                                return (
                                  <div key={day} className="flex items-center justify-center py-3">
                                    <button
                                      type="button"
                                      onClick={() => toggleAvailability(day, slot)}
                                      className={`w-7 h-7 rounded-lg border-2 flex items-center justify-center transition-all ${active
                                          ? (theme === "DARK" ? "bg-[#ccff00] border-[#ccff00]" : "bg-[#6348eb] border-[#6348eb]")
                                          : (theme === "DARK" ? "border-stone-700 hover:border-stone-500" : "border-stone-200 hover:border-stone-400")
                                        }`}
                                    >
                                      {active && <span className={`material-symbols-outlined text-sm ${theme === "DARK" ? "text-stone-950" : "text-white"}`}>check</span>}
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          })()}
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



      {/* Default Portrait Selector Modal (Premium Selection Interface) */}
      <Modal
        isOpen={showPortraitSelectorModal}
        onClose={() => setShowPortraitSelectorModal(false)}
        title="Select Default Portrait"
        theme={theme}
        width={700}
      >
        <div className="space-y-10 py-4">
          <div className="grid grid-cols-4 gap-6">
            {defaultPortraits.map((portrait) => (
              <button
                key={portrait.id}
                onClick={async () => {
                  if (editingUser) {
                    await handlePortraitSync(portrait.url);
                  } else {
                    setFormData(prev => ({ ...prev, portrait_url: portrait.url }));
                    showAppMessage("Portrait selected!", "INFO");
                  }
                  setShowPortraitSelectorModal(false);
                }}
                className={`group relative aspect-square rounded-[32px] overflow-hidden border-4 transition-all hover:scale-105 active:scale-95 ${theme === "DARK"
                    ? "border-stone-900 bg-stone-900 hover:border-[#ccff00]"
                    : "border-white bg-white hover:border-[#6348eb] shadow-md hover:shadow-xl"
                  } ${formData.portrait_url === portrait.url ? (theme === "DARK" ? "border-[#ccff00]" : "border-[#6348eb]") : ""}`}
              >
                <img
                  src={portrait.url}
                  alt={portrait.label}
                  className="w-full h-full object-cover transition-transform group-hover:scale-110"
                />
                <div className={`absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[2px]`}>
                  <div className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest bg-white text-black shadow-lg transform translate-y-4 group-hover:translate-y-0 transition-transform`}>
                    Select
                  </div>
                </div>
                {formData.portrait_url === portrait.url && (
                  <div className={`absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center shadow-lg animate-in zoom-in-50 duration-300 ${theme === "DARK" ? "bg-[#ccff00] text-stone-950" : "bg-[#6348eb] text-white"
                    }`}>
                    <span className="material-symbols-outlined text-sm font-black">check</span>
                  </div>
                )}
              </button>
            ))}
            {defaultPortraits.length === 0 && (
              <div className={`col-span-4 py-20 text-center rounded-[40px] border-2 border-dashed ${theme === "DARK" ? "border-stone-800 text-stone-500" : "border-stone-100 text-stone-400"
                }`}>
                <span className="material-symbols-outlined text-5xl mb-4 opacity-20">face</span>
                <p className="text-xs font-black uppercase tracking-widest">No portraits available in the library</p>

              </div>
            )}
          </div>

          <div className={`p-8 rounded-[40px] flex items-center justify-between gap-6 transition-colors ${theme === "DARK" ? "bg-stone-900/50" : "bg-stone-50"
            }`}>
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${theme === "DARK" ? "bg-stone-800 text-[#ccff00]" : "bg-white text-[#6348eb] shadow-sm"
                }`}>
                <span className="material-symbols-outlined">info</span>
              </div>
              <p className={`text-[11px] font-medium leading-relaxed max-w-sm ${theme === "DARK" ? "text-stone-400" : "text-stone-500"}`}>
                Default portraits provide a professional and consistent look across the platform. You can always revert to a custom photo later.
              </p>
            </div>
            <button
              onClick={() => setShowPortraitSelectorModal(false)}
              className={`px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${theme === "DARK" ? "bg-stone-800 text-white hover:bg-stone-700" : "bg-white text-stone-900 border hover:bg-stone-50 shadow-sm"
                }`}
            >
              Close
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
