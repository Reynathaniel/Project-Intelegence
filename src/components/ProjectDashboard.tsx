import React, { useState, useMemo } from 'react';
import { Project, DailyReport, UserRole } from '../types';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LayoutDashboard, 
  Settings, 
  Plus, 
  ChevronRight, 
  Users, 
  ShieldCheck, 
  HardHat, 
  Truck, 
  ClipboardCheck, 
  Activity,
  BarChart3,
  PieChart as PieChartIcon,
  Eye,
  EyeOff
} from 'lucide-react';
import LogisticsDashboard from './LogisticsDashboard';
import SupervisorDashboard from './SupervisorDashboard';
import HSEDashboard from './HSEDashboard';
import HRDashboard from './HRDashboard';

interface ProjectDashboardProps {
  project: Project;
  reports: DailyReport[];
  onUpdateConfig?: (config: any) => void;
}

export default function ProjectDashboard({ project, reports, onUpdateConfig }: ProjectDashboardProps) {
  const [isConfiguring, setIsConfiguring] = useState(false);
  const [visibleWidgets, setVisibleWidgets] = useState<string[]>(
    project.dashboardConfig?.visibleWidgets || ['Logistics', 'Supervisor', 'HSE', 'HR']
  );

  const toggleWidget = (widget: string) => {
    const next = visibleWidgets.includes(widget)
      ? visibleWidgets.filter(w => w !== widget)
      : [...visibleWidgets, widget];
    setVisibleWidgets(next);
    if (onUpdateConfig) {
      onUpdateConfig({ ...project.dashboardConfig, visibleWidgets: next });
    }
  };

  const widgets = [
    { id: 'Logistics', name: 'Logistics Hub', icon: <Truck className="w-4 h-4" />, component: <LogisticsDashboard project={project} profile={{ role: 'Admin' } as any} /> },
    { id: 'Supervisor', name: 'Supervisor Activity', icon: <HardHat className="w-4 h-4" />, component: <SupervisorDashboard project={project} reports={reports} /> },
    { id: 'HSE', name: 'HSE Intelligence', icon: <ShieldCheck className="w-4 h-4" />, component: <HSEDashboard project={project} reports={reports} /> },
    { id: 'HR', name: 'HR Personnel', icon: <Users className="w-4 h-4" />, component: <HRDashboard project={project} reports={reports} /> },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white uppercase tracking-tight flex items-center gap-3">
            <LayoutDashboard className="text-emerald-500" />
            Project Dashboard
          </h2>
          <p className="text-neutral-500 text-xs font-mono uppercase tracking-widest mt-1">
            {project.name} • {project.location}
          </p>
        </div>

        <button
          onClick={() => setIsConfiguring(!isConfiguring)}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-widest transition-all border ${
            isConfiguring 
              ? 'bg-emerald-500 text-black border-emerald-400' 
              : 'bg-neutral-900 text-neutral-400 border-neutral-800 hover:text-white hover:border-neutral-700'
          }`}
        >
          <Settings className={`w-4 h-4 ${isConfiguring ? 'animate-spin-slow' : ''}`} />
          {isConfiguring ? 'Save Layout' : 'Configure Dashboard'}
        </button>
      </div>

      <AnimatePresence>
        {isConfiguring && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="p-6 bg-neutral-900/50 border border-neutral-800 rounded-2xl backdrop-blur-xl"
          >
            <h3 className="text-xs font-mono text-neutral-500 uppercase tracking-widest mb-4">Toggle Visible Widgets</h3>
            <div className="flex flex-wrap gap-3">
              {widgets.map(w => (
                <button
                  key={w.id}
                  onClick={() => toggleWidget(w.id)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-xs uppercase tracking-widest transition-all border ${
                    visibleWidgets.includes(w.id)
                      ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                      : 'bg-neutral-800/50 text-neutral-600 border-neutral-700/50 grayscale'
                  }`}
                >
                  {visibleWidgets.includes(w.id) ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  {w.name}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 gap-12">
        {widgets.filter(w => visibleWidgets.includes(w.id)).map((w, idx) => (
          <motion.section
            key={w.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            className="space-y-6"
          >
            <div className="flex items-center gap-3">
              <div className="w-1 h-6 bg-emerald-500 rounded-full" />
              <h3 className="text-xl font-bold text-white uppercase tracking-tight flex items-center gap-2">
                {w.icon}
                {w.name}
              </h3>
            </div>
            <div className="bg-neutral-900/30 border border-neutral-800/50 rounded-3xl p-8 backdrop-blur-sm">
              {w.component}
            </div>
          </motion.section>
        ))}
      </div>

      {visibleWidgets.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
          <div className="p-6 bg-neutral-900 rounded-full border border-neutral-800">
            <LayoutDashboard className="w-12 h-12 text-neutral-700" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Dashboard is Empty</h3>
            <p className="text-neutral-500 text-sm">Use the configuration menu to enable widgets.</p>
          </div>
        </div>
      )}
    </div>
  );
}
