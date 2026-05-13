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
        } = await import("firebase/firestore");

        const uid = firebaseUser.uid;

        const attachProfile = (docRef: DocumentReference) => {
          return onSnapshot(docRef, (snap: DocumentSnapshot) => {
              if (!snap.exists()) {
                setProfile(null);
                setLoading(false);
                return;
              }
              const data = snap.data() as UserProfile;
              setProfile({ ...data, id: snap.id });

              if (data.status === "Invited") {
                updateDoc(snap.ref, {
                  status: "Active",
                  last_login: new Date().toISOString(),
                }).catch((err: unknown) => console.error("Failed to auto-activate user:", err));
              }
              setLoading(false);
            },
            (error) => {
              console.error("Profile fetch error:", error);
              setLoading(false);
            }
          );
        };

        try {
          const globalQ = query(collection(db, "global_users"), where("auth_uid", "==", uid));
          const globalSnap = await getDocs(globalQ);
          if (!globalSnap.empty) {
            const first = globalSnap.docs[0];
            if (first) unsubscribeProfileRef.current = attachProfile(first.ref) as () => void;
          } else {
            const tenantQ = query(
              collectionGroup(db, "users"),
              where("auth_uid", "==", uid),
              limit(1)
            );
            const tenantSnap = await getDocs(tenantQ);
            if (!tenantSnap.empty) {
              const firstT = tenantSnap.docs[0];
              if (firstT) unsubscribeProfileRef.current = attachProfile(firstT.ref) as () => void;
            } else {
              setProfile(null);
              setLoading(false);
            }
          }
        } catch (e) {
          console.error("Profile resolve error:", e);
          setProfile(null);
          setLoading(false);
        }
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
