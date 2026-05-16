"use client";
import React, { useState, useEffect, useRef } from "react";
import { useNotification } from "../context/NotificationContext";
import { db, storage, auth } from "../lib/firebase";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  onSnapshot
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { format } from "date-fns";

interface DashboardConfig {
  heroHeadline: string;
  heroSubheadline: string;
  heroImageUrl: string;
  stats: {
    label: string;
    value: string;
    trend: string;
    icon: string;
    variant: string;
  }[];
  featuredCard: {
    tag: string;
    title: string;
    subtitle: string;
    buttonText: string;
    imageUrl: string;
  };
  // Toggles
  showHeroSection: boolean;
  showStatsSection: boolean;
  showRecentActivity: boolean;
  showFeaturedCard: boolean;
  showUpcomingBookings: boolean;
  showClubEvents: boolean;
  
  // Titles
  upcomingBookingsTitle: string;
  recentActivityTitle: string;
  clubEventsTitle: string;
}

const DEFAULT_CONFIG: DashboardConfig = {
  heroHeadline: "READY TO DOMINATE THE COURT?",
  heroSubheadline: "Welcome Back",
  heroImageUrl: "/images/clay_court.png",
  stats: [
    { label: "Win Rate", value: "68%", trend: "+4.2%", icon: "trending_up", variant: "primary" },
    { label: "Matches", value: "124", trend: "Total", icon: "sports_tennis", variant: "default" },
    { label: "Loyalty Points", value: "2,450", trend: "Active", icon: "workspace_premium", variant: "yellow" }
  ],
  featuredCard: {
    tag: "Scheduled: Tomorrow",
    title: "QUARTER FINAL MATCH",
    subtitle: "Center Court • 10:00 AM vs. Marcus V.",
    buttonText: "Match Preview",
    imageUrl: "/images/clay_court.png"
  },
  showHeroSection: true,
  showStatsSection: true,
  showRecentActivity: true,
  showFeaturedCard: true,
  showUpcomingBookings: true,
  showClubEvents: true,
  upcomingBookingsTitle: "Upcoming Bookings",
  recentActivityTitle: "Recent Activity",
  clubEventsTitle: "Club Events & News"
};

