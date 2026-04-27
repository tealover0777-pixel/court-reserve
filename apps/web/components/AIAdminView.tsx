"use client";
import React from "react";

export default function AIAdminView({ theme = "LIGHT" }: { theme?: "LIGHT" | "DARK" | "VINTAGE" }) {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex justify-between items-end mb-10">
        <div>
          <h2 className={`text-5xl font-black italic tracking-tighter uppercase transition-colors duration-500 ${
            theme === "DARK" ? "text-[#ccff00]" : 
            theme === "VINTAGE" ? "text-black" :
            "text-[#4f6b28]"
          }`} style={{ fontFamily: 'Lexend, sans-serif' }}>
            AI Admin
          </h2>
          <p className={`font-bold uppercase tracking-widest text-xs mt-2 transition-colors duration-500 ${
            theme === "DARK" ? "text-stone-400" : 
            theme === "VINTAGE" ? "text-stone-500" :
            "text-stone-900"
          }`}>
            Intelligence Engine · <span className={
              theme === "DARK" ? "text-[#ccff00]" : 
              theme === "VINTAGE" ? "text-black" :
              "text-[#4f6b28]"
            }>Active</span> Status · <span className={
              theme === "DARK" ? "text-[#ccff00]" : 
              theme === "VINTAGE" ? "text-black" :
              "text-[#4f6b28]"
            }>v2.4.1</span>
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-8">
        <div className={`col-span-2 border rounded-3xl p-12 shadow-sm transition-colors duration-500 ${
          theme === "DARK" ? "bg-stone-950 border-stone-800" : 
          theme === "VINTAGE" ? "bg-white border-transparent shadow-md" :
          "bg-white border-stone-200"
        }`}>
          <div className="flex items-center gap-6 mb-10">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-colors ${
              theme === "DARK" ? "bg-stone-900 text-[#ccff00]" : 
              theme === "VINTAGE" ? "bg-[#f7f9fb] text-black" :
              "bg-stone-50 text-[#4f6b28]"
            }`}>
              <span className="material-symbols-outlined text-4xl">psychology</span>
            </div>
            <div>
              <h3 className={`text-2xl font-black italic tracking-tighter uppercase transition-colors ${
                theme === "DARK" ? "text-white" : 
                theme === "VINTAGE" ? "text-black" :
                "text-stone-900"
              }`}>Core Model Configuration</h3>
              <p className="text-stone-400 font-bold uppercase tracking-widest text-[10px]">Manage the neural engine settings</p>
            </div>
          </div>
          
          <div className="space-y-8">
            <div className={`flex items-center justify-between p-6 rounded-2xl border transition-colors ${
              theme === "DARK" ? "bg-stone-900/40 border-stone-800" : 
              theme === "VINTAGE" ? "bg-white border-stone-100 shadow-sm" :
              "bg-stone-50 border-stone-100"
            }`}>
              <div>
                <p className={`text-xs font-black uppercase tracking-widest mb-1 transition-colors ${
                  theme === "DARK" ? "text-white" : 
                  theme === "VINTAGE" ? "text-black" :
                  "text-stone-900"
                }`}>Response Creativity</p>
                <p className="text-[10px] text-stone-400 font-bold uppercase tracking-widest">Adjust temperature for AI responses</p>
              </div>
              <div className="w-48 h-2 bg-stone-200 rounded-full relative">
                <div className={`absolute left-0 top-0 h-full w-[70%] rounded-full ${
                  theme === "DARK" ? "bg-[#ccff00]" : 
                  theme === "VINTAGE" ? "bg-black" :
                  "bg-[#4f6b28]"
                }`}></div>
                <div className={`absolute left-[70%] top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 bg-white border-2 rounded-full shadow-md cursor-pointer ${
                  theme === "DARK" ? "border-[#ccff00]" : 
                  theme === "VINTAGE" ? "border-black" :
                  "border-[#4f6b28]"
                }`}></div>
              </div>
            </div>

            <div className={`flex items-center justify-between p-6 rounded-2xl border transition-colors ${
              theme === "DARK" ? "bg-stone-900/40 border-stone-800" : 
              theme === "VINTAGE" ? "bg-white border-stone-100 shadow-sm" :
              "bg-stone-50 border-stone-100"
            }`}>
              <div>
                <p className={`text-xs font-black uppercase tracking-widest mb-1 transition-colors ${
                  theme === "DARK" ? "text-white" : 
                  theme === "VINTAGE" ? "text-black" :
                  "text-stone-900"
                }`}>Context Window</p>
                <p className="text-[10px] text-stone-400 font-bold uppercase tracking-widest">Max tokens per interaction</p>
              </div>
              <span className={`text-sm font-black transition-colors ${
                theme === "DARK" ? "text-[#ccff00]" : 
                theme === "VINTAGE" ? "text-black" :
                "text-[#4f6b28]"
              }`}>32,768 TOKENS</span>
            </div>
          </div>
        </div>

        <div className={`rounded-3xl p-12 text-white shadow-xl flex flex-col justify-between transition-colors duration-500 ${
          theme === "DARK" ? "bg-stone-900 shadow-black/20" : 
          theme === "VINTAGE" ? "bg-black shadow-md" :
          "bg-[#4f6b28] shadow-[#4f6b28]/20"
        }`}>
          <div>
            <span className={`material-symbols-outlined text-5xl mb-6 transition-colors ${
              theme === "DARK" ? "text-[#ccff00]" : 
              theme === "VINTAGE" ? "text-white" :
              "text-white"
            }`}>bolt</span>
            <h4 className="text-3xl font-black italic tracking-tighter uppercase leading-tight mb-4">SYSTEM PERFORMANCE</h4>
            <p className="text-white/60 text-xs font-bold uppercase tracking-widest leading-loose">The engine is currently running at peak efficiency with sub-100ms latency.</p>
          </div>
          <button className={`w-full py-4 rounded-2xl text-[10px] font-black tracking-widest transition-all uppercase mt-12 ${
            theme === "DARK" ? "bg-[#ccff00] text-stone-950 hover:opacity-90" : 
            theme === "VINTAGE" ? "bg-white text-black hover:bg-stone-50" :
            "bg-white text-[#4f6b28] hover:bg-stone-50"
          }`}>
            Run Diagnostics
          </button>
        </div>
      </div>
    </div>
  );
}
