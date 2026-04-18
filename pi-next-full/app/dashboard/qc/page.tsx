"use client";
import { useEffect, useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/components/auth/user-provider";
import { DashboardHeader, StatCard, EmptyState, LoadingSpinner } from "@/components/shared/dashboard-ui";
import { ClipboardCheck, FileText, AlertCircle, CheckCircle2, FolderOpen, Upload, Trash2, ChevronRight, X, Loader2 } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";

export default function QCDashboardPage() {
  const { currentOrgId, user } = useUser();
  const supabase = createClient();
  const [projectId, setProjectId] = useState<string | null>(null);
  const [reports, setReports] = useState<any[]>([]);
  const [folders, setFolders] = useState<any[]>([]);
  const [files, setFiles] = useState<any[]>([]);
  const [matReqs, setMatReqs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "files">("overview");
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId || !currentOrgId) return;
    setLoading(true);
    const load = async () => {
      const [rep, fld, fil, mreq] = await Promise.all([
        supabase.from("daily_reports").select("id, report_date, author_name, data, status, ai_filled, ai_confidence")
          .eq("project_id", projectId).eq("discipline", "QC").eq("status", "Submitted").is("deleted_at", null)
          .order("report_date", { ascending: false }).limit(60),
        supabase.from("qc_folders").select("*").eq("project_id", projectId),
        supabase.from("qc_files").select("*").eq("project_id", projectId).order("created_at", { ascending: false }),
        supabase.from("qc_material_requests").select("*").eq("project_id", projectId).order("created_at", { ascending: false }).limit(50),
      ]);
      setReports(rep.data ?? []); setFolders(fld.data ?? []); setFiles(fil.data ?? []); setMatReqs(mreq.data ?? []);
      setLoading(false);
    };
    load();
    const ch = supabase.channel(`qc-${projectId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "daily_reports", filter: `project_id=eq.${projectId}` }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "qc_files", filter: `project_id=eq.${projectId}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [projectId, currentOrgId]);

  const stats = useMemo(() => {
    let inspections = 0, ncr = 0, punchOpen = 0, punchClosed = 0;
    reports.forEach((r) => {
      const d = r.data;
      inspections += d?.inspections?.length ?? 0;
      ncr += d?.nonConformity?.filter((n: any) => n.status !== "Closed").length ?? 0;
      const pl = d?.punchList ?? [];
      punchOpen += pl.filter((p: any) => p.status !== "Closed" && p.status !== "Done").length;
      punchClosed += pl.filter((p: any) => p.status === "Closed" || p.status === "Done").length;
    });
    const reqStatus: Record<string, number> = {};
    matReqs.forEach((r) => { reqStatus[r.status] = (reqStatus[r.status] ?? 0) + 1; });
    const statusColors: Record<string, string> = { Pending: "#F59E0B", Approved: "#10B981", Rejected: "#EF4444", "Approved by CC": "#3B82F6", "Approved by CM": "#8B5CF6" };
    const statusData = Object.entries(reqStatus).map(([name, value]) => ({ name, value, color: statusColors[name] ?? "#666" }));
    return { inspections, ncr, punchOpen, punchClosed, totalFiles: files.length, totalFolders: folders.length, statusData, pendingReqs: matReqs.filter((r) => r.status === "Pending").length };
  }, [reports, matReqs, files, folders]);

  const currentFiles = files.filter((f) => f.folder_id === currentFolderId);
  const currentSubfolders = folders.filter((f) => f.parent_id === currentFolderId);
  const breadcrumbs = useMemo(() => {
    const crumbs: any[] = [];
    let cur = folders.find((f) => f.id === currentFolderId);
    while (cur) { crumbs.unshift(cur); cur = folders.find((f) => f.id === cur.parent_id); }
    return crumbs;
  }, [currentFolderId, folders]);

  return (
    <div className="p-6 lg:p-8 max-w-7xl space-y-6">
      <DashboardHeader title="QC Dashboard" subtitle="Quality Control, Inspections & Document Management"
        icon={ClipboardCheck} iconColor="text-purple-500" projectId={projectId} onProjectChange={setProjectId} />

      {loading ? <LoadingSpinner /> : !projectId ? (
        <EmptyState icon={ClipboardCheck} title="QC Dashboard" description="Pilih project." />
      ) : (
        <>
          {/* Tabs */}
          <div className="flex gap-2">
            {(["overview", "files"] as const).map((tab) => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                  activeTab === tab ? "bg-purple-500/10 text-purple-400 border border-purple-500/20" : "text-neutral-500 hover:text-white border border-transparent"
                }`}>{tab === "overview" ? "Overview" : `Files (${stats.totalFiles})`}</button>
            ))}
          </div>

          {activeTab === "overview" ? (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard title="Inspections" value={stats.inspections.toString()} icon={<ClipboardCheck className="w-5 h-5" />} subtitle={`${reports.length} reports`} color="violet" />
                <StatCard title="Open NCR" value={stats.ncr.toString()} icon={<AlertCircle className="w-5 h-5" />} subtitle="Non-conformities" color="red" />
                <StatCard title="Punch List" value={`${stats.punchOpen} open`} icon={<FileText className="w-5 h-5" />} subtitle={`${stats.punchClosed} closed`} color="amber" />
                <StatCard title="QC Mat Requests" value={matReqs.length.toString()} icon={<CheckCircle2 className="w-5 h-5" />} subtitle={`${stats.pendingReqs} pending`} color="blue" />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Request status pie */}
                <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6">
                  <h3 className="text-sm font-bold text-white uppercase tracking-widest mb-5 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-purple-500" /> Material Request Status
                  </h3>
                  {stats.statusData.length > 0 ? (
                    <>
                      <ResponsiveContainer width="100%" height={180}>
                        <PieChart><Pie data={stats.statusData} cx="50%" cy="50%" innerRadius={40} outerRadius={70} dataKey="value" stroke="none">
                          {stats.statusData.map((e, i) => <Cell key={i} fill={e.color} />)}
                        </Pie><Tooltip contentStyle={{ background: "#1a1a1a", border: "1px solid #333", borderRadius: "8px", fontSize: "11px" }} /></PieChart>
                      </ResponsiveContainer>
                      <div className="space-y-1.5 mt-2">
                        {stats.statusData.map((item) => (
                          <div key={item.name} className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full shrink-0" style={{ background: item.color }} />
                            <span className="text-[10px] text-neutral-400">{item.name}</span>
                            <span className="text-[10px] text-white font-bold ml-auto">{item.value}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : <p className="text-neutral-600 text-sm text-center py-12">No requests yet.</p>}
                </div>

                {/* Recent inspections */}
                <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6">
                  <h3 className="text-sm font-bold text-white uppercase tracking-widest mb-5 flex items-center gap-2">
                    <ClipboardCheck className="w-4 h-4 text-emerald-500" /> Recent QC Reports
                  </h3>
                  <div className="space-y-2.5">
                    {reports.slice(0, 6).map((r) => (
                      <div key={r.id} className="p-3 bg-neutral-800/30 rounded-xl border border-neutral-800/50 flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-white">{r.report_date}</p>
                          <p className="text-[10px] text-neutral-500 mt-0.5">
                            {r.data?.inspections?.length ?? 0} inspections · {r.data?.nonConformity?.length ?? 0} NCR
                            {r.ai_filled && <span className="ml-1.5 text-violet-400">✦ AI</span>}
                          </p>
                        </div>
                        <p className="text-[10px] text-neutral-600">{r.author_name}</p>
                      </div>
                    ))}
                    {reports.length === 0 && <p className="text-neutral-600 text-sm text-center py-8">No QC reports.</p>}
                  </div>
                </div>
              </div>
            </>
          ) : (
            /* File browser */
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6">
              {/* Breadcrumb */}
              <div className="flex items-center gap-1.5 mb-5 text-xs">
                <button onClick={() => setCurrentFolderId(null)} className="text-neutral-400 hover:text-white cursor-pointer">Root</button>
                {breadcrumbs.map((b) => (
                  <span key={b.id} className="flex items-center gap-1.5">
                    <ChevronRight className="w-3 h-3 text-neutral-600" />
                    <button onClick={() => setCurrentFolderId(b.id)} className="text-neutral-400 hover:text-white cursor-pointer">{b.name}</button>
                  </span>
                ))}
              </div>
              {/* Folders */}
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-4">
                {currentSubfolders.map((f) => (
                  <button key={f.id} onClick={() => setCurrentFolderId(f.id)}
                    className="p-4 bg-neutral-800/40 border border-neutral-800 rounded-xl hover:border-neutral-700 transition-colors text-center cursor-pointer">
                    <FolderOpen className="w-8 h-8 text-amber-500 mx-auto mb-2" />
                    <p className="text-xs font-semibold text-white truncate">{f.name}</p>
                  </button>
                ))}
              </div>
              {/* Files */}
              <div className="space-y-2">
                {currentFiles.map((f) => (
                  <div key={f.id} className="flex items-center gap-3 p-3 bg-neutral-800/20 rounded-xl border border-neutral-800/30">
                    <FileText className="w-5 h-5 text-neutral-500 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-white truncate">{f.name}</p>
                      <p className="text-[10px] text-neutral-600">{f.uploaded_by_name} · {f.mime_type} · {((f.size_bytes ?? 0) / 1024).toFixed(0)} KB</p>
                    </div>
                  </div>
                ))}
                {currentSubfolders.length === 0 && currentFiles.length === 0 && (
                  <p className="text-neutral-600 text-sm text-center py-12">Folder kosong.</p>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
