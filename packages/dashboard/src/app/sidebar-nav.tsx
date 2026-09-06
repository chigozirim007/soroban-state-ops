"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconDashboard, IconContracts, IconAlerts, IconCost } from "../components/icons";

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
        <Link
          href="/"
          className={`nav-link ${isLinkActive("/") ? "active" : ""}`}
          style={{ display: "flex", alignItems: "center", gap: "8px" }}
        >
          <IconDashboard size={16} />
          <span>Overview</span>
        </Link>
        <Link
          href="/contracts"
          className={`nav-link ${isLinkActive("/contracts") ? "active" : ""}`}
          style={{ display: "flex", alignItems: "center", gap: "8px" }}
        >
          <IconContracts size={16} />
          <span>Contracts</span>
        </Link>
        <Link
          href="/alerts"
          className={`nav-link ${isLinkActive("/alerts") ? "active" : ""}`}
          style={{ display: "flex", alignItems: "center", gap: "8px" }}
        >
          <IconAlerts size={16} />
          <span>Alerts</span>
        </Link>
      </nav>

      <nav className="nav-section">
        <span className="nav-label">Tools</span>
        <Link
          href="/cost"
          className={`nav-link ${isLinkActive("/cost") ? "active" : ""}`}
          style={{ display: "flex", alignItems: "center", gap: "8px" }}
        >
          <IconCost size={16} />
          <span>Cost Estimator</span>
        </Link>
      </nav>
    </>
  );
}
