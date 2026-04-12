import React, { useState, useEffect, useMemo } from 'react';
import { Project, QCMaterialRequest, UserProfile } from '../types';
import { db, auth } from '../firebase';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  updateDoc, 
  doc, 
  serverTimestamp, 
  orderBy,
  getDocs,
  addDoc
} from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../firebase';
import { motion, AnimatePresence } from 'motion/react';
import { 
  DollarSign, 
  ClipboardCheck, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  TrendingUp, 
  Package,
  FileText,
  Check,
  X,
  ArrowRight,
  Search,
  Filter,
  PieChart as PieChartIcon,
  BarChart3,
  Layers,
  ShieldCheck,
  HardHat,
  Activity
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  PieChart,
  Pie
} from 'recharts';

interface CostControlDashboardProps {
  project: Project;
  userProfile: UserProfile;
  onNavigate?: (view: any) => void;
}

export default function CostControlDashboard({ project, userProfile, onNavigate }: CostControlDashboardProps) {
  const [requests, setRequests] = useState<QCMaterialRequest[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'All' | 'Pending' | 'Approved' | 'Rejected' | 'Approved by CC' | 'Approved by CM'>('All');
  const [filterDiscipline, setFilterDiscipline] = useState<string>('All');
  const [selectedRequest, setSelectedRequest] = useState<QCMaterialRequest | null>(null);
  const [isApprovalModalOpen, setIsApprovalModalOpen] = useState(false);
  const [remarks, setRemarks] = useState('');
  const [budgetCode, setBudgetCode] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Fetch all material requests for this project
  useEffect(() => {
    const q = query(
      collection(db, 'qcMaterialRequests'),
      where('projectId', '==', project.id),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const reqs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as QCMaterialRequest));
      setRequests(reqs);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'qcMaterialRequests');
    });

    return () => unsubscribe();
  }, [project.id]);

  const pendingApprovals = requests.filter(req => {
    const currentStepIndex = (req.approvals || []).findIndex(a => a.status === 'Pending');
    return currentStepIndex !== -1 && req.approvals[currentStepIndex].role === 'CC';
  });

  const filteredRequests = requests.filter(req => {
    const matchesSearch = req.itemName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         (req.spbNo || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'All' || req.status === filterStatus;
    const matchesDiscipline = filterDiscipline === 'All' || req.discipline === filterDiscipline;
    return matchesSearch && matchesStatus && matchesDiscipline;
  });

  const disciplines = Array.from(new Set(requests.map(r => r.discipline).filter(Boolean)));

  // Chart Data
  const disciplineData = useMemo(() => {
    const counts: Record<string, number> = {};
    requests.forEach(req => {
      const d = req.discipline || 'Unknown';
      counts[d] = (counts[d] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [requests]);

  const statusData = useMemo(() => {
    const counts: Record<string, number> = {
      'Approved': 0,
      'Pending': 0,
      'Rejected': 0,
      'Approved by CC': 0,
      'Approved by CM': 0
    };
    requests.forEach(req => {
      if (counts[req.status] !== undefined) {
        counts[req.status]++;
      } else {
        counts['Pending']++;
      }
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [requests]);

  const COLORS = ['#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6'];

  const handleApprove = async (requestId: string, status: 'Approved' | 'Rejected') => {
    setIsProcessing(true);
    try {
      const requestRef = doc(db, 'qcMaterialRequests', requestId);
      const requestData = requests.find(r => r.id === requestId);
      if (!requestData) return;

      const currentRoleIndex = (requestData.approvals || []).findIndex(a => a.status === 'Pending');
      if (currentRoleIndex === -1 || requestData.approvals[currentRoleIndex].role !== 'CC') {
        throw new Error('Unauthorized: You are not the current approver for this request.');
      }

      const updatedApprovals = [...(requestData.approvals || [])];
      updatedApprovals[currentRoleIndex] = {
        ...updatedApprovals[currentRoleIndex],
        status,
        approvedBy: auth.currentUser?.uid,
        approvedByName: userProfile.name,
        approvalDate: new Date().toISOString(),
        remarks: remarks
      };

      const isFinalApproval = currentRoleIndex === updatedApprovals.length - 1;
      let overallStatus: string = status === 'Rejected' ? 'Rejected' : (isFinalApproval ? 'Approved' : 'Pending');
      
      if (status === 'Approved' && !isFinalApproval) {
        overallStatus = 'Approved by CC';
      }

      const updateData: any = {
        approvals: updatedApprovals,
        status: overallStatus,
      };

      if (budgetCode) {
        updateData.budgetCode = budgetCode;
      }

      await updateDoc(requestRef, updateData);

      // Notify Requester
      await addDoc(collection(db, 'qcNotifications'), {
        projectId: project.id,
        userId: requestData.requestedBy,
        title: `Material Request ${status} by CC`,
        message: `Your request for ${requestData.itemName} has been ${status.toLowerCase()} by CC. Status: ${overallStatus}`,
        type: status === 'Approved' ? 'Approval' : 'Rejection',
        read: false,
        createdAt: serverTimestamp(),
      });

      // Notify next approver if approved and not final
      if (status === 'Approved' && !isFinalApproval) {
        const nextRole = updatedApprovals[currentRoleIndex + 1].role;
        const nextApproverQuery = query(collection(db, 'users'), where('role', '==', nextRole));
        const nextApproverSnap = await getDocs(nextApproverQuery);
        
        nextApproverSnap.docs.forEach(async (userDoc) => {
          await addDoc(collection(db, 'qcNotifications'), {
            projectId: project.id,
            userId: userDoc.id,
            title: 'Material Request Approval Needed',
            message: `A material request for ${requestData.itemName} is awaiting your approval after CC verification.`,
            type: 'MaterialRequest',
            read: false,
            createdAt: serverTimestamp(),
          });
        });
      }

      setIsApprovalModalOpen(false);
      setSelectedRequest(null);
      setRemarks('');
      setBudgetCode('');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'qcMaterialRequests');
    } finally {
      setIsProcessing(false);
    }
  };

  const totalVolume = requests
    .filter(r => r.status === 'Approved' || r.status === 'Approved by CC')
    .reduce((sum, r) => sum + (r.volume || 0), 0);

  return (
    <div className="space-y-8 pb-20">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-neutral-900/50 p-6 rounded-3xl border border-neutral-800">
        <div>
          <h2 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
            <DollarSign className="text-emerald-500 w-8 h-8" />
            COST CONTROL HUB
          </h2>
          <p className="text-neutral-500 text-xs font-mono uppercase tracking-[0.3em] mt-2">
            Financial Oversight & Material Verification
          </p>
        </div>
        <div className="flex gap-4">
          <div className="bg-neutral-950 px-6 py-3 rounded-2xl border border-neutral-800 flex flex-col items-center justify-center min-w-[140px]">
            <span className="text-[10px] font-mono text-neutral-500 uppercase">Pending Approvals</span>
            <span className="text-2xl font-bold text-amber-500">{pendingApprovals.length}</span>
          </div>
          <div className="bg-neutral-950 px-6 py-3 rounded-2xl border border-neutral-800 flex flex-col items-center justify-center min-w-[140px]">
            <span className="text-[10px] font-mono text-neutral-500 uppercase">Total Volume Appr.</span>
            <span className="text-2xl font-bold text-emerald-500">{totalVolume}</span>
          </div>
        </div>
      </div>

      {/* Analytics Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6">
          <h3 className="text-sm font-bold text-white uppercase tracking-widest mb-6 flex items-center gap-2">
            <BarChart3 size={16} className="text-emerald-500" />
            Requests by Status
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={statusData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#262626" vertical={false} />
                <XAxis 
                  dataKey="name" 
                  stroke="#525252" 
                  fontSize={10} 
                  tickFormatter={(val) => val.split(' ').map(w => w[0]).join('')}
                />
                <YAxis stroke="#525252" fontSize={10} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#171717', border: '1px solid #262626', borderRadius: '12px' }}
                  itemStyle={{ color: '#fff', fontSize: '12px' }}
                />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6">
          <h3 className="text-sm font-bold text-white uppercase tracking-widest mb-6 flex items-center gap-2">
            <PieChartIcon size={16} className="text-blue-500" />
            Discipline Distribution
          </h3>
          <div className="h-64 flex items-center">
            <div className="w-1/2 h-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={disciplineData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {disciplineData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#171717', border: '1px solid #262626', borderRadius: '12px' }}
                    itemStyle={{ color: '#fff', fontSize: '12px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="w-1/2 space-y-2">
              {disciplineData.map((entry, index) => (
                <div key={entry.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                    <span className="text-[10px] text-neutral-400 uppercase font-mono">{entry.name}</span>
                  </div>
                  <span className="text-xs font-bold text-white">{entry.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Pending Approvals Queue */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h3 className="text-xl font-bold text-white flex items-center gap-2 uppercase tracking-tight">
              <Clock className="text-amber-500" />
              Approval Queue
            </h3>
            <div className="flex items-center gap-4">
              {onNavigate && (
                <button 
                  onClick={() => onNavigate('qc-requests')}
                  className="px-4 py-2 bg-neutral-800 text-neutral-400 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-neutral-700 hover:text-white transition-all flex items-center gap-2"
                >
                  View All Requests
                  <ArrowRight size={12} />
                </button>
              )}
              <div className="flex flex-wrap items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                <input 
                  type="text"
                  placeholder="Search..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="bg-neutral-900 border border-neutral-800 rounded-xl pl-10 pr-4 py-2 text-[10px] text-white outline-none focus:border-emerald-500 transition-all w-32 sm:w-48"
                />
              </div>
              <select
                value={filterDiscipline}
                onChange={(e) => setFilterDiscipline(e.target.value)}
                className="bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 text-[10px] text-white outline-none focus:border-emerald-500 transition-all"
              >
                <option value="All">All Disciplines</option>
                {disciplines.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as any)}
                className="bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 text-[10px] text-white outline-none focus:border-emerald-500 transition-all"
              >
                <option value="All">All Status</option>
                <option value="Pending">Pending</option>
                <option value="Approved by CC">Approved by CC</option>
                <option value="Approved by CM">Approved by CM</option>
                <option value="Approved">Fully Approved</option>
                <option value="Rejected">Rejected</option>
              </select>
            </div>
          </div>
        </div>

        <div className="space-y-4">
            {pendingApprovals.length > 0 ? (
              pendingApprovals.map((req) => (
                <motion.div 
                  key={req.id}
                  layoutId={req.id}
                  className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 hover:border-emerald-500/50 transition-all group relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 blur-3xl rounded-full -mr-16 -mt-16" />
                  
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 bg-neutral-800 rounded-xl flex items-center justify-center text-emerald-500 group-hover:scale-110 transition-transform">
                        <Package size={24} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="text-lg font-bold text-white uppercase tracking-tight">{req.itemName}</h4>
                          <span className="px-2 py-0.5 bg-neutral-800 text-neutral-400 text-[9px] font-mono rounded uppercase">
                            {req.spbNo || 'PENDING SPB'}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] font-mono text-neutral-500 uppercase tracking-widest">
                          <span className="flex items-center gap-1 text-blue-400"><Layers size={10} /> {req.discipline}</span>
                          <span className="flex items-center gap-1"><ArrowRight size={10} /> {req.requestedByName}</span>
                          <span className="flex items-center gap-1"><ArrowRight size={10} /> {req.date}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <div className="text-right mr-4">
                        <p className="text-[10px] font-mono text-neutral-500 uppercase">Quantity</p>
                        <p className="text-xl font-bold text-white">{req.volume} <span className="text-xs text-neutral-500">{req.unit}</span></p>
                      </div>
                      <button 
                        onClick={() => {
                          setSelectedRequest(req);
                          setIsApprovalModalOpen(true);
                        }}
                        className="px-6 py-3 bg-emerald-500 text-black font-bold rounded-xl hover:bg-emerald-400 transition-all text-xs uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-emerald-500/20"
                      >
                        <ClipboardCheck size={16} />
                        Review
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))
            ) : (
              <div className="bg-neutral-900/30 border border-dashed border-neutral-800 rounded-3xl p-20 flex flex-col items-center justify-center text-center">
                <div className="w-16 h-16 bg-neutral-900 rounded-full flex items-center justify-center text-neutral-700 mb-4">
                  <CheckCircle2 size={32} />
                </div>
                <h4 className="text-lg font-bold text-neutral-500 uppercase">Queue Clear</h4>
                <p className="text-neutral-600 text-sm mt-2">No pending material requests require your approval at this time.</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Activity & History */}
        <div className="space-y-6">
          <h3 className="text-xl font-bold text-white flex items-center gap-2 uppercase tracking-tight">
            <TrendingUp className="text-blue-500" />
            Recent Activity
          </h3>
          
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl overflow-hidden">
            <div className="p-4 border-b border-neutral-800 bg-neutral-950/30">
              <p className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest">Last 10 Transactions</p>
            </div>
            <div className="divide-y divide-neutral-800">
              {filteredRequests.slice(0, 10).map((req) => (
                <div key={req.id} className="p-4 hover:bg-neutral-800/30 transition-colors flex items-center justify-between group">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      req.status === 'Approved' ? 'bg-emerald-500/10 text-emerald-500' :
                      req.status === 'Rejected' ? 'bg-red-500/10 text-red-500' :
                      req.status.includes('Approved by') ? 'bg-blue-500/10 text-blue-500' :
                      'bg-amber-500/10 text-amber-500'
                    }`}>
                      {req.status === 'Approved' ? <Check size={16} /> : req.status === 'Rejected' ? <X size={16} /> : <Clock size={16} />}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white uppercase truncate max-w-[120px]">{req.itemName}</p>
                      <p className="text-[9px] text-neutral-500 font-mono">{req.discipline} • {req.date}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-white">{req.volume} {req.unit}</p>
                    <span className={`text-[8px] font-bold uppercase tracking-widest ${
                      req.status === 'Approved' ? 'text-emerald-500' :
                      req.status === 'Rejected' ? 'text-red-500' :
                      req.status.includes('Approved by') ? 'text-blue-500' :
                      'text-amber-500'
                    }`}>{req.status}</span>
                  </div>
                </div>
              ))}
              {filteredRequests.length === 0 && (
                <div className="p-10 text-center text-neutral-600 italic text-sm">
                  No activity recorded yet.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Approval Modal */}
      <AnimatePresence>
        {isApprovalModalOpen && selectedRequest && (
          <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="w-full max-w-2xl bg-neutral-900 border border-neutral-800 rounded-[2.5rem] overflow-hidden shadow-2xl"
            >
              <div className="p-8 border-b border-neutral-800 flex items-center justify-between bg-neutral-950/50">
                <div>
                  <h3 className="text-2xl font-bold text-white uppercase tracking-tight">Review Request</h3>
                  <p className="text-emerald-500 text-[10px] font-mono uppercase tracking-widest mt-1">CC Verification Step</p>
                </div>
                <button 
                  onClick={() => setIsApprovalModalOpen(false)}
                  className="w-10 h-10 rounded-full bg-neutral-800 flex items-center justify-center text-neutral-400 hover:text-white hover:bg-neutral-700 transition-all"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-8 space-y-8">
                {/* Request Details Grid */}
                <div className="grid grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest">Item Description</label>
                      <p className="text-lg font-bold text-white uppercase">{selectedRequest.itemName}</p>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest">Quantity & Unit</label>
                      <p className="text-lg font-bold text-emerald-500">{selectedRequest.volume} {selectedRequest.unit}</p>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest">Discipline</label>
                      <p className="text-sm font-bold text-blue-400 uppercase">{selectedRequest.discipline}</p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest">Work Item / Area</label>
                      <p className="text-sm font-bold text-white">{selectedRequest.workItem || 'N/A'} - {selectedRequest.area || 'N/A'}</p>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest">SPB Reference</label>
                      <p className="text-sm font-mono text-blue-400">{selectedRequest.spbNo || 'PENDING ASSIGNMENT'}</p>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest">Submission Date</label>
                      <p className="text-sm font-bold text-white">{selectedRequest.date}</p>
                    </div>
                  </div>
                </div>

                {/* Budget & Remarks */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <label className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest flex items-center gap-2">
                      <Filter size={12} />
                      Budget Code
                    </label>
                    <input 
                      type="text"
                      value={budgetCode}
                      onChange={(e) => setBudgetCode(e.target.value)}
                      placeholder="e.g. B-2024-CIV-001"
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl p-3 text-sm text-white outline-none focus:border-emerald-500 transition-all"
                    />
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest flex items-center gap-2">
                      <FileText size={12} />
                      Verification Notes
                    </label>
                    <textarea 
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value)}
                      placeholder="Enter notes..."
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl p-3 text-sm text-white outline-none focus:border-emerald-500 transition-all min-h-[46px] resize-none"
                    />
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="grid grid-cols-2 gap-4">
                  <button 
                    onClick={() => handleApprove(selectedRequest.id, 'Rejected')}
                    disabled={isProcessing}
                    className="flex items-center justify-center gap-2 py-4 bg-red-500/10 text-red-500 font-bold rounded-2xl hover:bg-red-500 hover:text-white transition-all uppercase tracking-widest text-xs border border-red-500/20 disabled:opacity-50"
                  >
                    <XCircle size={18} />
                    Reject Request
                  </button>
                  <button 
                    onClick={() => handleApprove(selectedRequest.id, 'Approved')}
                    disabled={isProcessing}
                    className="flex items-center justify-center gap-2 py-4 bg-emerald-500 text-black font-bold rounded-2xl hover:bg-emerald-400 transition-all uppercase tracking-widest text-xs shadow-xl shadow-emerald-500/20 disabled:opacity-50"
                  >
                    <CheckCircle2 size={18} />
                    Verify & Approve
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
