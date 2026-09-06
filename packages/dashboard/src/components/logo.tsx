import React from "react";

interface LogoProps {
  size?: number;
  className?: string;
  showText?: boolean;
}

/**
 * Soroban State Ops — Circuit Abacus 'S' Logo
 *
 * Geometric cybernetic monogram combining Japanese Soroban abacus counters
 * with active PCB circuit traces and data telemetry nodes.
 */
export function SorobanLogo({ size = 36, className = "", showText = false }: LogoProps) {
  return (
    <div className={`soroban-logo-container ${className}`} style={{ display: "inline-flex", alignItems: "center", gap: "10px" }}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="soroban-logo-svg"
        style={{ flexShrink: 0, overflow: "visible" }}
      >
        <defs>
          {/* Cyber Cyan Gradient */}
          <linearGradient id="cyanGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#00F0FF" />
            <stop offset="100%" stopColor="#00A8FF" />
          </linearGradient>

          {/* Ice White Glow */}
          <linearGradient id="iceWhite" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="100%" stopColor="#CBD5E1" />
          </linearGradient>

          {/* Core Glow Filter */}
          <filter id="circuitGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="1.5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* ── Background Rounded Shield / Backplate (Dark Obsidian) ── */}
        <rect
          x="3"
          y="3"
          width="94"
          height="94"
          rx="20"
          fill="#05080E"
          stroke="rgba(0, 240, 255, 0.18)"
          strokeWidth="1.5"
        />

        {/* ── Inner Cyber Corner Accents ── */}
        <path d="M 12 24 L 12 14 L 22 14" stroke="#00F0FF" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
        <path d="M 88 24 L 88 14 L 78 14" stroke="#00F0FF" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
        <path d="M 12 76 L 12 86 L 22 86" stroke="#00F0FF" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
        <path d="M 88 76 L 88 86 L 78 86" stroke="#00F0FF" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />

        {/* ════ CIRCUIT ABACUS 'S' MONOGRAM ════ */}
        <g filter="url(#circuitGlow)">
          {/* ── Outer Circuit Track (Top Left to Bottom Right 'S') ── */}
          <path
            d="M 52 16 
               L 32 16 
               C 23 16, 18 21, 18 30 
               L 18 40 
               C 18 47, 24 51, 32 53 
               L 68 53 
               C 76 55, 82 59, 82 66 
               L 82 72 
               C 82 81, 76 86, 66 86 
               L 38 86"
            stroke="url(#cyanGradient)"
            strokeWidth="3.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* ── Inner Parallel Circuit Track ── */}
          <path
            d="M 64 22 
               L 36 22 
               C 30 22, 26 26, 26 32 
               L 26 36 
               C 26 42, 30 45, 36 47 
               L 62 47 
               C 70 49, 74 53, 74 60 
               L 74 68 
               C 74 74, 70 78, 62 78 
               L 48 78"
            stroke="#00F0FF"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.9"
          />

          {/* ── Third Inner Core Track ── */}
          <path
            d="M 34 32 
               L 42 32 
               C 46 32, 48 35, 52 40 
               L 56 46"
            stroke="#FFFFFF"
            strokeWidth="2"
            strokeLinecap="round"
            opacity="0.8"
          />
          <path
            d="M 66 68 
               L 58 68 
               C 54 68, 52 65, 48 60 
               L 44 54"
            stroke="#FFFFFF"
            strokeWidth="2"
            strokeLinecap="round"
            opacity="0.8"
          />

          {/* ── UPPER ABACUS REGISTER ── */}
          {/* Horizontal Abacus Counting Rod */}
          <line x1="38" y1="32" x2="82" y2="32" stroke="rgba(0, 240, 255, 0.45)" strokeWidth="1.8" strokeLinecap="round" />
          <line x1="82" y1="32" x2="82" y2="44" stroke="rgba(0, 240, 255, 0.45)" strokeWidth="1.8" strokeLinecap="round" />

          {/* 4 Upper Abacus Counting Beads */}
          {/* Bead 1 (Cyan - active) */}
          <rect x="52" y="27" width="5.5" height="10" rx="2.5" fill="url(#cyanGradient)" stroke="#05080E" strokeWidth="0.8" />
          {/* Bead 2 (Cyan - active) */}
          <rect x="59" y="27" width="5.5" height="10" rx="2.5" fill="url(#cyanGradient)" stroke="#05080E" strokeWidth="0.8" />
          {/* Bead 3 (Ice White - ledger balance) */}
          <rect x="66" y="27" width="5.5" height="10" rx="2.5" fill="url(#iceWhite)" stroke="#05080E" strokeWidth="0.8" />
          {/* Bead 4 (Ice White - ledger balance) */}
          <rect x="73" y="27" width="5.5" height="10" rx="2.5" fill="url(#iceWhite)" stroke="#05080E" strokeWidth="0.8" />

          {/* ── LOWER ABACUS REGISTER ── */}
          {/* Horizontal Abacus Counting Rod */}
          <line x1="18" y1="68" x2="62" y2="68" stroke="rgba(0, 240, 255, 0.45)" strokeWidth="1.8" strokeLinecap="round" />
          <line x1="18" y1="56" x2="18" y2="68" stroke="rgba(0, 240, 255, 0.45)" strokeWidth="1.8" strokeLinecap="round" />

          {/* 4 Lower Abacus Counting Beads */}
          {/* Bead 1 (Ice White) */}
          <rect x="23" y="63" width="5.5" height="10" rx="2.5" fill="url(#iceWhite)" stroke="#05080E" strokeWidth="0.8" />
          {/* Bead 2 (Ice White) */}
          <rect x="30" y="63" width="5.5" height="10" rx="2.5" fill="url(#iceWhite)" stroke="#05080E" strokeWidth="0.8" />
          {/* Bead 3 (Cyan) */}
          <rect x="37" y="63" width="5.5" height="10" rx="2.5" fill="url(#cyanGradient)" stroke="#05080E" strokeWidth="0.8" />
          {/* Bead 4 (Cyan) */}
          <rect x="44" y="63" width="5.5" height="10" rx="2.5" fill="url(#cyanGradient)" stroke="#05080E" strokeWidth="0.8" />

          {/* ── Circuit Terminal Nodes / Solder Pads (Clean Geometry) ── */}
          {/* Top terminal nodes */}
          <circle cx="52" cy="16" r="2.8" fill="#00F0FF" />
          <circle cx="52" cy="16" r="1.2" fill="#05080E" />

          <circle cx="64" cy="22" r="2.4" fill="#FFFFFF" />
          <circle cx="64" cy="22" r="1" fill="#05080E" />

          {/* Right terminal node on abacus line */}
          <circle cx="82" cy="44" r="2.8" fill="#FFFFFF" />
          <circle cx="82" cy="44" r="1.2" fill="#05080E" />

          {/* Left terminal node on lower abacus line */}
          <circle cx="18" cy="56" r="2.8" fill="#FFFFFF" />
          <circle cx="18" cy="56" r="1.2" fill="#05080E" />

          {/* Bottom terminal nodes */}
          <circle cx="48" cy="78" r="2.4" fill="#FFFFFF" />
          <circle cx="48" cy="78" r="1" fill="#05080E" />

          <circle cx="38" cy="86" r="2.8" fill="#00F0FF" />
          <circle cx="38" cy="86" r="1.2" fill="#05080E" />

          {/* Center heart-beat circuit via */}
          <circle cx="50" cy="50" r="2" fill="#00F0FF" opacity="0.9" />
        </g>
      </svg>

      {showText && (
        <div className="soroban-brand-lockup" style={{ display: "flex", flexDirection: "column", lineHeight: 1.15 }}>
          <span
            style={{
              fontSize: "1.1rem",
              fontWeight: 800,
              letterSpacing: "0.14em",
              color: "#FFFFFF",
              fontFamily: "var(--font-sans)",
            }}
          >
            SOROBAN
          </span>
          <span
            style={{
              fontSize: "0.72rem",
              fontWeight: 700,
              letterSpacing: "0.28em",
              color: "#00F0FF",
              fontFamily: "var(--font-mono)",
            }}
          >
            STATE OPS
          </span>
        </div>
      )}
    </div>
  );
}
