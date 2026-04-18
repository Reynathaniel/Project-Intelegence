"use client";
import { useEffect, useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/components/auth/user-provider";
import { DashboardHeader, StatCard, EmptyState, LoadingSpinner } from "@/components/shared/dashboard-ui";
import { HardHat, Users, TrendingUp, Activity, MapPin, Wrench, AlertCircle } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

interface Report {
  id: string; report_date: string; author_name: string;
  data: any; status: string; ai_filled: boolean; ai_confidence: string | null;
}

const DISCIPLINE_COLORS: Record<string, string> = {
  Mechanical: "#F59E0B", Piping: "#3B82F6", Electrical: "#10B981",
  Instrument: "#8B5CF6", Civil: "#EF4444",
};

export default function SupervisorDashboardPage() {
  const { currentOrgId } = useUser();
  const supabase = createClient();
  const [projectId, setProjectId] = useState<string | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!projectId) return;
    setLoading(true);
    const load = async () => {
      const { data } = await supabase.from("daily_reports")
        .select("id, report_date, author_name, data, status, ai_filled, ai_confidence")
        .eq("project_id", projectId).eq("discipline", "Supervisor").eq("status", "Submitted")
        .is("deleted_at", null).order("report_date", { ascending: false }).limit(60);
      setReports(data ?? []); setLoading(false);
    };
    load();
    const ch = supabase.channel(`sup-${projectId}`).on("postgres_changes",
      { event: "*", schema: "public", table: "daily_reports", filter: `project_id=eq.${projectId}` },
      () => load()).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [projectId]);

  const stats = useMemo(() => {
    let totalActivities = 0, totalManpower = 0, avgProgress = 0, totalProgress = 0;
    const disciplineCount: Record<string, number> = {};
    const areaProgress: Record<string, { progress: number; count: number }> = {};

    reports.forEach((r) => {
      const acts = r.data?.activities ?? [];
      totalActivities += acts.length;
      acts.forEach((a: any) => {
        totalManpower += Number(a.manpowerDirect) || 0;
        totalProgress += Number(a.progress) || 0;
        disciplineCount[a.discipline] = (disciplineCount[a.discipline] ?? 0) + 1;
        if (a.area) {
          if (!areaProgress[a.area]) areaProgress[a.area] = { progress: 0, count: 0 };
          areaProgress[a.area].progress += Number(a.progress) || 0;
          areaProgress[a.area].count += 1;
        }
      });
    });

    avgProgress = totalActivities > 0 ? totalProgress / totalActivities : 0;

    const discData = Object.entries(disciplineCount).map(([name, value]) => ({
      name, value, color: DISCIPLINE_COLORS[name] ?? "#6B7280"
    }));

    const areaData = Object.entries(areaProgress)
      .map(([name, { progress, count }]) => ({ name, avg: progress / count }))
      .sort((a, b) => b.avg - a.avg).slice(0, 8);

    return { totalActivities, totalManpower, avgProgress, reportCount: reports.length, discData, areaData };
  }, [reports]);

  const recentActivities = useMemo(() => {
    const all: any[] = [];
    reports.slice(0, 10).forEach((r) => {
      (r.data?.activities ?? []).forEach((a: any) => {
        all.push({ ...a, date: r.report_date, author: r.author_name, reportId: r.id });
      });
    });
    return all.slice(0, 15);
  }, [reports]);

  return (
    <div className="p-6 lg:p-8 max-w-7xl space-y-6">
      <DashboardHeader title="Supervisor Activity" subtitle="Work Progress & Field Operations Tracking"
        icon={HardHat} iconColor="text-orange-500" projectId={projectId} onProjectChange={setProjectId} />

      {loading ? <LoadingSpinner /> : !projectId || reports.length === 0 ? (
        <EmptyState icon={HardHat} title="Supervisor Activity" description={!projectId ? "Pilih project dulu." : "Belum ada laporan Supervisor."} />
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard title="Total Activities" value={stats.totalActivities.toString()} icon={<Activity className="w-5 h-5" />} subtitle={`${stats.reportCount} reports`} color="orange" />
            <StatCard title="Manpower Direct" value={stats.totalManpower.toLocaleString()} icon={<Users className="w-5 h-5" />} subtitle="Cumulative" color="emerald" />
            <StatCard title="Avg Progress" value={`${stats.avgProgress.toFixed(1)}%`} icon={<TrendingUp className="w-5 h-5" />} subtitle="Per activity" color="blue" />
            <StatCard title="Work Areas" value={stats.areaData.length.toString()} icon={<MapPin className="w-5 h-5" />} subtitle="Active zones" color="violet" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-neutral-900 border border-neutral-800 rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-5">
                <MapPin className="w-4 h-4 text-orange-500" />
                <h3 className="text-sm font-bold text-white uppercase tracking-widest">Progress by Area</h3>
              </div>
              {stats.areaData.length > 0 ? (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={stats.areaData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                    <XAxis type="number" tick={{ fill: "#666", fontSize: 10 }} axisLine={{ stroke: "#333" }} domain={[0, 100]} />
                    <YAxis dataKey="name" type="category" tick={{ fill: "#999", fontSize: 10 }} axisLine={{ stroke: "#333" }} width={80} />
                    <Tooltip contentStyle={{ background: "#1a1a1a", border: "1px solid #333", borderRadius: "8px", fontSize: "11px" }} />
                    <Bar dataKey="avg" fill="#F59E0B" radius={[0, 4, 4, 0]} name="Avg %" />
                  </BarChart>
                </ResponsiveContainer>
              ) : <p className="text-neutral-600 text-sm text-center py-16">No area data.</p>}
            </div>

            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-5">
                <Wrench className="w-4 h-4 text-blue-500" />
                <h3 className="text-sm font-bold text-white uppercase tracking-widest">By Discipline</h3>
              </div>
              {stats.discData.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie data={stats.discData} cx="50%" cy="50%" innerRadius={40} outerRadius={70} dataKey="value" stroke="none">
                        {stats.discData.map((e, i) => <Cell key={i} fill={e.color} />)}
                      </Pie>
                      <Tooltip contentStyle={{ background: "#1a1a1a", border: "1px solid #333", borderRadius: "8px", fontSize: "11px" }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-1.5 mt-2">
                    {stats.discData.map((item) => (
                      <div key={item.name} className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full shrink-0" style={{ background: item.color }} />
                        <span className="text-[11px] text-neutral-400">{item.name}</span>
                        <span className="text-[11px] text-white font-bold ml-auto">{item.value}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : <p className="text-neutral-600 text-sm text-center py-16">No data.</p>}
            </div>
          </div>

          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-5">
              <Activity className="w-4 h-4 text-emerald-500" />
              <h3 className="text-sm font-bold text-white uppercase tracking-widest">Recent Activities</h3>
            </div>
            <div className="space-y-2">
              {recentActivities.map((a, i) => (
                <div key={i} className="p-3.5 bg-neutral-800/30 rounded-xl border border-neutral-800/50 grid grid-cols-1 md:grid-cols-4 gap-3 items-center">
                  <div className="md:col-span-2">
                    <p className="text-sm font-semibold text-white">{a.workItem || "Untitled Activity"}</p>
                    <p className="text-[10px] text-neutral-500 mt-0.5">
                      <span className="inline-block px-1.5 py-0.5 rounded-full mr-1" style={{ background: (DISCIPLINE_COLORS[a.discipline] ?? "#666") + "20", color: DISCIPLINE_COLORS[a.discipline] ?? "#999" }}>
                        {a.discipline}
                      </span>
                      {a.area} · {a.location}
                    </p>
                  </div>
                  <div className="text-left md:text-center">
                    <p className="text-xs font-bold text-white">{a.progress}%{a.unit ? ` ${a.unit}` : ""}</p>
                    <p className="text-[9px] text-neutral-500">progress</p>
                  </div>
                  <div className="text-left md:text-right">
                    <p className="text-[10px] text-neutral-400"><Users className="w-3 h-3 inline mr-1" />{a.manpowerDirect} MP</p>
                    <p className="text-[9px] text-neutral-600 mt-0.5">{a.date} · {a.author}</p>
                  </div>
                  {a.assistanceNeeded && (
                    <div className="md:col-span-4 p-2 bg-amber-500/5 border border-amber-500/10 rounded-lg text-[11px] text-amber-400 flex items-start gap-2">
                      <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />
                      <span>Butuh bantuan: {a.assistanceNeeded}</span>
                    </div>
                  )}
                </div>
              ))}
              {recentActivities.length === 0 && <p className="text-neutral-600 text-sm text-center py-8">No activities.</p>}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
