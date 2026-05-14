"use client";
import React, { useState, useEffect } from "react";
import DashboardClient from "../components/DashboardClient";
import LoginView from "../components/LoginView";
import { useTenant } from "../context/TenantContext";
import { useAuth } from "../context/AuthContext";
import { usePathname } from "next/navigation";

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

  return <DashboardClient params={{ tenantId: "" }} />;
}
