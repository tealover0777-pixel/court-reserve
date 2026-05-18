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
          setDoc,
          doc,
        } = await import("firebase/firestore");

        const uid = firebaseUser.uid;

        let unsubs: (() => void)[] = [];

        const setupListeners = async () => {
          try {
            const userEmail = firebaseUser.email;
            
            const handleUserDoc = async (docSnap: any, isGlobal: boolean) => {
              if (!docSnap || !docSnap.exists()) return;
              const data = docSnap.data() as UserProfile;
              
              // Extract tenant_id from path if tenant-scoped user and missing
              let detectedTenantId = "";
              if (!isGlobal) {
                const pathParts = docSnap.ref.path.split("/");
                if (pathParts[0] === "tenants" && pathParts[1]) {
                  detectedTenantId = pathParts[1];
                }
              }

              console.log(`[AuthContext] Resolved profile from ${isGlobal ? 'global_users' : 'collectionGroup users'}:`, data.email);
              
              // Resolve combined profile
              setProfile({ 
                ...data, 
                tenant_id: data.tenant_id || detectedTenantId || undefined, 
                id: docSnap.id 
              });
              setLoading(false);

              // Perform self-healing and auto-activation
              const updates: any = {};
              if (data.status === "Invited") {
                updates.status = "Active";
                updates.last_login = new Date().toISOString();
              }
              if (!data.auth_uid || data.auth_uid !== uid) {
                updates.auth_uid = uid;
              }

              if (Object.keys(updates).length > 0) {
                try {
                  await setDoc(docSnap.ref, updates, { merge: true });
                  console.log(`[AuthContext] Self-healed & updated user document fields:`, updates);
                } catch (updateErr) {
                  console.error("[AuthContext] Failed to heal user document:", updateErr);
                }
              }
            };

            // 1. Concurrently listen to global_users by auth_uid or email
            const globalUidQ = query(collection(db, "global_users"), where("auth_uid", "==", uid), limit(1));
            const unsubGlobalUid = onSnapshot(globalUidQ, (snap) => {
              if (!snap.empty && snap.docs[0]) {
                handleUserDoc(snap.docs[0], true);
              }
            });
            unsubs.push(unsubGlobalUid);

            if (userEmail) {
              const globalEmailQ = query(collection(db, "global_users"), where("email", "==", userEmail), limit(1));
              const unsubGlobalEmail = onSnapshot(globalEmailQ, (snap) => {
                if (!snap.empty && snap.docs[0]) {
                  handleUserDoc(snap.docs[0], true);
                }
              });
              unsubs.push(unsubGlobalEmail);
            }

            // 2. Concurrently listen to collectionGroup("users") by auth_uid or email
            const tenantUidQ = query(collectionGroup(db, "users"), where("auth_uid", "==", uid), limit(1));
            const unsubTenantUid = onSnapshot(tenantUidQ, (snap) => {
              if (!snap.empty && snap.docs[0]) {
                handleUserDoc(snap.docs[0], false);
              }
            });
            unsubs.push(unsubTenantUid);

            if (userEmail) {
              const tenantEmailQ = query(collectionGroup(db, "users"), where("email", "==", userEmail), limit(1));
              const unsubTenantEmail = onSnapshot(tenantEmailQ, (snap) => {
                if (!snap.empty && snap.docs[0]) {
                  handleUserDoc(snap.docs[0], false);
                }
              });
              unsubs.push(unsubTenantEmail);
            }

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
          unsubs.forEach(unsub => unsub());
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
