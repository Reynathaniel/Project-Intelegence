"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/components/auth/user-provider";
import {
  FileText,
  Upload,
  Calendar,
  Filter,
  Sparkles,
} from "lucide-react";

export default function ReportsPage() {
  const { currentOrgId } = useUser();
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    if (!currentOrgId) return;

    async function load() {
      const { data } = await supabase
        .from("daily_reports")
        .select("id, project_id, discipline, report_date, author_name, status, ai_filled, ai_confidence, created_at, projects(name)")
        .eq("org_id", currentOrgId!)
        .is("deleted_at", null)
        .order("report_date", { ascending: false })
        .limit(50);
      setReports(data ?? []);
      setLoading(false);
    }
    load();
  }, [currentOrgId]);

  const disciplineColors: Record<string, string> = {
    HSE: "bg-red-500/10 text-red-400",
    Supervisor: "bg-orange-500/10 text-orange-400",
    Logistics: "bg-blue-500/10 text-blue-400",
    QC: "bg-purple-500/10 text-purple-400",
    HR: "bg-pink-500/10 text-pink-400",
    "Project Control": "bg-emerald-500/10 text-emerald-400",
    Procurement: "bg-yellow-500/10 text-yellow-400",
  };

  return (
    <div className="p-6 lg:p-8 max-w-7xl space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Daily Intelligence</h1>
          <p className="text-neutral-500 text-xs font-mono uppercase tracking-widest mt-1">
            Real-time field activity logs
          </p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500 text-black font-bold rounded-xl hover:bg-emerald-400 transition-colors text-sm cursor-pointer">
          <Upload className="w-4 h-4" />
          Upload PDF Report
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 pi-spinner" />
        </div>
      ) : reports.length === 0 ? (
        <div className="border border-dashed border-neutral-800 rounded-2xl p-16 text-center">
          <FileText className="w-12 h-12 text-neutral-700 mx-auto mb-4" />
          <h3 className="text-white font-bold text-lg mb-1">Belum ada laporan</h3>
          <p className="text-neutral-500 text-sm">
            Upload PDF laporan harian atau isi form manual.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map((r) => (
            <div
              key={r.id}
              className="flex items-center gap-4 p-4 bg-neutral-900/50 border border-neutral-800 rounded-xl hover:border-neutral-700 transition-colors"
            >
              <div className="w-10 h-10 bg-neutral-800 rounded-xl flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5 text-neutral-500" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-bold text-white">
                    {(r.projects as any)?.name ?? "Unknown Project"}
                  </span>
                  <span
                    className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                      disciplineColors[r.discipline] ?? "bg-neutral-800 text-neutral-400"
                    }`}
                  >
                    {r.discipline}
                  </span>
                  {r.ai_filled && (
                    <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-400 flex items-center gap-1">
                      <Sparkles className="w-3 h-3" /> AI {r.ai_confidence}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-neutral-500 mt-0.5">
                  {r.author_name} · {r.report_date}
                </p>
              </div>
              <span
                className={`text-[9px] font-bold uppercase px-2 py-1 rounded-full border ${
                  r.status === "Submitted"
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                    : "bg-neutral-800 text-neutral-500 border-neutral-700"
                }`}
              >
                {r.status}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
