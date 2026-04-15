import React, { useState, useEffect, useMemo } from 'react';
import { 
  Project, 
  PMScheduleItem, 
  PMCostItem, 
  PMCashFlowItem, 
  PMProcurementItem, 
  PMContractClaimItem, 
  PMIntelligence,
  UserProfile
} from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { 
  TrendingUp, 
  Clock, 
  DollarSign, 
  Package, 
  FileText, 
  AlertTriangle, 
  CheckCircle2, 
  ChevronRight, 
  Download,
  BarChart3,
  Activity,
  Target,
  Zap,
  ShieldAlert,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  Search,
  Filter,
  MoreHorizontal,
  Plus
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  PieChart,
  Pie
} from 'recharts';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  orderBy,
  limit 
} from 'firebase/firestore';
import { db } from '../firebase';
import { handleFirestoreError, OperationType } from '../firebase';

interface PMDashboardProps {
  project: Project;
  userProfile: UserProfile;
}

type PMTab = 'summary' | 'schedule' | 'cost' | 'cashflow' | 'procurement' | 'contract' | 'analysis';

export default function PMDashboard({ project, userProfile }: PMDashboardProps) {
  const [activeTab, setActiveTab] = useState<PMTab>('summary');
  const [schedule, setSchedule] = useState<PMScheduleItem[]>([]);
  const [costs, setCosts] = useState<PMCostItem[]>([]);
  const [cashFlow, setCashFlow] = useState<PMCashFlowItem[]>([]);
  const [procurement, setProcurement] = useState<PMProcurementItem[]>([]);
  const [claims, setClaims] = useState<PMContractClaimItem[]>([]);
  const [intelligence, setIntelligence] = useState<PMIntelligence | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch Data
  useEffect(() => {
    if (!project.id) return;

    const unsubscribes: (() => void)[] = [];

    // Schedule
    const qSchedule = query(collection(db, 'pmSchedules'), where('projectId', '==', project.id), orderBy('no', 'asc'));
    unsubscribes.push(onSnapshot(qSchedule, (snapshot) => {
      setSchedule(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PMScheduleItem)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'pmSchedules')));

    // Costs
    const qCosts = query(collection(db, 'pmCosts'), where('projectId', '==', project.id));
    unsubscribes.push(onSnapshot(qCosts, (snapshot) => {
      setCosts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PMCostItem)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'pmCosts')));

    // Cash Flow
    const qCashFlow = query(collection(db, 'pmCashFlows'), where('projectId', '==', project.id));
    unsubscribes.push(onSnapshot(qCashFlow, (snapshot) => {
      setCashFlow(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PMCashFlowItem)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'pmCashFlows')));

    // Procurement
    const qProcurement = query(collection(db, 'pmProcurements'), where('projectId', '==', project.id));
    unsubscribes.push(onSnapshot(qProcurement, (snapshot) => {
      setProcurement(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PMProcurementItem)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'pmProcurements')));

    // Claims
    const qClaims = query(collection(db, 'pmContractClaims'), where('projectId', '==', project.id));
    unsubscribes.push(onSnapshot(qClaims, (snapshot) => {
      setClaims(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PMContractClaimItem)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'pmContractClaims')));

    // Intelligence
    const qIntelligence = query(
      collection(db, 'pmIntelligence'), 
      where('projectId', '==', project.id),
      orderBy('date', 'desc'),
      limit(1)
    );
    unsubscribes.push(onSnapshot(qIntelligence, (snapshot) => {
      if (!snapshot.empty) {
        setIntelligence({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as PMIntelligence);
      }
      setIsLoading(false);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'pmIntelligence')));

    return () => unsubscribes.forEach(unsub => unsub());
  }, [project.id]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0
    }).format(value);
  };

  const tabs: { id: PMTab; label: string; icon: React.ReactNode }[] = [
    { id: 'summary', label: 'Executive Summary', icon: <Target className="w-4 h-4" /> },
    { id: 'schedule', label: 'Time Schedule', icon: <Clock className="w-4 h-4" /> },
    { id: 'cost', label: 'Cost Control', icon: <DollarSign className="w-4 h-4" /> },
    { id: 'cashflow', label: 'Cash Flow', icon: <TrendingUp className="w-4 h-4" /> },
    { id: 'procurement', label: 'Procurement', icon: <Package className="w-4 h-4" /> },
    { id: 'contract', label: 'Contract & Claims', icon: <FileText className="w-4 h-4" /> },
    { id: 'analysis', label: 'Strategic Analysis', icon: <Zap className="w-4 h-4" /> },
  ];

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <div className="w-12 h-12 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
        <p className="text-neutral-500 font-mono text-xs uppercase tracking-widest">Loading Strategic Intelligence...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 bg-emerald-500/10 rounded-lg">
              <ShieldAlert className="w-5 h-5 text-emerald-500" />
            </div>
            <h2 className="text-2xl font-bold text-white uppercase tracking-tight">Project Director Command</h2>
          </div>
          <p className="text-neutral-500 text-xs font-mono uppercase tracking-widest">
            {project.name} • Strategic Oversight & Control
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-4 py-2 bg-neutral-900 border border-neutral-800 text-neutral-400 rounded-xl text-xs font-bold uppercase tracking-wider hover:text-white hover:border-neutral-700 transition-all">
            <Download className="w-4 h-4" />
            Export Excel
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-black rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-500/20">
            <Plus className="w-4 h-4" />
            New Analysis
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex overflow-x-auto pb-2 gap-2 no-scrollbar">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-all ${
              activeTab === tab.id
                ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/20'
                : 'bg-neutral-900 text-neutral-500 border border-neutral-800 hover:text-white hover:border-neutral-700'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Main Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          {activeTab === 'summary' && (
            <div className="space-y-8">
              {/* KPI Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <KPICard 
                  title="Overall Progress" 
                  value={`${intelligence?.summary.overallProgress || 0}%`} 
                  trend={intelligence?.summary.scheduleStatus === 'Ahead' ? 'Ahead of Schedule' : 'Behind Schedule'}
                  trendType={intelligence?.summary.scheduleStatus === 'Ahead' ? 'positive' : 'negative'}
                  icon={<Activity className="w-5 h-5" />}
                />
                <KPICard 
                  title="Cost Status" 
                  value={intelligence?.summary.costStatus || 'N/A'} 
                  trend={intelligence?.summary.costStatus === 'Under Budget' ? 'Under Budget' : 'Over Budget'}
                  trendType={intelligence?.summary.costStatus === 'Under Budget' ? 'positive' : 'negative'}
                  icon={<DollarSign className="w-5 h-5" />}
                />
                <KPICard 
                  title="Cash Flow Health" 
                  value={intelligence?.summary.cashFlowHealth || 'N/A'} 
                  trend="Operational Liquidity"
                  trendType="neutral"
                  icon={<TrendingUp className="w-5 h-5" />}
                />
                <KPICard 
                  title="Claim Potential" 
                  value={formatCurrency(intelligence?.summary.claimPotentialValue || 0)} 
                  trend={`${intelligence?.summary.claimPotentialTime || 0} Days EOT`}
                  trendType="warning"
                  icon={<FileText className="w-5 h-5" />}
                />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* S-Curve Chart */}
                <div className="lg:col-span-2 bg-neutral-900 border border-neutral-800 rounded-3xl p-8">
                  <div className="flex items-center justify-between mb-8">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-emerald-500" />
                      Project S-Curve (Planned vs Actual)
                    </h3>
                  </div>
                  <div className="h-[350px] w-full">
                    <ResponsiveContainer width="100%" height="100%" minHeight={300}>
                      <AreaChart data={cashFlow}>
                        <defs>
                          <linearGradient id="colorPlanned" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                          </linearGradient>
                          <linearGradient id="colorActual" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#262626" vertical={false} />
                        <XAxis dataKey="period" stroke="#737373" fontSize={10} tickLine={false} axisLine={false} />
                        <YAxis stroke="#737373" fontSize={10} tickLine={false} axisLine={false} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#171717', border: '1px solid #262626', borderRadius: '12px' }}
                          itemStyle={{ color: '#fff', fontSize: '12px' }}
                        />
                        <Area type="monotone" dataKey="plannedProgress" stroke="#10b981" fillOpacity={1} fill="url(#colorPlanned)" strokeWidth={3} name="Planned %" />
                        <Area type="monotone" dataKey="actualProgress" stroke="#3b82f6" fillOpacity={1} fill="url(#colorActual)" strokeWidth={3} name="Actual %" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Critical Issues & Risks */}
                <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-8 space-y-6">
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-amber-500" />
                    Critical Risk Matrix
                  </h3>
                  <div className="space-y-4">
                    {intelligence?.summary.criticalIssues.map((issue, idx) => (
                      <div key={idx} className="p-4 bg-neutral-950 border border-neutral-800 rounded-2xl flex gap-4">
                        <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center shrink-0">
                          <ShieldAlert className="w-5 h-5 text-red-500" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-white mb-1 uppercase tracking-tight">{issue}</p>
                          <p className="text-[10px] text-neutral-500 leading-relaxed">Immediate director-level intervention required to mitigate schedule impact.</p>
                        </div>
                      </div>
                    ))}
                    {(!intelligence?.summary.criticalIssues || intelligence.summary.criticalIssues.length === 0) && (
                      <div className="text-center py-10">
                        <CheckCircle2 className="w-12 h-12 text-emerald-500/20 mx-auto mb-4" />
                        <p className="text-neutral-500 text-xs italic">No critical risks identified.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'schedule' && (
            <div className="bg-neutral-900 border border-neutral-800 rounded-3xl overflow-hidden">
              <div className="p-6 border-b border-neutral-800 flex items-center justify-between">
                <h3 className="text-lg font-bold text-white flex items-center gap-2 uppercase tracking-tight">
                  <Calendar className="w-5 h-5 text-emerald-500" />
                  Time Schedule (CPM Structured)
                </h3>
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1 text-[10px] font-bold text-red-500 uppercase tracking-widest">
                    <div className="w-2 h-2 bg-red-500 rounded-full" />
                    Critical Path
                  </span>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-neutral-950/50">
                      <th className="px-6 py-4 text-[10px] font-mono text-neutral-500 uppercase tracking-widest">No</th>
                      <th className="px-6 py-4 text-[10px] font-mono text-neutral-500 uppercase tracking-widest">Activity</th>
                      <th className="px-6 py-4 text-[10px] font-mono text-neutral-500 uppercase tracking-widest">Duration</th>
                      <th className="px-6 py-4 text-[10px] font-mono text-neutral-500 uppercase tracking-widest">Start</th>
                      <th className="px-6 py-4 text-[10px] font-mono text-neutral-500 uppercase tracking-widest">Finish</th>
                      <th className="px-6 py-4 text-[10px] font-mono text-neutral-500 uppercase tracking-widest">Predecessor</th>
                      <th className="px-6 py-4 text-[10px] font-mono text-neutral-500 uppercase tracking-widest">Resource</th>
                      <th className="px-6 py-4 text-[10px] font-mono text-neutral-500 uppercase tracking-widest">Remark</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-800">
                    {schedule.map((item) => (
                      <tr key={item.id} className={`hover:bg-neutral-800/30 transition-colors ${item.isCritical ? 'bg-red-500/5' : ''}`}>
                        <td className="px-6 py-4 text-xs font-mono text-neutral-500">{item.no}</td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            {item.isCritical && <span className="text-red-500 font-bold">*</span>}
                            <span className={`text-xs font-bold ${item.isCritical ? 'text-red-400' : 'text-white'}`}>{item.activity}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-xs text-neutral-300">{item.duration} Days</td>
                        <td className="px-6 py-4 text-xs text-neutral-400 font-mono">{item.start}</td>
                        <td className="px-6 py-4 text-xs text-neutral-400 font-mono">{item.finish}</td>
                        <td className="px-6 py-4 text-xs text-neutral-500 font-mono">{item.predecessor}</td>
                        <td className="px-6 py-4 text-xs text-neutral-300">{item.resource}</td>
                        <td className="px-6 py-4 text-xs text-neutral-500 italic">{item.remark}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'cost' && (
            <div className="bg-neutral-900 border border-neutral-800 rounded-3xl overflow-hidden">
              <div className="p-6 border-b border-neutral-800 flex items-center justify-between">
                <h3 className="text-lg font-bold text-white flex items-center gap-2 uppercase tracking-tight">
                  <DollarSign className="w-5 h-5 text-emerald-500" />
                  Cost Control & Variance Analysis
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-neutral-950/50">
                      <th className="px-6 py-4 text-[10px] font-mono text-neutral-500 uppercase tracking-widest">Item Description</th>
                      <th className="px-6 py-4 text-[10px] font-mono text-neutral-500 uppercase tracking-widest text-right">Budget Cost</th>
                      <th className="px-6 py-4 text-[10px] font-mono text-neutral-500 uppercase tracking-widest text-right">Actual Cost</th>
                      <th className="px-6 py-4 text-[10px] font-mono text-neutral-500 uppercase tracking-widest text-right">Variance</th>
                      <th className="px-6 py-4 text-[10px] font-mono text-neutral-500 uppercase tracking-widest text-center">Progress (%)</th>
                      <th className="px-6 py-4 text-[10px] font-mono text-neutral-500 uppercase tracking-widest text-center">Cost/Prog Ratio</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-800">
                    {costs.map((item) => (
                      <tr key={item.id} className="hover:bg-neutral-800/30 transition-colors">
                        <td className="px-6 py-4 text-xs font-bold text-white">{item.item}</td>
                        <td className="px-6 py-4 text-xs text-right text-neutral-300 font-mono">{formatCurrency(item.budgetCost)}</td>
                        <td className="px-6 py-4 text-xs text-right text-white font-mono">{formatCurrency(item.actualCost)}</td>
                        <td className={`px-6 py-4 text-xs text-right font-mono font-bold ${item.variance < 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                          {item.variance < 0 ? '-' : '+'}{formatCurrency(Math.abs(item.variance))}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex-1 h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                              <div className="h-full bg-emerald-500" style={{ width: `${item.progress}%` }} />
                            </div>
                            <span className="text-[10px] font-mono text-neutral-400">{item.progress}%</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={`px-2 py-1 rounded-lg text-[10px] font-bold ${item.costProgressRatio > 1.1 ? 'bg-red-500/10 text-red-500' : 'bg-emerald-500/10 text-emerald-500'}`}>
                            {item.costProgressRatio.toFixed(2)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'cashflow' && (
            <div className="bg-neutral-900 border border-neutral-800 rounded-3xl overflow-hidden">
              <div className="p-6 border-b border-neutral-800 flex items-center justify-between">
                <h3 className="text-lg font-bold text-white flex items-center gap-2 uppercase tracking-tight">
                  <TrendingUp className="w-5 h-5 text-emerald-500" />
                  Cash Flow & S-Curve Data
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-neutral-950/50">
                      <th className="px-6 py-4 text-[10px] font-mono text-neutral-500 uppercase tracking-widest">Period</th>
                      <th className="px-6 py-4 text-[10px] font-mono text-neutral-500 uppercase tracking-widest text-center">Planned Prog (%)</th>
                      <th className="px-6 py-4 text-[10px] font-mono text-neutral-500 uppercase tracking-widest text-center">Actual Prog (%)</th>
                      <th className="px-6 py-4 text-[10px] font-mono text-neutral-500 uppercase tracking-widest text-right">Planned Cost</th>
                      <th className="px-6 py-4 text-[10px] font-mono text-neutral-500 uppercase tracking-widest text-right">Actual Cost</th>
                      <th className="px-6 py-4 text-[10px] font-mono text-neutral-500 uppercase tracking-widest text-right">Cumulative Cost</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-800">
                    {cashFlow.map((item) => (
                      <tr key={item.id} className="hover:bg-neutral-800/30 transition-colors">
                        <td className="px-6 py-4 text-xs font-bold text-white uppercase">{item.period}</td>
                        <td className="px-6 py-4 text-center text-xs text-neutral-400 font-mono">{item.plannedProgress}%</td>
                        <td className="px-6 py-4 text-center text-xs text-emerald-500 font-mono font-bold">{item.actualProgress}%</td>
                        <td className="px-6 py-4 text-right text-xs text-neutral-400 font-mono">{formatCurrency(item.plannedCost)}</td>
                        <td className="px-6 py-4 text-right text-xs text-white font-mono">{formatCurrency(item.actualCost)}</td>
                        <td className="px-6 py-4 text-right text-xs text-emerald-500 font-mono font-bold">{formatCurrency(item.cumulativeCost)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'procurement' && (
            <div className="bg-neutral-900 border border-neutral-800 rounded-3xl overflow-hidden">
              <div className="p-6 border-b border-neutral-800 flex items-center justify-between">
                <h3 className="text-lg font-bold text-white flex items-center gap-2 uppercase tracking-tight">
                  <Package className="w-5 h-5 text-emerald-500" />
                  Procurement Tracking & Supply Chain Risk
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-neutral-950/50">
                      <th className="px-6 py-4 text-[10px] font-mono text-neutral-500 uppercase tracking-widest">Material</th>
                      <th className="px-6 py-4 text-[10px] font-mono text-neutral-500 uppercase tracking-widest">Status</th>
                      <th className="px-6 py-4 text-[10px] font-mono text-neutral-500 uppercase tracking-widest">PO Date</th>
                      <th className="px-6 py-4 text-[10px] font-mono text-neutral-500 uppercase tracking-widest">Delivery Date</th>
                      <th className="px-6 py-4 text-[10px] font-mono text-neutral-500 uppercase tracking-widest text-center">Delay (Days)</th>
                      <th className="px-6 py-4 text-[10px] font-mono text-neutral-500 uppercase tracking-widest text-center">Risk Level</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-800">
                    {procurement.map((item) => (
                      <tr key={item.id} className="hover:bg-neutral-800/30 transition-colors">
                        <td className="px-6 py-4 text-xs font-bold text-white">{item.material}</td>
                        <td className="px-6 py-4">
                          <span className="px-2 py-1 bg-neutral-800 border border-neutral-700 rounded-lg text-[10px] font-bold text-neutral-300 uppercase tracking-wider">
                            {item.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-xs text-neutral-400 font-mono">{item.poDate}</td>
                        <td className="px-6 py-4 text-xs text-neutral-400 font-mono">{item.deliveryDate}</td>
                        <td className={`px-6 py-4 text-center text-xs font-mono font-bold ${item.delay > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                          {item.delay > 0 ? `+${item.delay}` : '0'}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${
                            item.riskLevel === 'High' ? 'bg-red-500/10 text-red-500' :
                            item.riskLevel === 'Medium' ? 'bg-amber-500/10 text-amber-500' :
                            'bg-emerald-500/10 text-emerald-500'
                          }`}>
                            {item.riskLevel}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'contract' && (
            <div className="bg-neutral-900 border border-neutral-800 rounded-3xl overflow-hidden">
              <div className="p-6 border-b border-neutral-800 flex items-center justify-between">
                <h3 className="text-lg font-bold text-white flex items-center gap-2 uppercase tracking-tight">
                  <FileText className="w-5 h-5 text-emerald-500" />
                  Contract, Claims & Variation Orders
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-neutral-950/50">
                      <th className="px-6 py-4 text-[10px] font-mono text-neutral-500 uppercase tracking-widest">Issue / Variation</th>
                      <th className="px-6 py-4 text-[10px] font-mono text-neutral-500 uppercase tracking-widest">Type</th>
                      <th className="px-6 py-4 text-[10px] font-mono text-neutral-500 uppercase tracking-widest">Responsible</th>
                      <th className="px-6 py-4 text-[10px] font-mono text-neutral-500 uppercase tracking-widest text-center">EOT (Days)</th>
                      <th className="px-6 py-4 text-[10px] font-mono text-neutral-500 uppercase tracking-widest text-right">Cost Claim</th>
                      <th className="px-6 py-4 text-[10px] font-mono text-neutral-500 uppercase tracking-widest">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-800">
                    {claims.map((item) => (
                      <tr key={item.id} className="hover:bg-neutral-800/30 transition-colors">
                        <td className="px-6 py-4 text-xs font-bold text-white">{item.issue}</td>
                        <td className="px-6 py-4 text-xs text-neutral-400">{item.type}</td>
                        <td className="px-6 py-4 text-xs text-neutral-300">{item.responsible}</td>
                        <td className="px-6 py-4 text-center text-xs text-amber-500 font-mono font-bold">+{item.eot}</td>
                        <td className="px-6 py-4 text-right text-xs text-emerald-500 font-mono font-bold">{formatCurrency(item.costClaim)}</td>
                        <td className="px-6 py-4">
                          <span className="px-2 py-1 bg-neutral-800 border border-neutral-700 rounded-lg text-[10px] font-bold text-neutral-300 uppercase tracking-wider">
                            {item.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'analysis' && intelligence && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Analysis & Insights */}
              <div className="space-y-8">
                <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-8 space-y-6">
                  <h3 className="text-lg font-bold text-white flex items-center gap-2 uppercase tracking-tight">
                    <Zap className="w-5 h-5 text-emerald-500" />
                    Strategic Analysis
                  </h3>
                  
                  <div className="space-y-6">
                    <AnalysisItem 
                      title="Schedule Analysis" 
                      content={intelligence.analysis.schedule.delayCauses} 
                      subtitle={`Critical Path: ${intelligence.analysis.schedule.criticalPath}`}
                    />
                    <AnalysisItem 
                      title="Cost Analysis" 
                      content={intelligence.analysis.cost.profitRisk} 
                      subtitle={`Overrun Source: ${intelligence.analysis.cost.overrunSource}`}
                    />
                    <AnalysisItem 
                      title="Procurement Risk" 
                      content={intelligence.analysis.procurement.materialDelaysImpact} 
                    />
                    <AnalysisItem 
                      title="Contract Position" 
                      content={intelligence.analysis.contract.ldRisk} 
                      subtitle={`EOT Entitlement: ${intelligence.analysis.contract.eotEntitlement}`}
                    />
                  </div>
                </div>

                <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-8 space-y-6">
                  <h3 className="text-lg font-bold text-white flex items-center gap-2 uppercase tracking-tight">
                    <Target className="w-5 h-5 text-emerald-500" />
                    Scenario Simulation
                  </h3>
                  <div className="grid grid-cols-1 gap-4">
                    <ScenarioCard type="Best Case" content={intelligence.scenarios.bestCase} color="emerald" />
                    <ScenarioCard type="Most Likely" content={intelligence.scenarios.mostLikely} color="blue" />
                    <ScenarioCard type="Worst Case" content={intelligence.scenarios.worstCase} color="red" />
                  </div>
                </div>
              </div>

              {/* Action Plan & Forecast */}
              <div className="space-y-8">
                <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-8 space-y-6">
                  <h3 className="text-lg font-bold text-white flex items-center gap-2 uppercase tracking-tight">
                    <Activity className="w-5 h-5 text-emerald-500" />
                    Action Plan (Director Level)
                  </h3>
                  
                  <div className="space-y-6">
                    <div>
                      <p className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest mb-3">Immediate Actions (Short Term)</p>
                      <div className="space-y-2">
                        {intelligence.actionPlan.immediate.map((action, idx) => (
                          <div key={idx} className="flex items-start gap-3 p-3 bg-neutral-950 border border-neutral-800 rounded-xl">
                            <div className="w-5 h-5 rounded bg-emerald-500/10 flex items-center justify-center shrink-0 mt-0.5">
                              <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                            </div>
                            <p className="text-xs text-neutral-300 leading-relaxed">{action}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <p className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest mb-3">Strategic Actions (Long Term)</p>
                      <div className="space-y-2">
                        {intelligence.actionPlan.strategic.map((action, idx) => (
                          <div key={idx} className="flex items-start gap-3 p-3 bg-neutral-950 border border-neutral-800 rounded-xl">
                            <div className="w-5 h-5 rounded bg-blue-500/10 flex items-center justify-center shrink-0 mt-0.5">
                              <Target className="w-3 h-3 text-blue-500" />
                            </div>
                            <p className="text-xs text-neutral-300 leading-relaxed">{action}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="p-4 bg-amber-500/5 border border-amber-500/10 rounded-2xl">
                      <p className="text-[10px] font-mono text-amber-500 uppercase tracking-widest mb-2">Recovery Plan</p>
                      <p className="text-xs text-neutral-400 leading-relaxed italic">{intelligence.actionPlan.recovery}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-8 space-y-6">
                  <h3 className="text-lg font-bold text-white flex items-center gap-2 uppercase tracking-tight">
                    <BarChart3 className="w-5 h-5 text-emerald-500" />
                    Financial Forecast (EAC)
                  </h3>
                  <div className="grid grid-cols-1 gap-6">
                    <div className="p-6 bg-neutral-950 border border-neutral-800 rounded-2xl flex items-center justify-between">
                      <div>
                        <p className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest mb-1">Est. Completion Date</p>
                        <p className="text-xl font-bold text-white">{intelligence.forecast.estimatedCompletionDate}</p>
                      </div>
                      <Calendar className="w-8 h-8 text-neutral-700" />
                    </div>
                    <div className="p-6 bg-neutral-950 border border-neutral-800 rounded-2xl flex items-center justify-between">
                      <div>
                        <p className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest mb-1">Estimate at Completion (EAC)</p>
                        <p className="text-xl font-bold text-white">{formatCurrency(intelligence.forecast.eac)}</p>
                      </div>
                      <DollarSign className="w-8 h-8 text-neutral-700" />
                    </div>
                    <div className={`p-6 border rounded-2xl flex items-center justify-between ${intelligence.forecast.profitLossProjection >= 0 ? 'bg-emerald-500/5 border-emerald-500/10' : 'bg-red-500/5 border-red-500/10'}`}>
                      <div>
                        <p className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest mb-1">Profit / Loss Projection</p>
                        <p className={`text-xl font-bold ${intelligence.forecast.profitLossProjection >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                          {intelligence.forecast.profitLossProjection >= 0 ? '+' : ''}{formatCurrency(intelligence.forecast.profitLossProjection)}
                        </p>
                      </div>
                      {intelligence.forecast.profitLossProjection >= 0 ? <TrendingUp className="w-8 h-8 text-emerald-500/20" /> : <ShieldAlert className="w-8 h-8 text-red-500/20" />}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function KPICard({ title, value, trend, trendType, icon }: { title: string; value: string; trend: string; trendType: 'positive' | 'negative' | 'neutral' | 'warning'; icon: React.ReactNode }) {
  return (
    <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-3xl shadow-xl hover:border-emerald-500/30 transition-all group">
      <div className="flex items-center justify-between mb-4">
        <div className="p-2 bg-neutral-950 rounded-xl text-neutral-500 group-hover:text-emerald-500 transition-colors">
          {icon}
        </div>
        <div className={`flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest ${
          trendType === 'positive' ? 'text-emerald-500' : 
          trendType === 'negative' ? 'text-red-500' : 
          trendType === 'warning' ? 'text-amber-500' : 'text-neutral-500'
        }`}>
          {trendType === 'positive' ? <ArrowUpRight className="w-3 h-3" /> : 
           trendType === 'negative' ? <ArrowDownRight className="w-3 h-3" /> : null}
          {trend}
        </div>
      </div>
      <p className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest mb-1">{title}</p>
      <p className="text-2xl font-bold text-white tracking-tight">{value}</p>
    </div>
  );
}

function AnalysisItem({ title, content, subtitle }: { title: string; content: string; subtitle?: string }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-white uppercase tracking-tight">{title}</p>
        {subtitle && <p className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest">{subtitle}</p>}
      </div>
      <div className="p-4 bg-neutral-950 border border-neutral-800 rounded-2xl">
        <p className="text-xs text-neutral-400 leading-relaxed">{content}</p>
      </div>
    </div>
  );
}

function ScenarioCard({ type, content, color }: { type: string; content: string; color: 'emerald' | 'blue' | 'red' }) {
  const colorMap = {
    emerald: 'border-emerald-500/20 bg-emerald-500/5 text-emerald-500',
    blue: 'border-blue-500/20 bg-blue-500/5 text-blue-500',
    red: 'border-red-500/20 bg-red-500/5 text-red-500'
  };

  return (
    <div className={`p-4 border rounded-2xl ${colorMap[color]} space-y-2`}>
      <p className="text-[10px] font-bold uppercase tracking-widest">{type}</p>
      <p className="text-xs text-neutral-300 leading-relaxed">{content}</p>
    </div>
  );
}
