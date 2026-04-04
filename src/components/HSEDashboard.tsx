import React from 'react';
import { Project, DailyReport } from '../types';
import { motion } from 'framer-motion';
import { 
  ShieldCheck, 
  Users, 
  FileText, 
  AlertCircle,
  Download,
  Calendar,
  TrendingUp,
  Activity
} from 'lucide-react';
import { format } from 'date-fns';
import { generateHSESummaryReport } from '../services/pdfService';

interface HSEDashboardProps {
  project: Project;
  reports: DailyReport[];
}

export default function HSEDashboard({ project, reports }: HSEDashboardProps) {
  const hseReports = reports.filter(r => r.discipline === 'HSE' && r.status === 'Submitted');

  const stats = React.useMemo(() => {
    const totalMH = hseReports.reduce((acc, r) => {
      try {
        const data = JSON.parse(r.data);
        return acc + (data.manhours?.total || 0);
      } catch(e) { return acc; }
    }, 0);

    const openPermits = hseReports.filter(r => {
      try {
        return JSON.parse(r.data).permitStatus === 'Open';
      } catch(e) { return false; }
    }).length;

    const swoCount = hseReports.filter(r => {
      try {
        return JSON.parse(r.data).stopWorkOrder?.number;
      } catch(e) { return false; }
    }).length;

    const healthIssues = hseReports.reduce((acc, r) => {
      try {
        const hs = JSON.parse(r.data).healthStatus;
        return acc + (hs?.directSick || 0) + (hs?.indirectSick || 0);
      } catch(e) { return acc; }
    }, 0);

    return { totalMH, openPermits, swoCount, healthIssues };
  }, [hseReports]);

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white uppercase tracking-tight">HSE Dashboard</h2>
          <p className="text-neutral-500 text-sm font-mono">Safety Performance & Compliance Tracking</p>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => generateHSESummaryReport(project, reports)}
            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl flex items-center gap-2 transition-colors text-sm font-bold uppercase tracking-wider shadow-[0_0_15px_rgba(16,185,129,0.2)]"
          >
            <Download className="w-4 h-4" />
            Download Summary PDF
          </button>
          <div className="px-4 py-2 bg-neutral-900 border border-neutral-800 rounded-xl flex items-center gap-3">
            <Calendar className="w-4 h-4 text-emerald-500" />
            <span className="text-xs font-bold text-neutral-300 uppercase tracking-wider">
              {format(new Date(), 'MMMM dd, yyyy')}
            </span>
          </div>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Total Manhours" 
          value={stats.totalMH.toLocaleString()} 
          icon={<Users className="text-orange-500" />} 
          subtitle="Safe hours recorded"
        />
        <StatCard 
          title="Open Permits" 
          value={stats.openPermits.toString()} 
          icon={<FileText className="text-blue-500" />} 
          subtitle="Active work permits"
        />
        <StatCard 
          title="Stop Work Orders" 
          value={stats.swoCount.toString()} 
          icon={<AlertCircle className="text-red-500" />} 
          subtitle="Safety violations"
        />
        <StatCard 
          title="Health Issues" 
          value={stats.healthIssues.toString()} 
          icon={<ShieldCheck className="text-emerald-500" />} 
          subtitle="Total sick cases"
        />
      </div>

      {/* Detailed Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-8">
          <div className="flex items-center gap-3 mb-8">
            <Activity className="w-5 h-5 text-emerald-500" />
            <h3 className="text-lg font-bold text-white uppercase tracking-widest">Recent Observations</h3>
          </div>
          <div className="space-y-4">
            {hseReports.slice(0, 5).map((report, idx) => {
              const data = JSON.parse(report.data);
              return (
                <div key={idx} className="p-4 bg-neutral-800/30 rounded-2xl border border-neutral-800/50 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-white">Report Date: {report.date}</p>
                    <p className="text-[10px] text-neutral-500 font-mono uppercase">Permit: {data.permitStatus} | SWO: {data.stopWorkOrder?.number || 'None'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-emerald-500">{data.manhours?.total || 0} MH</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-8">
          <div className="flex items-center gap-3 mb-8">
            <TrendingUp className="w-5 h-5 text-blue-500" />
            <h3 className="text-lg font-bold text-white uppercase tracking-widest">Safety Compliance</h3>
          </div>
          <div className="space-y-6">
            <div className="p-6 bg-blue-500/5 border border-blue-500/10 rounded-2xl">
              <p className="text-xs font-bold text-blue-400 mb-2 uppercase">Permit Compliance</p>
              <div className="h-2 bg-neutral-800 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 w-[95%]" />
              </div>
              <p className="mt-2 text-[10px] text-neutral-500">95% of active works have valid permits</p>
            </div>
            <div className="p-6 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl">
              <p className="text-xs font-bold text-emerald-400 mb-2 uppercase">Health Status</p>
              <div className="h-2 bg-neutral-800 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 w-[98%]" />
              </div>
              <p className="mt-2 text-[10px] text-neutral-500">98% workforce health availability</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon, subtitle }: { title: string, value: string, icon: any, subtitle: string }) {
  return (
    <div className="p-6 bg-neutral-900 border border-neutral-800 rounded-2xl hover:border-neutral-700 transition-all group">
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs font-mono text-neutral-500 uppercase tracking-widest">{title}</p>
        <div className="p-2 bg-neutral-800 rounded-lg group-hover:scale-110 transition-transform">
          {icon}
        </div>
      </div>
      <p className="text-3xl font-bold text-white mb-1">{value}</p>
      <p className="text-[10px] text-neutral-600 uppercase tracking-wider">{subtitle}</p>
    </div>
  );
}
