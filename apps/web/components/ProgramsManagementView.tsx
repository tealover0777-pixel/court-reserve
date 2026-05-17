"use client";
import React, { useState, useEffect, useRef } from "react";
import { useNotification } from "../context/NotificationContext";
import { db, storage, auth } from "../lib/firebase";
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  onSnapshot
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

interface ThemeColors {
  bgColor?: string;
  textColor?: string;
}

interface ProgramTrack {
  title: string;
  description: string;
  imageUrl: string;
  priceLabel: string;
  priceValue: string;
  icon: string;
  tag?: string;
  themeColors?: {
    LIGHT?: ThemeColors;
    DARK?: ThemeColors;
    VINTAGE?: ThemeColors;
  };
}

interface FeaturedProgramItem {
  headline: string;
  description: string;
  imageUrl: string;
}

interface ProgramsConfig {
  heroHeadline: string;
  heroDescription: string;
  heroImageUrl: string;
  
  featuredPrograms?: FeaturedProgramItem[];
  
  sidebarHeadline: string;
  sidebarDescription: string;
  sidebarButtonText: string;
  
  tracks: ProgramTrack[];
  
  bottomHeadline: string;
  bottomDescription: string;
  bottomImageUrl: string;
  
  showHero: boolean;
  showSidebar: boolean;
  showTracks: boolean;
  showBottom: boolean;

  // Custom colors per theme
  sidebarThemeColors?: {
    LIGHT?: ThemeColors;
    DARK?: ThemeColors;
    VINTAGE?: ThemeColors;
  };
  bottomThemeColors?: {
    LIGHT?: ThemeColors;
    DARK?: ThemeColors;
    VINTAGE?: ThemeColors;
  };
}

const DEFAULT_CONFIG: ProgramsConfig = {
  heroHeadline: "CHAMPIONSHIP CLINIC 2024",
  heroDescription: "Intensive technical refinement for competitive players. Lead by ITF-certified master professionals.",
  heroImageUrl: "/images/programs_hero.png",
  
  featuredPrograms: [
    {
      headline: "CHAMPIONSHIP CLINIC 2024",
      description: "Intensive technical refinement for competitive players. Lead by ITF-certified master professionals.",
      imageUrl: "/images/programs_hero.png"
    }
  ],
  
  sidebarHeadline: "PRO-FOCUS WEEKEND",
  sidebarDescription: "Join Coach Marcus for a 48-hour immersion into strategy and bio-mechanics. Limited to 8 participants.",
  sidebarButtonText: "VIEW COACH BIO",
  
  tracks: [
    { 
      title: "ACTIVE CLINICS", 
      description: "High-energy drills focused on footwork, stamina, and consistent point construction.", 
      imageUrl: "/images/active_clinics.png",
      priceLabel: "STARTS AT",
      priceValue: "$45/HR",
      icon: "bolt"
    },
    { 
      title: "JUNIOR ACADEMY", 
      description: "Developing the next generation of competitors. Age groups 8-16.", 
      imageUrl: "/images/junior_academy.png",
      priceLabel: "LEVEL",
      priceValue: "PREMIER",
      icon: "school",
      tag: "PREMIER LEVEL"
    },
    { 
      title: "SOCIAL MIXERS", 
      description: "Network while you play. Round-robin format followed by clubhouse drinks.", 
      imageUrl: "/images/social_mixers.png",
      priceLabel: "CAPACITY",
      priceValue: "24 PLAYERS",
      icon: "groups"
    }
  ],
  
  bottomHeadline: "SPRING SESSION '24",
  bottomDescription: "Our most comprehensive training cycle yet. Registration now open for all skill levels.",
  bottomImageUrl: "/images/spring_session.png",
  
  showHero: true,
  showSidebar: true,
  showTracks: true,
  showBottom: true
};

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

