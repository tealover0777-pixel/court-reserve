"use client";
import React, { useState, useEffect } from "react";
import { useNotification } from "../context/NotificationContext";
import { db, auth } from "../lib/firebase";
import {
  doc,
  serverTimestamp,
  onSnapshot,
  setDoc
} from "firebase/firestore";

interface MembershipPlan {
  name: string;
  price: string;
  popular?: boolean;
  features: string[];
  bgColor?: string;
  textColor?: string;
}

interface MembershipsConfig {
  plans: MembershipPlan[];
}

const DEFAULT_PLANS: MembershipPlan[] = [
  { name: "SILVER", price: "99", popular: false, features: ["2 Bookings/Week", "Standard Access", "Social Mixers"] },
  { name: "GOLD", price: "199", popular: true, features: ["Unlimited Bookings", "Priority Courts", "Guest Passes (4)", "Pro Discounts"] },
  { name: "PLATINUM", price: "299", popular: false, features: ["24/7 Access", "Personal Locker", "Free Stringing", "Pro Clinic Access"] }
];

const PRESET_COLORS = [
  { name: "Brand Green", value: "#4f6b28" },
  { name: "Neon Lime", value: "#ccff00" },
  { name: "Royal Gold", value: "#b8860b" },
  { name: "Sleek Silver", value: "#8a9597" },
  { name: "Charcoal Black", value: "#1c1917" },
  { name: "Pure White", value: "#ffffff" },
  { name: "Crimson Coral", value: "#e11d48" },
  { name: "Midnight Navy", value: "#1e3a8a" },
  { name: "Royal Violet", value: "#581c87" }
];

