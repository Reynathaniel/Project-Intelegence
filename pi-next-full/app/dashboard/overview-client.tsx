"use client";

import Link from "next/link";
import {
  Briefcase,
  FileText,
  Users,
  Zap,
  ArrowRight,
  Activity,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";

interface Props {
  org: {
    id: string;
    name: string;
    slug: string;
    plan: string;
    monthly_extract_used: number;
    monthly_extract_limit: number;
  };
  projects: any[];
  todayReports: number;
  totalManpower: number;
  userName: string;
}

export function OverviewClient({
  org,
  projects,
  todayReports,
  totalManpower,
  userName,
}: Props) {
  const activeProjects = projects.filter((p) => p.status === "Active");
  const extractPct = org.monthly_extract_limit > 0
    ? Math.round((org.monthly_extract_used / org.monthly_extract_limit) * 100)
    : 0;

  return (
    <div className="p-6 lg:p-8 space-y-8 max-w-7xl">
      {/* Header */}
      <div className="space-y-1">
        <p className="text-xs font-mono text-neutral-500 uppercase tracking-[0.2em]">
          {org.name} · {org.plan} plan
        </p>
        <h1 className="text-2xl lg:text-3xl font-bold text-white tracking-tight">
          Selamat datang, {userName.split(" ")[0]}
        </h1>
        <p className="text-neutral-500 text-sm">
          Ini overview π untuk organisasi Anda hari ini.
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<Briefcase className="w-5 h-5" />}
          label="Active Projects"
          value={activeProjects.length}
          color="emerald"
        />
        <StatCard
          icon={<FileText className="w-5 h-5" />}
          label="Reports Hari Ini"
          value={todayReports}
          color="blue"
        />
        <StatCard
          icon={<Users className="w-5 h-5" />}
          label="Total Manpower"
          value={totalManpower}
          color="amber"
        />
        <StatCard
          icon={<Zap className="w-5 h-5" />}
          label="AI Extractions"
          value={`${org.monthly_extract_used}/${org.monthly_extract_limit}`}
          sub={`${extractPct}% used`}
          color="violet"
        />
      </div>

      {/* Projects grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">Projects</h2>
          <Link
            href="/dashboard/projects"
            className="text-xs text-emerald-500 hover:text-emerald-400 flex items-center gap-1 font-medium"
          >
            View all <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {projects.length === 0 ? (
          <div className="border border-dashed border-neutral-800 rounded-2xl p-12 text-center">
            <div className="w-14 h-14 bg-neutral-900 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Briefcase className="w-7 h-7 text-neutral-700" />
            </div>
            <h3 className="text-white font-bold mb-1">Belum ada project</h3>
            <p className="text-neutral-500 text-sm mb-4">
              Buat project pertama untuk mulai tracking.
            </p>
            <Link
              href="/dashboard/projects"
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500 text-black text-sm font-bold rounded-xl hover:bg-emerald-400 transition-colors"
            >
              + Buat Project
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.slice(0, 6).map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        )}
      </div>

      {/* Quick actions */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-white">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <QuickAction
            icon={<FileText className="w-5 h-5" />}
            label="Buat Laporan Harian"
            desc="Upload PDF atau isi manual"
            href="/dashboard/reports"
          />
          <QuickAction
            icon={<ShieldCheck className="w-5 h-5" />}
            label="HSE Dashboard"
            desc="Safety metrics & permits"
            href="/dashboard/hse"
          />
          <QuickAction
            icon={<TrendingUp className="w-5 h-5" />}
            label="PM Intelligence"
            desc="Schedule, cost, procurement"
            href="/dashboard/pm"
          />
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  sub,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  sub?: string;
  color: "emerald" | "blue" | "amber" | "violet";
}) {
  const colors = {
    emerald: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
    blue: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    amber: "bg-amber-500/10 text-amber-500 border-amber-500/20",
    violet: "bg-violet-500/10 text-violet-500 border-violet-500/20",
  };

  return (
    <div className="p-4 bg-neutral-900/50 border border-neutral-800 rounded-2xl space-y-3">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${colors[color]}`}>
        {icon}
      </div>
      <div>
        <p className="text-2xl font-bold text-white">{value}</p>
        <p className="text-[11px] text-neutral-500 font-medium mt-0.5">
          {label}
        </p>
        {sub && (
          <p className="text-[10px] text-neutral-600 font-mono mt-0.5">{sub}</p>
        )}
      </div>
    </div>
  );
}

function ProjectCard({ project }: { project: any }) {
  const statusColors: Record<string, string> = {
    Active: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    Completed: "bg-neutral-800 text-neutral-400 border-neutral-700",
    "On Hold": "bg-amber-500/10 text-amber-400 border-amber-500/20",
  };

  return (
    <Link
      href={`/dashboard/projects/${project.id}`}
      className="group block p-5 bg-neutral-900/50 border border-neutral-800 rounded-2xl hover:border-neutral-600 transition-all"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="w-9 h-9 bg-neutral-800 rounded-xl flex items-center justify-center group-hover:bg-emerald-500/10 transition-colors">
          <Activity className="w-4.5 h-4.5 text-neutral-500 group-hover:text-emerald-500 transition-colors" />
        </div>
        <span
          className={`text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded-full border ${
            statusColors[project.status] ?? statusColors.Active
          }`}
        >
          {project.status}
        </span>
      </div>
      <h3 className="font-bold text-white text-sm group-hover:text-emerald-400 transition-colors">
        {project.name}
      </h3>
      <p className="text-xs text-neutral-500 mt-1 truncate">
        {project.location ?? "No location set"}
      </p>
      {project.client && (
        <p className="text-[10px] text-neutral-600 font-mono mt-2 truncate">
          Client: {project.client}
        </p>
      )}
    </Link>
  );
}

function QuickAction({
  icon,
  label,
  desc,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  desc: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-4 p-4 bg-neutral-900/50 border border-neutral-800 rounded-2xl hover:border-emerald-500/30 hover:bg-emerald-500/5 transition-all group"
    >
      <div className="w-10 h-10 bg-neutral-800 rounded-xl flex items-center justify-center group-hover:bg-emerald-500/10 transition-colors shrink-0">
        <span className="text-neutral-500 group-hover:text-emerald-500 transition-colors">
          {icon}
        </span>
      </div>
      <div className="min-w-0">
        <p className="text-sm font-bold text-white">{label}</p>
        <p className="text-[11px] text-neutral-500">{desc}</p>
      </div>
    </Link>
  );
}
