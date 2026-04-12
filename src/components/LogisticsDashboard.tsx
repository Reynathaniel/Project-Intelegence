import React, { useState, useEffect } from 'react';
import { Project, MaterialRequest, DailyReport, UserProfile } from '../types';
import { db, collection, query, where, onSnapshot, addDoc, updateDoc, doc, handleFirestoreError, OperationType } from '../firebase';
import { compressImage } from '../services/imageService';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Truck, 
  Plus, 
  Search, 
  Filter, 
  CheckCircle2, 
  Clock, 
  AlertTriangle,
  MapPin,
  Package,
  ArrowRightLeft,
  ChevronRight,
  X,
  Save,
  Camera,
  ImageIcon,
  Trash2,
  Fuel,
  ArrowDownCircle,
  ArrowUpCircle,
  Download,
  Eye
} from 'lucide-react';
import { generateLogisticsSummaryReport } from '../services/pdfService';

interface LogisticsDashboardProps {
  project: Project;
  profile: UserProfile;
}

export default function LogisticsDashboard({ project, profile }: LogisticsDashboardProps) {
  const [requests, setRequests] = useState<MaterialRequest[]>([]);
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'All' | 'Proses' | 'Done'>('All');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingRequest, setEditingRequest] = useState<MaterialRequest | null>(null);
  const [showAllRequests, setShowAllRequests] = useState(false);
  const [showFuelDetails, setShowFuelDetails] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'materialRequests'), where('projectId', '==', project.id));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MaterialRequest));
      setRequests(list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'materialRequests');
    });

    const rq = query(collection(db, 'reports'), where('projectId', '==', project.id), where('discipline', '==', 'Logistics'));
    const unsubscribeReports = onSnapshot(rq, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DailyReport));
      setReports(list);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'reports');
    });

    return () => {
      unsubscribe();
      unsubscribeReports();
    };
  }, [project.id]);

  const fuelStats = reports.reduce((acc, report) => {
    try {
      const data = JSON.parse(report.data);
      const fuelIn = data.fuelIn?.reduce((sum: number, item: any) => sum + (item.volume || 0), 0) || 0;
      const fuelOut = data.fuelOut?.reduce((sum: number, item: any) => sum + (item.volume || 0), 0) || 0;
      return {
        totalIn: acc.totalIn + fuelIn,
        totalOut: acc.totalOut + fuelOut,
        balance: acc.balance + fuelIn - fuelOut
      };
    } catch (e) {
      return acc;
    }
  }, { totalIn: 0, totalOut: 0, balance: 0 });

  const filteredRequests = requests.filter(req => {
    const matchesSearch = req.itemName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         req.spbNo.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'All' || req.status === filterStatus;
    const matchesRole = profile.role === 'Logistics' || profile.role === 'Admin' || req.discipline === profile.role;
    return matchesSearch && matchesStatus && matchesRole;
  });

  const now = new Date();
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const stats = {
    total: requests.length,
    pending: requests.filter(r => r.status === 'Proses' || !(r.approval?.cm && r.approval?.cc && r.approval?.pm)).length,
    completed: requests.filter(r => r.status === 'Done').length,
    lowStock: requests.filter(r => r.remaining < (r.volumeSPB * 0.2)).length,
    notApprovedOverWeek: requests.filter(r => {
      const isFullyApproved = r.approval?.cm && r.approval?.cc && r.approval?.pm;
      const requestDate = new Date(r.date);
      return !isFullyApproved && requestDate < oneWeekAgo;
    }).length,
    notArrivedOverWeek: requests.filter(r => {
      const isFullyApproved = r.approval?.cm && r.approval?.cc && r.approval?.pm;
      if (!isFullyApproved || !r.approvalDate) return false;
      const approvalDate = new Date(r.approvalDate);
      const hasArrived = (r.totalVolume || 0) > 0;
      return !hasArrived && approvalDate < oneWeekAgo;
    }).length
  };

  const handleApprove = async (requestId: string, role: 'cm' | 'cc' | 'pm') => {
    try {
      const request = requests.find(r => r.id === requestId);
      if (!request) return;

      const newApproval = { ...request.approval, [role]: true };
      const isFullyApproved = newApproval.cm && newApproval.cc && newApproval.pm;
      
      const updateData: any = {
        approval: newApproval
      };

      if (isFullyApproved && !request.approvalDate) {
        updateData.approvalDate = new Date().toISOString().split('T')[0];
      }
      
      await updateDoc(doc(db, 'materialRequests', requestId), updateData);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'materialRequests');
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white uppercase tracking-tight">Logistics Hub</h2>
          <p className="text-neutral-500 text-sm font-mono">Inventory Management & Fuel Tracking</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowAllRequests(true)}
            className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-xl flex items-center gap-2 transition-colors text-sm font-bold uppercase tracking-wider border border-neutral-700"
          >
            <Package className="w-4 h-4" />
            View All Requests
          </button>
          <button
            onClick={() => generateLogisticsSummaryReport(project, reports, requests)}
            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl flex items-center gap-2 transition-colors text-sm font-bold uppercase tracking-wider shadow-[0_0_15px_rgba(16,185,129,0.2)]"
          >
            <Download className="w-4 h-4" />
            Download Summary PDF
          </button>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Total Requests" 
          value={stats.total.toString()} 
          icon={<Package className="text-blue-500" />} 
          subtitle="All SPB entries"
        />
        <StatCard 
          title="Fuel Balance" 
          value={`${fuelStats.balance} L`} 
          icon={<Fuel className="text-amber-500" />} 
          subtitle={`In: ${fuelStats.totalIn}L | Out: ${fuelStats.totalOut}L`}
        />
        <StatCard 
          title="Completed" 
          value={stats.completed.toString()} 
          icon={<CheckCircle2 className="text-emerald-500" />} 
          subtitle="Material delivered"
        />
        <StatCard 
          title="Low Inventory" 
          value={stats.lowStock.toString()} 
          icon={<AlertTriangle className="text-red-500" />} 
          subtitle="Below 20% threshold"
        />
      </div>

      {/* Fuel Status Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-neutral-900 border border-neutral-800 rounded-3xl p-8">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-500/20 rounded-lg">
                <Fuel className="w-5 h-5 text-amber-500" />
              </div>
              <h3 className="text-lg font-bold text-white uppercase tracking-widest">Fuel Consumption Status</h3>
            </div>
            <button
              onClick={() => setShowFuelDetails(true)}
              className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-xl flex items-center gap-2 transition-colors text-xs font-bold uppercase tracking-wider border border-neutral-700"
            >
              <Eye className="w-4 h-4" />
              View Details
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 bg-neutral-800/30 rounded-2xl border border-neutral-800/50">
              <p className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest mb-2">Current Balance</p>
              <p className="text-3xl font-bold text-emerald-400">{fuelStats.balance} <span className="text-sm font-normal text-neutral-500">LITERS</span></p>
            </div>
            <div className="p-6 bg-neutral-800/30 rounded-2xl border border-neutral-800/50">
              <div className="flex items-center gap-2 text-emerald-500 mb-2">
                <ArrowDownCircle className="w-3 h-3" />
                <p className="text-[10px] font-mono uppercase tracking-widest">Total Fuel In</p>
              </div>
              <p className="text-2xl font-bold text-white">+{fuelStats.totalIn} <span className="text-xs font-normal text-neutral-500">L</span></p>
            </div>
            <div className="p-6 bg-neutral-800/30 rounded-2xl border border-neutral-800/50">
              <div className="flex items-center gap-2 text-orange-500 mb-2">
                <ArrowUpCircle className="w-3 h-3" />
                <p className="text-[10px] font-mono uppercase tracking-widest">Total Fuel Out</p>
              </div>
              <p className="text-2xl font-bold text-white">-{fuelStats.totalOut} <span className="text-xs font-normal text-neutral-500">L</span></p>
            </div>
          </div>
        </div>

        <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-8 space-y-6">
          <h3 className="text-sm font-bold text-white uppercase tracking-widest flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-orange-500" />
            Quick Alerts
          </h3>
          <div className="space-y-4">
            {fuelStats.balance < 500 && (
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl">
                <p className="text-xs font-bold text-red-400 mb-1 uppercase">Low Fuel Warning</p>
                <p className="text-[10px] text-red-400/70 leading-relaxed">Fuel balance is below 500L. Please coordinate with procurement for replenishment.</p>
              </div>
            )}
            {stats.notApprovedOverWeek > 0 && (
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl">
                <p className="text-xs font-bold text-red-400 mb-1 uppercase">Approval Overdue</p>
                <p className="text-[10px] text-red-400/70 leading-relaxed">{stats.notApprovedOverWeek} requests have been pending for more than a week.</p>
              </div>
            )}
            {stats.notArrivedOverWeek > 0 && (
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl">
                <p className="text-xs font-bold text-red-400 mb-1 uppercase">Delivery Overdue</p>
                <p className="text-[10px] text-red-400/70 leading-relaxed">{stats.notArrivedOverWeek} approved requests have not arrived for more than a week.</p>
              </div>
            )}
            {stats.lowStock > 0 && (
              <div className="p-4 bg-orange-500/10 border border-orange-500/20 rounded-2xl">
                <p className="text-xs font-bold text-orange-400 mb-1 uppercase">Material Shortage</p>
                <p className="text-[10px] text-orange-400/70 leading-relaxed">{stats.lowStock} items are below 20% inventory threshold.</p>
              </div>
            )}
            <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-2xl">
              <p className="text-xs font-bold text-blue-400 mb-1 uppercase">Pending SPB</p>
              <p className="text-[10px] text-blue-400/70 leading-relaxed">{stats.pending} SPB requests are still in progress.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Summary View of Recent Requests */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-8 space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-white uppercase tracking-widest flex items-center gap-2">
            <Package className="w-5 h-5 text-emerald-500" />
            Recent Material Requests
          </h3>
          <button 
            onClick={() => setShowAllRequests(true)}
            className="text-xs font-bold text-emerald-500 hover:text-emerald-400 uppercase tracking-widest flex items-center gap-1"
          >
            View All <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {requests.slice(0, 6).map((req) => (
            <div 
              key={req.id} 
              onClick={() => setEditingRequest(req)}
              className="p-4 bg-neutral-800/30 border border-neutral-800 rounded-2xl hover:border-neutral-700 transition-all cursor-pointer group"
            >
              <div className="flex justify-between items-start mb-3">
                <div>
                  <p className="text-xs font-bold text-white group-hover:text-emerald-400 transition-colors">{req.spbNo}</p>
                  <p className="text-[9px] text-neutral-500 font-mono">{req.date}</p>
                </div>
                <span className={`px-2 py-0.5 rounded text-[8px] font-mono uppercase tracking-widest ${
                  req.status === 'Done' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-orange-500/10 text-orange-500'
                }`}>
                  {req.status}
                </span>
              </div>
              <p className="text-sm font-bold text-neutral-300 mb-3 truncate">{req.itemName}</p>
              <div className="flex items-center justify-between text-[10px]">
                <div className="flex items-center gap-1.5">
                  <div className={`w-1.5 h-1.5 rounded-full ${req.approval?.cm && req.approval?.cc && req.approval?.pm ? 'bg-emerald-500' : 'bg-orange-500'}`} />
                  <span className="text-neutral-500 uppercase">Approval</span>
                </div>
                <div className="text-right">
                  <span className="text-neutral-500 uppercase mr-2">Stock:</span>
                  <span className={req.remaining < (req.volumeSPB * 0.2) ? 'text-red-400' : 'text-emerald-400'}>
                    {req.remaining} {req.unit}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* All Requests Modal */}
      <AnimatePresence>
        {showAllRequests && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-6xl bg-neutral-900 border border-neutral-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
            >
              <div className="p-6 border-b border-neutral-800 flex items-center justify-between bg-neutral-900/50">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-500/20 rounded-lg">
                    <Package className="w-5 h-5 text-emerald-500" />
                  </div>
                  <h3 className="text-xl font-bold text-white tracking-tight uppercase">
                    All Material Requests
                  </h3>
                </div>
                <button onClick={() => setShowAllRequests(false)} className="text-neutral-500 hover:text-white">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-6 bg-neutral-900/50 border-b border-neutral-800 flex flex-col sm:flex-row items-center gap-4">
                <div className="relative flex-1 w-full">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                  <input 
                    type="text"
                    placeholder="Search items or SPB..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-neutral-800 border border-neutral-700 rounded-xl pl-10 pr-4 py-2 text-sm text-white outline-none focus:border-emerald-500"
                  />
                </div>
                <select 
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value as any)}
                  className="bg-neutral-800 border border-neutral-700 rounded-xl px-4 py-2 text-sm text-white outline-none focus:border-emerald-500 w-full sm:w-auto"
                >
                  <option value="All">All Status</option>
                  <option value="Proses">In Progress</option>
                  <option value="Done">Completed</option>
                </select>
                <button 
                  onClick={() => {
                    setShowAllRequests(false);
                    setShowAddModal(true);
                  }}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2 bg-emerald-500 text-black font-bold rounded-xl hover:bg-emerald-400 transition-all text-sm"
                >
                  <ArrowRightLeft className="w-4 h-4" />
                  UPDATE SPB
                </button>
              </div>

              <div className="overflow-auto flex-1">
                <table className="w-full text-left border-collapse">
                  <thead className="sticky top-0 z-10 bg-neutral-900">
                    <tr className="border-b border-neutral-800 bg-neutral-800/30">
                      <th className="p-4 text-[10px] font-mono text-neutral-500 uppercase tracking-widest">SPB Info</th>
                      <th className="p-4 text-[10px] font-mono text-neutral-500 uppercase tracking-widest">Material & Work</th>
                      <th className="p-4 text-[10px] font-mono text-neutral-500 uppercase tracking-widest">Approvals</th>
                      <th className="p-4 text-[10px] font-mono text-neutral-500 uppercase tracking-widest">Inventory Status</th>
                      <th className="p-4 text-[10px] font-mono text-neutral-500 uppercase tracking-widest">Location</th>
                      <th className="p-4 text-[10px] font-mono text-neutral-500 uppercase tracking-widest">Status</th>
                      <th className="p-4 text-[10px] font-mono text-neutral-500 uppercase tracking-widest">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRequests.map((req) => (
                      <tr key={req.id} className="border-b border-neutral-800/50 hover:bg-neutral-800/30 transition-colors group">
                        <td className="p-4">
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-white truncate">{req.spbNo}</p>
                            <p className="text-[10px] text-neutral-500 font-mono">{req.date}</p>
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-emerald-400 truncate">{req.itemName}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <ArrowRightLeft className="w-3 h-3 text-neutral-600" />
                              <p className="text-[10px] text-neutral-500 truncate">{req.workItem || 'N/A'}</p>
                            </div>
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="space-y-1.5 min-w-[120px]">
                            <div className="flex items-center gap-2">
                              <div className={`w-1.5 h-1.5 rounded-full ${req.approval?.cm ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-neutral-700'}`} />
                              <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-tighter">CM</span>
                              {profile.roles?.includes('CM') && !req.approval?.cm && (
                                <button onClick={() => handleApprove(req.id!, 'cm')} className="text-[8px] text-emerald-500 hover:text-emerald-400 font-bold uppercase ml-auto transition-colors">Approve</button>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <div className={`w-1.5 h-1.5 rounded-full ${req.approval?.cc ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-neutral-700'}`} />
                              <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-tighter">CC</span>
                              {profile.roles?.includes('CC') && !req.approval?.cc && (
                                <button onClick={() => handleApprove(req.id!, 'cc')} className="text-[8px] text-emerald-500 hover:text-emerald-400 font-bold uppercase ml-auto transition-colors">Approve</button>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <div className={`w-1.5 h-1.5 rounded-full ${req.approval?.pm ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-neutral-700'}`} />
                              <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-tighter">PM</span>
                              {profile.roles?.includes('Project Manager') && !req.approval?.pm && (
                                <button onClick={() => handleApprove(req.id!, 'pm')} className="text-[8px] text-emerald-500 hover:text-emerald-400 font-bold uppercase ml-auto transition-colors">Approve</button>
                              )}
                            </div>
                          </div>
                        </td>

                        <td className="p-4">
                          <div className="space-y-1">
                            <div className="flex justify-between text-[10px] font-mono">
                              <span className="text-neutral-500">Used: {req.used} {req.unit}</span>
                              <span className={req.remaining < (req.volumeSPB * 0.2) ? 'text-red-400' : 'text-emerald-400'}>
                                Stock: {req.remaining}
                              </span>
                            </div>
                            <div className="w-32 h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                              <div 
                                className={`h-full transition-all ${req.remaining < (req.volumeSPB * 0.2) ? 'bg-red-500' : 'bg-emerald-500'}`}
                                style={{ width: `${Math.min(100, (req.remaining / req.volumeSPB) * 100)}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <MapPin className="w-3 h-3 text-neutral-600" />
                            <span className="text-xs text-neutral-400">{req.location} - {req.area || 'General'}</span>
                          </div>
                        </td>
                        <td className="p-4">
                          <span className={`px-2 py-1 rounded-md text-[9px] font-mono uppercase tracking-widest ${
                            req.status === 'Done' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-orange-500/10 text-orange-500'
                          }`}>
                            {req.status}
                          </span>
                        </td>
                        <td className="p-4">
                          <button 
                            onClick={() => {
                              setShowAllRequests(false);
                              setEditingRequest(req);
                            }}
                            className="p-2 hover:bg-neutral-800 rounded-lg text-neutral-600 hover:text-emerald-400 transition-all"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {(showAddModal || editingRequest) && (
          <MaterialRequestModal 
            project={project}
            request={editingRequest}
            allRequests={requests}
            profile={profile}
            onClose={() => {
              setShowAddModal(false);
              setEditingRequest(null);
            }}
          />
        )}
      </AnimatePresence>

      {/* Fuel History Modal */}
      <AnimatePresence>
        {showFuelDetails && (
          <FuelHistoryModal 
            reports={reports}
            onClose={() => setShowFuelDetails(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function FuelHistoryModal({ reports, onClose }: { reports: DailyReport[], onClose: () => void }) {
  const [searchTerm, setSearchTerm] = useState('');
  
  const fuelIn = reports.flatMap(r => {
    try {
      const d = JSON.parse(r.data);
      return (d.fuelIn || []).map((fi: any) => ({ ...fi, date: r.date }));
    } catch(e) { return []; }
  }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const fuelOut = reports.flatMap(r => {
    try {
      const d = JSON.parse(r.data);
      return (d.fuelOut || []).map((fo: any) => ({ ...fo, date: r.date }));
    } catch(e) { return []; }
  }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const filteredIn = fuelIn.filter(item => 
    item.source?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    item.date?.includes(searchTerm)
  );

  const filteredOut = fuelOut.filter(item => 
    item.vehicleName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    item.driverName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.date?.includes(searchTerm)
  );

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-neutral-900 border border-neutral-800 rounded-3xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl"
      >
        <div className="p-6 border-b border-neutral-800 flex items-center justify-between bg-neutral-900/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/20 rounded-lg">
              <Fuel className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white uppercase tracking-widest">Fuel Consumption History</h3>
              <p className="text-[10px] text-neutral-500 font-mono uppercase tracking-widest mt-1">Detailed logs of all fuel transactions</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-neutral-800 rounded-full text-neutral-400 transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 border-b border-neutral-800 bg-neutral-900/30">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
            <input
              type="text"
              placeholder="Search by source, vehicle, driver or date..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-neutral-800 border border-neutral-700 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition-all"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Fuel In Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-emerald-500">
                  <ArrowDownCircle className="w-4 h-4" />
                  <span className="text-xs font-bold uppercase tracking-widest">Fuel In (Masuk)</span>
                </div>
                <span className="text-[10px] font-mono text-neutral-500">{filteredIn.length} Records</span>
              </div>
              <div className="space-y-3">
                {filteredIn.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between p-4 bg-neutral-800/30 rounded-2xl border border-neutral-800/50 hover:border-neutral-700 transition-colors">
                    <div>
                      <p className="text-sm font-bold text-white">{item.source}</p>
                      <p className="text-[10px] text-neutral-500 font-mono mt-1">{item.date}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-lg font-bold text-emerald-400">+{item.volume} L</span>
                    </div>
                  </div>
                ))}
                {filteredIn.length === 0 && (
                  <div className="text-center py-12 bg-neutral-800/20 rounded-2xl border border-dashed border-neutral-800">
                    <p className="text-xs text-neutral-500 font-mono uppercase tracking-widest">No fuel-in records found</p>
                  </div>
                )}
              </div>
            </div>

            {/* Fuel Out Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-orange-500">
                  <ArrowUpCircle className="w-4 h-4" />
                  <span className="text-xs font-bold uppercase tracking-widest">Fuel Out (Keluar)</span>
                </div>
                <span className="text-[10px] font-mono text-neutral-500">{filteredOut.length} Records</span>
              </div>
              <div className="space-y-3">
                {filteredOut.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between p-4 bg-neutral-800/30 rounded-2xl border border-neutral-800/50 hover:border-neutral-700 transition-colors">
                    <div>
                      <p className="text-sm font-bold text-white">{item.vehicleName}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <p className="text-[10px] text-neutral-500 font-mono">{item.date}</p>
                        <span className="text-neutral-700">•</span>
                        <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider">{item.driverName}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-lg font-bold text-orange-400">-{item.volume} L</span>
                    </div>
                  </div>
                ))}
                {filteredOut.length === 0 && (
                  <div className="text-center py-12 bg-neutral-800/20 rounded-2xl border border-dashed border-neutral-800">
                    <p className="text-xs text-neutral-500 font-mono uppercase tracking-widest">No fuel-out records found</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </motion.div>
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

function MaterialRequestModal({ project, request, onClose, profile, allRequests }: { project: Project, request: MaterialRequest | null, onClose: () => void, profile: UserProfile, allRequests: MaterialRequest[] }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<MaterialRequest>>(request || {
    projectId: project.id,
    date: new Date().toISOString().split('T')[0],
    spbNo: '',
    spbName: '',
    itemName: '',
    unit: 'bh',
    volumeSPB: 0,
    purchases: [],
    totalVolume: 0,
    totalPrice: 0,
    used: 0,
    remaining: 0,
    location: 'Sorong',
    status: 'Proses',
    pic: '',
    remarks: '',
    approval: { cm: false, cc: false, pm: false },
    workItem: '',
    area: '',
    usedWorkItem: '',
    usedArea: '',
    usedDiscipline: profile.role,
    usedPhotoUrl: '',
    usages: [],
    requestedBy: profile.name,
    discipline: profile.role
  });

  // Auto-calculate totalVolume whenever purchases or usages change
  useEffect(() => {
    const newTotalVolume = (formData.purchases || []).reduce((sum, p) => sum + (p.volume || 0), 0);
    const newTotalPrice = (formData.purchases || []).reduce((sum, p) => sum + (p.total || 0), 0);
    const newUsed = (formData.usages || []).reduce((sum, u) => sum + (u.volume || 0), 0);
    const newRemaining = newTotalVolume - newUsed;
    
    if (newTotalVolume !== formData.totalVolume || 
        newTotalPrice !== formData.totalPrice || 
        newRemaining !== formData.remaining ||
        newUsed !== formData.used) {
      setFormData(prev => ({
        ...prev,
        totalVolume: newTotalVolume,
        totalPrice: newTotalPrice,
        used: newUsed,
        remaining: newRemaining
      }));
    }
  }, [formData.purchases, formData.usages, formData.totalVolume, formData.totalPrice, formData.remaining, formData.used]);

  // Auto-fill logic
  useEffect(() => {
    if (request) return; // Don't auto-fill if we are explicitly editing a specific request from the list

    // If both are empty, clear the ID
    if (!formData.spbNo && !formData.itemName) {
      if (formData.id) {
        setFormData(prev => ({ ...prev, id: undefined }));
      }
      return;
    }

    // Try to find a match by SPB No or Item Name
    const match = allRequests.find(r => 
      (formData.spbNo && r.spbNo === formData.spbNo) || 
      (formData.itemName && r.itemName === formData.itemName)
    );

    if (match) {
      // Only update if the ID is different to avoid infinite loops
      if (formData.id !== match.id) {
        setFormData(prev => ({
          ...prev,
          id: match.id,
          spbNo: match.spbNo,
          spbName: match.spbName,
          itemName: match.itemName,
          unit: match.unit,
          volumeSPB: match.volumeSPB,
          purchases: match.purchases || [],
          totalVolume: match.totalVolume,
          totalPrice: match.totalPrice,
          used: match.used,
          usages: match.usages || [],
          location: match.location,
          status: match.status,
          workItem: match.workItem,
          area: match.area,
          remarks: match.remarks
        }));
      }
    } else {
      // If no match found and we had an ID, clear it (user might have typed a new non-existent number)
      if (formData.id) {
        setFormData(prev => ({ ...prev, id: undefined }));
      }
    }
  }, [formData.spbNo, formData.itemName, allRequests, request, formData.id]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, callback: (base64: string) => void) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        setError(null);
        const compressedBase64 = await compressImage(file, 600, 600, 0.5);
        callback(compressedBase64);
      } catch (err) {
        console.error('Failed to compress image:', err);
        setError('Failed to process image. Please try a smaller or different image.');
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.id) {
      setError('Please select an existing SPB request to update.');
      return;
    }

    // Check for full approval before processing further
    const isFullyApproved = formData.approval?.cm && formData.approval?.cc && formData.approval?.pm;
    if (!isFullyApproved) {
      const originalRequest = allRequests.find(r => r.id === formData.id);
      const hasNewPurchases = (formData.purchases?.length || 0) > (originalRequest?.purchases?.length || 0);
      const hasNewUsages = (formData.usages?.length || 0) > (originalRequest?.usages?.length || 0);
      
      if (hasNewPurchases || hasNewUsages || formData.status === 'Done') {
        setError('Cannot process further (add receipts/usages or complete) until full approval (CM, CC, PM) is received.');
        return;
      }
    }

    setLoading(true);
    try {
      const data = {
        ...formData,
        remaining: (formData.totalVolume || 0) - (formData.used || 0)
      };
      
      await updateDoc(doc(db, 'materialRequests', formData.id), data);
      onClose();
    } catch (err) {
      console.error('Failed to save SPB:', err);
      setError('Failed to update request. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="w-full max-w-2xl bg-neutral-900 border border-neutral-800 rounded-3xl overflow-hidden shadow-2xl"
      >
        <form onSubmit={handleSubmit}>
          <div className="p-6 border-b border-neutral-800 flex items-center justify-between bg-neutral-900/50">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-500/20 rounded-lg">
                <ArrowRightLeft className="w-5 h-5 text-emerald-500" />
              </div>
              <h3 className="text-xl font-bold text-white tracking-tight uppercase">
                Update SPB Request
              </h3>
            </div>
            <button type="button" onClick={onClose} className="text-neutral-500 hover:text-white">
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="p-8 space-y-10 max-h-[calc(100dvh-10rem)] overflow-y-auto">
            {error && (
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3 text-red-500 text-sm">
                <AlertTriangle className="w-4 h-4" />
                {error}
              </div>
            )}

            {!formData.id && !request && (
              <div className="p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-2xl">
                <div className="flex items-center gap-3 mb-2">
                  <Search className="w-4 h-4 text-emerald-500" />
                  <p className="text-xs font-bold text-emerald-500 uppercase tracking-widest">Search Mode Active</p>
                </div>
                <p className="text-[11px] text-neutral-400 leading-relaxed">
                  Please enter an existing <strong>SPB Number</strong> or <strong>Item Name</strong> below. 
                  The system will automatically retrieve the data for you to update.
                </p>
              </div>
            )}
            
            {/* Search Helpers */}
            <datalist id="spb-numbers">
              {allRequests.map(r => <option key={r.id} value={r.spbNo}>{r.itemName}</option>)}
            </datalist>
            <datalist id="item-names">
              {allRequests.map(r => <option key={r.id} value={r.itemName}>{r.spbNo}</option>)}
            </datalist>

            {/* Section 1: Stok yang Diminta (Requested Stock) */}
            <div className="space-y-6">
              <div className="flex items-center gap-3 pb-2 border-b border-neutral-800">
                <Package className="w-5 h-5 text-emerald-500" />
                <h4 className="text-sm font-bold text-white uppercase tracking-widest">1. Stok yang Diminta (Requested)</h4>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest flex items-center justify-between">
                    SPB Number
                    {formData.id && <span className="text-[9px] text-emerald-500 font-bold">MATCHED</span>}
                  </label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-600" />
                    <input 
                      required
                      list="spb-numbers"
                      value={formData.spbNo || ''}
                      onChange={e => setFormData({...formData, spbNo: e.target.value})}
                      className={`w-full bg-neutral-800 border rounded-xl pl-10 pr-4 py-3 text-white outline-none transition-all ${
                        formData.id ? 'border-emerald-500/50 focus:border-emerald-500' : 'border-neutral-700 focus:border-emerald-500'
                      }`}
                      placeholder="Search by SPB No..."
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest">SPB Name</label>
                  <input 
                    required
                    value={formData.spbName || ''}
                    onChange={e => setFormData({...formData, spbName: e.target.value})}
                    className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-4 py-3 text-white outline-none focus:border-emerald-500"
                    placeholder="e.g. SPB Material..."
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest flex items-center justify-between">
                    Material Item
                    {formData.id && <span className="text-[9px] text-emerald-500 font-bold">MATCHED</span>}
                  </label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-600" />
                    <input 
                      required
                      list="item-names"
                      value={formData.itemName || ''}
                      onChange={e => setFormData({...formData, itemName: e.target.value})}
                      className={`w-full bg-neutral-800 border rounded-xl pl-10 pr-4 py-3 text-white outline-none transition-all ${
                        formData.id ? 'border-emerald-500/50 focus:border-emerald-500' : 'border-neutral-700 focus:border-emerald-500'
                      }`}
                      placeholder="Search by Item Name..."
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest">Unit</label>
                    <input 
                      required
                      value={formData.unit || ''}
                      onChange={e => setFormData({...formData, unit: e.target.value})}
                      className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-4 py-3 text-white outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest">Requested Vol</label>
                    <input 
                      type="number"
                      required
                      value={formData.volumeSPB || 0}
                      onChange={e => setFormData({...formData, volumeSPB: parseFloat(e.target.value) || 0})}
                      className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-4 py-3 text-white outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest">Work Item</label>
                  <input 
                    value={formData.workItem || ''}
                    onChange={e => setFormData({...formData, workItem: e.target.value})}
                    className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-4 py-3 text-white outline-none focus:border-emerald-500"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest">Area/Location</label>
                  <input 
                    value={formData.area || ''}
                    onChange={e => setFormData({...formData, area: e.target.value})}
                    className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-4 py-3 text-white outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
            </div>

            {/* Section 2: Stok yang Diterima (Received Stock) */}
            <div className="space-y-6">
              <div className="flex items-center gap-3 pb-2 border-b border-neutral-800">
                <Truck className="w-5 h-5 text-blue-500" />
                <h4 className="text-sm font-bold text-white uppercase tracking-widest">2. Stok yang Diterima (Inventory Site)</h4>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest">Total Received (Stock in Site)</label>
                  <input 
                    type="number"
                    readOnly
                    value={formData.totalVolume || 0}
                    className="w-full bg-neutral-800/50 border border-neutral-700 rounded-xl px-4 py-3 text-white outline-none font-bold text-emerald-400 cursor-not-allowed"
                  />
                  <p className="text-[9px] text-neutral-600 font-mono italic">Auto-calculated from receipt history</p>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest">Status SPB</label>
                  <select 
                    value={formData.status || 'Proses'}
                    onChange={e => setFormData({...formData, status: e.target.value as any})}
                    className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-4 py-3 text-white outline-none focus:border-emerald-500"
                  >
                    <option value="Proses">Proses</option>
                    <option value="Done">Done</option>
                  </select>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-mono text-neutral-600 uppercase tracking-widest">Purchase / Receipt History</p>
                  <button 
                    type="button"
                    onClick={() => {
                      const current = formData.purchases || [];
                      setFormData({
                        ...formData,
                        purchases: [...current, { volume: 0, price: 0, total: 0 }]
                      });
                    }}
                    className="text-[10px] font-bold text-emerald-500 hover:text-emerald-400 flex items-center gap-1 uppercase tracking-wider"
                  >
                    <Plus className="w-3 h-3" />
                    Add Receipt
                  </button>
                </div>
                <div className="grid grid-cols-1 gap-4">
                  {(formData.purchases || []).map((p, i) => (
                    <div key={i} className="p-4 bg-neutral-800/30 rounded-xl border border-neutral-800 space-y-4">
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] font-bold text-neutral-400 uppercase">Receipt {i + 1}</p>
                        <button 
                          type="button"
                          onClick={() => {
                            const current = [...(formData.purchases || [])];
                            current.splice(i, 1);
                            setFormData({ ...formData, purchases: current });
                          }}
                          className="text-red-500 hover:text-red-400 transition-colors"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="space-y-1">
                          <label className="text-[9px] text-neutral-500 uppercase">Volume</label>
                          <input 
                            type="number"
                            placeholder="Volume"
                            value={p.volume || ''}
                            onChange={e => {
                              const val = parseFloat(e.target.value) || 0;
                              const current = [...(formData.purchases || [])];
                              current[i] = { ...current[i], volume: val, total: val * (current[i].price || 0) };
                              setFormData({ ...formData, purchases: current });
                            }}
                            className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] text-neutral-500 uppercase">Price</label>
                          <input 
                            type="number"
                            placeholder="Price"
                            value={p.price || ''}
                            onChange={e => {
                              const val = parseFloat(e.target.value) || 0;
                              const current = [...(formData.purchases || [])];
                              current[i] = { ...current[i], price: val, total: val * (current[i].volume || 0) };
                              setFormData({ ...formData, purchases: current });
                            }}
                            className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] text-neutral-500 uppercase">Total</label>
                          <input 
                            type="number"
                            readOnly
                            value={p.total || 0}
                            className="w-full bg-neutral-900/50 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-emerald-400 font-bold"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] text-neutral-500 uppercase">Invoice/Receipt</label>
                          <div className="relative group h-[34px]">
                            <div className="w-full h-full bg-neutral-900 rounded-lg border border-neutral-700 flex items-center justify-center overflow-hidden group-hover:border-emerald-500 transition-all">
                              {p.photoUrl ? (
                                <>
                                  <img src={p.photoUrl} alt="Receipt" className="w-full h-full object-cover" />
                                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                    <Camera className="w-3 h-3 text-white" />
                                  </div>
                                </>
                              ) : (
                                <div className="flex items-center gap-2 text-[9px] text-neutral-600">
                                  <Camera className="w-3 h-3" />
                                  <span>Upload</span>
                                </div>
                              )}
                            </div>
                            <input 
                              type="file"
                              accept="image/*"
                              onChange={(e) => handleImageUpload(e, (base64) => {
                                const current = [...(formData.purchases || [])];
                                current[i] = { ...current[i], photoUrl: base64 };
                                setFormData({ ...formData, purchases: current });
                              })}
                              className="absolute inset-0 opacity-0 cursor-pointer"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  {(formData.purchases || []).length === 0 && (
                    <div className="p-8 border-2 border-dashed border-neutral-800 rounded-2xl flex flex-col items-center justify-center text-neutral-600">
                      <Package className="w-8 h-8 mb-2 opacity-20" />
                      <p className="text-xs font-mono uppercase tracking-widest">No receipt history found</p>
                      <p className="text-[10px] mt-1">Click "Add Receipt" to record a new purchase</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Section 3: Material yang Digunakan (Used Material) */}
            <div className="space-y-6">
              <div className="flex items-center gap-3 pb-2 border-b border-neutral-800">
                <ArrowRightLeft className="w-5 h-5 text-orange-500" />
                <h4 className="text-sm font-bold text-white uppercase tracking-widest">3. Material yang Digunakan</h4>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest">Total Volume Used</label>
                  <input 
                    type="number"
                    readOnly
                    value={formData.used || 0}
                    className="w-full bg-neutral-800/50 border border-neutral-700 rounded-xl px-4 py-3 text-white outline-none font-bold text-orange-400 cursor-not-allowed"
                  />
                  <p className="text-[9px] text-neutral-600 font-mono italic">Auto-calculated from usage history</p>
                </div>
                <div className="p-4 bg-neutral-800/50 rounded-xl border border-neutral-700 flex flex-col justify-center">
                  <label className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest mb-1">Remaining Stock</label>
                  <p className={`text-2xl font-bold ${(formData.totalVolume || 0) - (formData.used || 0) < 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                    {(formData.totalVolume || 0) - (formData.used || 0)} <span className="text-xs font-normal text-neutral-500">{formData.unit}</span>
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-mono text-neutral-600 uppercase tracking-widest">Usage History (Gradual Usage)</p>
                  <button 
                    type="button"
                    onClick={() => {
                      const current = formData.usages || [];
                      setFormData({
                        ...formData,
                        usages: [...current, { 
                          date: new Date().toISOString().split('T')[0],
                          volume: 0, 
                          workItem: '', 
                          area: '', 
                          discipline: profile.role,
                          remarks: ''
                        }]
                      });
                    }}
                    className="text-[10px] font-bold text-orange-500 hover:text-orange-400 flex items-center gap-1 uppercase tracking-wider"
                  >
                    <Plus className="w-3 h-3" />
                    Add Usage Record
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  {(() => {
                    const sortedUsages = [...(formData.usages || [])].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
                    let cumulativeUsed = 0;
                    
                    return (formData.usages || []).map((u, i) => {
                      // For the visual "Balance After", we use the sorted order to show the timeline
                      // But the user edits the original array. This is tricky.
                      // Let's just show the balance based on the current list order for simplicity, 
                      // or sort the list before rendering.
                      // Actually, sorting the list before rendering is better for "gradual" tracking.
                      
                      // Find index in sorted list to show correct balance
                      const sortedIndex = sortedUsages.findIndex(su => su === u);
                      const previousUsages = sortedUsages.slice(0, sortedIndex + 1);
                      const usedUpToNow = previousUsages.reduce((sum, curr) => sum + (curr.volume || 0), 0);
                      const balanceAfter = (formData.totalVolume || 0) - usedUpToNow;

                      return (
                        <div key={i} className="p-4 bg-neutral-800/30 rounded-xl border border-neutral-800 space-y-4 relative overflow-hidden">
                          {balanceAfter < 0 && (
                            <div className="absolute top-0 right-0 px-2 py-0.5 bg-red-500 text-[8px] font-bold text-white uppercase tracking-tighter">
                              Over Capacity
                            </div>
                          )}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <p className="text-[10px] font-bold text-neutral-400 uppercase">Usage {i + 1}</p>
                              <input 
                                type="date"
                                value={u.date}
                                onChange={e => {
                                  const current = [...(formData.usages || [])];
                                  current[i] = { ...current[i], date: e.target.value };
                                  setFormData({ ...formData, usages: current });
                                }}
                                className="bg-transparent text-[10px] text-neutral-500 outline-none border-b border-neutral-700 focus:border-orange-500"
                              />
                            </div>
                            <div className="flex items-center gap-4">
                              <div className="text-right">
                                <p className="text-[8px] font-mono text-neutral-600 uppercase">Balance After</p>
                                <p className={`text-[10px] font-bold ${balanceAfter < 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                                  {balanceAfter} {formData.unit}
                                </p>
                              </div>
                              <button 
                                type="button"
                                onClick={() => {
                                  const current = [...(formData.usages || [])];
                                  current.splice(i, 1);
                                  setFormData({ ...formData, usages: current });
                                }}
                                className="text-red-500 hover:text-red-400 transition-colors"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-1">
                              <label className="text-[9px] text-neutral-500 uppercase">Volume Used</label>
                              <input 
                                type="number"
                                value={u.volume || ''}
                                onChange={e => {
                                  const val = parseFloat(e.target.value) || 0;
                                  const current = [...(formData.usages || [])];
                                  current[i] = { ...current[i], volume: val };
                                  setFormData({ ...formData, usages: current });
                                }}
                                className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[9px] text-neutral-500 uppercase">Work Item</label>
                              <input 
                                value={u.workItem}
                                onChange={e => {
                                  const current = [...(formData.usages || [])];
                                  current[i] = { ...current[i], workItem: e.target.value };
                                  setFormData({ ...formData, usages: current });
                                }}
                                className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white"
                                placeholder="e.g. Pengecoran..."
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[9px] text-neutral-500 uppercase">Area</label>
                              <input 
                                value={u.area}
                                onChange={e => {
                                  const current = [...(formData.usages || [])];
                                  current[i] = { ...current[i], area: e.target.value };
                                  setFormData({ ...formData, usages: current });
                                }}
                                className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white"
                                placeholder="e.g. Zone A..."
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1">
                              <label className="text-[9px] text-neutral-500 uppercase">Discipline</label>
                              <select 
                                value={u.discipline}
                                onChange={e => {
                                  const current = [...(formData.usages || [])];
                                  current[i] = { ...current[i], discipline: e.target.value };
                                  setFormData({ ...formData, usages: current });
                                }}
                                className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white"
                              >
                                <option value="Procurement">Procurement</option>
                                <option value="Construction">Construction</option>
                                <option value="Quality Control">Quality Control</option>
                                <option value="Logistic">Logistic</option>
                                <option value="Engineering">Engineering</option>
                                <option value="HR">HR</option>
                                <option value="HSE">HSE</option>
                              </select>
                            </div>
                            <div className="space-y-1">
                              <label className="text-[9px] text-neutral-500 uppercase">Usage Photo</label>
                              <div className="relative group h-[34px]">
                                <div className="w-full h-full bg-neutral-900 rounded-lg border border-neutral-700 flex items-center justify-center overflow-hidden group-hover:border-orange-500 transition-all">
                                  {u.photoUrl ? (
                                    <>
                                      <img src={u.photoUrl} alt="Usage" className="w-full h-full object-cover" />
                                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <Camera className="w-3 h-3 text-white" />
                                      </div>
                                    </>
                                  ) : (
                                    <div className="flex items-center gap-2 text-[9px] text-neutral-600">
                                      <Camera className="w-3 h-3" />
                                      <span>Upload Photo</span>
                                    </div>
                                  )}
                                </div>
                                <input 
                                  type="file"
                                  accept="image/*"
                                  onChange={(e) => handleImageUpload(e, (base64) => {
                                    const current = [...(formData.usages || [])];
                                    current[i] = { ...current[i], photoUrl: base64 };
                                    setFormData({ ...formData, usages: current });
                                  })}
                                  className="absolute inset-0 opacity-0 cursor-pointer"
                                />
                              </div>
                            </div>
                          </div>
                          
                          <div className="space-y-1">
                            <label className="text-[9px] text-neutral-500 uppercase">Remarks / Notes</label>
                            <textarea 
                              value={u.remarks || ''}
                              onChange={e => {
                                const current = [...(formData.usages || [])];
                                current[i] = { ...current[i], remarks: e.target.value };
                                setFormData({ ...formData, usages: current });
                              }}
                              className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white h-16 outline-none focus:border-orange-500"
                              placeholder="Add specific notes for this usage event..."
                            />
                          </div>
                        </div>
                      );
                    });
                  })()}
                  {(formData.usages || []).length === 0 && (
                    <div className="p-8 border-2 border-dashed border-neutral-800 rounded-2xl flex flex-col items-center justify-center text-neutral-600">
                      <ArrowRightLeft className="w-8 h-8 mb-2 opacity-20" />
                      <p className="text-xs font-mono uppercase tracking-widest">No usage history found</p>
                      <p className="text-[10px] mt-1">Click "Add Usage Record" to record material usage</p>
                    </div>
                  )}
                  
                  {/* Usage Summary by Area */}
                  {(formData.usages || []).length > 0 && (
                    <div className="mt-6 p-4 bg-neutral-900/50 rounded-2xl border border-neutral-800">
                      <p className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest mb-3">Usage Summary by Area</p>
                      <div className="space-y-2">
                        {Object.entries(
                          (formData.usages || []).reduce((acc, u) => {
                            const area = u.area || 'Unspecified Area';
                            acc[area] = (acc[area] || 0) + (u.volume || 0);
                            return acc;
                          }, {} as Record<string, number>)
                        ).map(([area, vol]) => (
                          <div key={area} className="flex items-center justify-between text-[11px]">
                            <span className="text-neutral-400">{area}</span>
                            <span className="font-bold text-white">{vol} {formData.unit}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="p-6 border-t border-neutral-800 bg-neutral-900/50 flex justify-end gap-4">
            <button
              type="submit"
              disabled={loading || (!formData.id && !request)}
              className="px-8 py-3 bg-emerald-500 text-black font-bold rounded-xl hover:bg-emerald-400 transition-all text-sm disabled:opacity-50 flex items-center gap-2 shadow-[0_0_20px_rgba(16,185,129,0.2)]"
            >
              <Save className="w-4 h-4" />
              {loading ? 'SAVING...' : 'SAVE UPDATE'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
