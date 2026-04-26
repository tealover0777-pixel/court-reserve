"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { auth } from "../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";

interface TenantContextType {
  tenantId: string | null;
  loading: boolean;
}

const TenantContext = createContext<TenantContextType>({
  tenantId: null,
  loading: true,
});

export const TenantProvider = ({ children }: { children: React.ReactNode }) => {
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // Force refresh the token to get the latest custom claims
        try {
          const idTokenResult = await user.getIdTokenResult(true);
          const tid = idTokenResult.claims.tenantId as string;
          if (tid) {
            setTenantId(tid);
          } else {
            // Default fallback for demo purposes if no claim exists
            setTenantId("kinetic");
          }
        } catch (e) {
          console.error("Error fetching tenant claim:", e);
          setTenantId("kinetic");
        }
      } else {
        setTenantId(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <TenantContext.Provider value={{ tenantId, loading }}>
      {children}
    </TenantContext.Provider>
  );
};

export const useTenant = () => useContext(TenantContext);
