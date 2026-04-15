import React, { useMemo } from 'react';
import { Project, DailyReport, HRPersonnel } from '../types';
import { motion } from 'motion/react';
import { 
  Users, 
  UserCheck, 
  UserMinus, 
  MapPin, 
  AlertTriangle, 
  Calendar, 
  ShieldAlert,
  TrendingUp,
  TrendingDown,
  Clock
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { format, isBefore, addDays, parseISO, differenceInDays } from 'date-fns';

interface HRDashboardProps {
  project: Project;
  reports: DailyReport[];
}

export default function HRDashboard({ project, reports }: HRDashboardProps) {
  const hrReports = useMemo(() => 
    reports.filter(r => r.discipline === 'HR' && r.status === 'Submitted')
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  , [reports]);

  const latestReport = hrReports[hrReports.length - 1];
  const latestData = latestReport ? JSON.parse(latestReport.data) : { personnelList: [] };
  const personnel: HRPersonnel[] = latestData.personnelList || [];

  const stats = useMemo(() => {
    const active = personnel.filter(p => p.activeStatus === 'Active').length;
    const resigned = personnel.filter(p => p.activeStatus === 'Resign').length;
    const onSite = personnel.filter(p => p.siteStatus === 'On Site' && p.activeStatus === 'Active').length;
    const offSite = personnel.filter(p => p.siteStatus === 'Off Site' && p.activeStatus === 'Active').length;
    const direct = personnel.filter(p => p.classification === 'Direct' && p.activeStatus === 'Active').length;
    const indirect = personnel.filter(p => p.classification === 'Indirect' && p.activeStatus === 'Active').length;

    return { active, resigned, onSite, offSite, direct, indirect, total: active };
  }, [personnel]);

  const chartData = useMemo(() => {
    return hrReports.map(r => {
      const data = JSON.parse(r.data);
      const pList = data.personnelList || [];
      return {
        date: format(parseISO(r.date), 'dd MMM'),
        total: pList.filter((p: any) => p.activeStatus === 'Active').length,
        onSite: pList.filter((p: any) => p.activeStatus === 'Active' && p.siteStatus === 'On Site').length,
      };
    });
  }, [hrReports]);

  const warnings = useMemo(() => {
    const today = new Date();
    const threshold = addDays(today, 30);
    const list: { type: string; name: string; date: string; daysLeft: number; icon: any; color: string }[] = [];

    personnel.filter(p => p.activeStatus === 'Active').forEach(p => {
      // MCU Expiry
      if (p.mcuExpiry) {
        const expiry = parseISO(p.mcuExpiry);
        if (isBefore(expiry, threshold)) {
          list.push({
            type: 'MCU Expiring',
            name: p.name,
            date: p.mcuExpiry,
            daysLeft: differenceInDays(expiry, today),
            icon: <ShieldAlert className="w-4 h-4" />,
            color: isBefore(expiry, today) ? 'text-red-500' : 'text-orange-500'
          });
        }
      }

      // Contract End
      if (p.contractEnd) {
        const expiry = parseISO(p.contractEnd);
        if (isBefore(expiry, threshold)) {
          list.push({
            type: 'Contract Ending',
            name: p.name,
            date: p.contractEnd,
            daysLeft: differenceInDays(expiry, today),
            icon: <Calendar className="w-4 h-4" />,
            color: isBefore(expiry, today) ? 'text-red-500' : 'text-orange-500'
          });
        }
      }

      // Entry Permit Expiry
      if (p.entryPermitExpiry) {
        const expiry = parseISO(p.entryPermitExpiry);
        if (isBefore(expiry, threshold)) {
          list.push({
            type: 'Permit Expiring',
            name: p.name,
            date: p.entryPermitExpiry,
            daysLeft: differenceInDays(expiry, today),
            icon: <AlertTriangle className="w-4 h-4" />,
            color: isBefore(expiry, today) ? 'text-red-500' : 'text-orange-500'
          });
        }
      }

      // Leave Approaching
      if (p.leaveStart) {
        const start = parseISO(p.leaveStart);
        if (isBefore(start, threshold) && !isBefore(start, today)) {
          list.push({
            type: 'Upcoming Leave',
            name: p.name,
            date: p.leaveStart,
            daysLeft: differenceInDays(start, today),
            icon: <Clock className="w-4 h-4" />,
            color: 'text-blue-500'
          });
        }
      }
    });

    return list.sort((a, b) => a.daysLeft - b.daysLeft);
  }, [personnel]);

  const trend = useMemo(() => {
    if (chartData.length < 2) return { value: 0, isUp: true };
    const latest = chartData[chartData.length - 1].total;
    const previous = chartData[chartData.length - 2].total;
    const diff = latest - previous;
    return {
      value: Math.abs(diff),
      isUp: diff >= 0
    };
  }, [chartData]);

  return (
    <div className="space-y-8">
      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Total Active Personnel" 
          value={stats.active} 
          icon={<Users className="text-emerald-500" />}
          trend={trend}
        />
        <StatCard 
          title="On Site" 
          value={stats.onSite} 
          icon={<MapPin className="text-blue-500" />}
        />
        <StatCard 
          title="Direct / Indirect" 
          value={`${stats.direct} / ${stats.indirect}`} 
          icon={<UserCheck className="text-purple-500" />}
        />
        <StatCard 
          title="Resigned (Total)" 
          value={stats.resigned} 
          icon={<UserMinus className="text-red-500" />}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Trends Graph */}
        <div className="lg:col-span-2 bg-neutral-900 border border-neutral-800 rounded-3xl p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white uppercase tracking-widest flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-500" />
              Personnel Trends
            </h3>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%" minHeight={300}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#262626" vertical={false} />
                <XAxis 
                  dataKey="date" 
                  stroke="#525252" 
                  fontSize={10} 
                  tickLine={false} 
                  axisLine={false} 
                />
                <YAxis 
                  stroke="#525252" 
                  fontSize={10} 
                  tickLine={false} 
                  axisLine={false} 
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#171717', border: '1px solid #262626', borderRadius: '12px' }}
                  itemStyle={{ color: '#fff', fontSize: '12px' }}
                />
                <Area 
                  type="monotone" 
                  dataKey="total" 
                  stroke="#10b981" 
                  fillOpacity={1} 
                  fill="url(#colorTotal)" 
                  strokeWidth={2}
                />
                <Area 
                  type="monotone" 
                  dataKey="onSite" 
                  stroke="#3b82f6" 
                  fill="transparent" 
                  strokeWidth={2}
                  strokeDasharray="5 5"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Warnings Panel */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 space-y-6">
          <h3 className="text-sm font-bold text-white uppercase tracking-widest flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-orange-500" />
            Expiry Warnings
          </h3>
          <div className="space-y-4 max-h-[calc(100dvh-25rem)] overflow-y-auto pr-2 custom-scrollbar">
            {warnings.length > 0 ? (
              warnings.map((warning, i) => (
                <div key={i} className="p-4 bg-neutral-800/50 border border-neutral-700 rounded-xl flex items-center gap-4 group hover:border-neutral-600 transition-all">
                  <div className={`p-2 rounded-lg bg-neutral-900 ${warning.color}`}>
                    {warning.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-white truncate">{warning.name}</p>
                    <p className="text-[10px] text-neutral-500 uppercase tracking-widest">{warning.type}</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-[10px] font-bold ${warning.color}`}>
                      {warning.daysLeft < 0 ? 'EXPIRED' : `${warning.daysLeft} DAYS`}
                    </p>
                    <p className="text-[9px] text-neutral-600 font-mono">{warning.date}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-10">
                <ShieldAlert className="w-12 h-12 text-neutral-800 mx-auto mb-4" />
                <p className="text-xs text-neutral-500 uppercase tracking-widest">No immediate warnings</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon, trend }: any) {
  return (
    <div className="p-6 bg-neutral-900 border border-neutral-800 rounded-2xl hover:border-neutral-700 transition-all group">
      <div className="flex items-center justify-between mb-4">
        <p className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest">{title}</p>
        <div className="p-2 bg-neutral-800 rounded-lg group-hover:scale-110 transition-transform">
          {icon}
        </div>
      </div>
      <div className="flex items-end justify-between">
        <p className="text-3xl font-bold text-white">{value}</p>
        {trend && (
          <div className={`flex items-center gap-1 text-[10px] font-bold ${trend.isUp ? 'text-emerald-500' : 'text-red-500'}`}>
            {trend.isUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {trend.value}
          </div>
        )}
      </div>
    </div>
  );
}
