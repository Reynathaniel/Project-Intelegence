"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUser } from "@/components/auth/user-provider";
import { signOut } from "@/app/actions/auth";
import {
  LayoutDashboard,
  FileText,
  Truck,
  HardHat,
  ShieldCheck,
  Users,
  ClipboardCheck,
  Briefcase,
  Settings,
  LogOut,
  X,
  Menu,
  ChevronDown,
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard, group: "main" },
  { href: "/dashboard/reports", label: "Daily Intelligence", icon: FileText, group: "main" },
  { href: "/dashboard/projects", label: "Projects", icon: Briefcase, group: "main" },
  { href: "/dashboard/hse", label: "HSE", icon: ShieldCheck, group: "role" },
  { href: "/dashboard/supervisor", label: "Supervisor", icon: HardHat, group: "role" },
  { href: "/dashboard/logistics", label: "Logistics", icon: Truck, group: "role" },
  { href: "/dashboard/qc", label: "QC", icon: ClipboardCheck, group: "role" },
  { href: "/dashboard/hr", label: "HR & Manpower", icon: Users, group: "role" },
  { href: "/dashboard/settings", label: "Settings", icon: Settings, group: "system" },
];

export function Sidebar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const { profile, orgs, currentOrgId, setCurrentOrgId } = useUser();
  const [orgDropdownOpen, setOrgDropdownOpen] = useState(false);

  const currentOrg = orgs.find((o) => o.org_id === currentOrgId);

  const nav = (
    <>
      {/* Logo */}
      <div className="p-5 border-b border-neutral-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center font-bold text-black text-xl shadow-lg shadow-emerald-500/20 select-none">
            π
          </div>
          <div>
            <h2 className="font-bold text-white tracking-tight text-sm">
              Project Intelligence
            </h2>
            <p className="text-[9px] text-neutral-500 font-mono uppercase tracking-[0.15em]">
              v2.0 · Supabase
            </p>
          </div>
        </div>
        <button
          onClick={() => setMobileOpen(false)}
          className="p-2 text-neutral-500 hover:text-white lg:hidden"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Org selector */}
      {orgs.length > 0 && (
        <div className="px-4 pt-4">
          <button
            onClick={() => setOrgDropdownOpen(!orgDropdownOpen)}
            className="w-full flex items-center justify-between px-3 py-2.5 bg-neutral-800/60 border border-neutral-700/50 rounded-xl text-xs hover:border-neutral-600 transition-colors"
          >
            <span className="font-semibold text-neutral-300 truncate">
              {currentOrg?.org_name ?? "Select Organization"}
            </span>
            <ChevronDown
              className={`w-4 h-4 text-neutral-500 transition-transform ${
                orgDropdownOpen ? "rotate-180" : ""
              }`}
            />
          </button>
          {orgDropdownOpen && (
            <div className="mt-1 bg-neutral-800 border border-neutral-700 rounded-xl overflow-hidden shadow-xl">
              {orgs.map((o) => (
                <button
                  key={o.org_id}
                  onClick={() => {
                    setCurrentOrgId(o.org_id);
                    setOrgDropdownOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 text-xs hover:bg-neutral-700 transition-colors ${
                    o.org_id === currentOrgId
                      ? "text-emerald-400 bg-emerald-500/5"
                      : "text-neutral-400"
                  }`}
                >
                  <span className="font-semibold">{o.org_name}</span>
                  <span className="ml-2 text-[9px] text-neutral-600 uppercase">
                    {o.role}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto custom-scrollbar">
        <p className="px-3 text-[9px] font-mono text-neutral-600 uppercase tracking-widest mb-2 mt-2">
          Main
        </p>
        {NAV_ITEMS.filter((i) => i.group === "main").map((item) => (
          <NavLink key={item.href} item={item} active={pathname === item.href} onNav={() => setMobileOpen(false)} />
        ))}

        <p className="px-3 text-[9px] font-mono text-neutral-600 uppercase tracking-widest mb-2 mt-6">
          Role Dashboards
        </p>
        {NAV_ITEMS.filter((i) => i.group === "role").map((item) => (
          <NavLink key={item.href} item={item} active={pathname === item.href} onNav={() => setMobileOpen(false)} />
        ))}

        <p className="px-3 text-[9px] font-mono text-neutral-600 uppercase tracking-widest mb-2 mt-6">
          System
        </p>
        {NAV_ITEMS.filter((i) => i.group === "system").map((item) => (
          <NavLink key={item.href} item={item} active={pathname === item.href} onNav={() => setMobileOpen(false)} />
        ))}
      </nav>

      {/* User footer */}
      <div className="p-4 border-t border-neutral-800 space-y-3">
        {profile && (
          <div className="flex items-center gap-3 p-3 bg-neutral-800/50 rounded-xl border border-neutral-700/50">
            <div className="w-9 h-9 rounded-full bg-neutral-700 overflow-hidden border border-neutral-600 shrink-0">
              {profile.avatar_url ? (
                <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <img
                  src={`https://ui-avatars.com/api/?name=${encodeURIComponent(
                    profile.full_name ?? profile.email
                  )}&background=10B981&color=fff&size=36`}
                  alt=""
                  className="w-full h-full object-cover"
                />
              )}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-white truncate">
                {profile.full_name ?? profile.email}
              </p>
              <p className="text-[10px] text-neutral-500 truncate">
                {profile.email}
              </p>
            </div>
          </div>
        )}
        <form action={signOut}>
          <button
            type="submit"
            className="w-full flex items-center justify-center gap-2 p-2.5 text-neutral-500 hover:text-red-400 hover:bg-red-500/5 rounded-xl transition-all text-xs font-bold uppercase tracking-widest cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </form>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile hamburger */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed top-4 left-4 z-50 p-2 bg-neutral-900 border border-neutral-800 rounded-xl lg:hidden"
      >
        <Menu className="w-5 h-5 text-neutral-400" />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar panel */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-72 bg-neutral-900 border-r border-neutral-800 flex flex-col transition-transform duration-200 lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {nav}
      </aside>
    </>
  );
}

function NavLink({
  item,
  active,
  onNav,
}: {
  item: (typeof NAV_ITEMS)[number];
  active: boolean;
  onNav: () => void;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onNav}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
        active
          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
          : "text-neutral-400 hover:bg-neutral-800 hover:text-white border border-transparent"
      }`}
    >
      <Icon className="w-[18px] h-[18px] shrink-0" />
      <span className="truncate">{item.label}</span>
    </Link>
  );
}
