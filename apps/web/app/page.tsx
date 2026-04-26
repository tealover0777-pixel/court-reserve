"use client";
import React from "react";
import DashboardClient from "../components/DashboardClient";
import { useTenant } from "../context/TenantContext";

export default function Home() {
  const { loading } = useTenant();

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  // Go directly to kinetic court dashboard as requested
  return <DashboardClient params={{ tenantId: "kinetic" }} />;
}
