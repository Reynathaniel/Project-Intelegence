import React, { useMemo } from 'react';
import { Project, DailyReport, SupervisorData } from '../types';
import { motion } from 'motion/react';
import { 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  Calendar,
  CheckCircle2,
  BarChart3,
  Users,
  AlertCircle,
  Truck,
  Download
} from 'lucide-react';
import { format, subDays, isSameDay, startOfDay, endOfDay } from 'date-fns';
import { generateSupervisorSummaryReport } from '../services/pdfService';

interface SupervisorDashboardProps {
  project: Project;
  reports: DailyReport[];
}

export default function SupervisorDashboard({ project, reports }: SupervisorDashboardProps) {
  const supervisorReports = useMemo(() => 
    reports
      .filter(r => r.discipline === 'Supervisor' && r.status === 'Submitted')
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [reports]
  );

  const stats = useMemo(() => {
    const today = new Date();
    const yesterday = subDays(today, 1);
    
    const parseReportData = (report?: DailyReport) => {
      if (!report) return { activities: [], totalManpower: 0, brokenEquipment: 0, totalHE: 0 };
      try {
        const data: SupervisorData = JSON.parse(report.data);
        const activities = data.activities || [];
        const totalManpower = activities.reduce((sum, act) => sum + (Number(act.manpowerDirect) || 0), 0);
        const brokenEquipment = activities.reduce((sum, act) => {
          const broken = act.brokenEquipment || [];
          return sum + broken.reduce((s: number, eq: any) => s + (Number(eq.count) || 0), 0);
        }, 0);
        const totalHE = activities.reduce((sum, act) => {
          const he = act.heavyEquipment || [];
          return sum + he.reduce((s: number, eq: any) => s + (Number(eq.count) || 0), 0);
        }, 0);
        return { activities, totalManpower, brokenEquipment, totalHE };
      } catch (e) {
        return { activities: [], totalManpower: 0, brokenEquipment: 0, totalHE: 0 };
      }
    };

    const unitStats: Record<string, { untilYesterday: number, today: number, untilToday: number, yesterday: number }> = {};
    
    // Process all reports to get cumulative data
    supervisorReports.forEach((report) => {
      const data = parseReportData(report);
      const reportDate = new Date(report.date);
      const isToday = isSameDay(reportDate, today);
      const isYesterday = isSameDay(reportDate, yesterday);
      const isBeforeToday = startOfDay(reportDate) < startOfDay(today);
      
      data.activities.forEach(act => {
        const unit = act.unit || 'nos';
        if (!unitStats[unit]) {
          unitStats[unit] = { untilYesterday: 0, today: 0, untilToday: 0, yesterday: 0 };
        }
        
        if (isToday) {
          unitStats[unit].today += Number(act.progress) || 0;
        }
        
        if (isYesterday) {
          unitStats[unit].yesterday += Number(act.progress) || 0;
        }

        if (isBeforeToday) {
          unitStats[unit].untilYesterday += Number(act.progress) || 0;
        }

        if (startOfDay(reportDate) <= startOfDay(today)) {
          unitStats[unit].untilToday += Number(act.progress) || 0;
        }
      });
    });

    const todayReport = supervisorReports.find(r => isSameDay(new Date(r.date), today)) || supervisorReports[0];
    const yesterdayReport = supervisorReports.find(r => isSameDay(new Date(r.date), yesterday));

    const todayData = parseReportData(todayReport);
    const yesterdayData = parseReportData(yesterdayReport);

    const unitSummaries = Object.entries(unitStats).map(([unit, s]) => ({
      unit,
      untilYesterday: s.untilYesterday,
      today: s.today,
      untilToday: s.untilToday,
      yesterday: s.yesterday,
      diff: s.today - s.yesterday
    })).sort((a, b) => b.untilToday - a.untilToday);

    const manpowerDiff = todayData.totalManpower - yesterdayData.totalManpower;
    const brokenDiff = todayData.brokenEquipment - yesterdayData.brokenEquipment;

    // Discipline-specific progress (cumulative until today)
    const disciplines = ['Civil', 'Mechanical', 'Piping', 'Electrical', 'Instrument'];
    const disciplineProgress = disciplines.map(disc => {
      const discActivities = [];
      // Find all activities for this discipline across all reports
      supervisorReports.forEach(r => {
        const d = parseReportData(r);
        discActivities.push(...d.activities.filter(act => act.discipline === disc));
      });

      const totalProgress = discActivities.reduce((sum, act) => sum + (Number(act.progress) || 0), 0);
      const unit = discActivities[0]?.unit || 'nos';
      return { name: disc, progress: totalProgress, unit };
    });

    return {
      unitSummaries,
      todayManpower: todayData.totalManpower,
      yesterdayManpower: yesterdayData.totalManpower,
      manpowerDiff,
      todayBroken: todayData.brokenEquipment,
      yesterdayBroken: yesterdayData.brokenEquipment,
      todayTotalHE: todayData.totalHE,
      brokenDiff,
      disciplineProgress,
      lastUpdated: todayReport?.date || 'No data',
      totalActivities: todayData.activities.length,
    };
  }, [supervisorReports]);

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white uppercase tracking-tight">Supervisor Dashboard</h2>
          <p className="text-neutral-500 text-sm font-mono">Performance Analysis & Progress Tracking</p>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => generateSupervisorSummaryReport(project, reports)}
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-6 bg-neutral-900 border border-neutral-800 rounded-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Users className="w-12 h-12 text-blue-500" />
          </div>
          <p className="text-xs font-mono text-neutral-500 uppercase tracking-widest mb-4">Total Manpower</p>
          <div className="flex items-end gap-2">
            <p className="text-4xl font-bold text-white">{stats.todayManpower}</p>
            <div className={`flex items-center gap-1 mb-1 text-sm font-bold ${stats.manpowerDiff >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
              {stats.manpowerDiff >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
              {Math.abs(stats.manpowerDiff)}
            </div>
          </div>
          <p className="mt-2 text-[10px] text-neutral-500 uppercase tracking-wider">Yesterday: {stats.yesterdayManpower}</p>
        </div>

        <div className="p-6 bg-neutral-900 border border-neutral-800 rounded-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Truck className="w-12 h-12 text-red-500" />
          </div>
          <p className="text-xs font-mono text-neutral-500 uppercase tracking-widest mb-4">Heavy Equipment</p>
          <div className="flex items-end gap-2">
            <p className="text-4xl font-bold text-white">{stats.todayTotalHE}</p>
            <div className={`flex items-center gap-1 mb-1 text-sm font-bold ${stats.brokenDiff <= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
              {stats.brokenDiff <= 0 ? <TrendingDown className="w-4 h-4" /> : <TrendingUp className="w-4 h-4" />}
              {Math.abs(stats.brokenDiff)}
            </div>
          </div>
          <p className="mt-2 text-[10px] text-neutral-500 uppercase tracking-wider">Total Units (Variance: {stats.brokenDiff})</p>
        </div>

        <div className="p-6 bg-neutral-900 border border-neutral-800 rounded-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <AlertCircle className="w-12 h-12 text-orange-500" />
          </div>
          <p className="text-xs font-mono text-neutral-500 uppercase tracking-widest mb-4">Broken Equipment</p>
          <div className="flex items-end gap-2">
            <p className="text-4xl font-bold text-white">{stats.todayBroken}</p>
            <div className={`flex items-center gap-1 mb-1 text-sm font-bold ${stats.brokenDiff <= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
              {stats.brokenDiff <= 0 ? <TrendingDown className="w-4 h-4" /> : <TrendingUp className="w-4 h-4" />}
              {Math.abs(stats.brokenDiff)}
            </div>
          </div>
          <p className="mt-2 text-[10px] text-neutral-500 uppercase tracking-wider">Variance vs Yesterday: {stats.yesterdayBroken}</p>
        </div>
      </div>

      {/* Unit Progress Summary */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Activity className="w-5 h-5 text-emerald-500" />
          <h3 className="font-bold text-white uppercase tracking-tight">Progress by Unit</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {stats.unitSummaries.map((s) => (
            <div key={s.unit} className="p-6 bg-neutral-900 border border-neutral-800 rounded-2xl space-y-6">
              <div className="flex items-center justify-between">
                <span className="px-3 py-1 bg-emerald-500/10 text-emerald-500 text-[10px] font-bold rounded-full border border-emerald-500/20 uppercase tracking-widest">
                  Unit: {s.unit}
                </span>
                <div className={`flex items-center gap-1 text-xs font-bold ${s.diff >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                  {s.diff >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  {Math.abs(s.diff).toFixed(1)}
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-end">
                  <div>
                    <p className="text-[10px] text-neutral-500 uppercase tracking-wider mb-1">Until Yesterday</p>
                    <p className="text-xl font-bold text-white">{s.untilYesterday.toFixed(1)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-neutral-500 uppercase tracking-wider mb-1">Today's Achievement</p>
                    <p className="text-xl font-bold text-emerald-500">+{s.today.toFixed(1)}</p>
                  </div>
                </div>

                <div className="pt-4 border-t border-neutral-800">
                  <div className="flex justify-between items-center mb-2">
                    <p className="text-[10px] text-neutral-400 uppercase tracking-widest font-bold">Total Progress Until Today</p>
                    <p className="text-lg font-bold text-white">{s.untilToday.toFixed(1)} <span className="text-xs text-neutral-500">{s.unit}</span></p>
                  </div>
                  <div className="h-2 bg-neutral-800 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(100, s.untilToday)}%` }}
                      className="h-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]"
                    />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Discipline Achievement */}
      <div className="p-8 bg-neutral-900 border border-neutral-800 rounded-2xl">
        <div className="flex items-center gap-3 mb-8">
          <BarChart3 className="w-5 h-5 text-purple-500" />
          <h3 className="font-bold text-white uppercase tracking-tight">Discipline Cumulative Achievement</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
          {stats.disciplineProgress.map((disc) => (
            <div key={disc.name}>
              <div className="flex justify-between mb-2">
                <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider">{disc.name}</span>
                <span className="text-xs font-mono text-purple-500">{disc.progress.toFixed(1)} {disc.unit}</span>
              </div>
              <div className="h-2 bg-neutral-800 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(100, disc.progress)}%` }}
                  className="h-full bg-purple-500"
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
