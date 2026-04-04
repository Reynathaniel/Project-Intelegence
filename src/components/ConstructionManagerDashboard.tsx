import React, { useState, useEffect } from 'react';
import { Project, QCMaterialRequest, UserProfile, DailyReport } from '../types';
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
import { motion, AnimatePresence } from 'framer-motion';
import { 
  HardHat, 
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
  Activity,
  Users,
  AlertTriangle
} from 'lucide-react';

interface ConstructionManagerDashboardProps {
  project: Project;
  userProfile: UserProfile;
  reports: DailyReport[];
  onNavigate?: (view: any) => void;
}

export default function ConstructionManagerDashboard({ project, userProfile, reports, onNavigate }: ConstructionManagerDashboardProps) {
  const [requests, setRequests] = useState<QCMaterialRequest[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRequest, setSelectedRequest] = useState<QCMaterialRequest | null>(null);
  const [isApprovalModalOpen, setIsApprovalModalOpen] = useState(false);
  const [remarks, setRemarks] = useState('');
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
    return currentStepIndex !== -1 && req.approvals[currentStepIndex].role === 'CM';
  });

  const handleApprove = async (requestId: string, status: 'Approved' | 'Rejected') => {
    setIsProcessing(true);
    try {
      const requestRef = doc(db, 'qcMaterialRequests', requestId);
      const requestData = requests.find(r => r.id === requestId);
      if (!requestData) return;

      const currentRoleIndex = (requestData.approvals || []).findIndex(a => a.status === 'Pending');
      if (currentRoleIndex === -1 || requestData.approvals[currentRoleIndex].role !== 'CM') {
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
        overallStatus = 'Approved by CM';
      }

      const updateData: any = {
        approvals: updatedApprovals,
        status: overallStatus,
      };

      await updateDoc(requestRef, updateData);

      // Notify Requester
      await addDoc(collection(db, 'qcNotifications'), {
        projectId: project.id,
        userId: requestData.requestedBy,
        title: `Material Request ${status} by CM`,
        message: `Your request for ${requestData.itemName} has been ${status.toLowerCase()} by CM. Status: ${overallStatus}`,
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
            message: `A material request for ${requestData.itemName} is awaiting your approval after CM verification.`,
            type: 'MaterialRequest',
            read: false,
            createdAt: serverTimestamp(),
          });
        });
      }

      setIsApprovalModalOpen(false);
      setSelectedRequest(null);
      setRemarks('');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'qcMaterialRequests');
    } finally {
      setIsProcessing(false);
    }
  };

  const todaysReports = reports.filter(r => r.date === new Date().toISOString().split('T')[0]);
  const totalManpower = todaysReports.reduce((sum, r) => sum + (r.manpower?.total || 0), 0);

  return (
    <div className="space-y-8 pb-20">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-neutral-900/50 p-6 rounded-3xl border border-neutral-800">
        <div>
          <h2 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
            <HardHat className="text-amber-500 w-8 h-8" />
            CM DASHBOARD
          </h2>
          <p className="text-neutral-500 text-xs font-mono uppercase tracking-[0.3em] mt-2">
            Construction Management & Site Operations
          </p>
        </div>
        <div className="flex gap-4">
          <div className="bg-neutral-950 px-6 py-3 rounded-2xl border border-neutral-800 flex flex-col items-center justify-center min-w-[140px]">
            <span className="text-[10px] font-mono text-neutral-500 uppercase">Pending Approvals</span>
            <span className="text-2xl font-bold text-amber-500">{pendingApprovals.length}</span>
          </div>
          <div className="bg-neutral-950 px-6 py-3 rounded-2xl border border-neutral-800 flex flex-col items-center justify-center min-w-[140px]">
            <span className="text-[10px] font-mono text-neutral-500 uppercase">Total Manpower Today</span>
            <span className="text-2xl font-bold text-blue-500">{totalManpower}</span>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-blue-500/10 rounded-lg text-blue-500">
              <Users size={20} />
            </div>
            <span className="text-[10px] font-mono text-neutral-500 uppercase">Manpower</span>
          </div>
          <p className="text-2xl font-bold text-white">{totalManpower}</p>
          <p className="text-[10px] text-neutral-500 mt-1 uppercase">Direct & Indirect</p>
        </div>
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-500">
              <Activity size={20} />
            </div>
            <span className="text-[10px] font-mono text-neutral-500 uppercase">Active Disciplines</span>
          </div>
          <p className="text-2xl font-bold text-white">{new Set(todaysReports.map(r => r.discipline)).size}</p>
          <p className="text-[10px] text-neutral-500 mt-1 uppercase">Reporting Today</p>
        </div>
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-amber-500/10 rounded-lg text-amber-500">
              <AlertTriangle size={20} />
            </div>
            <span className="text-[10px] font-mono text-neutral-500 uppercase">Open Issues</span>
          </div>
          <p className="text-2xl font-bold text-white">0</p>
          <p className="text-[10px] text-neutral-500 mt-1 uppercase">Requiring Attention</p>
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
            {onNavigate && (
              <button 
                onClick={() => onNavigate('qc-requests')}
                className="px-4 py-2 bg-neutral-800 text-neutral-400 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-neutral-700 hover:text-white transition-all flex items-center gap-2"
              >
                View All Requests
                <ArrowRight size={12} />
              </button>
            )}
          </div>

          <div className="space-y-4">
            {pendingApprovals.length > 0 ? (
              pendingApprovals.map((req) => (
                <motion.div 
                  key={req.id}
                  layoutId={req.id}
                  className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 hover:border-amber-500/50 transition-all group relative overflow-hidden"
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 bg-neutral-800 rounded-xl flex items-center justify-center text-amber-500 group-hover:scale-110 transition-transform">
                        <Package size={24} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="text-lg font-bold text-white uppercase tracking-tight">{req.itemName}</h4>
                          <span className="px-2 py-0.5 bg-neutral-800 text-neutral-400 text-[9px] font-mono rounded uppercase">
                            {req.discipline}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] font-mono text-neutral-500 uppercase tracking-widest">
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
                        className="px-6 py-3 bg-amber-500 text-black font-bold rounded-xl hover:bg-amber-400 transition-all text-xs uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-amber-500/20"
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
                <p className="text-neutral-600 text-sm mt-2">No pending material requests require your approval.</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Recent Reports */}
        <div className="space-y-6">
          <h3 className="text-xl font-bold text-white flex items-center gap-2 uppercase tracking-tight">
            <FileText className="text-blue-500" />
            Recent Reports
          </h3>
          
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl overflow-hidden">
            <div className="divide-y divide-neutral-800">
              {reports.slice(0, 10).map((report) => (
                <div key={report.id} className="p-4 hover:bg-neutral-800/30 transition-colors flex items-center justify-between group">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-neutral-800 flex items-center justify-center text-neutral-400">
                      <FileText size={16} />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white uppercase truncate max-w-[120px]">{report.discipline}</p>
                      <p className="text-[9px] text-neutral-500 font-mono">{report.authorName} • {report.date}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[8px] font-bold uppercase tracking-widest text-emerald-500">{report.status}</span>
                  </div>
                </div>
              ))}
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
                  <p className="text-amber-500 text-[10px] font-mono uppercase tracking-widest mt-1">CM Verification Step</p>
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
                      <p className="text-lg font-bold text-amber-500">{selectedRequest.volume} {selectedRequest.unit}</p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest">Discipline</label>
                      <p className="text-sm font-bold text-white uppercase">{selectedRequest.discipline}</p>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest">Submission Date</label>
                      <p className="text-sm font-bold text-white">{selectedRequest.date}</p>
                    </div>
                  </div>
                </div>

                {/* Remarks Input */}
                <div className="space-y-3">
                  <label className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest flex items-center gap-2">
                    <FileText size={12} />
                    CM Remarks / Site Verification
                  </label>
                  <textarea 
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder="Enter site verification notes..."
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-2xl p-4 text-sm text-white outline-none focus:border-amber-500 transition-all min-h-[120px] resize-none"
                  />
                </div>

                {/* Action Buttons */}
                <div className="grid grid-cols-2 gap-4">
                  <button 
                    onClick={() => handleApprove(selectedRequest.id, 'Rejected')}
                    disabled={isProcessing}
                    className="flex items-center justify-center gap-2 py-4 bg-red-500/10 text-red-500 font-bold rounded-2xl hover:bg-red-500 hover:text-white transition-all uppercase tracking-widest text-xs border border-red-500/20 disabled:opacity-50"
                  >
                    <XCircle size={18} />
                    Reject
                  </button>
                  <button 
                    onClick={() => handleApprove(selectedRequest.id, 'Approved')}
                    disabled={isProcessing}
                    className="flex items-center justify-center gap-2 py-4 bg-amber-500 text-black font-bold rounded-2xl hover:bg-amber-400 transition-all uppercase tracking-widest text-xs shadow-xl shadow-amber-500/20 disabled:opacity-50"
                  >
                    <CheckCircle2 size={18} />
                    Approve
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