export default function MembershipManagementView({ theme, tenantId }: { theme: string; tenantId: string }) {
  const [plans, setPlans] = useState<MembershipPlan[]>(DEFAULT_PLANS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activePlanIdx, setActivePlanIdx] = useState<number | null>(0);
  const [previewTheme, setPreviewTheme] = useState<"LIGHT" | "DARK" | "VINTAGE">(
    theme === "DARK" || theme === "VINTAGE" || theme === "LIGHT" ? (theme as any) : "LIGHT"
  );
  const { showNotification } = useNotification();

  useEffect(() => {
    if (theme === "DARK" || theme === "VINTAGE" || theme === "LIGHT") {
      setPreviewTheme(theme as any);
    }
  }, [theme]);

  useEffect(() => {
    if (!tenantId) return;

    const configRef = doc(db, "tenants", tenantId, "config", "memberships");
    const unsubscribe = onSnapshot(configRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as MembershipsConfig;
        if (data.plans && Array.isArray(data.plans)) {
          setPlans(data.plans);
        } else {
          setPlans(DEFAULT_PLANS);
        }
      } else {
        setPlans(DEFAULT_PLANS);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [tenantId]);

  const handleSave = async () => {
    if (!tenantId) return;
    setSaving(true);
    try {
      const configRef = doc(db, "tenants", tenantId, "config", "memberships");
      await setDoc(configRef, {
        plans,
        updatedAt: serverTimestamp(),
        updatedBy: auth.currentUser?.uid
      }, { merge: true });
      showNotification("Membership plans configuration saved successfully!");
    } catch (error) {
      console.error("Error saving memberships config:", error);
      showNotification("Failed to save memberships configuration.", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdatePlan = (index: number, updatedFields: Partial<MembershipPlan>) => {
    setPlans(prev => {
      const updated = [...prev];
      const target = updated[index];
      if (!target) return prev;
      updated[index] = { ...target, ...updatedFields };
      return updated;
    });
  };

  const handleAddFeature = (planIndex: number) => {
    setPlans(prev => {
      const updated = [...prev];
      const target = updated[planIndex];
      if (!target) return prev;
      updated[planIndex] = {
        ...target,
        features: [...target.features, "New Elite Feature"]
      };
      return updated;
    });
  };

  const handleRemoveFeature = (planIndex: number, featureIndex: number) => {
    setPlans(prev => {
      const updated = [...prev];
      const target = updated[planIndex];
      if (!target) return prev;
      const updatedFeatures = [...target.features];
      updatedFeatures.splice(featureIndex, 1);
      updated[planIndex] = {
        ...target,
        features: updatedFeatures
      };
      return updated;
    });
  };

  const handleFeatureChange = (planIndex: number, featureIndex: number, val: string) => {
    setPlans(prev => {
      const updated = [...prev];
      const target = updated[planIndex];
      if (!target) return prev;
      const updatedFeatures = [...target.features];
      updatedFeatures[featureIndex] = val;
      updated[planIndex] = {
        ...target,
        features: updatedFeatures
      };
      return updated;
    });
  };

  const handleAddPlan = () => {
    if (plans.length >= 6) {
      showNotification("Maximum limit of 6 membership plans reached.", "error");
      return;
    }
    const newPlan: MembershipPlan = {
      name: `NEW PLAN`,
      price: "150",
      popular: false,
      features: ["Benefit #1", "Benefit #2"]
    };
    setPlans(prev => [...prev, newPlan]);
    setActivePlanIdx(plans.length);
  };

  const handleRemovePlan = (index: number) => {
    if (plans.length <= 1) {
      showNotification("You must maintain at least 1 membership plan.", "error");
      return;
    }
    setPlans(prev => prev.filter((_, idx) => idx !== index));
    setActivePlanIdx(prev => (prev === index ? 0 : prev !== null && prev > index ? prev - 1 : prev));
  };

  // Helper styles to emulate real dashboard cards in preview mode
  const getPreviewCardStyle = (plan: MembershipPlan, themeSelected: string, index: number, total: number) => {
    const isDark = themeSelected === "DARK";
    const isVintage = themeSelected === "VINTAGE";
    const isLight = themeSelected === "LIGHT";

    if (plan.popular) {
      return isDark
        ? "bg-stone-100 text-white border border-[#ccff00]/30 shadow-[#ccff00]/5"
        : isVintage
          ? "bg-black text-white"
          : "bg-[#b8860b] text-white shadow-xl shadow-[#b8860b]/20";
    }
    
    if (index === total - 1 && total > 1) {
      return isDark
        ? "bg-stone-50 text-white border border-stone-200"
        : isVintage
          ? "bg-white text-black border-2 border-black"
          : isLight
            ? "bg-[#8a9597] text-white shadow-xl shadow-[#8a9597]/20"
            : "bg-stone-900 text-white";
    }

    return isDark
      ? "bg-stone-100 text-white"
      : isVintage
        ? "bg-white text-black border border-stone-50"
        : isLight
          ? "bg-white text-[#4f6b28] border-2 border-[#4f6b28]/10"
          : "bg-stone-50 text-stone-900";
  };

  const getPreviewButtonStyle = (plan: MembershipPlan, themeSelected: string) => {
    const isDark = themeSelected === "DARK";
    const isVintage = themeSelected === "VINTAGE";
    const isLight = themeSelected === "LIGHT";

    if (plan.popular) {
      return isDark
        ? "bg-stone-100 text-white"
        : isVintage
          ? "bg-white text-black"
          : "bg-[#ccff00] text-black";
    } else {
      return isDark
        ? "border-2 border-stone-200 text-white hover:bg-stone-200 hover:text-stone-950"
        : isVintage
          ? "border-2 border-black text-black hover:bg-black hover:text-white"
          : "border-2 border-[#4f6b28] text-[#4f6b28] hover:bg-[#4f6b28] hover:text-white";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* View Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <h2 className="text-5xl font-black tracking-tighter uppercase transition-colors text-primary" style={{ fontFamily: 'Lexend, sans-serif' }}>
            MEMBERSHIP PLANS MANAGEMENT
          </h2>
          <p className="text-on-surface-variant text-[11px] font-black uppercase tracking-widest mt-2">
            Design your club tiers and benefits. Changes apply instantly to front-facing plans.
          </p>
        </div>
        <div className="flex items-center gap-4 w-full md:w-auto">
          <button
            onClick={handleAddPlan}
            className="flex-1 md:flex-none px-6 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all bg-surface-container border border-outline/20 text-on-surface hover:bg-surface-container-high active:scale-95 flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-sm">add_circle</span>
            Add New Tier
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 md:flex-none px-8 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all bg-primary text-on-primary hover:scale-105 disabled:opacity-50 shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-sm">{saving ? "sync" : "save"}</span>
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-8">
        {/* Left Side: Plans List & Editor Form */}
        <div className="col-span-12 lg:col-span-6 space-y-6">
          <div className="rounded-[2.5rem] p-10 border transition-colors bg-surface-container-low border-outline/10 space-y-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-primary">credit_card</span>
                <h3 className="text-xl font-black uppercase tracking-widest">Active Plans ({plans.length})</h3>
              </div>
            </div>

            <div className="space-y-4">
              {plans.map((plan, index) => {
                const isActive = activePlanIdx === index;
                return (
                  <div
                    key={index}
                    className={`rounded-3xl border transition-all duration-300 ${
                      isActive
                        ? "bg-surface-container border-primary/40 ring-1 ring-primary/40 p-6"
                        : "bg-surface-container-low border-outline/10 p-5 hover:bg-surface-container hover:border-outline/30 cursor-pointer"
                    }`}
                    onClick={() => !isActive && setActivePlanIdx(index)}
                  >
                    {/* Collapsed view header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 flex-1">
                        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-xs ${
                          plan.popular ? "bg-[#ccff00]/15 text-[#ccff00]" : "bg-primary/10 text-primary"
                        }`}>
                          {plan.name ? plan.name.charAt(0) : "N"}
                        </div>
                        <div>
                          <h4 className="font-headline font-black text-sm tracking-wide uppercase flex items-center gap-2">
                            {plan.name || "UNNAMED PLAN"}
                            {plan.popular && (
                              <span className="bg-[#ccff00] text-black text-[7px] font-black tracking-widest px-2 py-0.5 rounded-full uppercase">
                                FEATURED
                              </span>
                            )}
                          </h4>
                          <p className="text-[10px] font-black uppercase tracking-widest opacity-40 mt-0.5">
                            ${plan.price} / Month • {plan.features ? plan.features.length : 0} Features
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        {plans.length > 1 && (
                          <button
                            onClick={() => handleRemovePlan(index)}
                            className="p-2 rounded-xl text-error hover:bg-error/10 hover:text-error transition-all animate-in fade-in"
                            title="Delete Plan"
                          >
                            <span className="material-symbols-outlined text-lg">delete</span>
                          </button>
                        )}
                        <span className={`material-symbols-outlined text-xl transition-transform duration-300 ${isActive ? 'rotate-180 text-primary' : 'opacity-40'}`}>
                          expand_more
                        </span>
                      </div>
                    </div>

                    {/* Active view detail form */}
                    {isActive && (
                      <div className="mt-8 pt-6 border-t border-outline/15 space-y-6 animate-in fade-in slide-in-from-top-2 duration-300" onClick={(e) => e.stopPropagation()}>
                        {/* Name & Price */}
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <label className="text-[9px] font-black uppercase tracking-[0.2em] opacity-40 ml-1">Plan Name</label>
                            <input
                              type="text"
                              value={plan.name}
                              onChange={(e) => handleUpdatePlan(index, { name: e.target.value.toUpperCase() })}
                              className="w-full px-5 py-3 rounded-2xl bg-surface border-none text-xs font-bold focus:ring-2 focus:ring-primary transition-all"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-[9px] font-black uppercase tracking-[0.2em] opacity-40 ml-1">Price ($/mo)</label>
                            <input
                              type="text"
                              value={plan.price}
                              onChange={(e) => handleUpdatePlan(index, { price: e.target.value })}
                              className="w-full px-5 py-3 rounded-2xl bg-surface border-none text-xs font-bold focus:ring-2 focus:ring-primary transition-all"
                            />
                          </div>
                        </div>

                        {/* Popular Toggles */}
                        <div className="flex items-center justify-between p-4 rounded-2xl bg-surface/50 border border-outline/10">
                          <div>
                            <h5 className="text-[10px] font-black uppercase tracking-wider">Highlight Plan</h5>
                            <p className="text-[8px] font-bold opacity-40 mt-0.5">Adds a highlighted badge and distinctive visual background styling.</p>
                          </div>
                          <button
                            onClick={() => handleUpdatePlan(index, { popular: !plan.popular })}
                            className={`w-10 h-5 rounded-full transition-all relative ${plan.popular ? 'bg-primary' : 'bg-surface-container-highest'}`}
                          >
                            <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${plan.popular ? 'left-6' : 'left-1'}`}></div>
                          </button>
                        </div>

                        {/* Custom Color Controls */}
                        <div className="grid grid-cols-2 gap-4 bg-surface/30 p-5 rounded-3xl border border-outline/10">
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <label className="text-[9px] font-black uppercase tracking-[0.2em] opacity-40 ml-1">Custom Background</label>
                              {plan.bgColor && (
                                <button
                                  onClick={() => handleUpdatePlan(index, { bgColor: "" })}
                                  className="text-[8px] font-black uppercase text-error hover:underline"
                                >
                                  Reset
                                </button>
                              )}
                            </div>
                            <div className="flex items-center gap-3 bg-surface p-2.5 rounded-2xl">
                              <input
                                type="color"
                                value={plan.bgColor || "#ffffff"}
                                onChange={(e) => handleUpdatePlan(index, { bgColor: e.target.value })}
                                className="w-8 h-8 rounded-xl border-0 cursor-pointer overflow-hidden bg-transparent"
                              />
                              <input
                                type="text"
                                placeholder="Auto Theme"
                                value={plan.bgColor || ""}
                                onChange={(e) => handleUpdatePlan(index, { bgColor: e.target.value })}
                                className="flex-1 bg-transparent border-none text-[11px] font-bold outline-none uppercase placeholder:text-stone-500 w-full"
                              />
                            </div>
                            {/* Predefined Palette Swatches */}
                            <div className="flex flex-wrap gap-1.5 pt-2 ml-1">
                              {PRESET_COLORS.map((preset) => (
                                <button
                                  key={preset.name}
                                  onClick={() => handleUpdatePlan(index, { bgColor: preset.value })}
                                  className={`w-5 h-5 rounded-full border transition-all hover:scale-115 cursor-pointer ${
                                    plan.bgColor === preset.value ? "ring-2 ring-primary scale-110" : "border-outline/15 hover:border-outline/30"
                                  }`}
                                  style={{ backgroundColor: preset.value }}
                                  title={preset.name}
                                />
                              ))}
                            </div>
                          </div>

                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <label className="text-[9px] font-black uppercase tracking-[0.2em] opacity-40 ml-1">Custom Font Color</label>
                              {plan.textColor && (
                                <button
                                  onClick={() => handleUpdatePlan(index, { textColor: "" })}
                                  className="text-[8px] font-black uppercase text-error hover:underline"
                                >
                                  Reset
                                </button>
                              )}
                            </div>
                            <div className="flex items-center gap-3 bg-surface p-2.5 rounded-2xl">
                              <input
                                type="color"
                                value={plan.textColor || "#000000"}
                                onChange={(e) => handleUpdatePlan(index, { textColor: e.target.value })}
                                className="w-8 h-8 rounded-xl border-0 cursor-pointer overflow-hidden bg-transparent"
                              />
                              <input
                                type="text"
                                placeholder="Auto Theme"
                                value={plan.textColor || ""}
                                onChange={(e) => handleUpdatePlan(index, { textColor: e.target.value })}
                                className="flex-1 bg-transparent border-none text-[11px] font-bold outline-none uppercase placeholder:text-stone-500 w-full"
                              />
                            </div>
                            {/* Predefined Palette Swatches */}
                            <div className="flex flex-wrap gap-1.5 pt-2 ml-1">
                              {PRESET_COLORS.map((preset) => (
                                <button
                                  key={preset.name}
                                  onClick={() => handleUpdatePlan(index, { textColor: preset.value })}
                                  className={`w-5 h-5 rounded-full border transition-all hover:scale-115 cursor-pointer ${
                                    plan.textColor === preset.value ? "ring-2 ring-primary scale-110" : "border-outline/15 hover:border-outline/30"
                                  }`}
                                  style={{ backgroundColor: preset.value }}
                                  title={preset.name}
                                />
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* Benefits Editor */}
                        <div className="space-y-4">
                          <div className="flex items-center justify-between ml-1">
                            <label className="text-[9px] font-black uppercase tracking-[0.2em] opacity-40">Tier Benefits / Features</label>
                            <button
                              onClick={() => handleAddFeature(index)}
                              className="text-[9px] font-black uppercase tracking-widest text-primary flex items-center gap-1 hover:underline"
                            >
                              <span className="material-symbols-outlined text-xs">add</span> Add Benefit
                            </button>
                          </div>
                          <div className="space-y-2">
                            {plan.features && plan.features.map((feature, fIdx) => (
                              <div key={fIdx} className="flex items-center gap-2">
                                <span className="material-symbols-outlined text-xs text-primary/60">check_circle</span>
                                <input
                                  type="text"
                                  value={feature}
                                  onChange={(e) => handleFeatureChange(index, fIdx, e.target.value)}
                                  className="flex-1 px-4 py-2.5 rounded-xl bg-surface border-none text-xs font-bold focus:ring-2 focus:ring-primary transition-all"
                                />
                                <button
                                  onClick={() => handleRemoveFeature(index, fIdx)}
                                  className="p-2 rounded-xl text-on-surface-variant hover:text-error hover:bg-error/15 transition-all"
                                  title="Remove Benefit"
                                >
                                  <span className="material-symbols-outlined text-base">close</span>
                                </button>
                              </div>
                            ))}
                            {(!plan.features || plan.features.length === 0) && (
                              <div className="text-center py-6 border border-dashed border-outline/10 rounded-2xl opacity-40 text-[9px] uppercase tracking-widest font-black">
                                No benefits added yet. Click 'Add Benefit' above.
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Side: High Fidelity Live Preview */}
        <div className="col-span-12 lg:col-span-6 space-y-6">
          <div className="rounded-[2.5rem] p-10 border transition-colors bg-surface-container-low border-outline/10 space-y-8 h-full flex flex-col">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-primary">visibility</span>
                <h3 className="text-xl font-black uppercase tracking-widest">Dynamic Preview</h3>
              </div>
              <div className="flex items-center gap-1 bg-surface-container p-1 rounded-2xl">
                {(["LIGHT", "DARK", "VINTAGE"] as const).map((t) => {
                  const label = t === "LIGHT" ? "KINETIC" : t === "VINTAGE" ? "LIGHT" : "DARK";
                  return (
                    <button
                      key={t}
                      onClick={() => setPreviewTheme(t)}
                      className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${
                        previewTheme === t
                          ? "bg-primary text-on-primary shadow-md"
                          : "text-on-surface-variant hover:bg-surface-container-high"
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Simulated Device Screen Container */}
            <div className={`flex-1 rounded-[2rem] p-8 transition-colors duration-500 overflow-y-auto min-h-[450px] flex flex-col justify-center theme-${previewTheme.toLowerCase()} bg-background text-on-background ${
              previewTheme === "DARK"
                ? "border border-stone-800"
                : "border border-outline/10"
            }`}>
              <div className="space-y-8 max-w-md mx-auto w-full animate-in fade-in duration-300">
                <h4 className={`text-2xl font-black tracking-tighter uppercase text-center ${
                  previewTheme === "LIGHT" ? "text-[#4f6b28]" : "text-on-background"
                }`} style={{ fontFamily: 'Lexend, sans-serif' }}>
                  MEMBERSHIP PLANS
                </h4>

                <div className="space-y-6">
                  {plans.map((plan, i) => {
                    const cardStyle = getPreviewCardStyle(plan, previewTheme, i, plans.length);
                    const buttonStyle = getPreviewButtonStyle(plan, previewTheme);
                    
                    return (
                      <div
                        key={i}
                        className={`${cardStyle} rounded-[30px] p-8 shadow-lg relative flex flex-col transition-all duration-300 ${
                          activePlanIdx === i ? "ring-2 ring-primary scale-[1.02]" : "opacity-85"
                        }`}
                        style={{
                          backgroundColor: plan.bgColor || undefined,
                          color: plan.textColor || undefined,
                        }}
                      >
                        {plan.popular && (
                          <div className={`absolute -top-3.5 left-8 px-4 py-1.5 text-[8px] font-black tracking-[0.2em] rounded-full shadow transition-colors ${
                            previewTheme === "DARK" ? "bg-white text-black" : previewTheme === "LIGHT" ? "bg-[#ccff00] text-black" : "bg-stone-900 text-white"
                          }`}>
                            MOST POPULAR
                          </div>
                        )}
                        <div className="mb-6">
                          <h5 className="text-lg font-black tracking-widest uppercase opacity-60 mb-1">{plan.name || "UNNAMED"}</h5>
                          <div className="flex items-baseline">
                            <span className="text-3xl font-black">${plan.price}</span>
                            <span className="text-xs font-bold opacity-40 ml-1.5">/MO</span>
                          </div>
                        </div>
                        <ul className="space-y-3.5 flex-1">
                          {plan.features && plan.features.map((f, j) => (
                            <li key={j} className="flex items-center gap-3">
                              <span className="material-symbols-outlined text-xs">check_circle</span>
                              <span className="text-xs font-bold">{f}</span>
                            </li>
                          ))}
                        </ul>
                        <button
                          className={`mt-8 w-full py-4 rounded-xl text-[9px] font-black tracking-widest uppercase transition-all ${buttonStyle}`}
                          style={
                            plan.textColor || plan.bgColor
                              ? plan.popular
                                ? {
                                    backgroundColor: plan.textColor || undefined,
                                    color: plan.bgColor || undefined,
                                  }
                                : {
                                    borderColor: plan.textColor || undefined,
                                    color: plan.textColor || undefined,
                                  }
                              : undefined
                          }
                        >
                          {plan.popular ? "CURRENT PLAN" : "UPGRADE NOW"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
