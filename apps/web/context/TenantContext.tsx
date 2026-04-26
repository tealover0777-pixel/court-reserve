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
    // Initial check from URL for non-logged in state
    const pathParts = window.location.pathname.split("/").filter(Boolean);
    if (pathParts.length > 0 && pathParts[0]) {
      const reserved = ["login", "register", "admin", "dashboard"];
      if (!reserved.includes(pathParts[0])) {
        setTenantId(pathParts[0]);
      }
    }

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // Force refresh the token to get the latest custom claims
        try {
          const idTokenResult = await user.getIdTokenResult(true);
          const tid = idTokenResult.claims.tenantId as string;
          if (tid) setTenantId(tid);
        } catch (e) {
          console.error("Error fetching tenant claim:", e);
        }
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
