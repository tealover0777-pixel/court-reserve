"use client";
import React, { createContext, useContext, useState, useCallback } from "react";

type NotificationType = "success" | "error" | "info";

interface Notification {
  message: string;
  type: NotificationType;
}

interface NotificationContextType {
  showNotification: (message: string, type?: NotificationType) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notification, setNotification] = useState<Notification | null>(null);

  const showNotification = useCallback((message: string, type: NotificationType = "success") => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  }, []);

  return (
    <NotificationContext.Provider value={{ showNotification }}>
      {children}
      {notification && (
        <div className={`fixed top-8 right-8 z-[9999] px-8 py-4 rounded-2xl shadow-2xl animate-in slide-in-from-right-8 duration-500 border flex items-center gap-3 ${
          notification.type === "success" 
            ? "bg-[#ccff00] text-stone-950 border-[#ccff00]" 
            : notification.type === "error"
            ? "bg-red-500 text-white border-red-600"
            : "bg-stone-900 text-white border-stone-800"
        }`}>
          <span className="material-symbols-outlined">
            {notification.type === "success" ? "check_circle" : notification.type === "error" ? "error" : "info"}
          </span>
          <span className="text-xs font-black uppercase tracking-widest">{notification.message}</span>
        </div>
      )}
    </NotificationContext.Provider>
  );
}

export function useNotification() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error("useNotification must be used within a NotificationProvider");
  }
  return context;
}
