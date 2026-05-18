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
        let docListenerUnsub: (() => void) | null = null;

        const setupListeners = async () => {
          try {
            const userEmail = firebaseUser.email;
            
            // Fetch custom claims first to do direct subcollection query if tenantId is available
            const idTokenResult = await firebaseUser.getIdTokenResult();
            const claimTenantId = idTokenResult.claims.tenantId as string;
            console.log("[AuthContext] Loaded custom claims tenantId:", claimTenantId);
            
            let resolvedDocId: string | null = null;

            const handleUserDoc = async (docSnap: any, isGlobal: boolean) => {
              if (!docSnap || !docSnap.exists()) return;
              
              // Prevent duplicate setup/listener storm for the same document
              if (resolvedDocId === docSnap.id) return;
              resolvedDocId = docSnap.id;

              console.log(`[AuthContext] User found: ${docSnap.ref.path}. Unsubscribing temporary search queries...`);
              
              // Unsubscribe search queries immediately to stop concurrent operations
              unsubs.forEach(unsub => {
                try { unsub(); } catch (e) {}
              });
              unsubs = [];

              const initialData = docSnap.data() as UserProfile;
              
              // Extract tenant_id from path if tenant-scoped user and missing
              let detectedTenantId = "";
              if (!isGlobal) {
                const pathParts = docSnap.ref.path.split("/");
                if (pathParts[0] === "tenants" && pathParts[1]) {
                  detectedTenantId = pathParts[1];
                }
              }
              const resolvedTenantId = initialData.tenant_id || detectedTenantId || undefined;

              // Start a single, dedicated listener for real-time document updates to prevent SDK assertion crash
              console.log("[AuthContext] Starting dedicated document listener for:", docSnap.ref.path);
              docListenerUnsub = onSnapshot(docSnap.ref, async (latestSnap: any) => {
                if (!latestSnap.exists()) return;
                const latestData = latestSnap.data() as UserProfile;
                
                // Update profile state
                setProfile({ 
                  ...latestData, 
                  tenant_id: resolvedTenantId, 
                  id: latestSnap.id 
                });
                setLoading(false);

                // Perform self-healing and auto-activation safely on the single active listener
                const updates: any = {};
                if (latestData.status === "Invited") {
                  updates.status = "Active";
                  updates.last_login = new Date().toISOString();
                }
                if (!latestData.auth_uid || latestData.auth_uid !== uid) {
                  updates.auth_uid = uid;
                }

                if (Object.keys(updates).length > 0) {
                  try {
                    await setDoc(latestSnap.ref, updates, { merge: true });
                    console.log(`[AuthContext] Self-healed & updated user document fields:`, updates);
                  } catch (updateErr) {
                    console.error("[AuthContext] Failed to heal user document:", updateErr);
                  }
                }
              }, (err) => {
                console.error("[AuthContext] Dedicated document listener error:", err);
              });

              // Validate and self-heal Custom Claims if missing or out of sync (asynchronously)
              try {
                const tokenResult = await firebaseUser.getIdTokenResult();
                const currentClaims = tokenResult.claims;
                const correctTenantId = resolvedTenantId || "";
                const correctRole = initialData.role || (initialData.roles && initialData.roles[0]) || "R10001";

                if (
                  !currentClaims.tenantId || 
                  currentClaims.tenantId !== correctTenantId || 
                  !currentClaims.role || 
                  currentClaims.role !== correctRole
                ) {
                  console.log(`[AuthContext] Custom claims missing or out-of-sync. Current:`, currentClaims, `Expected:`, { tenantId: correctTenantId, role: correctRole });
                  console.log(`[AuthContext] Triggering syncUserClaims cloud function...`);
                  
                  const { functions } = await import("../lib/firebase");
                  const { httpsCallable } = await import("firebase/functions");
                  const syncClaimsFn = httpsCallable(functions, "syncUserClaims");
                  const syncRes: any = await syncClaimsFn({ email: firebaseUser.email, uid: firebaseUser.uid });
                  
                  if (syncRes && syncRes.data && syncRes.data.status === "success") {
                    console.log(`[AuthContext] Custom claims synced successfully. Force refreshing ID token...`);
                    await firebaseUser.getIdToken(true);
                    console.log(`[AuthContext] ID token refreshed successfully with active claims.`);
                  } else {
                    console.warn(`[AuthContext] syncUserClaims returned non-success:`, syncRes);
                  }
                }
              } catch (claimsErr) {
                console.error("[AuthContext] Failed to sync or verify custom claims:", claimsErr);
              }
            };

            // 1. Direct subcollection queries under specific tenant if claimTenantId exists
            if (claimTenantId) {
              console.log(`[AuthContext] Subscribing to direct tenant ${claimTenantId} queries...`);
              const directUidQ = query(collection(db, "tenants", claimTenantId, "users"), where("auth_uid", "==", uid), limit(1));
              const unsubDirectUid = onSnapshot(directUidQ, (snap) => {
                if (!snap.empty && snap.docs[0]) {
                  handleUserDoc(snap.docs[0], false);
                }
              }, (err) => {
                console.error("[AuthContext] directUidQ listener error:", err);
              });
              unsubs.push(unsubDirectUid);

              if (userEmail) {
                const directEmailQ = query(collection(db, "tenants", claimTenantId, "users"), where("email", "==", userEmail), limit(1));
                const unsubDirectEmail = onSnapshot(directEmailQ, (snap) => {
                  if (!snap.empty && snap.docs[0]) {
                    handleUserDoc(snap.docs[0], false);
                  }
                }, (err) => {
                  console.error("[AuthContext] directEmailQ listener error:", err);
                });
                unsubs.push(unsubDirectEmail);
              }
            }

            // 2. Concurrently listen to global_users by auth_uid or email
            const globalUidQ = query(collection(db, "global_users"), where("auth_uid", "==", uid), limit(1));
            const unsubGlobalUid = onSnapshot(globalUidQ, (snap) => {
              if (!snap.empty && snap.docs[0]) {
                handleUserDoc(snap.docs[0], true);
              }
            }, (err) => {
              console.error("[AuthContext] globalUidQ listener error:", err);
            });
            unsubs.push(unsubGlobalUid);

            if (userEmail) {
              const globalEmailQ = query(collection(db, "global_users"), where("email", "==", userEmail), limit(1));
              const unsubGlobalEmail = onSnapshot(globalEmailQ, (snap) => {
                if (!snap.empty && snap.docs[0]) {
                  handleUserDoc(snap.docs[0], true);
                }
              }, (err) => {
                console.error("[AuthContext] globalEmailQ listener error:", err);
              });
              unsubs.push(unsubGlobalEmail);
            }

            // 3. Concurrently listen to collectionGroup("users") by auth_uid or email (as fallback)
            const tenantUidQ = query(collectionGroup(db, "users"), where("auth_uid", "==", uid), limit(1));
            const unsubTenantUid = onSnapshot(tenantUidQ, (snap) => {
              if (!snap.empty && snap.docs[0]) {
                handleUserDoc(snap.docs[0], false);
              }
            }, (err) => {
              console.error("[AuthContext] tenantUidQ listener error:", err);
            });
            unsubs.push(unsubTenantUid);

            if (userEmail) {
              const tenantEmailQ = query(collectionGroup(db, "users"), where("email", "==", userEmail), limit(1));
              const unsubTenantEmail = onSnapshot(tenantEmailQ, (snap) => {
                if (!snap.empty && snap.docs[0]) {
                  handleUserDoc(snap.docs[0], false);
                }
              }, (err) => {
                console.error("[AuthContext] tenantEmailQ listener error:", err);
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
          if (docListenerUnsub) {
            try { docListenerUnsub(); } catch (e) {}
          }
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
