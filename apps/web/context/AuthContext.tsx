"use client";
import React, { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, User, getAuth, signOut } from "firebase/auth";
import { auth } from "../lib/firebase";
import type { DocumentReference, DocumentSnapshot } from "firebase/firestore";

interface UserProfile {
  first_name: string;
  last_name: string;
  role: string;
  roles?: string[];
  email: string;
  auth_uid: string;
  user_id: string;
  status?: string;
  address_street?: string;
  address_city?: string;
  address_state?: string;
  address_zip?: string;
  tenant_id?: string;
  availability?: Record<string, string[]>;
  availability_from?: string;
  availability_to?: string;
  availability_enabled?: boolean;
  id: string;
  portrait_url?: string;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  logout: async () => {},
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribeProfileRef = { current: null as (() => void) | null };

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      const prevUnsub = unsubscribeProfileRef.current;
      if (prevUnsub) {
        prevUnsub();
        unsubscribeProfileRef.current = null;
      }
      setUser(firebaseUser);
      
      if (firebaseUser) {
        const { db } = await import("../lib/firebase");
        const {
          collection,
          collectionGroup,
          query,
          where,
          limit,
          getDocs,
          onSnapshot,
          updateDoc,
          doc,
        } = await import("firebase/firestore");

        const uid = firebaseUser.uid;

        let unsubGlobal: (() => void) | null = null;
        let unsubTenantGroup: (() => void) | null = null;

        const setupListeners = async () => {
          try {
            // 1. Listen to global_users in real-time
            const globalQ = query(collection(db, "global_users"), where("auth_uid", "==", uid), limit(1));
            unsubGlobal = onSnapshot(globalQ, (snap) => {
              if (!snap.empty && snap.docs[0]) {
                const docSnap = snap.docs[0];
                const data = docSnap.data() as UserProfile;
                console.log("[AuthContext] Real-time profile resolved from global_users:", data.email);
                setProfile({ ...data, id: docSnap.id });
                setLoading(false);
                
                if (data.status === "Invited") {
                  updateDoc(docSnap.ref, {
                    status: "Active",
                    last_login: new Date().toISOString(),
                  }).catch((err: unknown) => console.error("Failed to auto-activate user:", err));
                }
              }
            }, (err) => {
              console.error("Global real-time listener error:", err);
            });

            // 2. Listen to collectionGroup("users") in real-time
            const tenantQ = query(collectionGroup(db, "users"), where("auth_uid", "==", uid), limit(1));
            unsubTenantGroup = onSnapshot(tenantQ, (snap) => {
              if (!snap.empty && snap.docs[0]) {
                const docSnap = snap.docs[0];
                const data = docSnap.data() as UserProfile;
                const pathParts = docSnap.ref.path.split("/");
                let detectedTenantId = "";
                if (pathParts[0] === "tenants" && pathParts[1]) {
                  detectedTenantId = pathParts[1];
                }
                console.log("[AuthContext] Real-time profile resolved from collectionGroup users:", docSnap.ref.path, "Tenant:", detectedTenantId);
                setProfile({ ...data, tenant_id: data.tenant_id || detectedTenantId, id: docSnap.id });
                setLoading(false);

                if (data.status === "Invited") {
                  updateDoc(docSnap.ref, {
                    status: "Active",
                    last_login: new Date().toISOString(),
                  }).catch((err: unknown) => console.error("Failed to auto-activate user:", err));
                }
              }
            }, (err) => {
              console.error("Tenant collectionGroup real-time listener error:", err);
            });

            // After a short timeout, if neither has resolved, allow dashboard rendering with fallback values
            setTimeout(() => {
              setLoading(false);
            }, 1000);

          } catch (err) {
            console.error("Setup listeners failed:", err);
            setLoading(false);
          }
        };

        setupListeners();

        unsubscribeProfileRef.current = () => {
          if (unsubGlobal) unsubGlobal();
          if (unsubTenantGroup) unsubTenantGroup();
        };
      } else {
        setProfile(null);
        const u = unsubscribeProfileRef.current;
        if (u) u();
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      const u = unsubscribeProfileRef.current;
      if (u) u();
    };
  }, []);

  const logout = async () => {
    await signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
