import React, { useState, useEffect, useMemo } from 'react';
import { 
  Project, 
  LogisticsIntelligence,
  LogisticsMaterialPlan,
  LogisticsDeliverySchedule,
  LogisticsTransportAnalysis,
  LogisticsInventoryStatus,
  UserProfile,
  MaterialRequest,
  MaterialReceipt,
  MaterialUsage
} from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Truck, 
  Package, 
  Clock, 
  MapPin, 
  AlertTriangle, 
  CheckCircle2, 
  TrendingUp, 
  BarChart3, 
  Zap, 
  ShieldAlert, 
  Calendar, 
  ArrowUpRight, 
  Search, 
  Filter, 
  Download,
  Plus,
  Warehouse,
  Navigation,
  Route,
  Activity,
  DollarSign
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
  Pie,
  Legend
} from 'recharts';
import { 
  GoogleMap, 
  useJsApiLoader, 
  Marker, 
  Polyline,
  InfoWindow
} from '@react-google-maps/api';
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

interface LogisticsDashboardProps {
  project: Project;
  userProfile: UserProfile;
}

type LogisticsTab = 'summary' | 'material-plan' | 'delivery' | 'transport' | 'inventory' | 'site-logistics' | 'analysis';

export default function LogisticsDashboard({ project, userProfile }: LogisticsDashboardProps) {
  const [activeTab, setActiveTab] = useState<LogisticsTab>('summary');
  const [intelligence, setIntelligence] = useState<LogisticsIntelligence | null>(null);
  const [materialRequests, setMaterialRequests] = useState<MaterialRequest[]>([]);
  const [materialReceipts, setMaterialReceipts] = useState<MaterialReceipt[]>([]);
  const [materialUsages, setMaterialUsages] = useState<MaterialUsage[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch Data
  useEffect(() => {
    if (!project.id) return;

    const unsubscribes: (() => void)[] = [];

    // Intelligence
    const qIntel = query(
      collection(db, 'logisticsIntelligence'), 
      where('projectId', '==', project.id), 
      orderBy('date', 'desc'), 
      limit(1)
    );
    unsubscribes.push(onSnapshot(qIntel, (snapshot) => {
      if (!snapshot.empty) {
        setIntelligence({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as LogisticsIntelligence);
      }
      setIsLoading(false);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'logisticsIntelligence')));

    // Material Requests
    const qRequests = query(collection(db, 'materialRequests'), where('projectId', '==', project.id));
    unsubscribes.push(onSnapshot(qRequests, (snapshot) => {
      setMaterialRequests(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MaterialRequest)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'materialRequests')));

    // Material Receipts
    const qReceipts = query(collection(db, 'materialReceipts'), where('projectId', '==', project.id));
    unsubscribes.push(onSnapshot(qReceipts, (snapshot) => {
      setMaterialReceipts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MaterialReceipt)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'materialReceipts')));

    // Material Usages
    const qUsages = query(collection(db, 'materialUsages'), where('projectId', '==', project.id));
    unsubscribes.push(onSnapshot(qUsages, (snapshot) => {
      setMaterialUsages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MaterialUsage)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'materialUsages')));

    return () => unsubscribes.forEach(unsub => unsub());
  }, [project.id]);

  const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
          <p className="text-xs font-mono text-neutral-500 uppercase tracking-widest">Initializing Logistics Intelligence...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      {/* Header Section */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-500/10 rounded-lg">
              <Truck className="w-5 h-5 text-emerald-500" />
            </div>
            <h1 className="text-2xl font-bold text-white uppercase tracking-tighter">Logistics Command Center</h1>
          </div>
          <p className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest flex items-center gap-2">
            <Activity className="w-3 h-3" />
            Supply Chain Strategy & Operational Control • {project.name}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-xl text-[10px] font-mono uppercase tracking-widest transition-all flex items-center gap-2 border border-neutral-700">
            <Download className="w-4 h-4" />
            Export Logistics Report
          </button>
          <div className="h-8 w-px bg-neutral-800 mx-2" />
          <div className="flex flex-col items-end">
            <p className="text-[8px] font-mono text-neutral-500 uppercase tracking-widest">Intelligence Status</p>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider">Live Analysis Active</span>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-1 p-1 bg-neutral-900 border border-neutral-800 rounded-2xl overflow-x-auto no-scrollbar">
        {[
          { id: 'summary', label: 'Strategic Summary', icon: TrendingUp },
          { id: 'material-plan', label: 'Material Plan', icon: Package },
          { id: 'delivery', label: 'Delivery Schedule', icon: Clock },
          { id: 'transport', label: 'Transport & Hauling', icon: Navigation },
          { id: 'inventory', label: 'Inventory Control', icon: Warehouse },
          { id: 'site-logistics', label: 'Site Logistics', icon: Route },
          { id: 'analysis', label: 'Risk & Optimization', icon: ShieldAlert },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as LogisticsTab)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all whitespace-nowrap ${
              activeTab === tab.id 
                ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/20' 
                : 'text-neutral-500 hover:text-white hover:bg-neutral-800'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Main Content Area */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          {activeTab === 'summary' && <SummaryView intelligence={intelligence} setActiveTab={setActiveTab} />}
          {activeTab === 'material-plan' && <MaterialPlanView intelligence={intelligence} />}
          {activeTab === 'delivery' && <DeliveryScheduleView intelligence={intelligence} />}
          {activeTab === 'transport' && <TransportView intelligence={intelligence} />}
          {activeTab === 'inventory' && <InventoryView intelligence={intelligence} />}
          {activeTab === 'site-logistics' && <SiteLogisticsView intelligence={intelligence} />}
          {activeTab === 'analysis' && <AnalysisView intelligence={intelligence} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function SummaryView({ intelligence, setActiveTab }: { intelligence: LogisticsIntelligence | null, setActiveTab: (tab: LogisticsTab) => void }) {
  if (!intelligence) return <EmptyState />;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          label="Material Availability" 
          value={`${intelligence.inventoryStatus.reduce((acc, curr) => acc + (curr.stock > 0 ? 1 : 0), 0)} / ${intelligence.inventoryStatus.length}`}
          subValue="Items in Stock"
          icon={Package}
          trend="+2 New Arrivals"
          trendUp={true}
        />
        <StatCard 
          label="Pending Deliveries" 
          value={intelligence.deliverySchedule.filter(d => d.status !== 'Delivered').length.toString()}
          subValue="Active Shipments"
          icon={Truck}
          trend="3 Critical"
          trendUp={false}
          onClick={() => setActiveTab('delivery')}
        />
        <StatCard 
          label="Transport Efficiency" 
          value="94%"
          subValue="Fleet Utilization"
          icon={Navigation}
          trend="+5% vs Last Week"
          trendUp={true}
        />
        <StatCard 
          label="Logistics Risk" 
          value="Medium"
          subValue="Supply Chain Health"
          icon={ShieldAlert}
          trend="Stable"
          trendUp={true}
          color="text-orange-500"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6">
            <h3 className="text-sm font-bold text-white uppercase tracking-widest mb-6 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-500" />
              Strategic Impact Analysis
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <ImpactBox title="Schedule Impact" content={intelligence.impact.scheduleImpact} icon={Clock} color="emerald" />
              <ImpactBox title="Cost Impact" content={intelligence.impact.costImpact} icon={DollarSign} color="blue" />
              <ImpactBox title="Productivity" content={intelligence.impact.productivityImpact} icon={Zap} color="orange" />
            </div>
          </div>

          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6">
            <h3 className="text-sm font-bold text-white uppercase tracking-widest mb-6 flex items-center gap-2">
              <Zap className="w-4 h-4 text-emerald-500" />
              Optimization Strategy
            </h3>
            <div className="space-y-4">
              <OptimizationItem title="Delivery Optimization" content={intelligence.optimization.deliveryOptimization} />
              <OptimizationItem title="Transport Efficiency" content={intelligence.optimization.transportEfficiency} />
              <OptimizationItem title="Cost Reduction" content={intelligence.optimization.costReduction} />
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6">
            <h3 className="text-sm font-bold text-white uppercase tracking-widest mb-6 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-orange-500" />
              Risk Assessment
            </h3>
            <div className="space-y-4">
              <RiskItem label="Delays" content={intelligence.riskAnalysis.delays} />
              <RiskItem label="Bottlenecks" content={intelligence.riskAnalysis.bottlenecks} />
              <RiskItem label="Supply Risks" content={intelligence.riskAnalysis.supplyRisks} />
            </div>
          </div>

          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6">
            <h3 className="text-sm font-bold text-white uppercase tracking-widest mb-6 flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-500" />
              Scenario Simulation
            </h3>
            <div className="space-y-3">
              <ScenarioBox label="BEST CASE" content={intelligence.scenarios.bestCase} color="emerald" />
              <ScenarioBox label="NORMAL CASE" content={intelligence.scenarios.normalCase} color="blue" />
              <ScenarioBox label="WORST CASE" content={intelligence.scenarios.worstCase} color="red" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MaterialPlanView({ intelligence }: { intelligence: LogisticsIntelligence | null }) {
  if (!intelligence) return <EmptyState />;

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-3xl overflow-hidden shadow-2xl">
      <div className="p-6 border-b border-neutral-800 bg-neutral-900/50 flex items-center justify-between">
        <h3 className="text-sm font-bold text-white uppercase tracking-widest">Material Requirement Plan</h3>
        <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest">Aligned with Construction Schedule</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-neutral-800 bg-neutral-900/30">
              <th className="p-4 text-[10px] font-mono text-neutral-500 uppercase tracking-widest">Material</th>
              <th className="p-4 text-[10px] font-mono text-neutral-500 uppercase tracking-widest">Quantity</th>
              <th className="p-4 text-[10px] font-mono text-neutral-500 uppercase tracking-widest">Required Date</th>
              <th className="p-4 text-[10px] font-mono text-neutral-500 uppercase tracking-widest">Source</th>
              <th className="p-4 text-[10px] font-mono text-neutral-500 uppercase tracking-widest">Priority</th>
            </tr>
          </thead>
          <tbody>
            {intelligence.materialPlan.map((item, idx) => (
              <tr key={idx} className="border-b border-neutral-800/50 hover:bg-neutral-800/30 transition-colors">
                <td className="p-4 text-sm font-bold text-white">{item.material}</td>
                <td className="p-4 text-xs text-neutral-300 font-mono">{item.quantity} {item.unit}</td>
                <td className="p-4 text-xs text-neutral-300 font-mono">{item.requiredDate}</td>
                <td className="p-4 text-xs text-neutral-400 uppercase tracking-wider">{item.source}</td>
                <td className="p-4">
                  <span className={`px-2 py-1 rounded text-[9px] font-bold uppercase tracking-widest ${
                    item.priority === 'Critical' ? 'bg-red-500/10 text-red-500 border border-red-500/20' :
                    item.priority === 'High' ? 'bg-orange-500/10 text-orange-500 border border-orange-500/20' :
                    'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                  }`}>
                    {item.priority}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DeliveryScheduleView({ intelligence }: { intelligence: LogisticsIntelligence | null }) {
  const [selectedDelivery, setSelectedDelivery] = useState<LogisticsDeliverySchedule | null>(null);
  
  if (!intelligence) return <EmptyState />;

  return (
    <div className="space-y-6">
      <div className="bg-neutral-900 border border-neutral-800 rounded-3xl overflow-hidden shadow-2xl">
        <div className="p-6 border-b border-neutral-800 bg-neutral-900/50 flex items-center justify-between">
          <h3 className="text-sm font-bold text-white uppercase tracking-widest">Delivery Schedule & Tracking</h3>
          <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest">End-to-End Supply Chain Flow</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-neutral-800 bg-neutral-900/30">
                <th className="p-4 text-[10px] font-mono text-neutral-500 uppercase tracking-widest">Material</th>
                <th className="p-4 text-[10px] font-mono text-neutral-500 uppercase tracking-widest">PO Date</th>
                <th className="p-4 text-[10px] font-mono text-neutral-500 uppercase tracking-widest">Delivery Date</th>
                <th className="p-4 text-[10px] font-mono text-neutral-500 uppercase tracking-widest">Status</th>
                <th className="p-4 text-[10px] font-mono text-neutral-500 uppercase tracking-widest">Tracking</th>
              </tr>
            </thead>
            <tbody>
              {intelligence.deliverySchedule.map((item, idx) => (
                <tr key={idx} className="border-b border-neutral-800/50 hover:bg-neutral-800/30 transition-colors">
                  <td className="p-4 text-sm font-bold text-white">{item.material}</td>
                  <td className="p-4 text-xs text-neutral-300 font-mono">{item.poDate}</td>
                  <td className="p-4 text-xs text-neutral-300 font-mono">{item.deliveryDate}</td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${
                        item.status === 'Delivered' ? 'bg-emerald-500' :
                        item.status === 'Transit' ? 'bg-blue-500 animate-pulse' :
                        item.status === 'Fabrication' ? 'bg-orange-500' : 'bg-neutral-600'
                      }`} />
                      <span className="text-[10px] font-bold text-white uppercase tracking-widest">{item.status}</span>
                    </div>
                  </td>
                  <td className="p-4">
                    {item.tracking ? (
                      <button 
                        onClick={() => setSelectedDelivery(item)}
                        className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 rounded-lg text-[9px] font-bold uppercase tracking-widest transition-all border border-emerald-500/20"
                      >
                        <Navigation className="w-3 h-3" />
                        Live Track
                      </button>
                    ) : (
                      <span className="text-[9px] font-mono text-neutral-600 uppercase tracking-widest">No Tracking</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>
        {selectedDelivery && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
          >
            <div className="bg-neutral-900 border border-neutral-800 rounded-[2.5rem] w-full max-w-5xl h-[80vh] overflow-hidden flex flex-col shadow-2xl">
              <div className="p-6 border-b border-neutral-800 flex items-center justify-between bg-neutral-900/50">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-emerald-500/10 rounded-2xl">
                    <Truck className="w-6 h-6 text-emerald-500" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white uppercase tracking-tight">{selectedDelivery.material}</h2>
                    <p className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest">Live Intelligence Tracking • ID: {selectedDelivery.material.slice(0, 3).toUpperCase()}-TRK</p>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedDelivery(null)}
                  className="p-3 hover:bg-neutral-800 rounded-2xl text-neutral-500 hover:text-white transition-all"
                >
                  <ShieldAlert className="w-6 h-6 rotate-45" />
                </button>
              </div>
              
              <div className="flex-1 flex flex-col lg:flex-row">
                <div className="flex-1 relative bg-neutral-950">
                  <DeliveryTrackerMap delivery={selectedDelivery} />
                </div>
                
                <div className="w-full lg:w-80 border-t lg:border-t-0 lg:border-l border-neutral-800 p-6 space-y-6 overflow-y-auto bg-neutral-900/50">
                  <div className="space-y-4">
                    <h3 className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest">Shipment Status</h3>
                    <div className="p-4 bg-neutral-800/50 rounded-2xl border border-neutral-700/50 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-neutral-400 uppercase">Current Status</span>
                        <span className={`px-2 py-1 rounded text-[9px] font-bold uppercase tracking-widest ${
                          selectedDelivery.status === 'Delivered' ? 'bg-emerald-500/10 text-emerald-500' :
                          selectedDelivery.status === 'Transit' ? 'bg-blue-500/10 text-blue-500' :
                          'bg-orange-500/10 text-orange-500'
                        }`}>
                          {selectedDelivery.status}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-neutral-400 uppercase">Last Update</span>
                        <span className="text-[10px] font-mono text-neutral-300">{new Date(selectedDelivery.tracking?.lastUpdate || '').toLocaleTimeString()}</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest">Location Details</h3>
                    <div className="space-y-3">
                      <div className="flex gap-3">
                        <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                          <MapPin className="w-4 h-4 text-emerald-500" />
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-neutral-400 uppercase">Current Location</p>
                          <p className="text-xs text-white font-medium">{selectedDelivery.tracking?.locationName}</p>
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                          <Navigation className="w-4 h-4 text-blue-500" />
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-neutral-400 uppercase">Destination</p>
                          <p className="text-xs text-white font-medium">Project Site (Sorong)</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-neutral-800">
                    <div className="p-4 bg-emerald-500/10 rounded-2xl border border-emerald-500/20">
                      <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest mb-1">Estimated Arrival</p>
                      <p className="text-xl font-bold text-white tracking-tight">{selectedDelivery.tracking?.estimatedArrival}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const mapContainerStyle = {
  width: '100%',
  height: '100%'
};

const mapOptions = {
  styles: [
    { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
    { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
    { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
    {
      featureType: "administrative.locality",
      elementType: "labels.text.fill",
      stylers: [{ color: "#d59563" }],
    },
    {
      featureType: "poi",
      elementType: "labels.text.fill",
      stylers: [{ color: "#d59563" }],
    },
    {
      featureType: "poi.park",
      elementType: "geometry",
      stylers: [{ color: "#263c3f" }],
    },
    {
      featureType: "poi.park",
      elementType: "labels.text.fill",
      stylers: [{ color: "#6b9a76" }],
    },
    {
      featureType: "road",
      elementType: "geometry",
      stylers: [{ color: "#38414e" }],
    },
    {
      featureType: "road",
      elementType: "geometry.stroke",
      stylers: [{ color: "#212a37" }],
    },
    {
      featureType: "road",
      elementType: "labels.text.fill",
      stylers: [{ color: "#9ca5b3" }],
    },
    {
      featureType: "road.highway",
      elementType: "geometry",
      stylers: [{ color: "#746855" }],
    },
    {
      featureType: "road.highway",
      elementType: "geometry.stroke",
      stylers: [{ color: "#1f2835" }],
    },
    {
      featureType: "road.highway",
      elementType: "labels.text.fill",
      stylers: [{ color: "#f3d19c" }],
    },
    {
      featureType: "transit",
      elementType: "geometry",
      stylers: [{ color: "#2f3948" }],
    },
    {
      featureType: "transit.station",
      elementType: "labels.text.fill",
      stylers: [{ color: "#d59563" }],
    },
    {
      featureType: "water",
      elementType: "geometry",
      stylers: [{ color: "#17263c" }],
    },
    {
      featureType: "water",
      elementType: "labels.text.fill",
      stylers: [{ color: "#515c6d" }],
    },
    {
      featureType: "water",
      elementType: "labels.text.stroke",
      stylers: [{ color: "#17263c" }],
    },
  ],
  disableDefaultUI: true,
  zoomControl: true,
};

function DeliveryTrackerMap({ delivery }: { delivery: LogisticsDeliverySchedule }) {
  const [showInfo, setShowInfo] = useState(true);
  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''
  });

  const center = useMemo(() => ({
    lat: delivery.tracking?.currentLat || 0,
    lng: delivery.tracking?.currentLng || 0
  }), [delivery]);

  const destination = useMemo(() => ({
    lat: delivery.tracking?.destinationLat || 0,
    lng: delivery.tracking?.destinationLng || 0
  }), [delivery]);

  const path = useMemo(() => [
    { lat: delivery.tracking?.currentLat || 0, lng: delivery.tracking?.currentLng || 0 },
    { lat: delivery.tracking?.destinationLat || 0, lng: delivery.tracking?.destinationLng || 0 }
  ], [delivery]);

  if (!isLoaded) return (
    <div className="w-full h-full flex items-center justify-center bg-neutral-950">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
        <p className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest">Loading Satellite Intelligence...</p>
      </div>
    </div>
  );

  return (
    <GoogleMap
      mapContainerStyle={mapContainerStyle}
      center={center}
      zoom={4}
      options={mapOptions}
    >
      {/* Current Location Marker */}
      <Marker
        position={center}
        onClick={() => setShowInfo(true)}
        icon={{
          path: "M20 8v6M20 14l-2-2M20 14l2-2M11 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM16 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM4 18h16l-1-9H5l-1 9ZM7 9l1-4h8l1 4",
          fillColor: "#10b981",
          fillOpacity: 1,
          strokeWeight: 2,
          strokeColor: "#ffffff",
          scale: 1.5,
        }}
        title="Current Location"
      >
        {showInfo && (
          <InfoWindow onCloseClick={() => setShowInfo(false)}>
            <div className="p-2 min-w-[150px]">
              <p className="text-[10px] font-bold text-neutral-900 uppercase tracking-widest mb-1">{delivery.material}</p>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <MapPin className="w-3 h-3 text-emerald-600" />
                  <span className="text-[10px] font-medium text-neutral-700">{delivery.tracking?.locationName}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-3 h-3 text-blue-600" />
                  <span className="text-[10px] font-medium text-neutral-700">ETA: {delivery.tracking?.estimatedArrival}</span>
                </div>
              </div>
            </div>
          </InfoWindow>
        )}
      </Marker>

      {/* Destination Marker */}
      <Marker
        position={destination}
        icon={{
          path: "M12 21.7C17.3 17 20 13 20 10a8 8 0 1 0-16 0c0 3 2.7 7 8 11.7z M12 13a3 3 0 1 1 0-6 3 3 0 0 1 0 6z",
          fillColor: "#3b82f6",
          fillOpacity: 1,
          strokeWeight: 2,
          strokeColor: "#ffffff",
          scale: 1.5,
        }}
        title="Destination"
      />

      {/* Route Line */}
      <Polyline
        path={path}
        options={{
          strokeColor: "#10b981",
          strokeOpacity: 0.5,
          strokeWeight: 3,
          icons: [{
            icon: { path: 'M 0,-1 0,1', strokeOpacity: 1, scale: 4 },
            offset: '0',
            repeat: '20px'
          }],
        }}
      />
    </GoogleMap>
  );
}

function TransportView({ intelligence }: { intelligence: LogisticsIntelligence | null }) {
  if (!intelligence) return <EmptyState />;

  return (
    <div className="space-y-6">
      <div className="bg-neutral-900 border border-neutral-800 rounded-3xl overflow-hidden shadow-2xl">
        <div className="p-6 border-b border-neutral-800 bg-neutral-900/50 flex items-center justify-between">
          <h3 className="text-sm font-bold text-white uppercase tracking-widest">Transport & Hauling Analysis</h3>
          <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest">Fleet Optimization & Cycle Times</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-neutral-800 bg-neutral-900/30">
                <th className="p-4 text-[10px] font-mono text-neutral-500 uppercase tracking-widest">Item</th>
                <th className="p-4 text-[10px] font-mono text-neutral-500 uppercase tracking-widest">Distance</th>
                <th className="p-4 text-[10px] font-mono text-neutral-500 uppercase tracking-widest">Cycle Time</th>
                <th className="p-4 text-[10px] font-mono text-neutral-500 uppercase tracking-widest">Fleet Required</th>
                <th className="p-4 text-[10px] font-mono text-neutral-500 uppercase tracking-widest">Trips/Day</th>
              </tr>
            </thead>
            <tbody>
              {intelligence.transportAnalysis.map((item, idx) => (
                <tr key={idx} className="border-b border-neutral-800/50 hover:bg-neutral-800/30 transition-colors">
                  <td className="p-4 text-sm font-bold text-white">{item.item}</td>
                  <td className="p-4 text-xs text-neutral-300 font-mono">{item.distance} KM</td>
                  <td className="p-4 text-xs text-neutral-300 font-mono">{item.cycleTime} Hours</td>
                  <td className="p-4 text-xs text-neutral-400 uppercase tracking-widest">{item.fleetRequired}</td>
                  <td className="p-4 text-xs text-emerald-500 font-bold font-mono">{item.tripsPerDay}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function InventoryView({ intelligence }: { intelligence: LogisticsIntelligence | null }) {
  if (!intelligence) return <EmptyState />;

  return (
    <div className="space-y-6">
      <div className="bg-neutral-900 border border-neutral-800 rounded-3xl overflow-hidden shadow-2xl">
        <div className="p-6 border-b border-neutral-800 bg-neutral-900/50 flex items-center justify-between">
          <h3 className="text-sm font-bold text-white uppercase tracking-widest">Inventory Status & Stock Control</h3>
          <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest">Real-time Warehouse Monitoring</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-neutral-800 bg-neutral-900/30">
                <th className="p-4 text-[10px] font-mono text-neutral-500 uppercase tracking-widest">Material</th>
                <th className="p-4 text-[10px] font-mono text-neutral-500 uppercase tracking-widest">Stock</th>
                <th className="p-4 text-[10px] font-mono text-neutral-500 uppercase tracking-widest">Incoming</th>
                <th className="p-4 text-[10px] font-mono text-neutral-500 uppercase tracking-widest">Usage Rate</th>
                <th className="p-4 text-[10px] font-mono text-neutral-500 uppercase tracking-widest">Days Remaining</th>
              </tr>
            </thead>
            <tbody>
              {intelligence.inventoryStatus.map((item, idx) => (
                <tr key={idx} className="border-b border-neutral-800/50 hover:bg-neutral-800/30 transition-colors">
                  <td className="p-4 text-sm font-bold text-white">{item.material}</td>
                  <td className="p-4 text-xs text-neutral-300 font-mono">{item.stock}</td>
                  <td className="p-4 text-xs text-emerald-500 font-mono">+{item.incoming}</td>
                  <td className="p-4 text-xs text-neutral-400 font-mono">{item.usageRate}/Day</td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-neutral-800 rounded-full overflow-hidden max-w-[60px]">
                        <div 
                          className={`h-full rounded-full ${item.daysRemaining < 7 ? 'bg-red-500' : item.daysRemaining < 14 ? 'bg-orange-500' : 'bg-emerald-500'}`}
                          style={{ width: `${Math.min(100, (item.daysRemaining / 30) * 100)}%` }}
                        />
                      </div>
                      <span className={`text-[10px] font-bold font-mono ${item.daysRemaining < 7 ? 'text-red-500' : 'text-neutral-300'}`}>
                        {item.daysRemaining} DAYS
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function SiteLogisticsView({ intelligence }: { intelligence: LogisticsIntelligence | null }) {
  if (!intelligence) return <EmptyState />;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 space-y-6">
        <h3 className="text-sm font-bold text-white uppercase tracking-widest flex items-center gap-2">
          <Route className="w-4 h-4 text-emerald-500" />
          Site Logistics Plan
        </h3>
        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest">Laydown Area Allocation</label>
            <p className="text-xs text-neutral-300 leading-relaxed bg-neutral-800/50 p-4 rounded-xl border border-neutral-700/50">
              {intelligence.sitePlan.laydownAreaAllocation}
            </p>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest">Access Routes</label>
            <p className="text-xs text-neutral-300 leading-relaxed bg-neutral-800/50 p-4 rounded-xl border border-neutral-700/50">
              {intelligence.sitePlan.accessRoutes}
            </p>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest">Material Flow Inside Site</label>
            <p className="text-xs text-neutral-300 leading-relaxed bg-neutral-800/50 p-4 rounded-xl border border-neutral-700/50">
              {intelligence.sitePlan.materialFlow}
            </p>
          </div>
        </div>
      </div>

      <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 flex flex-col items-center justify-center text-center space-y-4">
        <div className="w-16 h-16 bg-emerald-500/10 rounded-2xl flex items-center justify-center">
          <MapPin className="w-8 h-8 text-emerald-500" />
        </div>
        <div>
          <h4 className="text-lg font-bold text-white uppercase tracking-tight">Site Map Integration</h4>
          <p className="text-xs text-neutral-500 font-mono mt-2">Visualizing laydown areas and access routes in real-time.</p>
        </div>
        <button className="px-6 py-3 bg-neutral-800 hover:bg-neutral-700 text-white rounded-xl text-[10px] font-bold uppercase tracking-[0.2em] transition-all border border-neutral-700">
          OPEN INTERACTIVE SITE MAP
        </button>
      </div>
    </div>
  );
}

function AnalysisView({ intelligence }: { intelligence: LogisticsIntelligence | null }) {
  if (!intelligence) return <EmptyState />;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6">
        <h3 className="text-sm font-bold text-white uppercase tracking-widest mb-6 flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-orange-500" />
          Risk & Bottleneck Analysis
        </h3>
        <div className="space-y-4">
          <RiskBox label="DELAYS" content={intelligence.riskAnalysis.delays} color="red" />
          <RiskBox label="BOTTLENECKS" content={intelligence.riskAnalysis.bottlenecks} color="orange" />
          <RiskBox label="SUPPLY RISKS" content={intelligence.riskAnalysis.supplyRisks} color="yellow" />
        </div>
      </div>

      <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6">
        <h3 className="text-sm font-bold text-white uppercase tracking-widest mb-6 flex items-center gap-2">
          <Zap className="w-4 h-4 text-emerald-500" />
          Optimization Strategy
        </h3>
        <div className="space-y-4">
          <OptimizationBox label="DELIVERY" content={intelligence.optimization.deliveryOptimization} />
          <OptimizationBox label="TRANSPORT" content={intelligence.optimization.transportEfficiency} />
          <OptimizationBox label="COST" content={intelligence.optimization.costReduction} />
        </div>
      </div>
    </div>
  );
}

// Helper Components
function StatCard({ label, value, subValue, icon: Icon, trend, trendUp, color = "text-white", onClick }: any) {
  return (
    <div 
      onClick={onClick}
      className={`bg-neutral-900 border border-neutral-800 p-6 rounded-3xl hover:border-emerald-500/30 transition-all group ${onClick ? 'cursor-pointer active:scale-95' : ''}`}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="p-2 bg-neutral-800 rounded-xl group-hover:bg-emerald-500/10 transition-colors">
          <Icon className="w-5 h-5 text-neutral-500 group-hover:text-emerald-500" />
        </div>
        {trend && (
          <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded uppercase tracking-widest ${trendUp ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
            {trend}
          </span>
        )}
      </div>
      <p className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest mb-1">{label}</p>
      <p className={`text-2xl font-bold ${color} tracking-tight`}>{value}</p>
      <p className="text-[10px] font-mono text-neutral-600 uppercase tracking-widest mt-1">{subValue}</p>
    </div>
  );
}

function ImpactBox({ title, content, icon: Icon, color }: any) {
  const colors: any = {
    emerald: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
    blue: 'text-blue-500 bg-blue-500/10 border-blue-500/20',
    orange: 'text-orange-500 bg-orange-500/10 border-orange-500/20'
  };
  return (
    <div className={`p-4 rounded-2xl border ${colors[color]} space-y-2`}>
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4" />
        <span className="text-[10px] font-bold uppercase tracking-widest">{title}</span>
      </div>
      <p className="text-xs leading-relaxed opacity-80">{content}</p>
    </div>
  );
}

function OptimizationItem({ title, content }: any) {
  return (
    <div className="flex gap-4 items-start">
      <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
      <div className="space-y-1">
        <p className="text-[10px] font-bold text-white uppercase tracking-widest">{title}</p>
        <p className="text-xs text-neutral-400 leading-relaxed">{content}</p>
      </div>
    </div>
  );
}

function RiskItem({ label, content }: any) {
  return (
    <div className="space-y-1">
      <p className="text-[10px] font-bold text-orange-500 uppercase tracking-widest">{label}</p>
      <p className="text-xs text-neutral-400 leading-relaxed">{content}</p>
    </div>
  );
}

function ScenarioBox({ label, content, color }: any) {
  const colors: any = {
    emerald: 'border-emerald-500/20 text-emerald-500',
    blue: 'border-blue-500/20 text-blue-500',
    red: 'border-red-500/20 text-red-500'
  };
  return (
    <div className={`p-3 border-l-2 ${colors[color]} bg-neutral-800/30 space-y-1`}>
      <p className="text-[9px] font-bold uppercase tracking-widest opacity-60">{label}</p>
      <p className="text-[11px] text-neutral-300 leading-relaxed">{content}</p>
    </div>
  );
}

function RiskBox({ label, content, color }: any) {
  const colors: any = {
    red: 'text-red-500 bg-red-500/5 border-red-500/10',
    orange: 'text-orange-500 bg-orange-500/5 border-orange-500/10',
    yellow: 'text-yellow-500 bg-yellow-500/5 border-yellow-500/10'
  };
  return (
    <div className={`p-4 rounded-2xl border ${colors[color]} space-y-2`}>
      <p className="text-[10px] font-bold uppercase tracking-widest">{label}</p>
      <p className="text-xs leading-relaxed opacity-80">{content}</p>
    </div>
  );
}

function OptimizationBox({ label, content }: any) {
  return (
    <div className="p-4 bg-neutral-800/50 border border-neutral-700/50 rounded-2xl space-y-2">
      <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">{label} OPTIMIZATION</p>
      <p className="text-xs text-neutral-300 leading-relaxed">{content}</p>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-96 bg-neutral-900 border border-neutral-800 rounded-3xl border-dashed">
      <div className="w-16 h-16 bg-neutral-800 rounded-2xl flex items-center justify-center mb-4">
        <ShieldAlert className="w-8 h-8 text-neutral-600" />
      </div>
      <h3 className="text-lg font-bold text-white uppercase tracking-tight">No Logistics Intelligence Data</h3>
      <p className="text-xs text-neutral-500 font-mono mt-2 max-w-xs text-center">
        Initialize logistics data from the Admin Panel to generate strategic supply chain analysis.
      </p>
    </div>
  );
}