export default function ContentManagementView({ theme, tenantId }: { theme: string; tenantId: string }) {
  const [config, setConfig] = useState<DashboardConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const { showNotification } = useNotification();
  const heroInputRef = useRef<HTMLInputElement>(null);
  const featuredInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!tenantId) return;

    const configRef = doc(db, "tenants", tenantId, "config", "dashboard");
    const unsubscribe = onSnapshot(configRef, (docSnap) => {
      if (docSnap.exists()) {
        setConfig({ ...DEFAULT_CONFIG, ...docSnap.data() });
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
      const configRef = doc(db, "tenants", tenantId, "config", "dashboard");
      await setDoc(configRef, {
        ...config,
        updatedAt: serverTimestamp(),
        updatedBy: auth.currentUser?.uid
      }, { merge: true });
      showNotification("Configuration saved successfully!");
    } catch (error) {
      console.error("Error saving config:", error);
      showNotification("Failed to save configuration.", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleImageUpload = async (file: File, type: 'hero' | 'featured') => {
    if (!tenantId) return;
    setUploading(type);
    try {
      const path = `tenants/${tenantId}/dashboard/${type}_${Date.now()}_${file.name}`;
      const storageRef = ref(storage, path);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      
      if (type === 'hero') {
        setConfig(prev => ({ ...prev, heroImageUrl: url }));
      } else {
        setConfig(prev => ({ ...prev, featuredCard: { ...prev.featuredCard, imageUrl: url } }));
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
            CONTENT MANAGEMENT
          </h2>
          <p className="text-on-surface-variant text-[11px] font-black uppercase tracking-widest mt-2">Customize your dashboard experience.</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-8 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all bg-primary text-on-primary hover:scale-105 disabled:opacity-50 shadow-lg shadow-primary/20"
        >
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </div>

      <div className="grid grid-cols-12 gap-8">
        {/* Hero Section Editor */}
        <div className="col-span-12 lg:col-span-8 space-y-6">
          <div className="rounded-[2.5rem] p-10 border transition-colors bg-surface-container-low border-outline/10">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-primary">campaign</span>
                <h3 className="text-xl font-black uppercase tracking-widest">Hero Section</h3>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-black uppercase tracking-widest opacity-40">Display Section</span>
                <button
                  onClick={() => setConfig({ ...config, showHeroSection: !config.showHeroSection })}
                  className={`w-10 h-5 rounded-full transition-all relative ${config.showHeroSection ? 'bg-primary' : 'bg-surface-container-highest'}`}
                >
                  <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${config.showHeroSection ? 'left-6' : 'left-1'}`}></div>
                </button>
              </div>
            </div>
            
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] opacity-50 ml-1">Headline</label>
                  <input
                    type="text"
                    value={config.heroHeadline}
                    onChange={(e) => setConfig({ ...config, heroHeadline: e.target.value })}
                    className="w-full px-6 py-4 rounded-2xl bg-surface-container border-none focus:ring-2 focus:ring-primary text-sm font-bold transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] opacity-50 ml-1">Sub-Headline</label>
                  <input
                    type="text"
                    value={config.heroSubheadline}
                    onChange={(e) => setConfig({ ...config, heroSubheadline: e.target.value })}
                    className="w-full px-6 py-4 rounded-2xl bg-surface-container border-none focus:ring-2 focus:ring-primary text-sm font-bold transition-all"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] opacity-50 ml-1">Background Image</label>
                <div 
                  onClick={() => heroInputRef.current?.click()}
                  className="group relative h-48 rounded-[2rem] overflow-hidden cursor-pointer border-2 border-dashed border-outline/20 hover:border-primary/50 transition-all flex items-center justify-center bg-surface-container/50"
                >
                  {config.heroImageUrl ? (
                    <>
                      <img src={config.heroImageUrl} className="absolute inset-0 w-full h-full object-cover opacity-40 group-hover:scale-105 transition-all duration-700" alt="Hero" />
                      <div className="relative z-10 flex flex-col items-center gap-2">
                        <span className="material-symbols-outlined text-4xl text-white">cloud_upload</span>
                        <span className="text-[10px] font-black uppercase tracking-widest text-white">Change Hero Image</span>
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center gap-2 opacity-40">
                      <span className="material-symbols-outlined text-4xl">add_photo_alternate</span>
                      <span className="text-[10px] font-black uppercase tracking-widest">Upload Image</span>
                    </div>
                  )}
                  {uploading === 'hero' && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-20">
                      <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    </div>
                  )}
                </div>
                <input 
                  type="file" 
                  ref={heroInputRef} 
                  className="hidden" 
                  onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0], 'hero')}
                  accept="image/*"
                />
              </div>
            </div>
          </div>

          {/* Featured Card Editor */}
          <div className="rounded-[2.5rem] p-10 border transition-colors bg-surface-container-low border-outline/10">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-primary">star</span>
                <h3 className="text-xl font-black uppercase tracking-widest">Featured Promotional Card</h3>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-black uppercase tracking-widest opacity-40">Display Section</span>
                <button
                  onClick={() => setConfig({ ...config, showFeaturedCard: !config.showFeaturedCard })}
                  className={`w-10 h-5 rounded-full transition-all relative ${config.showFeaturedCard ? 'bg-primary' : 'bg-surface-container-highest'}`}
                >
                  <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${config.showFeaturedCard ? 'left-6' : 'left-1'}`}></div>
                </button>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-8">
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] opacity-50 ml-1">Tag (e.g. Scheduled)</label>
                  <input
                    type="text"
                    value={config.featuredCard.tag}
                    onChange={(e) => setConfig({ ...config, featuredCard: { ...config.featuredCard, tag: e.target.value } })}
                    className="w-full px-6 py-4 rounded-2xl bg-surface-container border-none focus:ring-2 focus:ring-primary text-sm font-bold transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] opacity-50 ml-1">Title</label>
                  <input
                    type="text"
                    value={config.featuredCard.title}
                    onChange={(e) => setConfig({ ...config, featuredCard: { ...config.featuredCard, title: e.target.value } })}
                    className="w-full px-6 py-4 rounded-2xl bg-surface-container border-none focus:ring-2 focus:ring-primary text-sm font-bold transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] opacity-50 ml-1">Subtitle / Location</label>
                  <input
                    type="text"
                    value={config.featuredCard.subtitle}
                    onChange={(e) => setConfig({ ...config, featuredCard: { ...config.featuredCard, subtitle: e.target.value } })}
                    className="w-full px-6 py-4 rounded-2xl bg-surface-container border-none focus:ring-2 focus:ring-primary text-sm font-bold transition-all"
                  />
                </div>
              </div>
              
              <div className="space-y-6">
                 <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] opacity-50 ml-1">Background Image</label>
                  <div 
                    onClick={() => featuredInputRef.current?.click()}
                    className="group relative h-full min-h-[220px] rounded-[2rem] overflow-hidden cursor-pointer border-2 border-dashed border-outline/20 hover:border-primary/50 transition-all flex items-center justify-center bg-surface-container/50"
                  >
                    {config.featuredCard.imageUrl ? (
                      <>
                        <img src={config.featuredCard.imageUrl} className="absolute inset-0 w-full h-full object-cover opacity-40 group-hover:scale-105 transition-all duration-700" alt="Featured" />
                        <div className="relative z-10 flex flex-col items-center gap-2">
                          <span className="material-symbols-outlined text-3xl text-white">image</span>
                          <span className="text-[10px] font-black uppercase tracking-widest text-white">Change Image</span>
                        </div>
                      </>
                    ) : (
                      <div className="flex flex-col items-center gap-2 opacity-40">
                        <span className="material-symbols-outlined text-3xl">add_photo_alternate</span>
                        <span className="text-[10px] font-black uppercase tracking-widest">Upload Image</span>
                      </div>
                    )}
                    {uploading === 'featured' && (
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-20">
                        <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      </div>
                    )}
                  </div>
                  <input 
                    type="file" 
                    ref={featuredInputRef} 
                    className="hidden" 
                    onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0], 'featured')}
                    accept="image/*"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar Controls */}
        <div className="col-span-12 lg:col-span-4 space-y-6">
          {/* Section Visibility */}
          <div className="rounded-[2.5rem] p-10 border transition-colors bg-surface-container-low border-outline/10">
            <h3 className="text-xl font-black uppercase tracking-widest mb-8">Layout Settings</h3>
            
            <div className="space-y-8">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-widest">Upcoming Bookings</p>
                  <p className="text-[9px] opacity-50 uppercase tracking-widest mt-1">Show section on home</p>
                </div>
                <button
                  onClick={() => setConfig({ ...config, showUpcomingBookings: !config.showUpcomingBookings })}
                  className={`w-12 h-6 rounded-full transition-all relative ${config.showUpcomingBookings ? 'bg-primary' : 'bg-surface-container-highest'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${config.showUpcomingBookings ? 'left-7' : 'left-1'}`}></div>
                </button>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] opacity-50 ml-1">Section Title</label>
                  <input
                    type="text"
                    value={config.upcomingBookingsTitle}
                    onChange={(e) => setConfig({ ...config, upcomingBookingsTitle: e.target.value })}
                    className="w-full px-6 py-3 rounded-2xl bg-surface-container border-none focus:ring-2 focus:ring-primary text-xs font-bold transition-all"
                  />
                </div>
              </div>

              <div className={`h-px bg-outline/10 mx-2`}></div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-widest">Recent Activity</p>
                  <p className="text-[9px] opacity-50 uppercase tracking-widest mt-1">Show section on home</p>
                </div>
                <button
                  onClick={() => setConfig({ ...config, showRecentActivity: !config.showRecentActivity })}
                  className={`w-12 h-6 rounded-full transition-all relative ${config.showRecentActivity ? 'bg-primary' : 'bg-surface-container-highest'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${config.showRecentActivity ? 'left-7' : 'left-1'}`}></div>
                </button>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] opacity-50 ml-1">Recent Activity Title</label>
                  <input
                    type="text"
                    value={config.recentActivityTitle}
                    onChange={(e) => setConfig({ ...config, recentActivityTitle: e.target.value })}
                    className="w-full px-6 py-3 rounded-2xl bg-surface-container border-none focus:ring-2 focus:ring-primary text-xs font-bold transition-all"
                  />
                </div>
              </div>

              <div className={`h-px bg-outline/10 mx-2`}></div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-widest">Club Events & News</p>
                  <p className="text-[9px] opacity-50 uppercase tracking-widest mt-1">Show section on home</p>
                </div>
                <button
                  onClick={() => setConfig({ ...config, showClubEvents: !config.showClubEvents })}
                  className={`w-12 h-6 rounded-full transition-all relative ${config.showClubEvents ? 'bg-primary' : 'bg-surface-container-highest'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${config.showClubEvents ? 'left-7' : 'left-1'}`}></div>
                </button>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] opacity-50 ml-1">Club Events Title</label>
                  <input
                    type="text"
                    value={config.clubEventsTitle}
                    onChange={(e) => setConfig({ ...config, clubEventsTitle: e.target.value })}
                    className="w-full px-6 py-3 rounded-2xl bg-surface-container border-none focus:ring-2 focus:ring-primary text-xs font-bold transition-all"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Stats Cards Editor */}
          <div className="rounded-[2.5rem] p-10 border transition-colors bg-surface-container-low border-outline/10">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-xl font-black uppercase tracking-widest">Performance Stats</h3>
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-black uppercase tracking-widest opacity-40">Display</span>
                <button
                  onClick={() => setConfig({ ...config, showStatsSection: !config.showStatsSection })}
                  className={`w-10 h-5 rounded-full transition-all relative ${config.showStatsSection ? 'bg-primary' : 'bg-surface-container-highest'}`}
                >
                  <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${config.showStatsSection ? 'left-6' : 'left-1'}`}></div>
                </button>
              </div>
            </div>
            <div className="space-y-6">
              {config.stats.map((stat, idx) => (
                <div key={idx} className="p-6 rounded-3xl bg-surface-container border border-outline/5 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-surface text-primary shadow-sm">
                      <span className="material-symbols-outlined text-lg">{stat.icon}</span>
                    </div>
                    <input
                      type="text"
                      value={stat.label}
                      onChange={(e) => {
                        const newStats = config.stats.map((s, i) => 
                          i === idx ? { ...s, label: e.target.value } : s
                        );
                        setConfig({ ...config, stats: newStats });
                      }}
                      className="bg-transparent border-none focus:ring-0 p-0 text-[10px] font-black uppercase tracking-widest w-full"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                     <div className="space-y-1">
                      <label className="text-[8px] font-black uppercase tracking-widest opacity-40">Value/Label</label>
                      <input
                        type="text"
                        value={stat.value}
                        onChange={(e) => {
                          const newStats = config.stats.map((s, i) => 
                            i === idx ? { ...s, value: e.target.value } : s
                          );
                          setConfig({ ...config, stats: newStats });
                        }}
                        className="w-full px-4 py-2 rounded-xl bg-surface-container-highest border-none text-[10px] font-bold"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[8px] font-black uppercase tracking-widest opacity-40">Trend/Subtext</label>
                      <input
                        type="text"
                        value={stat.trend}
                        onChange={(e) => {
                          const newStats = config.stats.map((s, i) => 
                            i === idx ? { ...s, trend: e.target.value } : s
                          );
                          setConfig({ ...config, stats: newStats });
                        }}
                        className="w-full px-4 py-2 rounded-xl bg-surface-container-highest border-none text-[10px] font-bold"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
