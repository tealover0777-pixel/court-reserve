import React from "react";

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-6 text-on-background">
      <div className="max-w-md text-center">
        <h1 className="text-5xl font-black tracking-tighter text-primary italic mb-4">
          COURT RESERVE
        </h1>
        <p className="text-stone-500 mb-8 font-medium">
          The ultimate platform for elite tennis club management. 
          Please visit your club's specific portal to continue.
        </p>
        
        <div className="space-y-4">
          <p className="text-xs font-bold uppercase tracking-widest text-stone-400 mb-4">Demo Portals</p>
          <a 
            href="/kinetic" 
            className="block w-full rounded-full bg-primary p-4 font-black text-on-primary shadow-lg hover:opacity-90 transition-all uppercase tracking-widest text-center"
          >
            Kinetic Court
          </a>
          <a 
            href="/flraquet" 
            className="block w-full rounded-full border-2 border-primary p-4 font-black text-primary hover:bg-primary/5 transition-all uppercase tracking-widest text-center"
          >
            FL Raquet Club
          </a>
        </div>
      </div>
    </div>
  );
}
