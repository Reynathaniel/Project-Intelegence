import React from 'react';
import { Project, DailyReport, UserProfile, UserRole } from '../types';
import { motion } from 'motion/react';
import { 
  Activity, 
  Users, 
  ShieldCheck, 
  AlertCircle, 
  TrendingUp, 
  TrendingDown,
  Clock,
  Briefcase,
  CheckCircle2
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell
} from 'recharts';

interface CommandCenterProps {
  projects: Project[];
  reports: DailyReport[];
  profile: UserProfile;
}

export default function CommandCenter({ projects, reports, profile }: CommandCenterProps) {
  const today = new Date().toISOString().split('T')[0];
  const todayReports = reports.filter(r => r.date === today);
  
  // Calculate high-level KPIs
  const activeProjects = projects.filter(p => p.status === 'Active').length;
  const totalManpower = todayReports.reduce((acc, r) => {
    try {
      const data = JSON.parse(r.data);
      if (r.discipline === 'Supervisor') {
        return acc + (data.activities?.reduce((sum: number, act: any) => sum + (Number(act.manpowerDirect) || 0), 0) || 0);
      }
      return acc;
    } catch (e) { return acc; }
  }, 0);

  const safetyIncidents = todayReports.reduce((acc, r) => {
    try {
      if (r.discipline === 'HSE') {
        const data = JSON.parse(r.data);
        return acc + (data.accident || 0) + (data.nearMiss || 0);
      }
      return acc;
    } catch (e) { return acc; }
  }, 0);

  const completionRate = 78; // Mock for now, would be calculated from project progress

  const chartData = [
    { name: 'Mon', manpower: 45, progress: 12 },
    { name: 'Tue', manpower: 52, progress: 15 },
    { name: 'Wed', manpower: 48, progress: 18 },
    { name: 'Thu', manpower: 61, progress: 22 },
    { name: 'Fri', manpower: 55, progress: 25 },
    { name: 'Sat', manpower: 30, progress: 28 },
    { name: 'Sun', manpower: 10, progress: 30 },
  ];

  return (
    <div className="space-y-8">
      {/* KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KpiCard 
          title="Active Sectors" 
          value={activeProjects.toString()} 
          change="+2" 
          trend="up" 
          icon={<Briefcase className="text-blue-500" />} 
        />
        <KpiCard 
          title="Total Manpower" 
          value={totalManpower.toString()} 
          change="+12%" 
          trend="up" 
          icon={<Users className="text-emerald-500" />} 
        />
        <KpiCard 
          title="Safety Index" 
          value={safetyIncidents === 0 ? "100%" : "92%"} 
          change="Stable" 
          trend="neutral" 
          icon={<ShieldCheck className="text-purple-500" />} 
        />
        <KpiCard 
          title="Avg. Progress" 
          value={`${completionRate}%`} 
          change="-2%" 
          trend="down" 
          icon={<Activity className="text-orange-500" />} 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Chart */}
        <div className="lg:col-span-2 bg-neutral-900 border border-neutral-800 rounded-3xl p-8 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-white uppercase tracking-tight">Manpower & Progress Intelligence</h3>
              <p className="text-xs text-neutral-500 font-mono uppercase tracking-widest">Weekly Performance Analytics</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-emerald-500 rounded-full" />
                <span className="text-[10px] font-mono text-neutral-400 uppercase">Manpower</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-blue-500 rounded-full" />
                <span className="text-[10px] font-mono text-neutral-400 uppercase">Progress</span>
              </div>
            </div>
          </div>
          
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorManpower" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorProgress" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#262626" vertical={false} />
                <XAxis 
                  dataKey="name" 
                  stroke="#525252" 
                  fontSize={10} 
                  tickLine={false} 
                  axisLine={false} 
                  dy={10}
                />
                <YAxis 
                  stroke="#525252" 
                  fontSize={10} 
                  tickLine={false} 
                  axisLine={false} 
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#171717', border: '1px solid #262626', borderRadius: '12px' }}
                  itemStyle={{ fontSize: '12px', fontWeight: 'bold' }}
                />
                <Area type="monotone" dataKey="manpower" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorManpower)" />
                <Area type="monotone" dataKey="progress" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorProgress)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent Alerts / Activity */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-8 space-y-6">
          <h3 className="text-lg font-bold text-white uppercase tracking-tight">Critical Alerts</h3>
          <div className="space-y-4">
            <AlertItem 
              type="danger" 
              title="Weather Warning" 
              message="Heavy rain expected at Sorong Site. Secure all loose materials." 
              time="2h ago" 
            />
            <AlertItem 
              type="warning" 
              title="Material Delay" 
              message="Cement delivery for Jakarta Project delayed by 24 hours." 
              time="4h ago" 
            />
            <AlertItem 
              type="success" 
              title="Milestone Achieved" 
              message="Foundation work for Warehouse B completed ahead of schedule." 
              time="6h ago" 
            />
            <AlertItem 
              type="info" 
              title="New Personnel" 
              message="3 new supervisors assigned to the East Sector." 
              time="8h ago" 
            />
          </div>
          <button className="w-full py-3 bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white rounded-xl text-xs font-bold transition-all uppercase tracking-widest">
            View All Intelligence
          </button>
        </div>
      </div>
    </div>
  );
}

function KpiCard({ title, value, change, trend, icon }: { title: string, value: string, change: string, trend: 'up' | 'down' | 'neutral', icon: React.ReactNode }) {
  return (
    <motion.div 
      whileHover={{ y: -5 }}
      className="bg-neutral-900 border border-neutral-800 p-6 rounded-3xl space-y-4 shadow-xl"
    >
      <div className="flex items-center justify-between">
        <div className="p-3 bg-neutral-950 border border-neutral-800 rounded-2xl">
          {icon}
        </div>
        <div className={`flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full ${
          trend === 'up' ? 'bg-emerald-500/10 text-emerald-500' : 
          trend === 'down' ? 'bg-red-500/10 text-red-500' : 
          'bg-neutral-800 text-neutral-400'
        }`}>
          {trend === 'up' && <TrendingUp className="w-3 h-3" />}
          {trend === 'down' && <TrendingDown className="w-3 h-3" />}
          {change}
        </div>
      </div>
      <div>
        <p className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest">{title}</p>
        <h4 className="text-3xl font-bold text-white tracking-tight">{value}</h4>
      </div>
    </motion.div>
  );
}

function AlertItem({ type, title, message, time }: { type: 'danger' | 'warning' | 'success' | 'info', title: string, message: string, time: string }) {
  const colors = {
    danger: 'border-red-500/20 bg-red-500/5 text-red-500',
    warning: 'border-orange-500/20 bg-orange-500/5 text-orange-500',
    success: 'border-emerald-500/20 bg-emerald-500/5 text-emerald-500',
    info: 'border-blue-500/20 bg-blue-500/5 text-blue-500',
  };

  return (
    <div className={`p-4 border rounded-2xl space-y-1 ${colors[type]}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-tight">{title}</span>
        <span className="text-[9px] font-mono opacity-60 uppercase">{time}</span>
      </div>
      <p className="text-[11px] leading-relaxed opacity-80">{message}</p>
    </div>
  );
}
