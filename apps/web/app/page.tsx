"use client";
import React from "react";
import DashboardClient from "../components/DashboardClient";
import LoginView from "../components/LoginView";
import { useTenant } from "../context/TenantContext";
import { useAuth } from "../context/AuthContext";

export default function Home() {
  const { loading: tenantLoading } = useTenant();
  const { user, loading: authLoading } = useAuth();

  if (tenantLoading || authLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-white">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-[#6348eb] border-t-transparent"></div>
      </div>
    );
  }

  if (!user) {
    return <LoginView />;
  }

  // Go directly to kinetic court dashboard as requested
  return <DashboardClient params={{ tenantId: "kinetic" }} />;
}
