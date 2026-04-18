"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/components/auth/user-provider";
import {
  Plus,
  Briefcase,
  MapPin,
  Calendar,
  Loader2,
  X,
  Activity,
} from "lucide-react";
import Link from "next/link";

interface Project {
  id: string;
  name: string;
  location: string | null;
  client: string | null;
  status: "Active" | "Completed" | "On Hold";
  start_date: string | null;
  end_date: string | null;
  created_at: string;
}

export default function ProjectsPage() {
  const { currentOrgId } = useUser();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    if (!currentOrgId) return;

    async function load() {
      const { data } = await supabase
        .from("projects")
        .select("id, name, location, client, status, start_date, end_date, created_at")
        .eq("org_id", currentOrgId!)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      setProjects(data ?? []);
      setLoading(false);
    }
    load();

    // Realtime subscription
    const channel = supabase
      .channel("projects-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "projects",
          filter: `org_id=eq.${currentOrgId}`,
        },
        () => load()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentOrgId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 pi-spinner" />
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-7xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Projects</h1>
          <p className="text-neutral-500 text-xs font-mono uppercase tracking-widest mt-1">
            {projects.length} total · {projects.filter((p) => p.status === "Active").length} active
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500 text-black font-bold rounded-xl hover:bg-emerald-400 transition-colors text-sm cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          New Project
        </button>
      </div>

      {projects.length === 0 ? (
        <div className="border border-dashed border-neutral-800 rounded-2xl p-16 text-center">
          <Briefcase className="w-12 h-12 text-neutral-700 mx-auto mb-4" />
          <h3 className="text-white font-bold text-lg mb-1">Belum ada project</h3>
          <p className="text-neutral-500 text-sm">Klik &quot;New Project&quot; untuk memulai.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((p) => (
            <Link
              key={p.id}
              href={`/dashboard/projects/${p.id}`}
              className="group p-5 bg-neutral-900/50 border border-neutral-800 rounded-2xl hover:border-neutral-600 transition-all"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 bg-neutral-800 rounded-xl flex items-center justify-center group-hover:bg-emerald-500/10 transition-colors">
                  <Activity className="w-5 h-5 text-neutral-500 group-hover:text-emerald-500" />
                </div>
                <StatusBadge status={p.status} />
              </div>
              <h3 className="font-bold text-white group-hover:text-emerald-400 transition-colors">{p.name}</h3>
              {p.location && (
                <p className="text-xs text-neutral-500 flex items-center gap-1 mt-1.5">
                  <MapPin className="w-3 h-3" /> {p.location}
                </p>
              )}
              {p.client && (
                <p className="text-[10px] text-neutral-600 font-mono mt-2">Client: {p.client}</p>
              )}
              {p.start_date && (
                <p className="text-[10px] text-neutral-600 flex items-center gap-1 mt-1">
                  <Calendar className="w-3 h-3" />
                  {p.start_date} → {p.end_date ?? "ongoing"}
                </p>
              )}
            </Link>
          ))}
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <CreateProjectModal
          orgId={currentOrgId!}
          onClose={() => setShowCreate(false)}
          onCreated={() => setShowCreate(false)}
        />
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const c: Record<string, string> = {
    Active: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    Completed: "bg-neutral-800 text-neutral-400 border-neutral-700",
    "On Hold": "bg-amber-500/10 text-amber-400 border-amber-500/20",
  };
  return (
    <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded-full border ${c[status] ?? c.Active}`}>
      {status}
    </span>
  );
}

function CreateProjectModal({
  orgId,
  onClose,
  onCreated,
}: {
  orgId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const supabase = createClient();
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [client, setClient] = useState("");
  const [contractNo, setContractNo] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    setError(null);

    const { error: err } = await supabase.from("projects").insert({
      org_id: orgId,
      name: name.trim(),
      location: location.trim() || null,
      client: client.trim() || null,
      contract_no: contractNo.trim() || null,
      status: "Active",
    });

    if (err) {
      setError(err.message);
      setLoading(false);
    } else {
      onCreated();
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-2xl p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">New Project</h2>
          <button onClick={onClose} className="p-1 text-neutral-500 hover:text-white cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Nama Project *" value={name} onChange={setName} placeholder="EPC Power Plant Kalimantan" required />
          <Field label="Lokasi" value={location} onChange={setLocation} placeholder="Balikpapan, Kalimantan Timur" />
          <Field label="Client" value={client} onChange={setClient} placeholder="PT PLN (Persero)" />
          <Field label="Contract No." value={contractNo} onChange={setContractNo} placeholder="SPK/2026/001" />

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400">{error}</div>
          )}

          <button
            type="submit"
            disabled={loading || !name.trim()}
            className="w-full py-3 bg-emerald-500 text-black font-bold rounded-xl hover:bg-emerald-400 disabled:opacity-50 transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? "Creating..." : "Create Project"}
          </button>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  required?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="w-full px-3 py-2.5 bg-neutral-800 border border-neutral-700 rounded-xl text-white text-sm placeholder:text-neutral-600 focus:outline-none focus:border-emerald-500 transition-colors"
      />
    </div>
  );
}
