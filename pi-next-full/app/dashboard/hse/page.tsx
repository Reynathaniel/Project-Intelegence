"use client";

import { useEffect, useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/components/auth/user-provider";
import {
  ShieldCheck, Users, FileText, AlertCircle, Calendar,
  TrendingUp, Activity, Heart, AlertTriangle, Clock, ChevronDown,
} from "lucide-react";
import { format } from "date-fns";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";

interface DailyReport {
  id: string;
  project_id: string;
  report_date: string;
  author_name: string;
  data: Record<string, any>;
  hse_metrics: Record<string, any> | null;
  status: string;
  ai_filled: boolean;
  ai_confidence: string | null;
}

interface Project { id: string; name: string; location: string | null; }

export default function HSEDashboardPage() {
  const { currentOrgId } = useUser();
  const supabase = createClient();
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // Load projects
  useEffect(() => {
    if (!currentOrgId) return;
    (async () => {
      const { data } = await supabase
        .from("projects").select("id, name, location")
        .eq("org_id", currentOrgId).eq("status", "Active")
        .is("deleted_at", null).order("name");
      setProjects(data ?? []);
      if (data?.length && !selectedProjectId) setSelectedProjectId(data[0].id);
    })();
  }, [currentOrgId]);

  // Load HSE reports + realtime
  useEffect(() => {
    if (!selectedProjectId) return;
    setLoading(true);
    const load = async () => {
      const { data } = await supabase
        .from("daily_reports")
        .select("id, project_id, report_date, author_name, data, hse_metrics, status, ai_filled, ai_confidence")
        .eq("project_id", selectedProjectId).eq("discipline", "HSE").eq("status", "Submitted")
        .is("deleted_at", null).order("report_date", { ascending: false }).limit(90);
      setReports(data ?? []);
      setLoading(false);
    };
    load();
    const ch = supabase.channel(`hse-${selectedProjectId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "daily_reports", filter: `project_id=eq.${selectedProjectId}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [selectedProjectId]);

  const proj = projects.find((p) => p.id === selectedProjectId);

  // Stats
  const stats = useMemo(() => {
    let totalMH=0, totalManDay=0, openPermits=0, swoCount=0, healthIssues=0, totalInjuries=0;
    let safetyInduction=0, toolboxMeeting=0, safetyPatrol=0, unsafeAction=0, unsafeCondition=0, nearMiss=0, accident=0;
    reports.forEach((r) => {
      const d = r.data; if (!d) return;
      totalMH += d.manhours?.total ?? 0;
      totalManDay += d.manhours?.totalManDay ?? 0;
      if (d.permits) openPermits += d.permits.filter((p: any) => p.status === "Open").length;
      swoCount += d.stopWorkOrders?.length ?? 0;
      const hs = d.healthStatus;
      if (hs) healthIssues += (hs.directSick ?? 0) + (hs.indirectSick ?? 0);
      if (d.safetyStats) totalInjuries += d.safetyStats.noOfInjury ?? 0;
      const m = r.hse_metrics ?? d;
      safetyInduction += m.safetyInduction ?? 0;
      toolboxMeeting += m.toolboxMeeting ?? 0;
      safetyPatrol += m.safetyPatrol ?? 0;
      unsafeAction += m.unsafeAction ?? 0;
      unsafeCondition += m.unsafeCondition ?? 0;
      nearMiss += m.nearMiss ?? 0;
      accident += m.accident ?? 0;
    });
    return { totalMH, totalManDay, openPermits, swoCount, healthIssues, totalInjuries, safetyInduction, toolboxMeeting, safetyPatrol, unsafeAction, unsafeCondition, nearMiss, accident, reportCount: reports.length };
  }, [reports]);

  // Charts data
  const manhoursTrend = useMemo(() =>
    reports.slice(0, 14).reverse().map((r) => ({
      date: r.report_date.slice(5),
      manhours: r.data?.manhours?.total ?? 0,
      direct: r.data?.manhours?.direct ?? 0,
    })), [reports]);

  const pieData = useMemo(() => [
    { name: "Induction", value: stats.safetyInduction, color: "#10B981" },
    { name: "Toolbox", value: stats.toolboxMeeting, color: "#3B82F6" },
    { name: "Patrol", value: stats.safetyPatrol, color: "#8B5CF6" },
    { name: "Unsafe Act", value: stats.unsafeAction, color: "#F59E0B" },
    { name: "Unsafe Cond", value: stats.unsafeCondition, color: "#EF4444" },
    { name: "Near Miss", value: stats.nearMiss, color: "#EC4899" },
    { name: "Accident", value: stats.accident, color: "#DC2626" },
  ].filter((i) => i.value > 0), [stats]);

  // RENDER
  return (
    <div className="p-6 lg:p-8 max-w-7xl space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white uppercase tracking-tight flex items-center gap-3">
            <ShieldCheck className="w-7 h-7 text-emerald-500" /> HSE Dashboard
          </h1>
          <p className="text-neutral-500 text-sm font-mono mt-1">Safety Performance & Compliance Tracking</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {/* Project selector */}
          <div className="relative">
            <button onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-2 px-4 py-2 bg-neutral-900 border border-neutral-800 rounded-xl text-xs font-bold text-neutral-300 hover:border-neutral-700 transition-colors cursor-pointer">
              <Activity className="w-4 h-4 text-emerald-500" />
              {proj?.name ?? "Select Project"}
              <ChevronDown className={`w-3.5 h-3.5 text-neutral-500 transition-transform ${dropdownOpen ? "rotate-180" : ""}`} />
            </button>
            {dropdownOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setDropdownOpen(false)} />
                <div className="absolute right-0 mt-1 w-64 bg-neutral-800 border border-neutral-700 rounded-xl overflow-hidden shadow-xl z-20">
                  {projects.map((p) => (
                    <button key={p.id} onClick={() => { setSelectedProjectId(p.id); setDropdownOpen(false); }}
                      className={`w-full text-left px-4 py-2.5 text-xs hover:bg-neutral-700 transition-colors cursor-pointer ${p.id === selectedProjectId ? "text-emerald-400 bg-emerald-500/5" : "text-neutral-400"}`}>
                      <span className="font-semibold">{p.name}</span>
                      {p.location && <span className="block text-[10px] text-neutral-600 mt-0.5">{p.location}</span>}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          <div className="px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-xl flex items-center gap-2">
            <Calendar className="w-3.5 h-3.5 text-emerald-500" />
            <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">{format(new Date(), "dd MMM yyyy")}</span>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><div className="w-8 h-8 pi-spinner" /></div>
      ) : !selectedProjectId || reports.length === 0 ? (
        <div className="border border-dashed border-neutral-800 rounded-2xl p-16 text-center">
          <ShieldCheck className="w-12 h-12 text-neutral-700 mx-auto mb-4" />
          <h3 className="text-white font-bold text-lg mb-1">HSE Dashboard</h3>
          <p className="text-neutral-500 text-sm">{!selectedProjectId ? "Pilih project untuk melihat HSE data." : "Belum ada laporan HSE submitted."}</p>
        </div>
      ) : (
        <>
          {/* Stat Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard title="Total Manhours" value={stats.totalMH.toLocaleString()} icon={<Clock className="w-5 h-5" />} subtitle={`${stats.totalManDay.toLocaleString()} man-days`} color="orange" />
            <StatCard title="Open Permits" value={stats.openPermits.toString()} icon={<FileText className="w-5 h-5" />} subtitle={`${stats.reportCount} reports total`} color="blue" />
            <StatCard title="Stop Work Orders" value={stats.swoCount.toString()} icon={<AlertCircle className="w-5 h-5" />} subtitle="Safety violations" color="red" />
            <StatCard title="Health Issues" value={stats.healthIssues.toString()} icon={<Heart className="w-5 h-5" />} subtitle={`${stats.totalInjuries} injuries`} color="emerald" />
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-neutral-900 border border-neutral-800 rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-6">
                <TrendingUp className="w-4 h-4 text-emerald-500" />
                <h3 className="text-sm font-bold text-white uppercase tracking-widest">Manhours Trend</h3>
              </div>
              {manhoursTrend.length > 1 ? (
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart data={manhoursTrend}>
                    <defs>
                      <linearGradient id="mhG" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                    <XAxis dataKey="date" tick={{ fill: "#666", fontSize: 10 }} axisLine={{ stroke: "#333" }} />
                    <YAxis tick={{ fill: "#666", fontSize: 10 }} axisLine={{ stroke: "#333" }} />
                    <Tooltip contentStyle={{ background: "#1a1a1a", border: "1px solid #333", borderRadius: "8px", fontSize: "11px" }} />
                    <Area type="monotone" dataKey="manhours" stroke="#10B981" fill="url(#mhG)" strokeWidth={2} name="Total MH" />
                    <Area type="monotone" dataKey="direct" stroke="#3B82F6" fill="none" strokeWidth={1.5} strokeDasharray="4 2" name="Direct" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : <p className="text-neutral-600 text-sm text-center py-16">Butuh minimal 2 report.</p>}
            </div>

            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-6">
                <ShieldCheck className="w-4 h-4 text-blue-500" />
                <h3 className="text-sm font-bold text-white uppercase tracking-widest">Safety Categories</h3>
              </div>
              {pieData.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart><Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={75} dataKey="value" stroke="none">
                      {pieData.map((e, i) => <Cell key={i} fill={e.color} />)}
                    </Pie><Tooltip contentStyle={{ background: "#1a1a1a", border: "1px solid #333", borderRadius: "8px", fontSize: "11px" }} /></PieChart>
                  </ResponsiveContainer>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mt-2">
                    {pieData.map((item) => (
                      <div key={item.name} className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full shrink-0" style={{ background: item.color }} />
                        <span className="text-[10px] text-neutral-500 truncate">{item.name}</span>
                        <span className="text-[10px] text-white font-bold ml-auto">{item.value}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : <p className="text-neutral-600 text-sm text-center py-16">No data.</p>}
            </div>
          </div>

          {/* Bottom: Observations + Compliance */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Observations */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-5">
                <Activity className="w-4 h-4 text-emerald-500" />
                <h3 className="text-sm font-bold text-white uppercase tracking-widest">Recent Observations</h3>
              </div>
              <div className="space-y-3">
                {reports.slice(0, 6).map((r) => {
                  const d = r.data;
                  const openC = d?.permits?.filter((p: any) => p.status === "Open").length ?? 0;
                  const totalP = d?.permits?.length ?? 0;
                  const swos = d?.stopWorkOrders?.map((s: any) => s.number).filter(Boolean).join(", ") || "None";
                  return (
                    <div key={r.id} className="p-3.5 bg-neutral-800/30 rounded-xl border border-neutral-800/50 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-white">{r.report_date}</p>
                        <p className="text-[10px] text-neutral-500 font-mono mt-0.5 truncate">Permits: {openC}/{totalP} open · SWO: {swos}</p>
                        <p className="text-[10px] text-neutral-600 mt-0.5">
                          by {r.author_name}
                          {r.ai_filled && <span className="ml-1.5 text-violet-400">✦ AI {r.ai_confidence}</span>}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs font-bold text-emerald-500">{(d?.manhours?.total ?? 0).toLocaleString()} MH</p>
                        {(d?.healthStatus?.directSick ?? 0) > 0 && <p className="text-[9px] text-red-400 mt-0.5">{d.healthStatus.directSick} sick</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Safety Compliance */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-5">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <h3 className="text-sm font-bold text-white uppercase tracking-widest">Safety Compliance</h3>
              </div>
              <div className="space-y-2">
                <CRow label="Safety Inductions" value={stats.safetyInduction} color="#10B981" />
                <CRow label="Toolbox Meetings" value={stats.toolboxMeeting} color="#3B82F6" />
                <CRow label="Safety Patrols" value={stats.safetyPatrol} color="#8B5CF6" />
                <CRow label="Unsafe Actions" value={stats.unsafeAction} color="#F59E0B" warn />
                <CRow label="Unsafe Conditions" value={stats.unsafeCondition} color="#EF4444" warn />
                <CRow label="Near Misses" value={stats.nearMiss} color="#EC4899" warn />
                <CRow label="Accidents" value={stats.accident} color="#DC2626" warn critical />
              </div>
              {stats.swoCount > 0 && (
                <div className="mt-5 pt-4 border-t border-neutral-800">
                  <p className="text-[10px] font-bold text-red-400 uppercase tracking-wider mb-3">Stop Work Orders ({stats.swoCount})</p>
                  {reports.filter((r) => r.data?.stopWorkOrders?.length > 0).slice(0, 3).map((r) =>
                    r.data.stopWorkOrders.map((swo: any, i: number) => (
                      <div key={`${r.id}-${i}`} className="p-2.5 bg-red-500/5 border border-red-500/10 rounded-lg mb-2 text-[11px]">
                        <span className="text-red-400 font-bold">{swo.type}: {swo.number}</span>
                        <span className="text-neutral-500 ml-2">{swo.cause}</span>
                        <span className="text-neutral-600 block mt-0.5">Impact: {swo.impact} · {r.report_date}</span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// Sub-components
function StatCard({ title, value, icon, subtitle, color }: { title: string; value: string; icon: React.ReactNode; subtitle: string; color: "orange"|"blue"|"red"|"emerald" }) {
  const c = { orange: "bg-orange-500/10 text-orange-500 border-orange-500/20", blue: "bg-blue-500/10 text-blue-500 border-blue-500/20", red: "bg-red-500/10 text-red-500 border-red-500/20", emerald: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" };
  return (
    <div className="p-4 bg-neutral-900/50 border border-neutral-800 rounded-2xl space-y-3">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${c[color]}`}>{icon}</div>
      <div>
        <p className="text-2xl font-bold text-white">{value}</p>
        <p className="text-[11px] text-neutral-400 font-medium mt-0.5">{title}</p>
        <p className="text-[10px] text-neutral-600 font-mono">{subtitle}</p>
      </div>
    </div>
  );
}

function CRow({ label, value, color, warn, critical }: { label: string; value: number; color: string; warn?: boolean; critical?: boolean }) {
  return (
    <div className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-neutral-800/30 transition-colors">
      <div className="flex items-center gap-2.5">
        <div className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
        <span className="text-xs text-neutral-400">{label}</span>
      </div>
      <span className={`text-sm font-bold ${critical && value > 0 ? "text-red-400" : warn && value > 0 ? "text-amber-400" : "text-white"}`}>{value}</span>
    </div>
  );
}
