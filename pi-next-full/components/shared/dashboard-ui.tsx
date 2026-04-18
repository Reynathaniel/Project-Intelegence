"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/components/auth/user-provider";
import { Activity, ChevronDown, Calendar } from "lucide-react";
import { format } from "date-fns";

export interface Project {
  id: string;
  name: string;
  location: string | null;
}

// ============================================================================
// ProjectSelector — dropdown for picking project (used in every dashboard)
// ============================================================================

export function ProjectSelector({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (id: string) => void;
}) {
  const { currentOrgId } = useUser();
  const supabase = createClient();
  const [projects, setProjects] = useState<Project[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!currentOrgId) return;
    (async () => {
      const { data } = await supabase
        .from("projects")
        .select("id, name, location")
        .eq("org_id", currentOrgId)
        .is("deleted_at", null)
        .order("name");
      setProjects(data ?? []);
      if (data?.length && !value) onChange(data[0].id);
    })();
  }, [currentOrgId]);

  const selected = projects.find((p) => p.id === value);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-4 py-2 bg-neutral-900 border border-neutral-800 rounded-xl text-xs font-bold text-neutral-300 hover:border-neutral-700 transition-colors cursor-pointer"
      >
        <Activity className="w-4 h-4 text-emerald-500" />
        {selected?.name ?? "Select Project"}
        <ChevronDown className={`w-3.5 h-3.5 text-neutral-500 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-1 w-64 bg-neutral-800 border border-neutral-700 rounded-xl overflow-hidden shadow-xl z-20">
            {projects.length === 0 ? (
              <p className="px-4 py-3 text-xs text-neutral-500">No projects</p>
            ) : projects.map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  onChange(p.id);
                  setOpen(false);
                }}
                className={`w-full text-left px-4 py-2.5 text-xs hover:bg-neutral-700 transition-colors cursor-pointer ${
                  p.id === value ? "text-emerald-400 bg-emerald-500/5" : "text-neutral-400"
                }`}
              >
                <span className="font-semibold">{p.name}</span>
                {p.location && <span className="block text-[10px] text-neutral-600 mt-0.5">{p.location}</span>}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ============================================================================
// DashboardHeader — consistent header with title + project selector + date
// ============================================================================

export function DashboardHeader({
  title,
  subtitle,
  icon: Icon,
  iconColor = "text-emerald-500",
  projectId,
  onProjectChange,
  extra,
}: {
  title: string;
  subtitle: string;
  icon: any;
  iconColor?: string;
  projectId: string | null;
  onProjectChange: (id: string) => void;
  extra?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold text-white uppercase tracking-tight flex items-center gap-3">
          <Icon className={`w-7 h-7 ${iconColor}`} />
          {title}
        </h1>
        <p className="text-neutral-500 text-sm font-mono mt-1">{subtitle}</p>
      </div>
      <div className="flex items-center gap-3 flex-wrap">
        {extra}
        <ProjectSelector value={projectId} onChange={onProjectChange} />
        <div className="px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-xl flex items-center gap-2">
          <Calendar className="w-3.5 h-3.5 text-emerald-500" />
          <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">
            {format(new Date(), "dd MMM yyyy")}
          </span>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// StatCard — reusable metric card
// ============================================================================

export function StatCard({
  title,
  value,
  icon,
  subtitle,
  color = "emerald",
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
  subtitle?: string;
  color?: "orange" | "blue" | "red" | "emerald" | "violet" | "amber" | "pink";
}) {
  const colors = {
    orange: "bg-orange-500/10 text-orange-500 border-orange-500/20",
    blue: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    red: "bg-red-500/10 text-red-500 border-red-500/20",
    emerald: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
    violet: "bg-violet-500/10 text-violet-500 border-violet-500/20",
    amber: "bg-amber-500/10 text-amber-500 border-amber-500/20",
    pink: "bg-pink-500/10 text-pink-500 border-pink-500/20",
  };
  return (
    <div className="p-4 bg-neutral-900/50 border border-neutral-800 rounded-2xl space-y-3">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${colors[color]}`}>
        {icon}
      </div>
      <div>
        <p className="text-2xl font-bold text-white">{value}</p>
        <p className="text-[11px] text-neutral-400 font-medium mt-0.5">{title}</p>
        {subtitle && <p className="text-[10px] text-neutral-600 font-mono">{subtitle}</p>}
      </div>
    </div>
  );
}

// ============================================================================
// Empty state & loading
// ============================================================================

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: any;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="border border-dashed border-neutral-800 rounded-2xl p-16 text-center">
      <Icon className="w-12 h-12 text-neutral-700 mx-auto mb-4" />
      <h3 className="text-white font-bold text-lg mb-1">{title}</h3>
      <p className="text-neutral-500 text-sm mb-4">{description}</p>
      {action}
    </div>
  );
}

export function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 pi-spinner" />
    </div>
  );
}

// ============================================================================
// Discipline color mapping
// ============================================================================

export const DISCIPLINE_COLORS: Record<string, string> = {
  HSE: "bg-red-500/10 text-red-400 border-red-500/20",
  Supervisor: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  Logistics: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  QC: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  HR: "bg-pink-500/10 text-pink-400 border-pink-500/20",
  Procurement: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  "Document Control": "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
  "Mechanic & Electrical": "bg-amber-500/10 text-amber-400 border-amber-500/20",
  "Project Control": "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
};
