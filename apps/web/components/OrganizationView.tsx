"use client";
import React, { useState, useEffect } from "react";
import { db, storage } from "../lib/firebase";
import { doc, onSnapshot, setDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { useTenant } from "../context/TenantContext";

const US_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA", 
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD", 
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ", 
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC", 
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY"
];

interface OrganizationViewProps {
  theme: "LIGHT" | "DARK" | "VINTAGE";
  tenantId?: string | null;
}

export default function OrganizationView({ theme, tenantId: tenantIdProp }: OrganizationViewProps) {
  const { tenantId: contextTenantId } = useTenant();
  const tenantId = tenantIdProp ?? contextTenantId;
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
      await setDoc(doc(db, "tenants", tenantId), {
        ...data,
        updated_at: serverTimestamp()
      }, { merge: true });
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
        {activeTab === "BRANDING" && <BrandingTab data={tenantData} onSave={handleSave} isSaving={isSaving} theme={theme} tenantId={tenantId} />}
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

  useEffect(() => {
    if (data) setFormData(data);
  }, [data]);

  const inputClasses = `w-full border rounded-2xl px-6 py-4 text-sm font-bold outline-none transition-all ${
    isDark ? "bg-stone-900 border-stone-800 text-white focus:border-[#ccff00]" : "bg-stone-50 border-stone-100 text-stone-900 focus:border-stone-400"
  }`;

  return (
    <div className="space-y-12">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
        <div className="space-y-8">
          <h4 className={`text-[10px] font-black tracking-[0.2em] uppercase opacity-40 ${isDark ? "text-white" : "text-stone-900"}`}>General Info</h4>
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
              value={formData.owner_phone || formData.phone || ""} 
              onChange={(e) => setFormData({...formData, owner_phone: e.target.value})}
              className={inputClasses}
            />
          </FormField>
          <FormField label="Support Email" theme={theme}>
            <input 
              value={formData.owner_email || formData.support_email || ""} 
              onChange={(e) => setFormData({...formData, owner_email: e.target.value})}
              className={inputClasses}
            />
          </FormField>
        </div>

        <div className="space-y-8">
          <h4 className={`text-[10px] font-black tracking-[0.2em] uppercase opacity-40 ${isDark ? "text-white" : "text-stone-900"}`}>Address</h4>
          <FormField label="Street Address" theme={theme}>
            <input 
              value={formData.address_street_1 || ""} 
              onChange={(e) => setFormData({...formData, address_street_1: e.target.value})}
              className={inputClasses}
              placeholder="123 Tennis Ave"
            />
          </FormField>
          <FormField label="Suite / Unit" theme={theme}>
            <input 
              value={formData.address_street_2 || ""} 
              onChange={(e) => setFormData({...formData, address_street_2: e.target.value})}
              className={inputClasses}
              placeholder="Suite 100"
            />
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="City" theme={theme}>
              <input 
                value={formData.address_city || ""} 
                onChange={(e) => setFormData({...formData, address_city: e.target.value})}
                className={inputClasses}
              />
            </FormField>
            <FormField label="State" theme={theme}>
              <select 
                value={formData.address_state || ""} 
                onChange={(e) => setFormData({...formData, address_state: e.target.value})}
                className={`${inputClasses} appearance-none`}
              >
                <option value="">Select State</option>
                {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </FormField>
          </div>
          <FormField label="Zip Code" theme={theme}>
            <input 
              value={formData.address_zip || ""} 
              onChange={(e) => setFormData({...formData, address_zip: e.target.value})}
              className={inputClasses}
            />
          </FormField>
        </div>

        <div className="md:col-span-2 pt-8 border-t border-stone-100 dark:border-stone-800">
          <h4 className={`text-[10px] font-black tracking-[0.2em] uppercase opacity-40 mb-8 ${isDark ? "text-white" : "text-stone-900"}`}>Owner Details</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <FormField label="First Name" theme={theme}>
              <input 
                value={formData.owner_first_name || ""} 
                onChange={(e) => setFormData({...formData, owner_first_name: e.target.value})}
                className={inputClasses}
              />
            </FormField>
            <FormField label="Last Name" theme={theme}>
              <input 
                value={formData.owner_last_name || ""} 
                onChange={(e) => setFormData({...formData, owner_last_name: e.target.value})}
                className={inputClasses}
              />
            </FormField>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button 
          onClick={() => onSave(formData)}
          disabled={isSaving}
          className={`px-12 py-5 rounded-2xl text-xs font-black tracking-[0.2em] uppercase transition-all ${
            isDark ? "bg-[#ccff00] text-stone-950 hover:scale-[1.02]" : "bg-stone-900 text-white hover:shadow-xl"
          }`}
        >
          {isSaving ? "Saving..." : "Save All Changes"}
        </button>
      </div>
    </div>
  );
}

function BrandingTab({ data, onSave, isSaving, theme, tenantId }: any) {
  const isDark = theme === "DARK";
  const [formData, setFormData] = useState(data || {});
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (data) setFormData(data);
  }, [data]);

  const processLogoFile = async (file: File) => {
    if (!file || !tenantId) return;
    setIsUploading(true);
    try {
      const storageRef = ref(storage, `tenants/${tenantId}/branding/logo_${Date.now()}`);
      const snapshot = await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(snapshot.ref);
      
      setFormData({ ...formData, logo_url: downloadURL });
      await setDoc(doc(db, "tenants", tenantId), {
        logo_url: downloadURL,
        updated_at: serverTimestamp()
      }, { merge: true });
    } catch (err) {
      console.error("Logo upload failed:", err);
    } finally {
      setIsUploading(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await processLogoFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      await processLogoFile(file);
    }
  };

  const colorPresets = ["#ccff00", "#4f6b28", "#000000", "#ffffff", "#3b82f6", "#ef4444"];

  return (
    <div className="space-y-12">
      <div className="max-w-4xl space-y-12">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
          <FormField label="Organization Name" theme={theme}>
            <input 
              value={formData.name || ""} 
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              className={`w-full border rounded-2xl px-6 py-4 text-sm font-bold outline-none transition-all ${
                isDark ? "bg-stone-900 border-stone-800 text-white focus:border-[#ccff00]" : "bg-stone-50 border-stone-100 text-stone-900 focus:border-stone-400"
              }`}
              placeholder="Enter organization name"
            />
          </FormField>
        </div>

        <div className="space-y-6">
          <FormField label="Organization Logo" theme={theme}>
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleLogoUpload} 
              className="hidden" 
              accept="image/*"
            />
            <div 
              onClick={() => fileInputRef.current?.click()}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`h-64 rounded-[40px] border-2 border-dashed flex flex-col items-center justify-center gap-6 transition-all cursor-pointer relative overflow-hidden group max-w-2xl ${
                isDragging 
                  ? (isDark ? "border-[#ccff00] bg-[#ccff00]/10 scale-[1.02]" : "border-stone-900 bg-stone-100 scale-[1.02]")
                  : (isDark ? "border-stone-800 hover:border-[#ccff00]/50 bg-stone-900/50" : "border-stone-200 hover:border-stone-400 bg-stone-50/50")
              }`}
            >
              {formData.logo_url ? (
                <>
                  <img src={formData.logo_url} alt="Logo" className="h-32 w-auto object-contain z-10 transition-transform group-hover:scale-105" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                    <span className="text-white text-[10px] font-black tracking-widest uppercase">Change Logo</span>
                  </div>
                </>
              ) : (
                <>
                  <span className={`material-symbols-outlined text-5xl opacity-20 ${isDark ? "text-white" : "text-stone-900"}`}>
                    {isUploading ? "sync" : "add_a_photo"}
                  </span>
                  <div className="text-center space-y-2">
                    <p className="text-[10px] font-black tracking-widest uppercase opacity-40">
                      {isUploading ? "Uploading..." : "Upload Organization Logo"}
                    </p>
                    <p className="text-[8px] font-bold text-stone-400 uppercase tracking-[0.2em]">Drag and drop or click to browse</p>
                  </div>
                </>
              )}
            </div>
          </FormField>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button 
          onClick={() => onSave(formData)}
          disabled={isSaving}
          className={`px-12 py-5 rounded-2xl text-xs font-black tracking-[0.2em] uppercase transition-all ${
            isDark ? "bg-[#ccff00] text-stone-950 hover:scale-[1.02]" : "bg-stone-900 text-white hover:shadow-xl"
          }`}
        >
          {isSaving ? "Saving..." : "Apply Branding"}
        </button>

        <button 
          onClick={() => fileInputRef.current?.click()}
          className={`px-10 py-5 rounded-2xl text-xs font-black tracking-[0.2em] uppercase transition-all border ${
            isDark ? "border-stone-700 text-stone-400 hover:text-white hover:border-white" : "border-stone-200 text-stone-500 hover:text-stone-900 hover:border-stone-900"
          }`}
        >
          Replace LOGO
        </button>
      </div>
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
