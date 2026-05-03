"use client";
import React, { useState, useEffect } from "react";
import { db } from "../lib/firebase";
import { doc, onSnapshot, updateDoc, serverTimestamp } from "firebase/firestore";
import { useTenant } from "../context/TenantContext";

interface OrganizationViewProps {
  theme: "LIGHT" | "DARK" | "VINTAGE";
}

export default function OrganizationView({ theme }: OrganizationViewProps) {
  const { tenantId } = useTenant();
  const [activeTab, setActiveTab] = useState<"INFO" | "BRANDING" | "EMAIL" | "PAYMENT">("INFO");
  const [tenantData, setTenantData] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: "SUCCESS" | "ERROR" } | null>(null);

  useEffect(() => {
    if (!tenantId) return;
    const unsub = onSnapshot(doc(db, "tenants", tenantId), (doc) => {
      if (doc.exists()) setTenantData(doc.data());
    });
    return () => unsub();
  }, [tenantId]);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const handleSave = async (data: any) => {
    if (!tenantId) return;
    setIsSaving(true);
    try {
      await updateDoc(doc(db, "tenants", tenantId), {
        ...data,
        updated_at: serverTimestamp()
      });
      setNotification({ message: "Organization updated successfully", type: "SUCCESS" });
    } catch (err) {
      console.error(err);
      setNotification({ message: "Failed to update organization", type: "ERROR" });
    } finally {
      setIsSaving(false);
    }
  };

  const tabs = [
    { id: "INFO", label: "Information", icon: "info" },
    { id: "BRANDING", label: "Branding", icon: "palette" },
    { id: "EMAIL", label: "Email Settings", icon: "mail" },
    { id: "PAYMENT", label: "Payment & Billing", icon: "payments" },
  ];

  const isDark = theme === "DARK";
  const isVintage = theme === "VINTAGE";

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col gap-2">
        <h3 className={`text-6xl font-black italic tracking-tighter transition-all duration-500 ${
          isDark ? "text-white" : isVintage ? "text-black" : "text-stone-900"
        }`}>ORGANIZATION</h3>
        <p className={`text-xs font-bold tracking-[0.2em] uppercase ${
          isDark ? "text-stone-500" : "text-stone-400"
        }`}>Manage your brand and business core</p>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 p-1 rounded-2xl bg-stone-100/50 dark:bg-stone-950/30 w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl text-[10px] font-black tracking-widest uppercase transition-all ${
              activeTab === tab.id
                ? (isDark ? "bg-[#ccff00] text-stone-950 shadow-lg shadow-[#ccff00]/20" : "bg-white text-stone-950 shadow-sm")
                : (isDark ? "text-stone-500 hover:text-white" : "text-stone-400 hover:text-stone-900")
            }`}
          >
            <span className="material-symbols-outlined text-sm">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className={`p-12 rounded-[40px] border transition-all duration-500 ${
        isDark ? "bg-stone-950 border-stone-800" : "bg-white border-stone-100 shadow-xl shadow-stone-200/50"
      }`}>
        {activeTab === "INFO" && <InfoTab data={tenantData} onSave={handleSave} isSaving={isSaving} theme={theme} />}
        {activeTab === "BRANDING" && <BrandingTab data={tenantData} onSave={handleSave} isSaving={isSaving} theme={theme} />}
        {activeTab === "EMAIL" && <EmailTab data={tenantData} onSave={handleSave} isSaving={isSaving} theme={theme} />}
        {activeTab === "PAYMENT" && <PaymentTab data={tenantData} onSave={handleSave} isSaving={isSaving} theme={theme} />}
      </div>

      {/* Notification Toast */}
      {notification && (
        <div className="fixed bottom-12 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4">
          <div className={`px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-4 ${
            notification.type === "SUCCESS" 
              ? (isDark ? "bg-[#ccff00] text-stone-950" : "bg-stone-900 text-white") 
              : "bg-red-500 text-white"
          }`}>
            <span className="material-symbols-outlined">
              {notification.type === "SUCCESS" ? "check_circle" : "error"}
            </span>
            <span className="text-sm font-bold tracking-tight">{notification.message}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function FormField({ label, children, theme }: { label: string; children: React.ReactNode; theme: string }) {
  const isDark = theme === "DARK";
  return (
    <div className="space-y-3">
      <label className={`text-[10px] font-black tracking-widest uppercase ml-1 ${
        isDark ? "text-stone-500" : "text-stone-400"
      }`}>{label}</label>
      {children}
    </div>
  );
}

function InfoTab({ data, onSave, isSaving, theme }: any) {
  const [formData, setFormData] = useState(data || {});
  const isDark = theme === "DARK";

  const inputClasses = `w-full border rounded-2xl px-6 py-4 text-sm font-bold outline-none transition-all ${
    isDark ? "bg-stone-900 border-stone-800 text-white focus:border-[#ccff00]" : "bg-stone-50 border-stone-100 text-stone-900 focus:border-stone-400"
  }`;

  return (
    <div className="space-y-12">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <FormField label="Organization Name" theme={theme}>
          <input 
            value={formData.name || ""} 
            onChange={(e) => setFormData({...formData, name: e.target.value})}
            className={inputClasses}
          />
        </FormField>
        <FormField label="Organization ID" theme={theme}>
          <div className={`px-6 py-4 rounded-2xl font-mono text-sm opacity-50 ${isDark ? "bg-stone-900 text-white" : "bg-stone-100 text-stone-500"}`}>
            {formData.tenant_id}
          </div>
        </FormField>
        <FormField label="Primary Phone" theme={theme}>
          <input 
            value={formData.phone || ""} 
            onChange={(e) => setFormData({...formData, phone: e.target.value})}
            className={inputClasses}
          />
        </FormField>
        <FormField label="Support Email" theme={theme}>
          <input 
            value={formData.support_email || ""} 
            onChange={(e) => setFormData({...formData, support_email: e.target.value})}
            className={inputClasses}
          />
        </FormField>
      </div>
      <button 
        onClick={() => onSave(formData)}
        disabled={isSaving}
        className={`px-12 py-5 rounded-2xl text-xs font-black tracking-[0.2em] uppercase transition-all ${
          isDark ? "bg-[#ccff00] text-stone-950 hover:scale-[1.02]" : "bg-stone-900 text-white hover:shadow-xl"
        }`}
      >
        {isSaving ? "Saving..." : "Update Information"}
      </button>
    </div>
  );
}

function BrandingTab({ data, onSave, isSaving, theme }: any) {
  const isDark = theme === "DARK";
  const [formData, setFormData] = useState(data || {});

  const colorPresets = ["#ccff00", "#4f6b28", "#000000", "#ffffff", "#3b82f6", "#ef4444"];

  return (
    <div className="space-y-12">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
        <div className="space-y-6">
          <FormField label="Organization Logo" theme={theme}>
            <div className={`h-48 rounded-3xl border-2 border-dashed flex flex-col items-center justify-center gap-4 transition-colors ${
              isDark ? "border-stone-800 hover:border-stone-600 bg-stone-900/50" : "border-stone-200 hover:border-stone-300 bg-stone-50/50"
            }`}>
              <span className="material-symbols-outlined text-4xl opacity-20">add_a_photo</span>
              <p className="text-[10px] font-black tracking-widest uppercase opacity-40">Upload New Logo</p>
            </div>
          </FormField>
        </div>
        <div className="space-y-8">
          <FormField label="Primary Brand Color" theme={theme}>
            <div className="flex flex-wrap gap-4">
              {colorPresets.map(color => (
                <button
                  key={color}
                  onClick={() => setFormData({...formData, brand_color: color})}
                  className={`w-12 h-12 rounded-xl transition-all ${formData.brand_color === color ? "ring-4 ring-offset-4 ring-blue-500 scale-110" : "hover:scale-105"}`}
                  style={{ backgroundColor: color }}
                />
              ))}
              <div className="flex items-center gap-4 ml-4">
                <input 
                  type="color" 
                  value={formData.brand_color || "#ccff00"} 
                  onChange={(e) => setFormData({...formData, brand_color: e.target.value})}
                  className="w-12 h-12 rounded-xl cursor-pointer"
                />
                <span className="font-mono text-xs opacity-50 uppercase">{formData.brand_color || "#ccff00"}</span>
              </div>
            </div>
          </FormField>
          
          <FormField label="Typography Style" theme={theme}>
            <div className="grid grid-cols-2 gap-4">
              {["MODERN", "CLASSIC", "MINIMAL", "BOLD"].map(style => (
                <button
                  key={style}
                  onClick={() => setFormData({...formData, typo_style: style})}
                  className={`p-6 rounded-2xl border text-[10px] font-black tracking-widest uppercase transition-all ${
                    formData.typo_style === style
                      ? (isDark ? "bg-white text-stone-950 border-white" : "bg-stone-900 text-white border-stone-900")
                      : (isDark ? "bg-stone-900 border-stone-800 text-stone-500 hover:text-white" : "bg-white border-stone-100 text-stone-400 hover:text-stone-900 shadow-sm")
                  }`}
                >
                  {style}
                </button>
              ))}
            </div>
          </FormField>
        </div>
      </div>
      <button 
        onClick={() => onSave(formData)}
        disabled={isSaving}
        className={`px-12 py-5 rounded-2xl text-xs font-black tracking-[0.2em] uppercase transition-all ${
          isDark ? "bg-[#ccff00] text-stone-950 hover:scale-[1.02]" : "bg-stone-900 text-white hover:shadow-xl"
        }`}
      >
        {isSaving ? "Saving..." : "Apply Branding"}
      </button>
    </div>
  );
}

function EmailTab({ data, onSave, isSaving, theme }: any) {
  const isDark = theme === "DARK";
  const [formData, setFormData] = useState(data || {});

  const toggleClasses = (active: boolean) => `relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
    active ? (isDark ? "bg-[#ccff00]" : "bg-[#4f6b28]") : (isDark ? "bg-stone-800" : "bg-stone-200")
  }`;

  const toggleCircle = (active: boolean) => `inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
    active ? "translate-x-6" : "translate-x-1"
  }`;

  return (
    <div className="space-y-12">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
        <div className="space-y-8">
          {[
            { id: "notify_booking", label: "Booking Confirmation Emails", desc: "Send automated emails when a court is booked" },
            { id: "notify_payment", label: "Payment Receipt Emails", desc: "Automatically send receipts after transactions" },
            { id: "notify_program", label: "Program Enrollment Alerts", desc: "Notify staff of new program sign-ups" },
          ].map(setting => (
            <div key={setting.id} className="flex items-center justify-between p-6 rounded-3xl bg-stone-100/30 dark:bg-stone-900/30 border border-stone-100 dark:border-stone-800">
              <div className="space-y-1">
                <h6 className={`text-xs font-bold uppercase tracking-tight ${isDark ? "text-white" : "text-stone-900"}`}>{setting.label}</h6>
                <p className="text-[10px] text-stone-400 font-medium">{setting.desc}</p>
              </div>
              <button 
                onClick={() => setFormData({...formData, [setting.id]: !formData[setting.id]})}
                className={toggleClasses(formData[setting.id])}
              >
                <span className={toggleCircle(formData[setting.id])} />
              </button>
            </div>
          ))}
        </div>
        <div className="space-y-6">
          <FormField label="Custom Email Signature" theme={theme}>
            <textarea 
              rows={6}
              value={formData.email_signature || ""}
              onChange={(e) => setFormData({...formData, email_signature: e.target.value})}
              className={`w-full border rounded-2xl px-6 py-4 text-sm font-bold outline-none transition-all resize-none ${
                isDark ? "bg-stone-900 border-stone-800 text-white focus:border-[#ccff00]" : "bg-stone-50 border-stone-100 text-stone-900 focus:border-stone-400"
              }`}
              placeholder="Best regards,\nElite Tennis Team"
            />
          </FormField>
        </div>
      </div>
      <button 
        onClick={() => onSave(formData)}
        disabled={isSaving}
        className={`px-12 py-5 rounded-2xl text-xs font-black tracking-[0.2em] uppercase transition-all ${
          isDark ? "bg-[#ccff00] text-stone-950 hover:scale-[1.02]" : "bg-stone-900 text-white hover:shadow-xl"
        }`}
      >
        {isSaving ? "Saving..." : "Save Email Preferences"}
      </button>
    </div>
  );
}

function PaymentTab({ data, onSave, isSaving, theme }: any) {
  const isDark = theme === "DARK";
  const [formData, setFormData] = useState(data || {});

  return (
    <div className="space-y-12">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
        <div className="space-y-6">
          <div className={`p-8 rounded-[32px] border ${isDark ? "bg-stone-900/50 border-stone-800" : "bg-stone-50 border-stone-100"}`}>
            <div className="flex items-center justify-between mb-8">
              <span className="material-symbols-outlined text-3xl opacity-20">credit_card</span>
              <span className={`px-4 py-1.5 rounded-full text-[10px] font-black tracking-widest uppercase ${isDark ? "bg-[#ccff00]/10 text-[#ccff00]" : "bg-green-100 text-green-700"}`}>Connected</span>
            </div>
            <div className="space-y-1">
              <h6 className={`text-sm font-bold tracking-tight ${isDark ? "text-white" : "text-stone-900"}`}>•••• •••• •••• 4242</h6>
              <p className="text-[10px] text-stone-400 font-medium uppercase tracking-widest">Expires 12/26</p>
            </div>
          </div>
          <button className={`w-full py-5 rounded-2xl text-[10px] font-black tracking-widest uppercase transition-all border ${
            isDark ? "border-stone-800 text-stone-400 hover:text-white hover:bg-stone-800" : "border-stone-200 text-stone-500 hover:text-stone-900 hover:bg-stone-50"
          }`}>Update Payment Method</button>
        </div>
        <div className="space-y-8">
          <FormField label="Currency" theme={theme}>
            <select className={`w-full border rounded-2xl px-6 py-4 text-sm font-bold outline-none transition-all appearance-none ${
              isDark ? "bg-stone-900 border-stone-800 text-white focus:border-[#ccff00]" : "bg-stone-50 border-stone-100 text-stone-900 focus:border-stone-400 shadow-sm"
            }`}>
              <option>USD ($) - US Dollar</option>
              <option>EUR (€) - Euro</option>
              <option>GBP (£) - British Pound</option>
            </select>
          </FormField>
          <div className="p-6 rounded-3xl bg-blue-50/30 dark:bg-blue-900/10 border border-blue-100/50 dark:border-blue-800/30">
            <div className="flex gap-4">
              <span className="material-symbols-outlined text-blue-500">verified_user</span>
              <div className="space-y-1">
                <h6 className={`text-xs font-bold uppercase tracking-tight ${isDark ? "text-white" : "text-stone-900"}`}>Secure Transactions</h6>
                <p className="text-[10px] text-stone-400 font-medium">All payments are processed securely via Stripe. We do not store full credit card numbers on our servers.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      <button 
        onClick={() => onSave(formData)}
        disabled={isSaving}
        className={`px-12 py-5 rounded-2xl text-xs font-black tracking-[0.2em] uppercase transition-all ${
          isDark ? "bg-[#ccff00] text-stone-950 hover:scale-[1.02]" : "bg-stone-900 text-white hover:shadow-xl"
        }`}
      >
        {isSaving ? "Saving..." : "Update Billing Info"}
      </button>
    </div>
  );
}
