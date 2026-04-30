"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import ReactDOM from "react-dom";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  theme?: "LIGHT" | "DARK" | "VINTAGE";
  width?: number;
  footer?: React.ReactNode;
  resizable?: boolean;
  moveable?: boolean;
}

export const Modal = ({
  isOpen,
  onClose,
  title,
  children,
  theme = "LIGHT",
  width = 480,
  footer,
  resizable = true,
  moveable = true,
}: ModalProps) => {
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const offsetRef = useRef({ x: 0, y: 0 });
  const [resizeW, setResizeW] = useState<number | null>(null);
  const [resizeH, setResizeH] = useState<number | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setOffset({ x: 0, y: 0 });
      offsetRef.current = { x: 0, y: 0 };
      setResizeW(null);
      setResizeH(null);
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  const onHeaderMouseDown = useCallback((e: React.MouseEvent) => {
    if (!moveable) return;
    if (e.button !== 0 || (e.target as HTMLElement).closest("button")) return;
    
    e.preventDefault();
    const startMx = e.clientX;
    const startMy = e.clientY;
    const startOx = offsetRef.current.x;
    const startOy = offsetRef.current.y;
    
    setIsDragging(true);
    
    const onMove = (moveEvent: MouseEvent) => {
      const next = {
        x: startOx + moveEvent.clientX - startMx,
        y: startOy + moveEvent.clientY - startMy,
      };
      offsetRef.current = next;
      setOffset(next);
    };
    
    const onUp = () => {
      setIsDragging(false);
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [moveable]);

  const onResizeStart = useCallback((e: React.MouseEvent) => {
    if (!resizable) return;
    e.preventDefault();
    e.stopPropagation();
    
    const el = modalRef.current;
    if (!el) return;
    
    const { width: startW, height: startH } = el.getBoundingClientRect();
    const startMx = e.clientX;
    const startMy = e.clientY;
    
    const onMove = (moveEvent: MouseEvent) => {
      setResizeW(Math.max(320, startW + moveEvent.clientX - startMx));
      setResizeH(Math.max(180, startH + moveEvent.clientY - startMy));
    };
    
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [resizable]);

  if (!isOpen) return null;

  const themeStyles = {
    LIGHT: {
      bg: "#ffffff",
      border: "#e7e5e4",
      text: "#1c1917",
      headerBg: "#fafaf9",
      accent: "#4f6b28",
      backdrop: "rgba(28, 25, 23, 0.4)",
    },
    DARK: {
      bg: "#0c0a09",
      border: "#292524",
      text: "#ffffff",
      headerBg: "#1c1917",
      accent: "#ccff00",
      backdrop: "rgba(0, 0, 0, 0.6)",
    },
    VINTAGE: {
      bg: "#ffffff",
      border: "#f5f5f4",
      text: "#000000",
      headerBg: "#f7f9fb",
      accent: "#000000",
      backdrop: "rgba(28, 25, 23, 0.4)",
    },
  };

  const s = themeStyles[theme];

  return ReactDOM.createPortal(
    <div style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      {/* Backdrop */}
      <div 
        style={{ position: "absolute", inset: 0, backgroundColor: s.backdrop, backdropFilter: "blur(4px)" }} 
        onClick={onClose}
      />
      
      {/* Modal Container */}
      <div 
        ref={modalRef}
        style={{ 
          position: "relative",
          zIndex: 10,
          backgroundColor: s.bg,
          border: `1px solid ${s.border}`,
          borderRadius: 32,
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          transform: `translate(${offset.x}px, ${offset.y}px)`,
          width: resizeW || width,
          height: resizeH || "auto",
          maxWidth: "calc(100vw - 48px)",
          maxHeight: "calc(100vh - 48px)",
          minWidth: 320,
          minHeight: 180,
          transition: "background-color 0.5s, border-color 0.5s",
        }}
      >
        {/* Header / Drag Handle */}
        <div 
          onMouseDown={onHeaderMouseDown}
          style={{ 
            padding: "24px 32px",
            borderBottom: `1px solid ${s.border}`,
            backgroundColor: s.headerBg,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            cursor: moveable ? (isDragging ? "grabbing" : "grab") : "default",
            userSelect: "none",
            transition: "background-color 0.5s, border-color 0.5s",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {moveable && (
              <div style={{ display: "flex", flexDirection: "column", gap: 2, opacity: 0.2 }}>
                <div style={{ display: "flex", gap: 2 }}>
                  {[...Array(3)].map((_, i) => <div key={i} style={{ width: 4, height: 4, borderRadius: "50%", backgroundColor: s.text }} />)}
                </div>
                <div style={{ display: "flex", gap: 2 }}>
                  {[...Array(3)].map((_, i) => <div key={i} style={{ width: 4, height: 4, borderRadius: "50%", backgroundColor: s.text }} />)}
                </div>
              </div>
            )}
            <h3 style={{ 
              margin: 0,
              fontSize: 20, 
              fontWeight: 900, 
              fontStyle: "italic",
              letterSpacing: "-0.025em",
              textTransform: "uppercase",
              color: s.accent,
              fontFamily: "Lexend, sans-serif"
            }}>
              {title}
            </h3>
          </div>
          <button 
            onClick={onClose}
            style={{ 
              width: 40, 
              height: 40, 
              borderRadius: 16, 
              border: "none",
              backgroundColor: "transparent",
              display: "flex", 
              alignItems: "center", 
              justifyContent: "center",
              cursor: "pointer",
              color: theme === "DARK" ? "#a8a29e" : "#78716c",
              transition: "background-color 0.2s"
            }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = theme === "DARK" ? "#292524" : "#f5f5f4"}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = "transparent"}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 24 }}>close</span>
          </button>
        </div>
        
        {/* Content */}
        <div style={{ padding: 32, flex: 1, overflowY: "auto", color: s.text }}>
          {children}
        </div>
        
        {/* Footer */}
        {footer && (
          <div style={{ 
            padding: "24px 32px", 
            borderTop: `1px solid ${s.border}`,
            backgroundColor: s.headerBg,
            transition: "background-color 0.5s, border-color 0.5s",
          }}>
            {footer}
          </div>
        )}
        
        {/* Resize Handle */}
        {resizable && (
          <div 
            onMouseDown={onResizeStart}
            style={{ 
              position: "absolute", 
              right: 0, 
              bottom: 0, 
              width: 32, 
              height: 32, 
              cursor: "nwse-resize", 
              display: "flex", 
              alignItems: "flex-end", 
              justifyContent: "flex-end", 
              padding: 8,
              opacity: 0.3,
              color: s.text
            }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M10 2L2 10M10 6L6 10M10 9L9 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};
