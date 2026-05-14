"use client";
import React, { useState, useEffect } from "react";
import { Modal } from "@repo/ui/modal";
import { db } from "../lib/firebase";
import { doc, updateDoc, arrayUnion, arrayRemove, runTransaction, getDoc, collection, query, where, getDocs } from "firebase/firestore";
import { Event } from "../lib/types";
import { format } from "date-fns";

interface EventDetailsModalProps {
  event: Event;
  theme: "LIGHT" | "DARK" | "VINTAGE";
  profile: any;
  tenantId: string;
  onClose: () => void;
}

export default function EventDetailsModal({ event, theme, profile, tenantId, onClose }: EventDetailsModalProps) {
  const [loading, setLoading] = useState(false);
  const [leaders, setLeaders] = useState<any[]>([]);
  const isSignedUp = event.signups?.includes(profile.id);
  const isWaitlisted = event.waiting_list?.includes(profile.id);
  const isFull = (event.signups?.length || 0) >= event.max_participants;
  const deadline = event.cancellation_deadline?.toDate ? event.cancellation_deadline.toDate() : (event.cancellation_deadline ? new Date(event.cancellation_deadline) : null);
  const isPastDeadline = deadline ? new Date() > deadline : false;

  useEffect(() => {
    const fetchLeaders = async () => {
      if (event.event_leaders && event.event_leaders.length > 0) {
        const usersRef = collection(db, "tenants", tenantId, "users");
        // Firestore 'in' query supports up to 10 elements. Should be enough for leaders.
        const q = query(usersRef, where("uid", "in", event.event_leaders));
        const snap = await getDocs(q);
        setLeaders(snap.docs.map(d => d.data()));
      }
    };
    fetchLeaders();
  }, [event.event_leaders, tenantId]);

  const handleJoin = async () => {
    if (!profile.id) return;
    setLoading(true);
    try {
      const eventRef = doc(db, "tenants", tenantId, "events", event.id);
      
      await runTransaction(db, async (transaction) => {
        const eDoc = await transaction.get(eventRef);
        if (!eDoc.exists()) throw "Event does not exist!";
        
        const data = eDoc.data() as Event;
        const currentSignups = data.signups || [];
        const currentWaitlist = data.waiting_list || [];
        
        if (currentSignups.includes(profile.id) || currentWaitlist.includes(profile.id)) {
          return; // Already in
        }

        if (currentSignups.length < data.max_participants) {
          transaction.update(eventRef, {
            signups: arrayUnion(profile.id)
          });
        } else {
          transaction.update(eventRef, {
            waiting_list: arrayUnion(profile.id)
          });
        }
      });
    } catch (error) {
      console.error("Error joining event:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleLeave = async () => {
    if (!profile.id) return;
    setLoading(true);
    try {
      const eventRef = doc(db, "tenants", tenantId, "events", event.id);
      
      await runTransaction(db, async (transaction) => {
        const eDoc = await transaction.get(eventRef);
        if (!eDoc.exists()) throw "Event does not exist!";
        
        const data = eDoc.data() as Event;
        let signups = data.signups || [];
        let waitlist = data.waiting_list || [];
        
        if (signups.includes(profile.id)) {
          // Remove from signups
          signups = signups.filter(id => id !== profile.id);
          
          if (waitlist.length > 0) {
            const nextInLine = waitlist.shift();
            if (nextInLine) signups.push(nextInLine);
          }
          
          transaction.update(eventRef, { signups, waiting_list: waitlist });
        } else if (waitlist.includes(profile.id)) {
          // Remove from waitlist
          waitlist = waitlist.filter(id => id !== profile.id);
          transaction.update(eventRef, { waiting_list: waitlist });
        }
      });
    } catch (error) {
      console.error("Error leaving event:", error);
    } finally {
      setLoading(false);
    }
  };

  const eventDate = event.date?.toDate ? event.date.toDate() : new Date(event.date);

  return (
    <Modal isOpen={true} onClose={onClose} theme={theme} width={800} title="Event Details">
      <div className={`p-8 ${theme === "DARK" ? "text-white" : "text-stone-900"}`}>
        {/* Header with Image */}
        <div className="relative h-64 rounded-2xl overflow-hidden mb-8 group">
          <img 
            src={event.image_url || "/images/clay_court.png"} 
            alt={event.title} 
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent"></div>
          <div className="absolute bottom-6 left-6">
            <span className={`px-3 py-1 rounded-full text-[10px] font-black tracking-widest uppercase mb-3 inline-block ${theme === "DARK" ? "bg-[#ccff00] text-stone-950" : "bg-white text-black"}`}>
              {event.tag}
            </span>
            <h2 className="text-4xl font-black tracking-tighter uppercase text-white">{event.title}</h2>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-10">
          <div className="col-span-12 md:col-span-8">
            <div className="flex items-center gap-6 mb-8">
              <div className="flex flex-col">
                <span className="text-[10px] font-black tracking-widest uppercase opacity-50 mb-1">Date & Time</span>
                <p className="font-bold">{format(eventDate, "EEEE, MMM d")}</p>
                <p className="text-sm opacity-70">{format(eventDate, "h:mm a")}</p>
              </div>
              <div className="w-px h-10 bg-stone-200 dark:bg-stone-800" />
              <div className="flex flex-col">
                <span className="text-[10px] font-black tracking-widest uppercase opacity-50 mb-1">Capacity</span>
                <p className="font-bold">{event.signups?.length || 0} / {event.max_participants}</p>
                <p className="text-sm opacity-70">{event.waiting_list?.length || 0} on waitlist</p>
              </div>
              {deadline && (
                <>
                  <div className="w-px h-10 bg-stone-200 dark:bg-stone-800" />
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black tracking-widest uppercase opacity-50 mb-1">Cancel By</span>
                    <p className={`font-bold ${isPastDeadline ? "text-red-500" : ""}`}>{format(deadline, "MMM d, h:mm a")}</p>
                    <p className="text-sm opacity-70">{isPastDeadline ? "Deadline passed" : "Policy applies"}</p>
                  </div>
                </>
              )}
            </div>

            <div className="mb-10">
              <h4 className="text-[10px] font-black tracking-widest uppercase opacity-50 mb-4">Event Details</h4>
              <p className="leading-relaxed opacity-80 whitespace-pre-wrap">{event.description}</p>
            </div>

            {leaders.length > 0 && (
              <div>
                <h4 className="text-[10px] font-black tracking-widest uppercase opacity-50 mb-4">Event Leaders</h4>
                <div className="flex flex-wrap gap-4">
                  {leaders.map(leader => (
                    <div key={leader.uid} className="flex items-center gap-3 bg-stone-100 dark:bg-stone-900 px-4 py-2 rounded-full">
                      <div className="w-8 h-8 rounded-full overflow-hidden bg-stone-200">
                        {leader.portrait_url ? (
                          <img src={leader.portrait_url} alt={leader.first_name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-[10px] font-black uppercase">
                            {leader.first_name?.[0]}{leader.last_name?.[0]}
                          </div>
                        )}
                      </div>
                      <span className="text-xs font-bold uppercase">{leader.first_name} {leader.last_name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="col-span-12 md:col-span-4">
            <div className={`p-6 rounded-2xl border transition-colors ${theme === "DARK" ? "bg-stone-900 border-stone-800" : "bg-stone-50 border-stone-100"}`}>
              <h4 className="text-[10px] font-black tracking-widest uppercase opacity-50 mb-6 text-center">Status</h4>
              
              {isSignedUp ? (
                <div className="text-center">
                  <div className="w-12 h-12 rounded-full bg-green-500/20 text-green-500 flex items-center justify-center mx-auto mb-4">
                    <span className="material-symbols-outlined">check_circle</span>
                  </div>
                  <p className="text-sm font-bold uppercase tracking-tight mb-2">You're in!</p>
                  <p className="text-[10px] opacity-60 uppercase mb-8">Registered for this event</p>
                  <button 
                    onClick={handleLeave}
                    disabled={loading || isPastDeadline}
                    className={`w-full py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${
                      isPastDeadline 
                        ? "bg-stone-200 dark:bg-stone-800 text-stone-400 cursor-not-allowed" 
                        : "text-red-500 hover:bg-red-500/10"
                    }`}
                  >
                    {isPastDeadline ? "Cancellation Closed" : "Cancel Registration"}
                  </button>
                  {isPastDeadline && (
                    <p className="text-[9px] text-red-500 font-bold uppercase mt-2">The cancellation deadline has passed.</p>
                  )}
                </div>
              ) : isWaitlisted ? (
                <div className="text-center">
                  <div className="w-12 h-12 rounded-full bg-amber-500/20 text-amber-500 flex items-center justify-center mx-auto mb-4">
                    <span className="material-symbols-outlined">hourglass_top</span>
                  </div>
                  <p className="text-sm font-bold uppercase tracking-tight mb-2">On Waitlist</p>
                  <p className="text-[10px] opacity-60 uppercase mb-8">Position: #{event.waiting_list.indexOf(profile.id) + 1}</p>
                  <button 
                    onClick={handleLeave}
                    disabled={loading}
                    className="w-full py-3 text-[10px] font-black uppercase tracking-widest text-red-500 hover:bg-red-500/10 rounded-xl transition-all"
                  >
                    Leave Waitlist
                  </button>
                </div>
              ) : (
                <div className="text-center">
                  <p className="text-2xl font-black mb-1">{isFull ? "Waitlist" : "Join Now"}</p>
                  <p className="text-[10px] opacity-60 uppercase mb-8">{isFull ? "Event is currently full" : "Spots still available"}</p>
                  <button 
                    onClick={handleJoin}
                    disabled={loading}
                    className={`w-full py-4 rounded-xl text-xs font-black tracking-widest uppercase transition-all shadow-lg ${
                      theme === "DARK" ? "bg-[#ccff00] text-stone-950 shadow-[#ccff00]/10" : "bg-[#4f6b28] text-white shadow-[#4f6b28]/10"
                    } hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50`}
                  >
                    {loading ? "Processing..." : (isFull ? "Join Waitlist" : "Register Now")}
                  </button>
                </div>
              )}

              <div className="mt-8 pt-8 border-t border-stone-200 dark:border-stone-800">
                <h5 className="text-[8px] font-black tracking-widest uppercase opacity-40 mb-3">Cancellation Policy</h5>
                <p className="text-[10px] leading-relaxed opacity-60">{event.cancellation_policy || "No cancellation policy provided."}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
