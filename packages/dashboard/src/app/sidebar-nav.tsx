"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function SidebarNav() {
  const pathname = usePathname();

  const isLinkActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  return (
    <>
      <nav className="nav-section">
        <span className="nav-label">Monitor</span>
        <Link href="/" className={`nav-link ${isLinkActive("/") ? "active" : ""}`}>
          📊 Overview
        </Link>
        <Link href="/contracts" className={`nav-link ${isLinkActive("/contracts") ? "active" : ""}`}>
          📋 Contracts
        </Link>
        <Link href="/alerts" className={`nav-link ${isLinkActive("/alerts") ? "active" : ""}`}>
          🔔 Alerts
        </Link>
      </nav>

      <nav className="nav-section">
        <span className="nav-label">Tools</span>
        <Link href="/cost" className={`nav-link ${isLinkActive("/cost") ? "active" : ""}`}>
          💰 Cost Estimator
        </Link>
      </nav>
    </>
  );
}
