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

interface ProgramTrack {
  title: string;
  description: string;
  imageUrl: string;
  priceLabel: string;
  priceValue: string;
  icon: string;
  tag?: string;
}

interface ProgramsConfig {
  heroHeadline: string;
  heroDescription: string;
  heroImageUrl: string;
  
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
}

const DEFAULT_CONFIG: ProgramsConfig = {
  heroHeadline: "CHAMPIONSHIP CLINIC 2024",
  heroDescription: "Intensive technical refinement for competitive players. Lead by ITF-certified master professionals.",
  heroImageUrl: "/images/programs_hero.png",
  
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

export default function ProgramsManagementView({ theme, tenantId }: { theme: string; tenantId: string }) {
  const [config, setConfig] = useState<ProgramsConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const { showNotification } = useNotification();
  
  const heroInputRef = useRef<HTMLInputElement>(null);
  const bottomInputRef = useRef<HTMLInputElement>(null);
  const trackRefs = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)];

  useEffect(() => {
    if (!tenantId) return;

    const configRef = doc(db, "tenants", tenantId, "config", "programs");
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
      } else if (type === 'track' && index !== undefined) {
        const newTracks = [...config.tracks];
        newTracks[index] = { ...newTracks[index], imageUrl: url };
        setConfig(prev => ({ ...prev, tracks: newTracks }));
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

      <div className="grid grid-cols-12 gap-8">
        <div className="col-span-12 lg:col-span-8 space-y-6">
          {/* Hero Program Editor */}
          <div className="rounded-[2.5rem] p-10 border transition-colors bg-surface-container-low border-outline/10">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-primary">workspace_premium</span>
                <h3 className="text-xl font-black uppercase tracking-widest">Featured Program (Hero)</h3>
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
            
            <div className="space-y-6">
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
                <label className="text-[10px] font-black uppercase tracking-[0.2em] opacity-50 ml-1">Description</label>
                <textarea
                  value={config.heroDescription}
                  onChange={(e) => setConfig({ ...config, heroDescription: e.target.value })}
                  className="w-full px-6 py-4 rounded-2xl bg-surface-container border-none focus:ring-2 focus:ring-primary text-sm font-bold transition-all min-h-[100px]"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] opacity-50 ml-1">Hero Image</label>
                <div 
                  onClick={() => heroInputRef.current?.click()}
                  className="group relative h-48 rounded-[2rem] overflow-hidden cursor-pointer border-2 border-dashed border-outline/20 hover:border-primary/50 transition-all flex items-center justify-center bg-surface-container/50"
                >
                  {config.heroImageUrl ? (
                    <>
                      <img src={config.heroImageUrl} className="absolute inset-0 w-full h-full object-cover opacity-40 group-hover:scale-105 transition-all duration-700" alt="Hero" />
                      <div className="relative z-10 flex flex-col items-center gap-2">
                        <span className="material-symbols-outlined text-4xl text-white">cloud_upload</span>
                        <span className="text-[10px] font-black uppercase tracking-widest text-white">Change Image</span>
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
                <input type="file" ref={heroInputRef} className="hidden" onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0], 'hero')} accept="image/*" />
              </div>
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
                  </div>
                  
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase tracking-widest opacity-40">Title</label>
                        <input
                          type="text"
                          value={track.title}
                          onChange={(e) => {
                            const newTracks = [...config.tracks];
                            newTracks[idx] = { ...newTracks[idx], title: e.target.value };
                            setConfig({ ...config, tracks: newTracks });
                          }}
                          className="w-full px-4 py-3 rounded-xl bg-surface border-none text-[10px] font-bold"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase tracking-widest opacity-40">Description</label>
                        <textarea
                          value={track.description}
                          onChange={(e) => {
                            const newTracks = [...config.tracks];
                            newTracks[idx] = { ...newTracks[idx], description: e.target.value };
                            setConfig({ ...config, tracks: newTracks });
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
                              const newTracks = [...config.tracks];
                              newTracks[idx] = { ...newTracks[idx], priceLabel: e.target.value };
                              setConfig({ ...config, tracks: newTracks });
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
                              const newTracks = [...config.tracks];
                              newTracks[idx] = { ...newTracks[idx], priceValue: e.target.value };
                              setConfig({ ...config, tracks: newTracks });
                            }}
                            className="w-full px-4 py-3 rounded-xl bg-surface border-none text-[10px] font-bold"
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase tracking-widest opacity-40">Track Image</label>
                        <div 
                          onClick={() => trackRefs[idx].current?.click()}
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
                        <input type="file" ref={trackRefs[idx]} className="hidden" onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0], 'track', idx)} accept="image/*" />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
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
                  className="group relative h-32 rounded-xl overflow-hidden cursor-pointer border-2 border-dashed border-outline/10 hover:border-primary/50 transition-all flex items-center justify-center bg-surface"
                >
                  {config.bottomImageUrl ? (
                    <>
                      <img src={config.bottomImageUrl} className="absolute inset-0 w-full h-full object-cover opacity-30" alt="Bottom" />
                      <span className="relative z-10 material-symbols-outlined text-xl text-primary">image</span>
                    </>
                  ) : (
                    <span className="material-symbols-outlined text-xl opacity-20">add_photo_alternate</span>
                  )}
                  {uploading === 'bottom' && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-20">
                      <div className="w-4 h-4 border border-white border-t-transparent rounded-full animate-spin"></div>
                    </div>
                  )}
                </div>
                <input type="file" ref={bottomInputRef} className="hidden" onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0], 'bottom')} accept="image/*" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
