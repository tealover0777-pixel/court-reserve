"use client";
import React, { useState, useEffect } from "react";
import { db, storage } from "../lib/firebase";
import { collection, doc, onSnapshot, orderBy, query, setDoc, serverTimestamp, deleteDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { useTenant } from "../context/TenantContext";
import { Modal } from "@repo/ui/modal";

const US_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY"
];

interface CompanyViewProps {
  theme: "LIGHT" | "DARK" | "VINTAGE";
  tenantId?: string | null;
}

export default function CompanyView({ theme, tenantId: tenantIdProp }: CompanyViewProps) {
  const { tenantId: contextTenantId } = useTenant();
  const tenantId = tenantIdProp !== undefined ? tenantIdProp : contextTenantId;
  const isGlobalView = !tenantId || tenantId === "Global" || tenantId === "consolidated";
  const [activeTab, setActiveTab] = useState<"INFO" | "BRANDING" | "EMAIL" | "COURT" | "PAYMENT" | "PHOTOS">("INFO");
  const [tenantData, setTenantData] = useState<any>(null);
  const [dimensions, setDimensions] = useState<Record<string, string[]>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: "SUCCESS" | "ERROR" } | null>(null);

  useEffect(() => {
    if (isGlobalView) {
      // Platform view: Listen to multiple documents in platform_company
      const documents = ["information", "branding", "email", "payment"];
      const unsubs = documents.map(docId => 
        onSnapshot(doc(db, "platform_company", docId), (snapshot) => {
          if (snapshot.exists()) {
            setTenantData((prev: any) => ({ ...prev, ...snapshot.data() }));
          }
        })
      );
      return () => unsubs.forEach(unsub => unsub());
    } else if (tenantId) {
      // Tenant view: Listen to the single tenant document
      const unsub = onSnapshot(doc(db, "tenants", tenantId), (snapshot) => {
        if (snapshot.exists()) {
          setTenantData(snapshot.data());
        }
      });
      return () => unsub();
    }
  }, [tenantId, isGlobalView]);

  useEffect(() => {
    const dimQuery = query(collection(db, "dimensions"), orderBy("category", "asc"));
    const unsub = onSnapshot(dimQuery, (snapshot) => {
      const mapped: Record<string, string[]> = {};
      snapshot.docs.forEach((snap) => {
        const data = snap.data();
        const category = String(data.category || "").trim();
        if (category) {
          mapped[category.toLowerCase()] = Array.isArray(data.items) ? data.items.map((item: string) => String(item)) : [];
        }
      });
      setDimensions(mapped);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [notification]);


  const handleSave = async (data: any, docId: string) => {
    setIsSaving(true);
    try {
      const cleanData = Object.fromEntries(
        Object.entries(data).filter(([_, v]) => v !== undefined)
      );

      if (isGlobalView) {
        // Save to specific platform_company document
        await setDoc(doc(db, "platform_company", docId), {
          ...cleanData,
          updated_at: serverTimestamp()
        }, { merge: true });
      } else if (tenantId) {
        // Save all data to the tenant document
        await setDoc(doc(db, "tenants", tenantId), {
          ...cleanData,
          updated_at: serverTimestamp()
        }, { merge: true });
      }
      setNotification({ message: "Update successful", type: "SUCCESS" });
    } catch (err) {
      console.error(err);
      setNotification({ message: "Failed to update", type: "ERROR" });
    } finally {
      setIsSaving(false);
    }
  };

  const tabs = [
    { id: "INFO", label: "Information", icon: "info" },
    { id: "BRANDING", label: "Branding", icon: "palette" },
    { id: "EMAIL", label: "Email Settings", icon: "mail" },
    { id: "COURT", label: isGlobalView ? "Default Court" : "Court", icon: "sports_tennis" },
    { id: "PAYMENT", label: "Payment & Billing", icon: "payments" },
    { id: "PHOTOS", label: isGlobalView ? "Default player photo" : "Photos", icon: "photo_library" }
  ];

  const isDark = theme === "DARK";
  const isVintage = theme === "VINTAGE";

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col gap-2">
        <h3 className={`text-6xl font-black italic tracking-tighter transition-all duration-500 ${isDark ? "text-white" : isVintage ? "text-black" : "text-stone-900"
          }`}>{isGlobalView ? "PLATFORM COMPANY" : "COMPANY"}</h3>
        <p className={`text-xs font-bold tracking-[0.2em] uppercase ${isDark ? "text-stone-200" : "text-stone-900"}`}>Manage your brand and business core</p>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 p-1 rounded-2xl bg-stone-100/50 dark:bg-stone-950/30 w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl text-[10px] font-black tracking-widest uppercase transition-all ${activeTab === tab.id
                ? (isDark ? "bg-[#ccff00] text-stone-950 shadow-lg shadow-[#ccff00]/20" : "bg-white text-stone-950 shadow-sm")
                : (isDark ? "text-stone-300 hover:text-white" : "text-stone-950 hover:text-stone-900")
              }`}
          >
            <span className="material-symbols-outlined text-sm">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className={`p-12 rounded-[40px] border transition-all duration-500 ${isDark ? "bg-stone-950 border-stone-800" : "bg-white border-stone-100 shadow-xl shadow-stone-200/50"
        }`}>
        {activeTab === "INFO" && <InfoTab data={tenantData} onSave={(d: any) => handleSave(d, "information")} isSaving={isSaving} theme={theme} isGlobalView={isGlobalView} />}
        {activeTab === "BRANDING" && <BrandingTab data={tenantData} onSave={(d: any) => handleSave(d, "branding")} isSaving={isSaving} theme={theme} tenantId={tenantId} isGlobalView={isGlobalView} />}
        {activeTab === "EMAIL" && <EmailTab data={tenantData} onSave={(d: any) => handleSave(d, "email")} isSaving={isSaving} theme={theme} tenantId={tenantId} isGlobalView={isGlobalView} />}
        {activeTab === "COURT" && (
          isGlobalView 
            ? <DefaultCourtsTab theme={theme} setNotification={setNotification} />
            : <CourtTab data={tenantData} onSave={(d: any) => handleSave(d, "information")} isSaving={isSaving} theme={theme} dimensions={dimensions} tenantId={tenantId} />
        )}
        {activeTab === "PAYMENT" && <PaymentTab data={tenantData} onSave={(d: any) => handleSave(d, "payment")} isSaving={isSaving} theme={theme} />}
        {activeTab === "PHOTOS" && <PhotosTab theme={theme} setNotification={setNotification} />}
      </div>

      {/* Notification Toast */}
      {notification && (
        <div className="fixed bottom-12 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4">
          <div className={`px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-4 ${notification.type === "SUCCESS"
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
      <label className={`text-[10px] font-black tracking-widest uppercase ml-1 ${isDark ? "text-stone-300" : "text-stone-950"}`}>{label}</label>
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

  const inputClasses = `w-full border rounded-2xl px-6 py-4 text-sm font-bold outline-none transition-all ${isDark ? "bg-stone-900 border-stone-800 text-white focus:border-[#ccff00]" : "bg-stone-50 border-stone-100 text-stone-900 focus:border-stone-400"
    }`;

  return (
    <div className="space-y-12">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
        <div className="space-y-8">
          <h4 className={`text-[10px] font-black tracking-[0.2em] uppercase opacity-40 ${isDark ? "text-white" : "text-stone-900"}`}>General Info</h4>
          <FormField label="Company Name" theme={theme}>
            <input
              value={formData.name || ""}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className={inputClasses}
            />
          </FormField>
          <FormField label="Company ID" theme={theme}>
            <div className={`px-6 py-4 rounded-2xl font-mono text-sm ${isDark ? "bg-stone-900 text-stone-300" : "bg-stone-100 text-stone-700"}`}>
              {formData.tenant_id}
            </div>
          </FormField>
          <FormField label="Primary Phone" theme={theme}>
            <input
              value={formData.owner_phone || formData.phone || ""}
              onChange={(e) => setFormData({ ...formData, owner_phone: e.target.value })}
              className={inputClasses}
            />
          </FormField>
          <FormField label="Support Email" theme={theme}>
            <input
              value={formData.owner_email || formData.support_email || ""}
              onChange={(e) => setFormData({ ...formData, owner_email: e.target.value })}
              className={inputClasses}
            />
          </FormField>
        </div>

        <div className="space-y-8">
          <h4 className={`text-[10px] font-black tracking-[0.2em] uppercase opacity-40 ${isDark ? "text-white" : "text-stone-900"}`}>Address</h4>
          <FormField label="Street Address 1" theme={theme}>
            <input
              value={formData.address_street_1 || ""}
              onChange={(e) => setFormData({ ...formData, address_street_1: e.target.value })}
              className={inputClasses}
              placeholder="123 Tennis Ave"
            />
          </FormField>
          <FormField label="Street Address 2" theme={theme}>
            <input
              value={formData.address_street_2 || ""}
              onChange={(e) => setFormData({ ...formData, address_street_2: e.target.value })}
              className={inputClasses}
              placeholder="Suite 100"
            />
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="City" theme={theme}>
              <input
                value={formData.address_city || ""}
                onChange={(e) => setFormData({ ...formData, address_city: e.target.value })}
                className={inputClasses}
              />
            </FormField>
            <FormField label="State" theme={theme}>
              <select
                value={formData.address_state || ""}
                onChange={(e) => setFormData({ ...formData, address_state: e.target.value })}
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
              onChange={(e) => setFormData({ ...formData, address_zip: e.target.value })}
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
                onChange={(e) => setFormData({ ...formData, owner_first_name: e.target.value })}
                className={inputClasses}
              />
            </FormField>
            <FormField label="Last Name" theme={theme}>
              <input
                value={formData.owner_last_name || ""}
                onChange={(e) => setFormData({ ...formData, owner_last_name: e.target.value })}
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
          className={`px-12 py-5 rounded-2xl text-xs font-black tracking-[0.2em] uppercase transition-all ${isDark ? "bg-[#ccff00] text-stone-950 hover:scale-[1.02]" : "bg-stone-900 text-white hover:shadow-xl"
            }`}
        >
          {isSaving ? "Saving..." : "Save All Changes"}
        </button>
      </div>
    </div>
  );
}

function BrandingTab({ data, onSave, isSaving, theme, tenantId, isGlobalView }: any) {
  const isDark = theme === "DARK";
  const [formData, setFormData] = useState(data || {});
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (data) setFormData(data);
  }, [data]);

  const processLogoFile = async (file: File) => {
    if (!file) return;
    if (!isGlobalView && !tenantId) return;
    
    setIsUploading(true);
    try {
      const storagePath = isGlobalView 
        ? `platform/branding/logo_${Date.now()}` 
        : `tenants/${tenantId}/branding/logo_${Date.now()}`;
        
      const storageRef = ref(storage, storagePath);
      const snapshot = await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(snapshot.ref);

      setFormData({ ...formData, logo_url: downloadURL });
      
      if (isGlobalView) {
        await setDoc(doc(db, "platform_company", "branding"), {
          logo_url: downloadURL,
          updated_at: serverTimestamp()
        }, { merge: true });
      } else if (tenantId) {
        await setDoc(doc(db, "tenants", tenantId), {
          logo_url: downloadURL,
          updated_at: serverTimestamp()
        }, { merge: true });
      }
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
          <FormField label="Company Name" theme={theme}>
            <input
              value={formData.name || ""}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className={`w-full border rounded-2xl px-6 py-4 text-sm font-bold outline-none transition-all ${isDark ? "bg-stone-900 border-stone-800 text-white focus:border-[#ccff00]" : "bg-stone-50 border-stone-100 text-stone-900 focus:border-stone-400"
                }`}
              placeholder="Enter company name"
            />
          </FormField>
        </div>

        <div className="space-y-6">
          <FormField label="Company Logo" theme={theme}>
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
              className={`h-64 rounded-[40px] border-2 border-dashed flex flex-col items-center justify-center gap-6 transition-all cursor-pointer relative overflow-hidden group max-w-2xl ${isDragging
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
                    <p className={`text-[10px] font-black tracking-widest uppercase ${isDark ? "text-stone-300" : "text-stone-500"}`}>
                      {isUploading ? "Uploading..." : "Upload Company Logo"}
                    </p>
                    <p className={`text-[8px] font-bold uppercase tracking-[0.2em] ${isDark ? "text-stone-300" : "text-stone-950"}`}>Drag and drop or click to browse</p>
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
          className={`px-12 py-5 rounded-2xl text-xs font-black tracking-[0.2em] uppercase transition-all ${isDark ? "bg-[#ccff00] text-stone-950 hover:scale-[1.02]" : "bg-stone-900 text-white hover:shadow-xl"
            }`}
        >
          {isSaving ? "Saving..." : "Apply Branding"}
        </button>

        <button
          onClick={() => fileInputRef.current?.click()}
          className={`px-10 py-5 rounded-2xl text-xs font-black tracking-[0.2em] uppercase transition-all border ${isDark ? "border-stone-800 text-stone-200 hover:text-white" : "border-stone-200 text-stone-950 hover:text-stone-900"}`}
        >
          Replace LOGO
        </button>
      </div>
    </div>
  );
}

function EmailTab({ data, onSave, isSaving, theme, tenantId }: any) {
  const isDark = theme === "DARK";
  const [formData, setFormData] = useState({
    delivery_method: "API",
    smtp_service: "Gmail",
    smtp_2fa: true,
    smtp_tls: true,
    use_platform_email: false,
    ...data
  });

  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<{
    type: "SUCCESS" | "ERROR";
    message: string;
    hint?: string;
    helpUrl?: string;
  } | null>(null);

  /** Maps raw SMTP error text → friendly hint + help link */
  const classifySmtpError = (raw: string): { message: string; hint: string; helpUrl?: string } => {
    const r = raw.toLowerCase();
    if (r.includes("badcredentials") || r.includes("username and password not accepted") || r.includes("535")) {
      return {
        message: "Invalid login — Gmail rejected the credentials.",
        hint: "Gmail requires an App Password when 2FA is enabled. Enable the '2FA' checkbox and paste a 16-character App Password (not your account password).",
        helpUrl: "https://myaccount.google.com/apppasswords",
      };
    }
    if (r.includes("self signed certificate") || r.includes("certificate")) {
      return { message: "TLS certificate error.", hint: "Disable the TLS/SSL option or contact your SMTP provider." };
    }
    if (r.includes("econnrefused") || r.includes("enotfound") || r.includes("econnreset")) {
      return { message: "Could not connect to SMTP server.", hint: "Check the SMTP Host and Port. Make sure port 587 (TLS) or 465 (SSL) is correct for your provider." };
    }
    if (r.includes("530") || r.includes("authentication required")) {
      return { message: "SMTP authentication required.", hint: "Your server requires a username and password. Fill in the SMTP User and Password fields." };
    }
    if (r.includes("550") || r.includes("user unknown") || r.includes("no such user")) {
      return { message: "Recipient address rejected.", hint: "The test email address may not exist. Try a different inbox." };
    }
    return { message: raw, hint: "Double-check your SMTP credentials, host, and port." };
  };

  const handleVerifyEmail = async () => {
    if (!formData.test_email) {
      setVerificationStatus({ type: "ERROR", message: "Please enter a test email address." });
      return;
    }
    if (!formData.from_email) {
      setVerificationStatus({ type: "ERROR", message: "Please enter a From Email Address before verifying." });
      return;
    }

    setIsVerifying(true);
    setVerificationStatus(null);

    try {
      const FUNCTION_URL =
        "https://us-central1-court-reserve-9eeed.cloudfunctions.net/sendVerificationEmail";

      const res = await fetch(FUNCTION_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from_email: formData.from_email,
          from_name: formData.from_name,
          test_email: formData.test_email,
          smtp_host: formData.smtp_host,
          smtp_port: formData.smtp_port,
          smtp_user: formData.smtp_user,
          smtp_password: formData.smtp_password,
          smtp_app_password: formData.smtp_app_password,
          smtp_2fa: formData.smtp_2fa,
          smtp_tls: formData.smtp_tls,
          delivery_method: formData.delivery_method,
          smtp_service: formData.smtp_service,
        }),
      });

      const json = await res.json();
      if (json.success) {
        setVerificationStatus({
          type: "SUCCESS",
          message: `Email delivered to ${formData.test_email}`,
          hint: "Check your inbox — the verification email should arrive within a minute.",
        });
      } else {
        const classified = classifySmtpError(json.error || "");
        setVerificationStatus({ type: "ERROR", ...classified });
      }
    } catch (err) {
      setVerificationStatus({ type: "ERROR", message: "Network error — make sure the server is running." });
    } finally {
      setIsVerifying(false);
    }
  };

  const inputClasses = `w-full border rounded-2xl px-6 py-4 text-sm font-bold outline-none transition-all ${isDark ? "bg-stone-900 border-stone-800 text-white focus:border-[#ccff00]" : "bg-stone-50 border-stone-100 text-stone-900 focus:border-stone-400"
    }`;

  return (
    <div className="space-y-16 animate-in fade-in duration-700">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
        <div className="space-y-2">
          <h3 className={`text-3xl font-black tracking-tighter uppercase transition-colors ${isDark ? "text-white" : "text-black"}`}>Email Setup</h3>
          <p className={`${isDark ? "text-stone-300" : "text-stone-900"} text-xs font-medium`}>Configure how your marketing and system emails are delivered.</p>
        </div>

        {tenantId !== "Global" && (
          <div className={`p-6 px-8 rounded-3xl border transition-all flex items-center gap-6 min-w-[320px] ${isDark ? "bg-stone-900/50 border-stone-800" : "bg-stone-50 border-stone-100"
            }`}>
            <div className="flex-1 space-y-1">
              <h4 className={`text-[10px] font-black uppercase tracking-widest ${isDark ? "text-white" : "text-stone-900"}`}>Use Platform Email Service</h4>
              <p className={`text-[8px] font-bold uppercase tracking-tight ${isDark ? "text-stone-300" : "text-stone-950"}`}>Inherit from master company</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={formData.use_platform_email}
                onChange={(e) => setFormData({ ...formData, use_platform_email: e.target.checked })}
              />
              <div className="w-12 h-6 bg-stone-200 peer-focus:outline-none rounded-full peer dark:bg-stone-800 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-green-500"></div>
            </label>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-16 gap-y-12">
        {/* Left Column: Common Fields */}
        <div className="space-y-12">
          <div className="space-y-8">
            <h4 className={`text-[10px] font-black tracking-[0.2em] uppercase opacity-40 ${isDark ? "text-white" : "text-stone-900"}`}>Common Fields (Required)</h4>
            <div className="space-y-6">
              <FormField label="From Email Address" theme={theme}>
                <input
                  value={formData.from_email || ""}
                  onChange={(e) => setFormData({ ...formData, from_email: e.target.value })}
                  className={inputClasses}
                  placeholder="e.g. hello@company.com"
                />
              </FormField>
              <FormField label="From Name" theme={theme}>
                <input
                  value={formData.from_name || ""}
                  onChange={(e) => setFormData({ ...formData, from_name: e.target.value })}
                  className={inputClasses}
                  placeholder="e.g. Company Team"
                />
              </FormField>
            </div>
          </div>

          <div className={`space-y-8 pt-8 border-t border-stone-100 dark:border-stone-800 transition-opacity duration-300 ${formData.use_platform_email ? "opacity-40 pointer-events-none grayscale" : ""}` }>
            <h4 className={`text-[10px] font-black tracking-[0.2em] uppercase opacity-40 ${isDark ? "text-white" : "text-stone-900"}`}>Delivery Method</h4>
            <div className={`p-1 rounded-2xl flex items-center bg-stone-100 dark:bg-stone-950 w-full`}>
              <button
                onClick={() => setFormData({ ...formData, delivery_method: "API" })}
                className={`flex-1 py-3 px-4 rounded-xl text-[10px] font-black tracking-widest uppercase transition-all ${formData.delivery_method === "API"
                    ? (isDark ? "bg-[#ccff00] text-stone-950 shadow-lg shadow-[#ccff00]/10" : "bg-white text-stone-900 shadow-sm")
                    : (isDark ? "text-stone-300 hover:text-white" : "text-stone-950 hover:text-stone-900")
                  }`}
              >
                Service Provider (API)
              </button>
              <button
                onClick={() => setFormData({ ...formData, delivery_method: "SMTP" })}
                className={`flex-1 py-3 px-4 rounded-xl text-[10px] font-black tracking-widest uppercase transition-all relative ${formData.delivery_method === "SMTP"
                    ? (isDark ? "bg-[#ccff00] text-stone-950 shadow-lg shadow-[#ccff00]/10" : "bg-stone-900 text-white shadow-lg")
                    : (isDark ? "text-stone-300 hover:text-white" : "text-stone-950 hover:text-stone-900")
                  }`}
              >
                Custom SMTP
                {formData.delivery_method === "SMTP" && (
                  <span className="absolute -top-1 -right-1 bg-green-500 text-white text-[8px] px-1.5 py-0.5 rounded-full ring-2 ring-white dark:ring-stone-900">ACTIVE</span>
                )}
              </button>
            </div>
          </div>

          <div className={`p-10 rounded-[40px] space-y-6 transition-all ${isDark ? "bg-stone-900/30 border border-stone-800" : "bg-stone-100/50 border border-stone-200"}`}>
            <div className="flex gap-4">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isDark ? "bg-[#ccff00]/10 text-[#ccff00]" : "bg-green-100 text-green-700"}`}>
                <span className="material-symbols-outlined text-xl">send</span>
              </div>
              <div className="space-y-1">
                <h6 className={`text-sm font-black uppercase tracking-tight ${isDark ? "text-white" : "text-stone-900"}`}>Test Verification</h6>
                <p className={`text-[10px] font-medium ${isDark ? "text-stone-300" : "text-stone-900"}`}>Verify your credentials by sending a test message to the configured test address.</p>
              </div>
            </div>
            <button 
              onClick={handleVerifyEmail}
              disabled={isVerifying}
              className={`w-full py-4 rounded-2xl border-2 text-[10px] font-black tracking-widest uppercase transition-all ${
                isVerifying ? "opacity-50 cursor-not-allowed" : ""
              } ${isDark ? "border-white text-white hover:bg-white hover:text-stone-950" : "border-stone-900 text-stone-900 hover:bg-stone-900 hover:text-white"
              }`}>
              {isVerifying ? "Sending..." : "Send Verification Email"}
            </button>

            {verificationStatus && (
              <div className={`rounded-2xl text-[10px] overflow-hidden ${
                verificationStatus.type === "SUCCESS"
                  ? (isDark ? "bg-[#ccff00]/10 border border-[#ccff00]/20" : "bg-green-50 border border-green-200")
                  : (isDark ? "bg-red-500/10 border border-red-500/20" : "bg-red-50 border border-red-200")
              }`}>
                <div className="flex items-start gap-3 p-4">
                  <span className={`material-symbols-outlined text-base mt-0.5 shrink-0 ${
                    verificationStatus.type === "SUCCESS" ? (isDark ? "text-[#ccff00]" : "text-green-600") : (isDark ? "text-red-400" : "text-red-600")
                  }`}>
                    {verificationStatus.type === "SUCCESS" ? "check_circle" : "error"}
                  </span>
                  <div className="space-y-1.5 min-w-0">
                    <p className={`font-black uppercase tracking-widest leading-tight ${
                      verificationStatus.type === "SUCCESS" ? (isDark ? "text-[#ccff00]" : "text-green-700") : (isDark ? "text-red-400" : "text-red-700")
                    }`}>{verificationStatus.message}</p>
                    {verificationStatus.hint && (
                      <p className={`font-medium normal-case tracking-normal leading-relaxed ${
                        isDark ? "text-stone-300" : "text-stone-600"
                      }`}>{verificationStatus.hint}</p>
                    )}
                    {verificationStatus.helpUrl && (
                      <a
                        href={verificationStatus.helpUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`inline-flex items-center gap-1 font-black uppercase tracking-widest underline underline-offset-2 ${
                          isDark ? "text-[#ccff00]" : "text-stone-900"
                        }`}
                      >
                        <span className="material-symbols-outlined text-xs">open_in_new</span>
                        Generate App Password
                      </a>
                    )}
                  </div>
                </div>
              </div>
            )}
            <p className={`text-[8px] text-center font-black uppercase tracking-widest ${isDark ? "text-stone-300" : "text-stone-950"}`}>
              Target: <span className={isDark ? "text-white" : "text-stone-950"}>{formData.test_email || "Not Configured"}</span>
            </p>
          </div>
        </div>

        {/* Right Column: Optional & SMTP Relay */}
        <div className="space-y-12">
          <div className="space-y-8">
            <h4 className={`text-[10px] font-black tracking-[0.2em] uppercase opacity-40 ${isDark ? "text-white" : "text-stone-900"}`}>Optional / Testing</h4>
            <div className="space-y-6">
              <FormField label="Reply-To Email" theme={theme}>
                <input
                  value={formData.reply_to_email || ""}
                  onChange={(e) => setFormData({ ...formData, reply_to_email: e.target.value })}
                  className={inputClasses}
                  placeholder="e.g. support@company.com"
                />
              </FormField>
              <FormField label="Test Email Address" theme={theme}>
                <input
                  value={formData.test_email || ""}
                  onChange={(e) => setFormData({ ...formData, test_email: e.target.value })}
                  className={inputClasses}
                  placeholder="e.g. test@company.com"
                />
              </FormField>
            </div>
          </div>

          {!formData.use_platform_email && (
          <div className={`space-y-8 pt-8 border-t border-stone-100 dark:border-stone-800`}>
            <h4 className={`text-[10px] font-black tracking-[0.2em] uppercase opacity-40 ${isDark ? "text-white" : "text-stone-900"}`}>SMTP Relay Configuration</h4>
            <div className="space-y-6">
              <FormField label="Email Service" theme={theme}>
                <select
                  value={formData.smtp_service}
                  onChange={(e) => {
                    const service = e.target.value;
                    const configs: Record<string, { host: string; port: string }> = {
                      "Gmail": { host: "smtp.gmail.com", port: "587" },
                      "Outlook / Office 365": { host: "smtp.office365.com", port: "587" },
                      "Yahoo!": { host: "smtp.mail.yahoo.com", port: "587" },
                      "SendGrid": { host: "smtp.sendgrid.net", port: "587" },
                      "Amazon SES": { host: "email-smtp.us-east-1.amazonaws.com", port: "587" }
                    };

                    if (configs[service]) {
                      setFormData({
                        ...formData,
                        smtp_service: service,
                        smtp_host: configs[service].host,
                        smtp_port: configs[service].port
                      });
                    } else {
                      setFormData({ ...formData, smtp_service: service });
                    }
                  }}
                  className={`${inputClasses} appearance-none cursor-pointer`}
                >
                  <option>Select Service</option>
                  <option>Gmail</option>
                  <option>Outlook / Office 365</option>
                  <option>Yahoo!</option>
                  <option>SendGrid</option>
                  <option>Amazon SES</option>
                  <option>Custom SMTP</option>
                </select>
                <p className={`text-[8px] mt-2 font-bold uppercase tracking-widest italic ${isDark ? "text-stone-300" : "text-stone-950"}`}>Selecting a service will auto-populate host and port details.</p>
              </FormField>

              <div className="grid grid-cols-4 gap-4">
                <div className="col-span-3">
                  <FormField label="SMTP Host" theme={theme}>
                    <input
                      value={formData.smtp_host || ""}
                      onChange={(e) => setFormData({ ...formData, smtp_host: e.target.value })}
                      className={inputClasses}
                      placeholder="e.g. smtp.gmail.com"
                    />
                  </FormField>
                </div>
                <div className="col-span-1">
                  <FormField label="Port" theme={theme}>
                    <input
                      value={formData.smtp_port || ""}
                      onChange={(e) => setFormData({ ...formData, smtp_port: e.target.value })}
                      className={inputClasses}
                      placeholder="587"
                    />
                  </FormField>
                </div>
              </div>

              <FormField label="SMTP Username" theme={theme}>
                <input
                  value={formData.smtp_user || ""}
                  onChange={(e) => setFormData({ ...formData, smtp_user: e.target.value })}
                  className={inputClasses}
                  placeholder="Company Login"
                />
              </FormField>

              <div className="space-y-4 pt-4">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={formData.smtp_2fa}
                    onChange={(e) => setFormData({ ...formData, smtp_2fa: e.target.checked })}
                    className="w-4 h-4 rounded-md border-stone-300 text-stone-900 focus:ring-stone-500"
                  />
                  <span className={`text-[10px] font-black uppercase tracking-widest ${isDark ? "text-stone-300" : "text-stone-950"} group-hover:text-stone-950 dark:group-hover:text-white`}>
                    My account has 2FA enabled (requires App Password)
                  </span>
                </label>

                {formData.smtp_2fa && (
                  <FormField label="App Password 🔐" theme={theme}>
                    <input
                      type="password"
                      value={formData.smtp_app_password || ""}
                      onChange={(e) => setFormData({ ...formData, smtp_app_password: e.target.value })}
                      className={inputClasses}
                      placeholder="••••••••••••••••"
                    />
                    <p className={`text-[8px] mt-2 font-bold uppercase tracking-widest ${isDark ? "text-stone-300" : "text-stone-950"}`}>Generate this in your Google Account Security settings. Use it instead of your regular password.</p>
                  </FormField>
                )}

                <label className="flex items-center gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={formData.smtp_tls}
                    onChange={(e) => setFormData({ ...formData, smtp_tls: e.target.checked })}
                    className="w-4 h-4 rounded-md border-stone-300 text-stone-900 focus:ring-stone-500"
                  />
                  <span className={`text-[10px] font-black uppercase tracking-widest ${isDark ? "text-stone-300" : "text-stone-950"} group-hover:text-stone-950 dark:group-hover:text-white`}>
                    Use TLS / SSL for secure connection
                  </span>
                </label>
              </div>
            </div>
          </div>
          )}
        </div>
      </div>

      <div className="pt-12 border-t border-stone-100 dark:border-stone-800 flex justify-end">
        <button
          onClick={() => onSave(formData)}
          disabled={isSaving}
          className={`px-12 py-5 rounded-2xl text-xs font-black tracking-[0.2em] uppercase transition-all ${isDark ? "bg-[#ccff00] text-stone-950 hover:scale-[1.02]" : "bg-stone-900 text-white hover:shadow-xl shadow-stone-900/20"
            }`}
        >
          {isSaving ? "Saving..." : "Save Email Configuration"}
        </button>
      </div>
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
              <p className={`text-[10px] font-medium uppercase tracking-widest ${isDark ? "text-stone-300" : "text-stone-950"}`}>Expires 12/26</p>
            </div>
          </div>
          <button className={`w-full py-5 rounded-2xl text-[10px] font-black tracking-widest uppercase transition-all border ${isDark ? "border-stone-800 text-stone-200 hover:text-white" : "border-stone-200 text-stone-950 hover:text-stone-900"}`}>Update Payment Method</button>
        </div>
        <div className="space-y-8">
          <FormField label="Currency" theme={theme}>
            <select className={`w-full border rounded-2xl px-6 py-4 text-sm font-bold outline-none transition-all appearance-none ${isDark ? "bg-stone-900 border-stone-800 text-white focus:border-[#ccff00]" : "bg-stone-50 border-stone-100 text-stone-900 focus:border-stone-400 shadow-sm"
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
                <p className={`text-[10px] font-medium ${isDark ? "text-stone-300" : "text-stone-900"}`}>All payments are processed securely via Stripe. We do not store full credit card numbers on our servers.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      <button
        onClick={() => onSave(formData)}
        disabled={isSaving}
        className={`px-12 py-5 rounded-2xl text-xs font-black tracking-[0.2em] uppercase transition-all ${isDark ? "bg-[#ccff00] text-stone-950 hover:scale-[1.02]" : "bg-stone-900 text-white hover:shadow-xl"
          }`}
      >
        {isSaving ? "Saving..." : "Update Billing Info"}
      </button>
    </div>
  );
}

function toTimeInputValue(value: string | null | undefined): string {
  if (!value) return "";
  const str = String(value).trim();
  // Already HH:MM format
  if (/^\d{1,2}:\d{2}$/.test(str)) {
    const parts = str.split(":");
    const h = parts[0] || "0";
    const m = parts[1] || "00";
    return `${h.padStart(2, "0")}:${m}`;
  }
  // Convert "6:00 AM" / "11:00 PM" → "HH:MM"
  const match = str.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match || !match[1] || !match[2] || !match[3]) return "";
  let h = parseInt(match[1], 10);
  const min = match[2];
  const period = match[3].toUpperCase();
  if (period === "AM" && h === 12) h = 0;
  if (period === "PM" && h !== 12) h += 12;
  return `${String(h).padStart(2, "0")}:${min}`;
}

function toDisplayTime(value: string | null | undefined): string {
  if (!value) return "—";
  const str = String(value).trim();
  // "HH:MM" or "H:MM" → "H:MM AM/PM"
  if (/^\d{1,2}:\d{2}$/.test(str)) {
    const parts = str.split(":");
    let h = parseInt(parts[0] || "0", 10);
    const min = parts[1] || "00";
    const period = h >= 12 ? "PM" : "AM";
    if (h === 0) h = 12;
    else if (h > 12) h -= 12;
    return `${h}:${min} ${period}`;
  }
  // Already a display string ("6:00 AM") — return as-is
  return str;
}

function CourtTab({ data, onSave, isSaving, theme, dimensions, tenantId }: any) {
  const isDark = theme === "DARK";
  const [courts, setCourts] = useState<any[]>([]);
  const [courtName, setCourtName] = useState("");
  const [courtCondition, setCourtCondition] = useState("");
  const [courtEnvironment, setCourtEnvironment] = useState("");
  const [restrictions, setRestrictions] = useState("");
  const [editingCourtId, setEditingCourtId] = useState<string | null>(null);
  const [courtImageUrl, setCourtImageUrl] = useState("");
  const [courtStatus, setCourtStatus] = useState("Available");
  const [availableFrom, setAvailableFrom] = useState("06:00");
  const [availableTo, setAvailableTo] = useState("23:00");

  const [isUploading, setIsUploading] = useState(false);
  const [isDraggingPhoto, setIsDraggingPhoto] = useState(false);
  const courtFileRef = React.useRef<HTMLInputElement>(null);
  const [defaultCourts, setDefaultCourts] = useState<any[]>([]);
  const [showLibraryModal, setShowLibraryModal] = useState(false);

  useEffect(() => {
    if (tenantId === "Global") return;
    const q = query(collection(db, "platform_company", "defaults", "courts"), orderBy("created_at", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      const courts = snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setDefaultCourts(courts);
    });
    return () => unsub();
  }, [tenantId]);

  useEffect(() => {
    const rawCourts = Array.isArray(data?.courts) ? data.courts : [];
    // Ensure all courts have default hours if missing
    const initializedCourts = rawCourts.map((court: any) => ({
      ...court,
      available_from: court.available_from || court.availableFrom || "06:00",
      available_to: court.available_to || court.availableTo || "23:00"
    }));
    setCourts(initializedCourts);
  }, [data]);

  const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");
  const getDimensionOptions = (aliases: string[]) => {
    const normalizedAliases = aliases.map(normalize);
    for (const [category, items] of Object.entries(dimensions || {})) {
      const normalizedCategory = normalize(category);
      if (normalizedAliases.some((alias) => normalizedCategory.includes(alias) || alias.includes(normalizedCategory))) {
        return Array.isArray(items) ? items : [];
      }
    }
    return [];
  };

  const conditionOptions = dimensions?.courtcondition || [];
  const statusOptions = dimensions?.courtstatus || [];


  const resetForm = () => {
    setCourtName("");
    setCourtCondition("");
    setCourtImageUrl("");
    setRestrictions("");
    setCourtStatus("Available");
    setAvailableFrom("06:00");
    setAvailableTo("23:00");
    setEditingCourtId(null);

  };

  const handleSubmitCourt = () => {
    const name = courtName.trim();
    if (!name || !courtCondition) return;

    const payload = {
      id: editingCourtId || `court_${Date.now()}`,
      name,
      condition: courtCondition,
      status: courtStatus,
      available_from: availableFrom || null,
      available_to: availableTo || null,
      image_url: courtImageUrl,

      restrictions: restrictions.trim(),
      updated_at: new Date().toISOString(),
    };

    if (editingCourtId) {
      setCourts((prev) => prev.map((court) => (court.id === editingCourtId ? { ...court, ...payload } : court)));
    } else {
      setCourts((prev) => [...prev, { ...payload, created_at: new Date().toISOString() }]);
    }
    resetForm();
  };

  const handleEditCourt = (court: any) => {
    setEditingCourtId(court.id);
    setCourtName(court.name || "");
    setCourtCondition(court.condition || "");
    setCourtImageUrl(court.image_url || "");
    setRestrictions(court.restrictions || "");
    setCourtStatus(court.status || "Available");
    setAvailableFrom(toTimeInputValue(court.available_from) || "06:00");
    setAvailableTo(toTimeInputValue(court.available_to) || "23:00");

  };

  const uploadFile = async (file: File) => {
    setIsUploading(true);
    try {
      const storageRef = ref(storage, `courts/${Date.now()}_${file.name}`);
      const snapshot = await uploadBytes(storageRef, file);
      const url = await getDownloadURL(snapshot.ref);
      setCourtImageUrl(url);
    } catch (err) {
      console.error("Photo upload failed:", err);
    } finally {
      setIsUploading(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await uploadFile(file);
  };

  const onPhotoDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingPhoto(true);
  };

  const onPhotoDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingPhoto(false);
  };

  const onPhotoDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingPhoto(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) {
      await uploadFile(file);
    }
  };

  const handleDeleteCourt = (courtId: string) => {
    setCourts((prev) => prev.filter((court) => court.id !== courtId));
    if (editingCourtId === courtId) resetForm();
  };

  const handleSaveCourts = () => {
    onSave({ ...data, courts });
  };

  const inputClasses = `w-full border rounded-2xl px-6 py-4 text-sm font-bold outline-none transition-all ${isDark ? "bg-stone-900 border-stone-800 text-white focus:border-[#ccff00]" : "bg-stone-50 border-stone-100 text-stone-900 focus:border-stone-400"
    }`;

  return (
    <div className="space-y-10">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-stretch">
        <div className={`p-8 rounded-[32px] border space-y-6 h-full ${isDark ? "bg-stone-900/40 border-stone-800" : "bg-stone-50 border-stone-100"}`}>
          <h4 className={`text-[10px] font-black tracking-[0.2em] uppercase opacity-50 ${isDark ? "text-white" : "text-stone-900"}`}>
            {editingCourtId
              ? (tenantId === "Global" ? "Edit Default Court" : "Edit Court")
              : (tenantId === "Global" ? "Register Default Court" : "Register Court")}
          </h4>

          {tenantId !== "Global" && defaultCourts.length > 0 && !editingCourtId && (
            <div className="space-y-6">
              <FormField label="Template Courts" theme={theme}>
                <div className="grid grid-cols-2 gap-3">
                  {defaultCourts.map(dc => (
                    <button
                      key={dc.id}
                      type="button"
                      onClick={() => {
                        setCourtName(dc.name || dc.label || "");
                        setCourtImageUrl(dc.url || dc.image_url || "");
                      }}
                      className={`flex items-center gap-3 p-3 rounded-2xl border transition-all text-left group ${isDark ? "bg-stone-800/40 border-stone-800 hover:border-[#ccff00]/50" : "bg-white border-stone-100 hover:border-stone-400 shadow-sm"
                        }`}
                    >
                      {(dc.url || dc.image_url) ? (
                        <img src={dc.url || dc.image_url} className="w-10 h-10 rounded-xl object-cover flex-shrink-0" alt={dc.name || dc.label} />
                      ) : (
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isDark ? "bg-stone-900" : "bg-stone-50"}`}>
                          <span className="material-symbols-outlined text-sm opacity-20">sports_tennis</span>
                        </div>
                      )}
                      <div className="overflow-hidden">
                        <p className={`text-[10px] font-black truncate mb-0.5 ${isDark ? "text-white" : "text-stone-900"}`}>{dc.name || dc.label}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </FormField>
              <div className={`h-[1px] w-full ${isDark ? "bg-stone-800" : "bg-stone-200/50"}`} />
            </div>
          )}

          <FormField label={tenantId === "Global" ? "Default Court Name" : "Court Name"} theme={theme}>
            <input value={courtName} onChange={(e) => setCourtName(e.target.value)} className={inputClasses} placeholder="e.g. Court 01" />
          </FormField>

          <FormField label={tenantId === "Global" ? "Default Court Condition" : "Court Condition"} theme={theme}>
            <select value={courtCondition} onChange={(e) => setCourtCondition(e.target.value)} className={`${inputClasses} appearance-none`}>
              <option value="">Select condition</option>
              {conditionOptions.map((option: string) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </FormField>

          <FormField label={tenantId === "Global" ? "Default Court Status" : "Court Status"} theme={theme}>
            <select value={courtStatus} onChange={(e) => setCourtStatus(e.target.value)} className={`${inputClasses} appearance-none`}>
              <option value="">Select status</option>
              {statusOptions.map((option: string) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </FormField>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Available From" theme={theme}>
              <input
                type="time"
                value={availableFrom}
                onChange={(e) => setAvailableFrom(e.target.value)}
                className={inputClasses}
              />
            </FormField>
            <FormField label="Available To" theme={theme}>
              <input
                type="time"
                value={availableTo}
                onChange={(e) => setAvailableTo(e.target.value)}
                className={inputClasses}
              />
            </FormField>
          </div>


          <FormField label={tenantId === "Global" ? "Default Court Photo" : "Court Photo"} theme={theme}>
            <input type="file" ref={courtFileRef} onChange={handlePhotoUpload} className="hidden" accept="image/*" />
            <div
              onClick={() => courtFileRef.current?.click()}
              onDragOver={onPhotoDragOver}
              onDragLeave={onPhotoDragLeave}
              onDrop={onPhotoDrop}
              className={`h-48 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-4 transition-all cursor-pointer overflow-hidden group relative ${isDraggingPhoto
                  ? (isDark ? "border-[#ccff00] bg-[#ccff00]/10 scale-[1.02]" : "border-stone-900 bg-stone-100 scale-[1.02]")
                  : (isDark ? "border-stone-800 bg-stone-900/50 hover:border-[#ccff00]/50" : "border-stone-200 bg-stone-50/50 hover:border-stone-400")
                }`}
            >
              {courtImageUrl ? (
                <>
                  <img src={courtImageUrl} alt="Court" className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                    <span className="text-white text-[10px] font-black tracking-widest uppercase">Change Photo</span>
                  </div>
                </>
              ) : (
                <>
                  <span className={`material-symbols-outlined text-4xl opacity-20 ${isDark ? "text-white" : "text-stone-900"} ${isUploading ? "animate-spin" : ""}`}>
                    {isUploading ? "sync" : "add_a_photo"}
                  </span>
                  <div className="text-center space-y-1">
                    <p className={`text-[10px] font-black tracking-widest uppercase ${isDark ? "text-stone-300" : "text-stone-500"}`}>
                      {isUploading ? "Uploading..." : "Click or drag photo"}
                    </p>
                    <p className={`text-[8px] font-bold uppercase tracking-[0.2em] ${isDark ? "text-stone-300" : "text-stone-950"}`}>Drop files here</p>
                  </div>
                </>
              )}
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  courtFileRef.current?.click();
                }}
                className={`mt-3 flex-1 py-4 rounded-xl text-[9px] font-black tracking-[0.2em] uppercase border transition-all ${isDark ? "border-stone-800 text-stone-400 hover:text-white" : "border-stone-200 text-stone-600 hover:text-stone-900"
                  }`}
              >
                Load from Directory
              </button>
              {tenantId !== "Global" && (
                <button
                  type="button"
                  onClick={() => setShowLibraryModal(true)}
                  className={`mt-3 flex-1 py-4 rounded-xl text-[9px] font-black tracking-[0.2em] uppercase border transition-all ${isDark ? "border-[#ccff00]/20 text-[#ccff00] hover:bg-[#ccff00]/10" : "border-stone-900 text-stone-900 hover:bg-stone-50"
                    }`}
                >
                  Pick from Library
                </button>
              )}
            </div>
          </FormField>

          {/* Library Modal */}
          <Modal isOpen={showLibraryModal} onClose={() => setShowLibraryModal(false)} title="Select Court Photo">
            <div className="p-8 max-w-2xl w-full bg-white rounded-[32px] shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-2xl font-black text-stone-900 tracking-tight uppercase italic leading-none">Court Library</h2>
                  <p className="text-[10px] font-bold text-stone-500 uppercase tracking-[0.2em] mt-2">Pick a professional template</p>
                </div>
                <button onClick={() => setShowLibraryModal(false)} className="w-10 h-10 rounded-full hover:bg-stone-100 flex items-center justify-center transition-colors">
                  <span className="material-symbols-outlined text-stone-400">close</span>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                {defaultCourts.map(dc => (
                  <button
                    key={dc.id}
                    onClick={() => {
                      setCourtImageUrl(dc.url || dc.image_url);
                      // If name is empty, suggest the template name
                      if (!courtName.trim()) setCourtName(dc.name || dc.label);
                      setShowLibraryModal(false);
                    }}
                    className="group relative aspect-[4/3] rounded-2xl overflow-hidden border-2 border-transparent hover:border-stone-900 transition-all text-left"
                  >
                    <img src={dc.url || dc.image_url} alt={dc.name} className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60 group-hover:opacity-80 transition-opacity" />
                    <div className="absolute bottom-4 left-4 right-4">
                      <p className="text-white text-[10px] font-black uppercase tracking-widest leading-tight">{dc.name || dc.label}</p>
                    </div>
                  </button>
                ))}
                {defaultCourts.length === 0 && (
                  <div className="col-span-2 py-20 text-center border-2 border-dashed border-stone-100 rounded-3xl">
                    <p className="text-stone-400 text-[10px] font-black uppercase tracking-widest">No professional photos available</p>
                  </div>
                )}
              </div>
            </div>
          </Modal>

          <FormField label="Restrictions" theme={theme}>
            <textarea
              value={restrictions}
              onChange={(e) => setRestrictions(e.target.value)}
              rows={4}
              className={`${inputClasses} resize-none`}
              placeholder="e.g. No shoes with black soles."
            />
          </FormField>

          <div className="flex items-center gap-3">
            <button
              onClick={handleSubmitCourt}
              disabled={!courtName.trim() || !courtCondition}
              className={`px-8 py-4 rounded-2xl text-[10px] font-black tracking-[0.2em] uppercase transition-all disabled:opacity-40 ${isDark ? "bg-[#ccff00] text-stone-950" : "bg-stone-900 text-white"
                }`}
            >
              {editingCourtId ? "Update Court" : "Add Court"}
            </button>
            {editingCourtId && (
              <button
                onClick={resetForm}
                className={`px-8 py-4 rounded-2xl text-[10px] font-black tracking-[0.2em] uppercase border ${isDark ? "border-stone-700 text-stone-300" : "border-stone-200 text-stone-600"
                  }`}
              >
                Cancel
              </button>
            )}
          </div>
        </div>

        <div className={`p-8 rounded-[32px] border flex flex-col h-full ${isDark ? "bg-stone-900/20 border-stone-800" : "bg-white border-stone-100"}`}>
          <h4 className={`text-[10px] font-black tracking-[0.2em] uppercase mb-6 opacity-50 ${isDark ? "text-white" : "text-stone-900"}`}>
            {tenantId === "Global" ? "Registered Default Courts" : "Registered Courts"} ({courts.length})
          </h4>
          <div className="space-y-4 flex-1 overflow-y-auto pr-2 min-h-[400px]">
            {courts.length === 0 && (
              <div className={`rounded-2xl border border-dashed px-6 py-8 text-center text-[10px] font-black uppercase tracking-widest ${isDark ? "border-stone-800 text-stone-300" : "border-stone-200 text-stone-950"}`}>
                No courts registered yet
              </div>
            )}
            {courts.map((court) => {
              const fromVal = court.available_from || court.availableFrom || "";
              const toVal = court.available_to || court.availableTo || "";
              const hasHours = fromVal !== "" || toVal !== "";
              const fromTime = hasHours ? toDisplayTime(fromVal) : "—";
              const toTime = hasHours ? toDisplayTime(toVal) : "—";
              const isAvailable = (court.status || "Available") === "Available";

              return (
                <div key={court.id} className={`rounded-2xl border transition-all overflow-hidden ${isDark ? "bg-stone-900 border-stone-800 hover:border-stone-700" : "bg-white border-stone-150 hover:border-stone-300 shadow-sm hover:shadow-md"}`}>
                  <div className="flex gap-0 items-stretch">
                    {/* Court photo strip */}
                    {court.image_url ? (
                      <div className="w-24 flex-shrink-0">
                        <img src={court.image_url} alt={court.name} className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className={`w-24 flex-shrink-0 flex items-center justify-center ${isDark ? "bg-stone-800" : "bg-stone-100"}`}>
                        <span className={`material-symbols-outlined text-3xl ${isDark ? "text-stone-700" : "text-stone-300"}`}>sports_tennis</span>
                      </div>
                    )}

                    {/* Card body */}
                    <div className="flex-1 px-5 py-4 flex flex-col gap-3 min-w-0">
                      {/* Row 1: name + actions */}
                      <div className="flex items-center justify-between gap-2">
                        <p className={`text-sm font-black tracking-tight leading-tight ${isDark ? "text-white" : "text-stone-900"}`}>{court.name}</p>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button
                            onClick={() => handleEditCourt(court)}
                            className={`p-1.5 rounded-lg transition-colors ${isDark ? "text-stone-300 hover:text-white hover:bg-stone-800" : "text-stone-950 hover:text-stone-900 hover:bg-stone-100"}`}
                          >
                            <span className="material-symbols-outlined text-base">edit</span>
                          </button>
                          <button
                            onClick={() => handleDeleteCourt(court.id)}
                            className={`p-1.5 rounded-lg transition-colors ${isDark ? "text-red-500 hover:bg-red-500/10" : "text-red-400 hover:bg-red-50"}`}
                          >
                            <span className="material-symbols-outlined text-base">delete</span>
                          </button>
                        </div>
                      </div>

                      {/* Row 2: condition badge + status badge */}
                      <div className="flex flex-wrap gap-2">
                        <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${isDark ? "bg-stone-800 text-stone-300" : "bg-stone-100 text-stone-950"}`}>
                          {court.condition}
                        </span>
                        <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${isAvailable ? (isDark ? "bg-[#ccff00]/10 text-[#ccff00] border border-[#ccff00]/20" : "bg-green-50 text-green-700 border border-green-200") : (isDark ? "bg-red-500/10 text-red-400 border border-red-500/20" : "bg-red-50 text-red-700 border border-red-200")}`}>
                          {court.status || "Available"}
                        </span>
                      </div>

                      {/* Row 3: availability hours bar */}
                      <div className={`flex flex-col gap-1.5 px-4 py-3 rounded-2xl ${isDark ? "bg-stone-800/40" : "bg-stone-50/50 border border-stone-100"}`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className={`material-symbols-outlined text-[14px] ${isDark ? "text-[#ccff00]" : "text-stone-500"}`}>schedule</span>
                            <span className={`text-[9px] font-black uppercase tracking-widest ${isDark ? "text-stone-300" : "text-stone-950"}`}>Operating Hours</span>
                          </div>
                          {!hasHours && (
                            <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${isDark ? "bg-stone-800 text-stone-300" : "bg-stone-200 text-stone-950"}`}>Not set</span>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-4">
                          <div className="flex-1">
                            <p className={`text-[8px] font-black uppercase tracking-widest mb-0.5 ${isDark ? "text-stone-500" : "text-stone-400"}`}>Available From</p>
                            <p className={`text-[11px] font-black tabular-nums ${hasHours ? (isDark ? "text-[#ccff00]" : "text-stone-900") : (isDark ? "text-stone-700" : "text-stone-300")}`}>
                              {fromTime}
                            </p>
                          </div>
                          <div className={`w-[1px] h-6 ${isDark ? "bg-stone-700" : "bg-stone-200"}`} />
                          <div className="flex-1">
                            <p className={`text-[8px] font-black uppercase tracking-widest mb-0.5 ${isDark ? "text-stone-300" : "text-stone-950"}`}>Available To</p>
                            <p className={`text-[11px] font-black tabular-nums ${hasHours ? (isDark ? "text-[#ccff00]" : "text-stone-900") : (isDark ? "text-stone-700" : "text-stone-300")}`}>
                              {toTime}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Row 4: restrictions (optional) */}
                      {court.restrictions && (
                        <div className="flex items-start gap-1.5">
                          <span className={`material-symbols-outlined text-sm flex-shrink-0 mt-px ${isDark ? "text-[#ccff00]" : "text-stone-600"}`}>info</span>
                          <p className={`text-[10px] font-bold leading-tight ${isDark ? "text-stone-300" : "text-stone-700"}`}>{court.restrictions}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleSaveCourts}
          disabled={isSaving}
          className={`px-12 py-5 rounded-2xl text-xs font-black tracking-[0.2em] uppercase transition-all ${isDark ? "bg-[#ccff00] text-stone-950 hover:scale-[1.02]" : "bg-stone-900 text-white hover:shadow-xl"
            }`}
        >
          {isSaving ? "Saving..." : (tenantId === "Global" ? "Save Default Court Configuration" : "Save Court Configuration")}
        </button>
      </div>
    </div>
  );
}

function DefaultCourtsTab({ theme, setNotification }: { theme: string; setNotification: any }) {
  const isDark = theme === "DARK";
  const [courts, setCourts] = useState<any[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    const q = query(collection(db, "platform_company", "defaults", "courts"), orderBy("created_at", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setCourts(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsub();
  }, []);

  const showAppMessage = (message: string, type: "SUCCESS" | "ERROR") => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const inputCls = `w-full border rounded-2xl px-6 py-4 text-sm font-bold outline-none transition-all ${
    isDark ? "bg-stone-950 border-stone-800 text-white focus:border-[#ccff00]" : "bg-white border-stone-100 text-stone-900 focus:border-[#4f6b28]"
  }`;

  return (
    <div className="space-y-12">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-2">
          <h4 className={`text-[10px] font-black tracking-[0.2em] uppercase opacity-40 ${isDark ? "text-white" : "text-stone-900"}`}>MANAGE DEFAULT COURTS</h4>
          <p className={`text-xs font-bold tracking-tight ${isDark ? "text-stone-400" : "text-stone-500"}`}>Add standardized courts to the platform library</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-12">
        <div className="xl:col-span-2">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {courts.map((court) => (
              <div 
                key={court.id} 
                className={`group relative aspect-square rounded-[32px] overflow-hidden border transition-all ${
                  isDark ? "bg-stone-900 border-stone-800 hover:border-[#ccff00]/50" : "bg-white border-stone-100 hover:border-stone-300 shadow-sm"
                }`}
              >
                <img src={court.url} alt={court.name} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                
                {/* Overlay with Actions */}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-all duration-300 flex flex-col items-center justify-center gap-3 p-6">
                  <p className="text-white text-[10px] font-black uppercase tracking-widest text-center">{court.name}</p>
                  <button 
                    onClick={() => setConfirmDeleteId(court.id)}
                    className="w-10 h-10 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 transition-colors shadow-lg shadow-red-500/20"
                  >
                    <span className="material-symbols-outlined text-xl">delete</span>
                  </button>
                </div>
              </div>
            ))}
            
            {courts.length === 0 && (
              <div className={`col-span-full h-64 rounded-[32px] border-2 border-dashed flex flex-col items-center justify-center gap-4 ${
                isDark ? "border-stone-800 bg-stone-950/30" : "border-stone-100 bg-stone-50/30"
              }`}>
                <span className="material-symbols-outlined text-4xl opacity-20">inventory_2</span>
                <p className="text-[10px] font-black uppercase tracking-widest opacity-40">No default courts yet</p>
              </div>
            )}
          </div>
        </div>

        <div className="relative">
          <div className={`sticky top-8 p-8 rounded-[40px] border space-y-8 ${
            isDark ? "bg-stone-900/40 border-stone-800" : "bg-stone-50 border-stone-100"
          }`}>
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${isDark ? "bg-[#ccff00] text-stone-950" : "bg-stone-900 text-white"}`}>
                  <span className="material-symbols-outlined text-sm">add</span>
                </div>
                <h5 className={`text-[10px] font-black uppercase tracking-widest ${isDark ? "text-white" : "text-stone-900"}`}>Add New Court</h5>
              </div>

              <div className="space-y-4">
                <label className={`text-[9px] font-black uppercase tracking-widest ml-4 ${isDark ? "text-stone-400" : "text-stone-500"}`}>Court Name</label>
                <input 
                  id="new-court-name"
                  type="text" 
                  placeholder="e.g. Center Court"
                  className={inputCls}
                />
              </div>

              <div className="space-y-4">
                <label className={`text-[9px] font-black uppercase tracking-widest ml-4 ${isDark ? "text-stone-400" : "text-stone-500"}`}>Court Photo</label>
                <input 
                  type="file" 
                  ref={fileInputRef}
                  className="hidden" 
                  accept="image/*"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;

                    const nameEl = document.getElementById("new-court-name") as HTMLInputElement;
                    if (!nameEl.value) {
                      showAppMessage("Please enter a court name first.", "ERROR");
                      return;
                    }

                    setIsUploading(true);
                    try {
                      const id = `CRT_${Date.now()}`;
                      const storageRef = ref(storage, `defaults/${id}`);
                      await uploadBytes(storageRef, file);
                      const url = await getDownloadURL(storageRef);

                      await setDoc(doc(db, "platform_company", "defaults", "courts", id), {
                        name: nameEl.value,
                        url: url,
                        created_at: new Date().toISOString()
                      });

                      nameEl.value = "";
                      showAppMessage("Court added to library.", "SUCCESS");
                    } catch (err) {
                      console.error("Upload failed:", err);
                      showAppMessage("Failed to upload image.", "ERROR");
                    } finally {
                      setIsUploading(false);
                    }
                  }}
                />

                <div 
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onDrop={async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const file = e.dataTransfer.files?.[0];
                    if (!file) return;

                    const nameEl = document.getElementById("new-court-name") as HTMLInputElement;
                    if (!nameEl.value) {
                      showAppMessage("Please enter a court name first.", "ERROR");
                      return;
                    }

                    setIsUploading(true);
                    try {
                      const id = `CRT_${Date.now()}`;
                      const storageRef = ref(storage, `defaults/${id}`);
                      await uploadBytes(storageRef, file);
                      const url = await getDownloadURL(storageRef);

                      await setDoc(doc(db, "platform_company", "defaults", "courts", id), {
                        name: nameEl.value,
                        url: url,
                        created_at: new Date().toISOString()
                      });

                      nameEl.value = "";
                      showAppMessage("Court added to library.", "SUCCESS");
                    } catch (err) {
                      console.error("Upload failed:", err);
                      showAppMessage("Failed to upload image.", "ERROR");
                    } finally {
                      setIsUploading(false);
                    }
                  }}
                  className={`group cursor-pointer border-2 border-dashed rounded-3xl p-12 flex flex-col items-center justify-center gap-4 transition-all ${
                    isDark ? "border-stone-800 bg-stone-950/50 hover:bg-stone-900" : "border-stone-200 bg-white hover:bg-stone-50"
                  }`}
                >
                  {isUploading ? (
                    <div className={`h-10 w-10 animate-spin rounded-full border-4 border-t-transparent ${
                      isDark ? "border-[#ccff00]" : "border-[#4f6b28]"
                    }`}></div>
                  ) : (
                    <>
                      <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all ${
                        isDark ? "bg-stone-900 text-stone-700 group-hover:text-[#ccff00]" : "bg-stone-100 text-stone-400 group-hover:text-[#4f6b28]"
                      }`}>
                        <span className="material-symbols-outlined text-4xl">cloud_upload</span>
                      </div>
                      <div className="text-center">
                        <p className={`text-xs font-black uppercase tracking-widest ${isDark ? "text-stone-300" : "text-stone-900"}`}>Drop image here</p>
                        <p className="text-[10px] text-stone-400 mt-1 uppercase tracking-widest">or click to browse local files</p>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!confirmDeleteId}
        onClose={() => setConfirmDeleteId(null)}
        title="Delete Default Court?"
        theme={theme as any}
        width={400}
        footer={
          <div className="flex gap-4">
            <button 
              onClick={() => setConfirmDeleteId(null)}
              className={`flex-1 py-4 border-2 rounded-2xl text-[10px] font-black tracking-widest transition-all uppercase ${
                isDark ? "border-stone-800 text-stone-400 hover:bg-stone-900" : 
                "border-stone-100 text-stone-400 hover:bg-stone-50"
              }`}
            >
              Cancel
            </button>
            <button 
              onClick={async () => {
                if (!confirmDeleteId) return;
                try {
                  await deleteDoc(doc(db, "platform_company", "defaults", "courts", confirmDeleteId));
                  showAppMessage("Court removed.", "SUCCESS");
                } catch (err) {
                  showAppMessage("Failed to remove court.", "ERROR");
                } finally {
                  setConfirmDeleteId(null);
                }
              }}
              className="flex-1 py-4 rounded-2xl text-[10px] font-black tracking-widest transition-all uppercase shadow-lg bg-red-500 text-white hover:bg-red-600 shadow-red-500/20"
            >
              Delete Now
            </button>
          </div>
        }
      >
        <div className="relative z-10 text-center py-4">
          <div className="w-20 h-20 bg-red-50 rounded-3xl flex items-center justify-center mb-8 mx-auto text-red-500">
            <span className="material-symbols-outlined text-4xl">delete_forever</span>
          </div>
          <h3 className={`text-xl font-black italic tracking-tighter uppercase mb-2 ${isDark ? "text-white" : "text-stone-900"}`}>Are you sure?</h3>
          <p className="text-[10px] text-stone-400 font-bold uppercase tracking-widest leading-relaxed px-4">
            This will permanently remove this court from the default library.
          </p>
        </div>
      </Modal>
    </div>
  );
}

function PhotosTab({ theme, setNotification }: { theme: "LIGHT" | "DARK" | "VINTAGE", setNotification: any }) {
  const [defaultPortraits, setDefaultPortraits] = useState<any[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const isDark = theme === "DARK";

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "platform_company", "defaults", "portraits"), (snapshot) => {
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setDefaultPortraits(items.sort((a: any, b: any) => 
        new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
      ));
    });
    return () => unsub();
  }, []);

  const showAppMessage = (message: string, type: "SUCCESS" | "ERROR") => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const inputCls = `w-full border rounded-2xl px-6 py-4 text-sm font-bold outline-none transition-all ${
    isDark ? "bg-stone-900 border-stone-800 text-white focus:border-[#ccff00]" : "bg-stone-50 border-stone-100 text-stone-900 focus:border-stone-400"
  }`;

  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col gap-4">
        <h4 className={`text-[10px] font-black tracking-[0.2em] uppercase opacity-40 ${isDark ? "text-white" : "text-stone-900"}`}>MANAGE DEFAULT PHOTOS</h4>
        <p className="text-xs text-stone-400 font-bold uppercase tracking-widest leading-relaxed">
          Manage the standard portraits available for all administrative users when creating or editing profiles.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-12">
        {/* Left: Library Grid */}
        <div className={`p-8 rounded-[32px] border flex flex-col min-h-[500px] ${isDark ? "bg-stone-900/20 border-stone-800" : "bg-white border-stone-100"}`}>
          <h4 className={`text-[10px] font-black tracking-[0.2em] uppercase mb-6 opacity-50 ${isDark ? "text-white" : "text-stone-900"}`}>
            Stored Portraits ({defaultPortraits.length})
          </h4>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 overflow-y-auto pr-2 max-h-[600px]">
            {defaultPortraits.map((avatar) => (
              <div 
                key={avatar.id} 
                className={`p-4 rounded-3xl border flex items-center gap-4 transition-all group ${
                  isDark ? "bg-stone-900 border-stone-800 hover:border-stone-700" : "bg-stone-50 border-stone-100 hover:bg-stone-100/50"
                }`}
              >
                <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-white shadow-md flex-shrink-0">
                  <img src={avatar.url} alt={avatar.label} className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-[10px] font-black uppercase tracking-widest truncate ${isDark ? "text-white" : "text-stone-900"}`}>{avatar.label}</p>
                  <p className="text-[8px] text-stone-400 truncate opacity-50">{avatar.id}</p>
                </div>
                <button 
                  onClick={() => setConfirmDeleteId(avatar.id)}
                  className="p-2 text-red-400 hover:text-red-600 transition-colors"
                >
                  <span className="material-symbols-outlined text-lg">delete</span>
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Upload Section */}
        <div className="space-y-8">
          <div className={`p-8 rounded-[40px] border-2 border-dashed transition-all relative ${
            isDark 
              ? "border-stone-800 bg-stone-900/20 hover:border-[#ccff00]/30" 
              : "border-stone-200 bg-stone-50/50 hover:border-[#4f6b28]/30"
          }`}>
            <h4 className={`text-[10px] font-black uppercase tracking-[0.2em] mb-6 text-center ${isDark ? "text-stone-500" : "text-stone-400"}`}>Add New Default Photo</h4>
            
            <div className="space-y-6">
              <input 
                type="text" 
                placeholder="Label (e.g. Male Executive)" 
                id="new-portrait-label"
                className={inputCls} 
              />

              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/*"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  
                  const labelEl = document.getElementById("new-portrait-label") as HTMLInputElement;
                  if (!labelEl.value) {
                    showAppMessage("Please enter a label first.", "ERROR");
                    return;
                  }

                  setIsUploading(true);
                  try {
                    const id = `DEF_${Date.now()}`;
                    const storageRef = ref(storage, `defaults/${id}`);
                    await uploadBytes(storageRef, file);
                    const url = await getDownloadURL(storageRef);

                    await setDoc(doc(db, "platform_company", "defaults", "portraits", id), {
                      label: labelEl.value,
                      url: url,
                      created_at: new Date().toISOString()
                    });

                    labelEl.value = "";
                    showAppMessage("Portrait added to library.", "SUCCESS");
                  } catch (err) {
                    console.error("Upload failed:", err);
                    showAppMessage("Failed to upload image.", "ERROR");
                  } finally {
                    setIsUploading(false);
                  }
                }}
              />

              <div 
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onDrop={async (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const file = e.dataTransfer.files?.[0];
                  if (!file) return;

                  const labelEl = document.getElementById("new-portrait-label") as HTMLInputElement;
                  if (!labelEl.value) {
                    showAppMessage("Please enter a label first.", "ERROR");
                    return;
                  }

                  setIsUploading(true);
                  try {
                    const id = `DEF_${Date.now()}`;
                    const storageRef = ref(storage, `defaults/${id}`);
                    await uploadBytes(storageRef, file);
                    const url = await getDownloadURL(storageRef);

                    await setDoc(doc(db, "platform_company", "defaults", "portraits", id), {
                      label: labelEl.value,
                      url: url,
                      created_at: new Date().toISOString()
                    });

                    labelEl.value = "";
                    showAppMessage("Portrait added to library.", "SUCCESS");
                  } catch (err) {
                    console.error("Upload failed:", err);
                    showAppMessage("Failed to upload image.", "ERROR");
                  } finally {
                    setIsUploading(false);
                  }
                }}
                className={`group cursor-pointer border-2 border-dashed rounded-3xl p-12 flex flex-col items-center justify-center gap-4 transition-all ${
                  isDark ? "border-stone-800 bg-stone-950/50 hover:bg-stone-900" : "border-stone-200 bg-white hover:bg-stone-50"
                }`}
              >
                {isUploading ? (
                  <div className={`h-10 w-10 animate-spin rounded-full border-4 border-t-transparent ${
                    isDark ? "border-[#ccff00]" : "border-[#4f6b28]"
                  }`}></div>
                ) : (
                  <>
                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all ${
                      isDark ? "bg-stone-900 text-stone-700 group-hover:text-[#ccff00]" : "bg-stone-100 text-stone-400 group-hover:text-[#4f6b28]"
                    }`}>
                      <span className="material-symbols-outlined text-4xl">cloud_upload</span>
                    </div>
                    <div className="text-center">
                      <p className={`text-xs font-black uppercase tracking-widest ${isDark ? "text-stone-300" : "text-stone-900"}`}>Drop image here</p>
                      <p className="text-[10px] text-stone-400 mt-1 uppercase tracking-widest">or click to browse local files</p>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!confirmDeleteId}
        onClose={() => setConfirmDeleteId(null)}
        title="Delete Default Photo?"
        theme={theme}
        width={400}
        footer={
          <div className="flex gap-4">
            <button 
              onClick={() => setConfirmDeleteId(null)}
              className={`flex-1 py-4 border-2 rounded-2xl text-[10px] font-black tracking-widest transition-all uppercase ${
                isDark ? "border-stone-800 text-stone-400 hover:bg-stone-900" : 
                "border-stone-100 text-stone-400 hover:bg-stone-50"
              }`}
            >
              Cancel
            </button>
            <button 
              onClick={async () => {
                if (!confirmDeleteId) return;
                try {
                  await deleteDoc(doc(db, "platform_company", "defaults", "portraits", confirmDeleteId));
                  showAppMessage("Portrait removed.", "SUCCESS");
                } catch (err) {
                  showAppMessage("Failed to remove portrait.", "ERROR");
                } finally {
                  setConfirmDeleteId(null);
                }
              }}
              className="flex-1 py-4 rounded-2xl text-[10px] font-black tracking-widest transition-all uppercase shadow-lg bg-red-500 text-white hover:bg-red-600 shadow-red-500/20"
            >
              Delete Now
            </button>
          </div>
        }
      >
        <div className="relative z-10 text-center py-4">
          <div className="w-20 h-20 bg-red-50 rounded-3xl flex items-center justify-center mb-8 mx-auto text-red-500">
            <span className="material-symbols-outlined text-4xl">delete_forever</span>
          </div>
          <h3 className={`text-xl font-black italic tracking-tighter uppercase mb-2 ${isDark ? "text-white" : "text-stone-900"}`}>Are you sure?</h3>
          <p className="text-[10px] text-stone-400 font-bold uppercase tracking-widest leading-relaxed px-4">
            This will permanently remove this photo from the default library.
          </p>
        </div>
      </Modal>
    </div>
  );
}