export default function ProgramsManagementView({ theme, tenantId }: { theme: string; tenantId: string }) {
  const [config, setConfig] = useState<ProgramsConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [uploadTarget, setUploadTarget] = useState<{ type: string; index?: number } | null>(null);
  const [activeTheme, setActiveTheme] = useState<"LIGHT" | "DARK" | "VINTAGE">("LIGHT");
  const { showNotification } = useNotification();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const triggerImageUpload = (type: string, index?: number) => {
    setUploadTarget({ type, index });
    fileInputRef.current?.click();
  };
  
  const activeSidebarBgColor = config.sidebarThemeColors?.[activeTheme]?.bgColor || "";
  const activeSidebarTextColor = config.sidebarThemeColors?.[activeTheme]?.textColor || "";
  const activeBottomBgColor = config.bottomThemeColors?.[activeTheme]?.bgColor || "";
  const activeBottomTextColor = config.bottomThemeColors?.[activeTheme]?.textColor || "";
  const activeThemeName = activeTheme === "LIGHT" ? "Kinetic" : activeTheme === "VINTAGE" ? "Light" : "Dark";

  const handleUpdateThemeColor = (
    section: 'sidebar' | 'bottom',
    key: 'bgColor' | 'textColor',
    value: string
  ) => {
    setConfig(prev => {
      const themeColorsKey = section === 'sidebar' ? 'sidebarThemeColors' : 'bottomThemeColors';
      const themeColors = { ...(prev[themeColorsKey] || {}) };
      const currentThemeOverride = { ...(themeColors[activeTheme] || {}) };
      
      if (value === "") {
        delete currentThemeOverride[key];
      } else {
        currentThemeOverride[key] = value;
      }
      
      if (Object.keys(currentThemeOverride).length === 0) {
        delete themeColors[activeTheme];
      } else {
        themeColors[activeTheme] = currentThemeOverride;
      }
      
      return {
        ...prev,
        [themeColorsKey]: themeColors
      };
    });
  };

  const handleUpdateTrackThemeColor = (
    trackIndex: number,
    key: 'bgColor' | 'textColor',
    value: string
  ) => {
    setConfig(prev => {
      const updatedTracks = [...prev.tracks];
      const originalTrack = updatedTracks[trackIndex];
      if (!originalTrack) return prev;
      const track = { ...originalTrack };
      const trackThemeColors = { ...(track.themeColors || {}) };
      const currentThemeOverride = { ...(trackThemeColors[activeTheme] || {}) };

      if (value === "") {
        delete currentThemeOverride[key];
      } else {
        currentThemeOverride[key] = value;
      }

      if (Object.keys(currentThemeOverride).length === 0) {
        delete trackThemeColors[activeTheme];
      } else {
        trackThemeColors[activeTheme] = currentThemeOverride;
      }

      track.themeColors = trackThemeColors;
      updatedTracks[trackIndex] = track;

      return {
        ...prev,
        tracks: updatedTracks
      };
    });
  };
  
  const heroInputRef = useRef<HTMLInputElement>(null);
  const bottomInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!tenantId) return;

    const configRef = doc(db, "tenants", tenantId, "config", "programs");
    const unsubscribe = onSnapshot(configRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as ProgramsConfig;
        const featuredPrograms = data.featuredPrograms || [
          {
            headline: data.heroHeadline || "CHAMPIONSHIP CLINIC 2024",
            description: data.heroDescription || "Intensive technical refinement for competitive players. Lead by ITF-certified master professionals.",
            imageUrl: data.heroImageUrl || "/images/programs_hero.png"
          }
        ];
        setConfig({ ...DEFAULT_CONFIG, ...data, featuredPrograms });
      } else {
        setConfig(DEFAULT_CONFIG);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [tenantId]);

  const handleSave = async () => {
    if (!tenantId) return;
    setSaving(true);
    try {
      const configRef = doc(db, "tenants", tenantId, "config", "programs");
      await setDoc(configRef, {
        ...config,
        updatedAt: serverTimestamp(),
        updatedBy: auth.currentUser?.uid
      }, { merge: true });
      showNotification("Programs configuration saved successfully!");
    } catch (error) {
      console.error("Error saving programs config:", error);
      showNotification("Failed to save programs configuration.", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleImageUpload = async (file: File, type: string, index?: number) => {
    if (!tenantId) return;
    setUploading(index !== undefined ? `${type}_${index}` : type);
    try {
      const path = `tenants/${tenantId}/programs/${type}_${index !== undefined ? index : ''}_${Date.now()}_${file.name}`;
      const storageRef = ref(storage, path);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      
      if (type === 'hero') {
        setConfig(prev => ({ ...prev, heroImageUrl: url }));
      } else if (type === 'bottom') {
        setConfig(prev => ({ ...prev, bottomImageUrl: url }));
      } else if (type === 'featured' && index !== undefined) {
        setConfig(prev => {
          const featured = [...(prev.featuredPrograms || [])];
          if (featured[index]) {
            featured[index] = { ...featured[index], imageUrl: url };
          }
          return { ...prev, featuredPrograms: featured };
        });
      } else if (type === 'track' && index !== undefined) {
        setConfig(prev => {
          const newTracks = [...prev.tracks];
          const track = newTracks[index];
          if (track) {
            newTracks[index] = { ...track, imageUrl: url };
          }
          return { ...prev, tracks: newTracks };
        });
      }
      showNotification("Image uploaded successfully!");
    } catch (error) {
      console.error("Error uploading image:", error);
      showNotification("Failed to upload image.", "error");
    } finally {
      setUploading(null);
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
    <div className="max-w-6xl space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-5xl font-black tracking-tighter uppercase transition-colors text-primary" style={{ fontFamily: 'Lexend, sans-serif' }}>
            PROGRAMS MANAGEMENT
          </h2>
          <p className="text-on-surface-variant text-[11px] font-black uppercase tracking-widest mt-2">Manage your club's training offerings.</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-8 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all bg-primary text-on-primary hover:scale-105 disabled:opacity-50 shadow-lg shadow-primary/20"
        >
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </div>

      {/* Dynamic Theme Selection Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-surface-container-low p-6 rounded-3xl border border-outline/10">
        <div>
          <h4 className="text-xs font-black uppercase tracking-wider text-on-surface">Configuration Color Theme Scope</h4>
          <p className="text-[9px] font-bold opacity-50 uppercase tracking-widest mt-1">Select theme to customize specific background and font color overrides</p>
        </div>
        <div className="flex gap-2">
          {[
            { key: "LIGHT", label: "Kinetic" },
            { key: "DARK", label: "Dark" },
            { key: "VINTAGE", label: "Light" }
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTheme(t.key as any)}
              className={`px-6 py-2.5 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all ${
                activeTheme === t.key
                  ? "bg-primary text-on-primary shadow-md hover:scale-102"
                  : "bg-surface hover:bg-surface-container transition-all"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-12 gap-8">
        <div className="col-span-12 lg:col-span-8 space-y-6">
          {/* Featured Programs Editor */}
          <div className="rounded-[2.5rem] p-10 border transition-colors bg-surface-container-low border-outline/10 space-y-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-primary">workspace_premium</span>
                <h3 className="text-xl font-black uppercase tracking-widest">Featured Programs</h3>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-black uppercase tracking-widest opacity-40">Display</span>
                <button
                  onClick={() => setConfig({ ...config, showHero: !config.showHero })}
                  className={`w-10 h-5 rounded-full transition-all relative ${config.showHero ? 'bg-primary' : 'bg-surface-container-highest'}`}
                >
                  <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${config.showHero ? 'left-6' : 'left-1'}`}></div>
                </button>
              </div>
            </div>
            
            <div className="space-y-10">
              {config.featuredPrograms?.map((item, idx) => (
                <div key={idx} className="p-8 rounded-[2rem] bg-surface-container space-y-6 relative overflow-hidden">
                  <div className="flex justify-between items-center">
                    <span className="px-4 py-1 rounded-full text-[8px] font-black uppercase tracking-widest bg-primary/10 text-primary">
                      Featured Program 0{idx + 1}
                    </span>
                    {config.featuredPrograms && config.featuredPrograms.length > 1 && (
                      <button
                        onClick={() => {
                          setConfig(prev => {
                            const newFeatured = [...(prev.featuredPrograms || [])];
                            newFeatured.splice(idx, 1);
                            return { ...prev, featuredPrograms: newFeatured };
                          });
                        }}
                        className="flex items-center gap-1 text-[8px] font-black uppercase tracking-widest text-error hover:underline transition-all"
                      >
                        <span className="material-symbols-outlined text-sm">delete</span>
                        Remove
                      </button>
                    )}
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase tracking-widest opacity-40">Headline</label>
                      <input
                        type="text"
                        value={item.headline}
                        onChange={(e) => {
                          const val = e.target.value;
                          setConfig(prev => {
                            const newFeatured = [...(prev.featuredPrograms || [])];
                            if (newFeatured[idx]) {
                              newFeatured[idx] = { ...newFeatured[idx], headline: val };
                            }
                            return { ...prev, featuredPrograms: newFeatured };
                          });
                        }}
                        className="w-full px-4 py-3 rounded-xl bg-surface border-none text-[10px] font-bold"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase tracking-widest opacity-40">Description</label>
                      <textarea
                        value={item.description}
                        onChange={(e) => {
                          const val = e.target.value;
                          setConfig(prev => {
                            const newFeatured = [...(prev.featuredPrograms || [])];
                            if (newFeatured[idx]) {
                              newFeatured[idx] = { ...newFeatured[idx], description: val };
                            }
                            return { ...prev, featuredPrograms: newFeatured };
                          });
                        }}
                        className="w-full px-4 py-3 rounded-xl bg-surface border-none text-[10px] font-bold min-h-[80px]"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase tracking-widest opacity-40">Program Image</label>
                      <div 
                        onClick={() => triggerImageUpload('featured', idx)}
                        className="group relative h-28 rounded-xl overflow-hidden cursor-pointer border-2 border-dashed border-outline/10 hover:border-primary/50 transition-all flex items-center justify-center bg-surface"
                      >
                        {item.imageUrl ? (
                          <>
                            <img src={item.imageUrl} className="absolute inset-0 w-full h-full object-cover opacity-30" alt="Featured" />
                            <span className="relative z-10 material-symbols-outlined text-xl text-primary">image</span>
                          </>
                        ) : (
                          <span className="material-symbols-outlined text-xl opacity-20">add_photo_alternate</span>
                        )}
                        {uploading === `featured_${idx}` && (
                          <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-20">
                            <div className="w-4 h-4 border border-white border-t-transparent rounded-full animate-spin"></div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              <button
                onClick={() => {
                  setConfig(prev => ({
                    ...prev,
                    featuredPrograms: [
                      ...(prev.featuredPrograms || []),
                      { headline: "CHAMPIONSHIP CLINIC 2024", description: "Intensive technical refinement for competitive players.", imageUrl: "" }
                    ]
                  }));
                }}
                className="w-full py-4 border-2 border-dashed border-primary/30 rounded-2xl text-[10px] font-black tracking-widest text-primary hover:border-primary hover:bg-primary/5 transition-all uppercase flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-lg">add</span>
                Add Featured Program
              </button>
            </div>
          </div>

          {/* Training Tracks Editor */}
          <div className="rounded-[2.5rem] p-10 border transition-colors bg-surface-container-low border-outline/10">
             <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-primary">dynamic_feed</span>
                <h3 className="text-xl font-black uppercase tracking-widest">Training Tracks</h3>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-black uppercase tracking-widest opacity-40">Display</span>
                <button
                  onClick={() => setConfig({ ...config, showTracks: !config.showTracks })}
                  className={`w-10 h-5 rounded-full transition-all relative ${config.showTracks ? 'bg-primary' : 'bg-surface-container-highest'}`}
                >
                  <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${config.showTracks ? 'left-6' : 'left-1'}`}></div>
                </button>
              </div>
            </div>

            <div className="space-y-12">
              {config.tracks.map((track, idx) => (
                <div key={idx} className="p-8 rounded-[2rem] bg-surface-container space-y-6 relative overflow-hidden">
                  <div className="flex justify-between items-center mb-2">
                    <span className="px-4 py-1 rounded-full text-[8px] font-black uppercase tracking-widest bg-primary/10 text-primary">Track 0{idx + 1}</span>
                    {config.tracks.length > 1 && (
                      <button
                        onClick={() => {
                          setConfig(prev => {
                            const newTracks = [...prev.tracks];
                            newTracks.splice(idx, 1);
                            return { ...prev, tracks: newTracks };
                          });
                        }}
                        className="flex items-center gap-1 text-[8px] font-black uppercase tracking-widest text-error hover:underline transition-all"
                      >
                        <span className="material-symbols-outlined text-sm">delete</span>
                        Remove Track
                      </button>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase tracking-widest opacity-40">Title</label>
                        <input
                          type="text"
                          value={track.title}
                          onChange={(e) => {
                            const val = e.target.value;
                            setConfig(prev => {
                              const newTracks = [...prev.tracks];
                              const trackObj = newTracks[idx];
                              if (trackObj) {
                                newTracks[idx] = { ...trackObj, title: val };
                              }
                              return { ...prev, tracks: newTracks };
                            });
                          }}
                          className="w-full px-4 py-3 rounded-xl bg-surface border-none text-[10px] font-bold"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase tracking-widest opacity-40">Description</label>
                        <textarea
                          value={track.description}
                          onChange={(e) => {
                            const val = e.target.value;
                            setConfig(prev => {
                              const newTracks = [...prev.tracks];
                              const trackObj = newTracks[idx];
                              if (trackObj) {
                                newTracks[idx] = { ...trackObj, description: val };
                              }
                              return { ...prev, tracks: newTracks };
                            });
                          }}
                          className="w-full px-4 py-3 rounded-xl bg-surface border-none text-[10px] font-bold min-h-[80px]"
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-[9px] font-black uppercase tracking-widest opacity-40">Stat Label</label>
                          <input
                            type="text"
                            value={track.priceLabel}
                            onChange={(e) => {
                              const val = e.target.value;
                              setConfig(prev => {
                                const newTracks = [...prev.tracks];
                                const trackObj = newTracks[idx];
                                if (trackObj) {
                                  newTracks[idx] = { ...trackObj, priceLabel: val };
                                }
                                return { ...prev, tracks: newTracks };
                              });
                            }}
                            className="w-full px-4 py-3 rounded-xl bg-surface border-none text-[10px] font-bold"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-black uppercase tracking-widest opacity-40">Stat Value</label>
                          <input
                            type="text"
                            value={track.priceValue}
                            onChange={(e) => {
                              const val = e.target.value;
                              setConfig(prev => {
                                const newTracks = [...prev.tracks];
                                const trackObj = newTracks[idx];
                                if (trackObj) {
                                  newTracks[idx] = { ...trackObj, priceValue: val };
                                }
                                return { ...prev, tracks: newTracks };
                              });
                            }}
                            className="w-full px-4 py-3 rounded-xl bg-surface border-none text-[10px] font-bold"
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase tracking-widest opacity-40">Track Image</label>
                        <div 
                          onClick={() => triggerImageUpload('track', idx)}
                          className="group relative h-24 rounded-xl overflow-hidden cursor-pointer border-2 border-dashed border-outline/10 hover:border-primary/50 transition-all flex items-center justify-center bg-surface"
                        >
                          {track.imageUrl ? (
                            <>
                              <img src={track.imageUrl} className="absolute inset-0 w-full h-full object-cover opacity-30" alt="Track" />
                              <span className="relative z-10 material-symbols-outlined text-xl text-primary">image</span>
                            </>
                          ) : (
                            <span className="material-symbols-outlined text-xl opacity-20">add_photo_alternate</span>
                          )}
                          {uploading === `track_${idx}` && (
                            <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-20">
                              <div className="w-4 h-4 border border-white border-t-transparent rounded-full animate-spin"></div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Track Theme Custom Color Pickers */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-surface/30 p-4 rounded-2xl border border-outline/10 mt-4">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="text-[8px] font-black uppercase tracking-widest opacity-40">
                          Background ({activeThemeName})
                        </label>
                        {track.themeColors?.[activeTheme]?.bgColor && (
                          <button
                            onClick={() => handleUpdateTrackThemeColor(idx, "bgColor", "")}
                            className="text-[7px] font-black uppercase text-error hover:underline"
                          >
                            Reset
                          </button>
                        )}
                      </div>
                      <div className="flex items-center gap-2 bg-surface px-2 py-1.5 rounded-xl">
                        <input
                          type="color"
                          value={track.themeColors?.[activeTheme]?.bgColor || "#ffffff"}
                          onChange={(e) => handleUpdateTrackThemeColor(idx, "bgColor", e.target.value)}
                          className="w-6 h-6 rounded-lg border-0 cursor-pointer overflow-hidden bg-transparent"
                        />
                        <input
                          type="text"
                          placeholder="Auto"
                          value={track.themeColors?.[activeTheme]?.bgColor || ""}
                          onChange={(e) => handleUpdateTrackThemeColor(idx, "bgColor", e.target.value)}
                          className="flex-1 bg-transparent border-none text-[9px] font-bold outline-none uppercase placeholder:text-stone-500 w-full"
                        />
                      </div>
                      <div className="flex flex-wrap gap-1 pt-1">
                        {PRESET_COLORS.map((preset) => (
                          <button
                            key={preset.name}
                            onClick={() => handleUpdateTrackThemeColor(idx, "bgColor", preset.value)}
                            className={`w-4 h-4 rounded-full border transition-all hover:scale-115 cursor-pointer ${
                              track.themeColors?.[activeTheme]?.bgColor === preset.value ? "ring-1 ring-primary scale-110" : "border-outline/15 hover:border-outline/35"
                            }`}
                            style={{ backgroundColor: preset.value }}
                            title={preset.name}
                          />
                        ))}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="text-[8px] font-black uppercase tracking-widest opacity-40">
                          Font Color ({activeThemeName})
                        </label>
                        {track.themeColors?.[activeTheme]?.textColor && (
                          <button
                            onClick={() => handleUpdateTrackThemeColor(idx, "textColor", "")}
                            className="text-[7px] font-black uppercase text-error hover:underline"
                          >
                            Reset
                          </button>
                        )}
                      </div>
                      <div className="flex items-center gap-2 bg-surface px-2 py-1.5 rounded-xl">
                        <input
                          type="color"
                          value={track.themeColors?.[activeTheme]?.textColor || "#000000"}
                          onChange={(e) => handleUpdateTrackThemeColor(idx, "textColor", e.target.value)}
                          className="w-6 h-6 rounded-lg border-0 cursor-pointer overflow-hidden bg-transparent"
                        />
                        <input
                          type="text"
                          placeholder="Auto"
                          value={track.themeColors?.[activeTheme]?.textColor || ""}
                          onChange={(e) => handleUpdateTrackThemeColor(idx, "textColor", e.target.value)}
                          className="flex-1 bg-transparent border-none text-[9px] font-bold outline-none uppercase placeholder:text-stone-500 w-full"
                        />
                      </div>
                      <div className="flex flex-wrap gap-1 pt-1">
                        {PRESET_COLORS.map((preset) => (
                          <button
                            key={preset.name}
                            onClick={() => handleUpdateTrackThemeColor(idx, "textColor", preset.value)}
                            className={`w-4 h-4 rounded-full border transition-all hover:scale-115 cursor-pointer ${
                              track.themeColors?.[activeTheme]?.textColor === preset.value ? "ring-1 ring-primary scale-110" : "border-outline/15 hover:border-outline/35"
                            }`}
                            style={{ backgroundColor: preset.value }}
                            title={preset.name}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              <button
                onClick={() => {
                  setConfig(prev => ({
                    ...prev,
                    tracks: [
                      ...prev.tracks,
                      { 
                        title: "NEW TRAINING TRACK", 
                        description: "Track details and scheduling information...", 
                        imageUrl: "",
                        priceLabel: "STARTS AT",
                        priceValue: "$50/HR",
                        icon: "fitness_center"
                      }
                    ]
                  }));
                }}
                className="w-full py-4 border-2 border-dashed border-primary/30 rounded-2xl text-[10px] font-black tracking-widest text-primary hover:border-primary hover:bg-primary/5 transition-all uppercase flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-lg">add</span>
                Add Training Track
              </button>
            </div>
          </div>
        </div>

        <div className="col-span-12 lg:col-span-4 space-y-6">
          {/* Sidebar Editor */}
          <div className="rounded-[2.5rem] p-10 border transition-colors bg-surface-container-low border-outline/10">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-xl font-black uppercase tracking-widest">Side Spotlight</h3>
              <button
                onClick={() => setConfig({ ...config, showSidebar: !config.showSidebar })}
                className={`w-10 h-5 rounded-full transition-all relative ${config.showSidebar ? 'bg-primary' : 'bg-surface-container-highest'}`}
              >
                <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${config.showSidebar ? 'left-6' : 'left-1'}`}></div>
              </button>
            </div>
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase tracking-widest opacity-40">Headline</label>
                <input
                  type="text"
                  value={config.sidebarHeadline}
                  onChange={(e) => setConfig({ ...config, sidebarHeadline: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl bg-surface-container border-none text-[10px] font-bold"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase tracking-widest opacity-40">Description</label>
                <textarea
                  value={config.sidebarDescription}
                  onChange={(e) => setConfig({ ...config, sidebarDescription: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl bg-surface-container border-none text-[10px] font-bold min-h-[80px]"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase tracking-widest opacity-40">Button Text</label>
                <input
                  type="text"
                  value={config.sidebarButtonText}
                  onChange={(e) => setConfig({ ...config, sidebarButtonText: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl bg-surface-container border-none text-[10px] font-bold"
                />
              </div>
            </div>

              {/* Side Spotlight Custom Colors */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-surface/30 p-5 rounded-3xl border border-outline/10 mt-6">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[9px] font-black uppercase tracking-[0.2em] opacity-40 ml-1">
                      Background ({activeThemeName})
                    </label>
                    {activeSidebarBgColor && (
                      <button
                        onClick={() => handleUpdateThemeColor("sidebar", "bgColor", "")}
                        className="text-[8px] font-black uppercase text-error hover:underline"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-3 bg-surface p-2.5 rounded-2xl">
                    <input
                      type="color"
                      value={activeSidebarBgColor || "#ffffff"}
                      onChange={(e) => handleUpdateThemeColor("sidebar", "bgColor", e.target.value)}
                      className="w-8 h-8 rounded-xl border-0 cursor-pointer overflow-hidden bg-transparent"
                    />
                    <input
                      type="text"
                      placeholder="Auto"
                      value={activeSidebarBgColor || ""}
                      onChange={(e) => handleUpdateThemeColor("sidebar", "bgColor", e.target.value)}
                      className="flex-1 bg-transparent border-none text-[11px] font-bold outline-none uppercase placeholder:text-stone-500 w-full"
                    />
                  </div>
                  {/* Predefined Swatches */}
                  <div className="flex flex-wrap gap-1.5 pt-2 ml-1">
                    {PRESET_COLORS.map((preset) => (
                      <button
                        key={preset.name}
                        onClick={() => handleUpdateThemeColor("sidebar", "bgColor", preset.value)}
                        className={`w-5 h-5 rounded-full border transition-all hover:scale-115 cursor-pointer ${
                          activeSidebarBgColor === preset.value ? "ring-2 ring-primary scale-110" : "border-outline/15 hover:border-outline/35"
                        }`}
                        style={{ backgroundColor: preset.value }}
                        title={preset.name}
                      />
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[9px] font-black uppercase tracking-[0.2em] opacity-40 ml-1">
                      Font Color ({activeThemeName})
                    </label>
                    {activeSidebarTextColor && (
                      <button
                        onClick={() => handleUpdateThemeColor("sidebar", "textColor", "")}
                        className="text-[8px] font-black uppercase text-error hover:underline"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-3 bg-surface p-2.5 rounded-2xl">
                    <input
                      type="color"
                      value={activeSidebarTextColor || "#000000"}
                      onChange={(e) => handleUpdateThemeColor("sidebar", "textColor", e.target.value)}
                      className="w-8 h-8 rounded-xl border-0 cursor-pointer overflow-hidden bg-transparent"
                    />
                    <input
                      type="text"
                      placeholder="Auto"
                      value={activeSidebarTextColor || ""}
                      onChange={(e) => handleUpdateThemeColor("sidebar", "textColor", e.target.value)}
                      className="flex-1 bg-transparent border-none text-[11px] font-bold outline-none uppercase placeholder:text-stone-500 w-full"
                    />
                  </div>
                  {/* Predefined Swatches */}
                  <div className="flex flex-wrap gap-1.5 pt-2 ml-1">
                    {PRESET_COLORS.map((preset) => (
                      <button
                        key={preset.name}
                        onClick={() => handleUpdateThemeColor("sidebar", "textColor", preset.value)}
                        className={`w-5 h-5 rounded-full border transition-all hover:scale-115 cursor-pointer ${
                          activeSidebarTextColor === preset.value ? "ring-2 ring-primary scale-110" : "border-outline/15 hover:border-outline/35"
                        }`}
                        style={{ backgroundColor: preset.value }}
                        title={preset.name}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>

      {/* Bottom Banner Editor */}
      <div className="rounded-[2.5rem] p-10 border transition-colors bg-surface-container-low border-outline/10">
        <div className="flex items-center justify-between mb-8">
          <h3 className="text-xl font-black uppercase tracking-widest">Bottom Banner</h3>
          <button
            onClick={() => setConfig({ ...config, showBottom: !config.showBottom })}
            className={`w-10 h-5 rounded-full transition-all relative ${config.showBottom ? 'bg-primary' : 'bg-surface-container-highest'}`}
          >
            <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${config.showBottom ? 'left-6' : 'left-1'}`}></div>
          </button>
        </div>
        <div className="space-y-4">
           <div className="space-y-1">
            <label className="text-[9px] font-black uppercase tracking-widest opacity-40">Headline</label>
            <input
              type="text"
              value={config.bottomHeadline}
              onChange={(e) => setConfig({ ...config, bottomHeadline: e.target.value })}
              className="w-full px-4 py-3 rounded-xl bg-surface-container border-none text-[10px] font-bold"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[9px] font-black uppercase tracking-widest opacity-40">Description</label>
            <textarea
              value={config.bottomDescription}
              onChange={(e) => setConfig({ ...config, bottomDescription: e.target.value })}
              className="w-full px-4 py-3 rounded-xl bg-surface-container border-none text-[10px] font-bold min-h-[80px]"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[9px] font-black uppercase tracking-widest opacity-40">Banner Image</label>
            <div 
              onClick={() => bottomInputRef.current?.click()}
              className="group relative h-48 rounded-[2rem] overflow-hidden cursor-pointer border-2 border-dashed border-outline/10 hover:border-primary/50 transition-all flex items-center justify-center bg-surface-container/50"
            >
              {config.bottomImageUrl ? (
                <>
                  <img src={config.bottomImageUrl} className="absolute inset-0 w-full h-full object-cover opacity-40 group-hover:scale-105 transition-all duration-700" alt="Bottom" />
                  <div className="relative z-10 flex flex-col items-center gap-2">
                    <span className="material-symbols-outlined text-4xl text-on-surface">cloud_upload</span>
                    <span className="text-[10px] font-black uppercase tracking-widest text-on-surface">Change Image</span>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center gap-2 opacity-40">
                  <span className="material-symbols-outlined text-4xl">add_photo_alternate</span>
                  <span className="text-[10px] font-black uppercase tracking-widest">Upload Image</span>
                </div>
              )}
              {uploading === 'bottom' && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-20">
                  <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                </div>
              )}
            </div>
            <input type="file" ref={bottomInputRef} className="hidden" onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0], 'bottom')} accept="image/*" />
          </div>
        </div>

          {/* Bottom Banner Custom Colors */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-surface/30 p-5 rounded-3xl border border-outline/10 mt-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[9px] font-black uppercase tracking-[0.2em] opacity-40 ml-1">
                  Background ({activeThemeName})
                </label>
                {activeBottomBgColor && (
                  <button
                    onClick={() => handleUpdateThemeColor("bottom", "bgColor", "")}
                    className="text-[8px] font-black uppercase text-error hover:underline"
                  >
                    Reset
                  </button>
                )}
              </div>
              <div className="flex items-center gap-3 bg-surface p-2.5 rounded-2xl">
                <input
                  type="color"
                  value={activeBottomBgColor || "#ffffff"}
                  onChange={(e) => handleUpdateThemeColor("bottom", "bgColor", e.target.value)}
                  className="w-8 h-8 rounded-xl border-0 cursor-pointer overflow-hidden bg-transparent"
                />
                <input
                  type="text"
                  placeholder="Auto"
                  value={activeBottomBgColor || ""}
                  onChange={(e) => handleUpdateThemeColor("bottom", "bgColor", e.target.value)}
                  className="flex-1 bg-transparent border-none text-[11px] font-bold outline-none uppercase placeholder:text-stone-500 w-full"
                />
              </div>
              {/* Predefined Swatches */}
              <div className="flex flex-wrap gap-1.5 pt-2 ml-1">
                {PRESET_COLORS.map((preset) => (
                  <button
                    key={preset.name}
                    onClick={() => handleUpdateThemeColor("bottom", "bgColor", preset.value)}
                    className={`w-5 h-5 rounded-full border transition-all hover:scale-115 cursor-pointer ${
                      activeBottomBgColor === preset.value ? "ring-2 ring-primary scale-110" : "border-outline/15 hover:border-outline/35"
                    }`}
                    style={{ backgroundColor: preset.value }}
                    title={preset.name}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[9px] font-black uppercase tracking-[0.2em] opacity-40 ml-1">
                  Font Color ({activeThemeName})
                </label>
                {activeBottomTextColor && (
                  <button
                    onClick={() => handleUpdateThemeColor("bottom", "textColor", "")}
                    className="text-[8px] font-black uppercase text-error hover:underline"
                  >
                    Reset
                  </button>
                )}
              </div>
              <div className="flex items-center gap-3 bg-surface p-2.5 rounded-2xl">
                <input
                  type="color"
                  value={activeBottomTextColor || "#000000"}
                  onChange={(e) => handleUpdateThemeColor("bottom", "textColor", e.target.value)}
                  className="w-8 h-8 rounded-xl border-0 cursor-pointer overflow-hidden bg-transparent"
                />
                <input
                  type="text"
                  placeholder="Auto"
                  value={activeBottomTextColor || ""}
                  onChange={(e) => handleUpdateThemeColor("bottom", "textColor", e.target.value)}
                  className="flex-1 bg-transparent border-none text-[11px] font-bold outline-none uppercase placeholder:text-stone-500 w-full"
                />
              </div>
              {/* Predefined Swatches */}
              <div className="flex flex-wrap gap-1.5 pt-2 ml-1">
                {PRESET_COLORS.map((preset) => (
                  <button
                    key={preset.name}
                    onClick={() => handleUpdateThemeColor("bottom", "textColor", preset.value)}
                    className={`w-5 h-5 rounded-full border transition-all hover:scale-115 cursor-pointer ${
                      activeBottomTextColor === preset.value ? "ring-2 ring-primary scale-110" : "border-outline/15 hover:border-outline/35"
                    }`}
                    style={{ backgroundColor: preset.value }}
                    title={preset.name}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Unified hidden file input for dynamic list uploads */}
        <input 
          type="file" 
          ref={fileInputRef} 
          className="hidden" 
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file && uploadTarget) {
              handleImageUpload(file, uploadTarget.type, uploadTarget.index);
            }
          }}
          accept="image/*" 
        />
      </div>
  );
}
