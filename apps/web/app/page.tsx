"use client";
import React, { useState, useEffect } from "react";
import DashboardClient from "../components/DashboardClient";
import LoginView from "../components/LoginView";
import { useTenant } from "../context/TenantContext";
import { useAuth } from "../context/AuthContext";

export default function Home() {
  const { loading: tenantLoading } = useTenant();
  const { user, loading: authLoading } = useAuth();
  const [urlTenantId, setUrlTenantId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const path = window.location.pathname.split("/")[1];
      setUrlTenantId(path && path !== "" ? path : "");
    }
  }, []);

  if (tenantLoading || authLoading || urlTenantId === null) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-white">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-[#6348eb] border-t-transparent"></div>
      </div>
    );
  }

  if (!user) {
    return <LoginView />;
  }

  return <DashboardClient params={{ tenantId: urlTenantId }} />;
}
