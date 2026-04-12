import React, { useState, useEffect, useRef } from 'react';
import { Project, QCMaterialRequest, UserProfile, MaterialRequest, UserRole, ApprovalStep } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  Package, 
  FileText, 
  ChevronRight, 
  Check, 
  X, 
  Bell,
  AlertCircle,
  CheckCircle,
  Search,
  Clock,
  RotateCcw,
  PenTool,
  Printer,
  Download,
  Eye,
  ChevronUp,
  ChevronDown
} from 'lucide-react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  doc, 
  serverTimestamp, 
  orderBy,
  getDocs,
  deleteDoc
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { handleFirestoreError, OperationType } from '../firebase';
import { compressImage } from '../services/imageService';
import { isSuperAdmin } from '../constants';
import SignatureCanvas from 'react-signature-canvas';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

interface QCMaterialRequestsProps {
  project: Project;
  userProfile: UserProfile;
}

const defaultApprovalRoles: UserRole[] = ['CM', 'CC', 'Project Manager'];

const ExpandableText = ({ text, className = "", textClassName = "text-xs font-bold text-white uppercase", maxLines = 2 }: { text: string; className?: string; textClassName?: string; maxLines?: number }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const isLong = text.length > 40;

  return (
    <div className={`relative group ${className}`}>
      <div className="flex flex-col">
        <p className={`transition-all duration-300 ${textClassName} ${
          !isExpanded && isLong ? `line-clamp-${maxLines}` : ''
        } leading-relaxed tracking-tight`}>
          {text}
        </p>
        {isLong && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
            className="mt-1.5 text-[9px] font-bold text-emerald-500 uppercase tracking-[0.2em] hover:text-emerald-400 flex items-center gap-1.5 w-fit group/btn"
          >
            <span className="group-hover/btn:mr-1 transition-all">{isExpanded ? 'Collapse' : 'Expand Details'}</span>
            {isExpanded ? (
              <ChevronUp size={10} className="animate-bounce-subtle" />
            ) : (
              <ChevronDown size={10} className="animate-bounce-subtle" />
            )}
          </button>
        )}
      </div>
      
      {/* Enhanced Tooltip for Hover */}
      {!isExpanded && isLong && (
        <div className="absolute left-0 bottom-full mb-3 hidden group-hover:block z-[100] w-72 p-4 bg-neutral-900/95 backdrop-blur-md border border-emerald-500/20 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] pointer-events-none ring-1 ring-white/5">
          <div className="flex items-start gap-3">
            <div className="mt-1 w-1 h-1 rounded-full bg-emerald-500 flex-shrink-0" />
            <p className="text-[11px] text-neutral-200 uppercase leading-relaxed font-medium tracking-wide">{text}</p>
          </div>
          <div className="absolute left-6 -bottom-1.5 w-3 h-3 bg-neutral-900 border-r border-b border-emerald-500/20 rotate-45" />
        </div>
      )}
    </div>
  );
};

export default function QCMaterialRequests({ project, userProfile }: QCMaterialRequestsProps) {
  const [requests, setRequests] = useState<QCMaterialRequest[]>([]);
  const [logisticsRequests, setLogisticsRequests] = useState<MaterialRequest[]>([]);
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [isApprovalModalOpen, setIsApprovalModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<QCMaterialRequest | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [cancelConfirmId, setCancelConfirmId] = useState<string | null>(null);
  const [requestPhotoUrl, setRequestPhotoUrl] = useState<string | null>(null);
  const [signatureMethod, setSignatureMethod] = useState<'draw' | 'upload'>('draw');
  const [uploadedSignature, setUploadedSignature] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'summary'>('all');
  
  useEffect(() => {
    if (!isApprovalModalOpen) {
      setSignatureMethod('draw');
      setUploadedSignature(null);
    }
  }, [isApprovalModalOpen]);

  const sigCanvas = useRef<SignatureCanvas>(null);
  const approvalRoles = project.approvalConfig?.qcMaterialRequestRoles || defaultApprovalRoles;

  const isAdmin = () => (userProfile.roles || []).includes('Admin') || isSuperAdmin(auth.currentUser?.email);
  const isAssigned = () => userProfile.projects?.includes(project.id) || isSuperAdmin(auth.currentUser?.email);
  const canCreateRequest = () => {
    const roles = userProfile.roles || [userProfile.role];
    const allowedRoles: UserRole[] = ['QC', 'Supervisor', 'HSE', 'Logistics', 'Admin'];
    return (roles.some(role => allowedRoles.includes(role)) && isAssigned()) || isAdmin();
  };
  
  const isApprover = () => {
    const roles = userProfile.roles || [userProfile.role];
    return (roles.some(role => approvalRoles.includes(role)) || isAdmin()) && isAssigned();
  };

  // Fetch QC Material Requests
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

  // Fetch Logistics Material Requests to show status to QC
  useEffect(() => {
    const q = query(
      collection(db, 'materialRequests'),
      where('projectId', '==', project.id)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const reqs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MaterialRequest));
      setLogisticsRequests(reqs);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'materialRequests');
    });

    return () => unsubscribe();
  }, [project.id]);

  const handleRequestPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setError(null);
    try {
      const compressedBase64 = await compressImage(file, 600, 600, 0.5);
      setRequestPhotoUrl(compressedBase64);
    } catch (err) {
      console.error('Failed to compress image:', err);
      setError('Failed to process image. Please try a smaller file or a different format.');
      setRequestPhotoUrl(null);
    } finally {
      setIsUploading(false);
    }
  };

  const handleSignatureUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setIsUploading(true);
      const compressed = await compressImage(file);
      setUploadedSignature(compressed);
    } catch (err) {
      console.error('Error uploading signature:', err);
      setError('Failed to upload signature.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleCreateRequest = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const spbNo = formData.get('spbNo') as string;

    // Check for duplicate SPB number
    if (spbNo) {
      const isDuplicateInQC = requests.some(r => r.spbNo === spbNo);
      const isDuplicateInLogistics = logisticsRequests.some(r => r.spbNo === spbNo);
      
      if (isDuplicateInQC || isDuplicateInLogistics) {
        setError(`SPB Number "${spbNo}" already exists in the system. Each SPB must be unique.`);
        return;
      }
    }

    const newRequest = {
      projectId: project.id,
      date: new Date().toISOString().split('T')[0],
      itemName: formData.get('itemName') as string,
      unit: formData.get('unit') as string,
      volume: Number(formData.get('volume')),
      spbNo: formData.get('spbNo') as string,
      workItem: formData.get('workItem') as string,
      area: formData.get('area') as string,
      remarks: formData.get('remarks') as string,
      requestedBy: auth.currentUser?.uid || '',
      requestedByName: formData.get('requestedByName') as string || userProfile.name,
      discipline: formData.get('discipline') as string || userProfile.role,
      photoUrl: requestPhotoUrl,
      status: 'Pending',
      approvals: approvalRoles.map(role => ({
        role,
        status: 'Pending'
      })),
      createdAt: serverTimestamp(),
    };

    try {
      await addDoc(collection(db, 'qcMaterialRequests'), newRequest);
      
      // Notify first approver role
      const firstRole = approvalRoles[0];
      const approverUsersQuery = query(collection(db, 'users'), where('role', 'in', [firstRole, 'CC']));
      const approverSnap = await getDocs(approverUsersQuery);
      
      approverSnap.docs.forEach(async (userDoc) => {
        await addDoc(collection(db, 'qcNotifications'), {
          projectId: project.id,
          userId: userDoc.id,
          title: 'New Material Request Created',
          message: `${userProfile.name} has submitted a new material request for ${newRequest.itemName}.`,
          type: 'MaterialRequest',
          read: false,
          createdAt: serverTimestamp(),
        });
      });

      setIsRequestModalOpen(false);
      setRequestPhotoUrl(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'qcMaterialRequests');
    }
  };

  const handleApproveRequest = async (requestId: string, status: 'Approved' | 'Rejected', signature?: string, remarks?: string, budgetCode?: string) => {
    if (!isAssigned()) {
      setError('You are not assigned to this project and cannot perform approvals.');
      return;
    }
    try {
      const requestRef = doc(db, 'qcMaterialRequests', requestId);
      const requestData = requests.find(r => r.id === requestId);
      if (!requestData) return;

      // Strict role enforcement: only find the index for the user's own role that is still pending
      const roles = userProfile.roles || [userProfile.role];
      const currentRoleIndex = requestData.approvals?.findIndex(a => roles.includes(a.role) && a.status === 'Pending') ?? -1;
      
      if (currentRoleIndex === -1) {
        setError(`You cannot approve for your current designations or it has already been processed.`);
        return;
      }

      const userRole = requestData.approvals![currentRoleIndex].role;

      // Ensure all previous steps are approved
      const previousStepsApproved = requestData.approvals?.slice(0, currentRoleIndex).every(a => a.status === 'Approved');
      if (!previousStepsApproved) {
        setError(`Previous approval steps must be completed first.`);
        return;
      }

      const updatedApprovals = [...(requestData.approvals || [])];
      updatedApprovals[currentRoleIndex] = {
        ...updatedApprovals[currentRoleIndex],
        status,
        approvedBy: auth.currentUser?.uid,
        approvedByName: userProfile.name,
        approvedByEmail: auth.currentUser?.email || '',
        approvalDate: new Date().toISOString(),
        signature,
        remarks
      };

      const allApproved = updatedApprovals.every(a => a.status === 'Approved');
      let overallStatus: string = status === 'Rejected' ? 'Rejected' : (allApproved ? 'Approved' : 'Pending');
      
      // Special status update for CC approval
      if (status === 'Approved' && !allApproved) {
        if (updatedApprovals[currentRoleIndex].role === 'CC') {
          overallStatus = 'Approved by CC';
        } else if (updatedApprovals[currentRoleIndex].role === 'CM') {
          overallStatus = 'Approved by CM';
        }
      }

      const updateData: any = {
        approvals: updatedApprovals,
        status: overallStatus,
      };

      if (budgetCode) {
        updateData.budgetCode = budgetCode;
      }

      if (overallStatus === 'Approved') {
        updateData.spbNo = requestData.spbNo || `QC-${Date.now().toString().slice(-6)}`;
      }

      await updateDoc(requestRef, updateData);

      // Notify QC Requester
      await addDoc(collection(db, 'qcNotifications'), {
        projectId: project.id,
        userId: requestData.requestedBy,
        title: `Material Request Step ${status}`,
        message: `Your request for ${requestData.itemName} has been ${status.toLowerCase()} by ${userRole}.`,
        type: status === 'Approved' ? 'Approval' : 'Rejection',
        read: false,
        createdAt: serverTimestamp(),
      });

      // Notify next approver and CC
      if (status === 'Approved' && !allApproved) {
        const nextRole = updatedApprovals[currentRoleIndex + 1]?.role;
        if (nextRole) {
          const nextApproverQuery = query(collection(db, 'users'), where('role', 'in', [nextRole, 'CC']));
          const nextApproverSnap = await getDocs(nextApproverQuery);
          
          nextApproverSnap.docs.forEach(async (userDoc) => {
            await addDoc(collection(db, 'qcNotifications'), {
              projectId: project.id,
              userId: userDoc.id,
              title: 'Material Request Update',
              message: `A material request for ${requestData.itemName} has been updated. Status: ${overallStatus}.`,
              type: 'MaterialRequest',
              read: false,
              createdAt: serverTimestamp(),
            });
          });
        }
      }

      // If final approval, automatically create a MaterialRequest for Logistics
      if (overallStatus === 'Approved') {
        await addDoc(collection(db, 'materialRequests'), {
          projectId: project.id,
          date: new Date().toISOString().split('T')[0],
          spbNo: updateData.spbNo,
          spbName: `QC Request: ${requestData.itemName}`,
          itemName: requestData.itemName,
          unit: requestData.unit,
          volumeSPB: requestData.volume,
          totalVolume: 0,
          totalPrice: 0,
          used: 0,
          remaining: 0,
          location: 'Sorong',
          status: 'Proses',
          pic: userProfile.name,
          remarks: `Approved QC Request from ${requestData.requestedByName}. ${requestData.remarks || ''}`,
          approval: { cm: true, cc: true, pm: true },
          discipline: 'Quality Control',
          requestedBy: requestData.requestedByName,
          workItem: requestData.workItem || '',
          area: requestData.area || '',
          photoUrl: requestData.photoUrl || null,
        });
      }

      setIsApprovalModalOpen(false);
      setSelectedRequest(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'qcMaterialRequests');
    }
  };

  const handleCancelMyApproval = async (requestId: string) => {
    if (!isAssigned()) {
      setError('You are not assigned to this project and cannot cancel approvals.');
      return;
    }
    try {
      const requestRef = doc(db, 'qcMaterialRequests', requestId);
      const requestData = requests.find(r => r.id === requestId);
      if (!requestData) return;

      const roles = userProfile.roles || [userProfile.role];
      const approvalIndex = requestData.approvals?.findIndex(a => roles.includes(a.role) && a.status !== 'Pending') ?? -1;
      if (approvalIndex === -1) return;

      const approval = requestData.approvals[approvalIndex];
      if (approval.approvedBy !== auth.currentUser?.uid && !isAdmin()) {
        setError('You can only cancel your own approvals.');
        return;
      }

      const updatedApprovals = [...(requestData.approvals || [])];
      updatedApprovals[approvalIndex] = {
        role: approval.role,
        status: 'Pending'
      };

      // Recalculate overall status
      const hasRejected = updatedApprovals.some(a => a.status === 'Rejected');
      const allApproved = updatedApprovals.every(a => a.status === 'Approved');
      
      let overallStatus = 'Pending';
      if (hasRejected) {
        overallStatus = 'Rejected';
      } else if (allApproved) {
        overallStatus = 'Approved';
      } else {
        // Check for partial approvals to maintain the "Approved by ..." status if needed
        const lastApprovedIndex = [...updatedApprovals].reverse().findIndex(a => a.status === 'Approved');
        if (lastApprovedIndex !== -1) {
          const actualIndex = updatedApprovals.length - 1 - lastApprovedIndex;
          const lastRole = updatedApprovals[actualIndex].role;
          if (lastRole === 'CC') overallStatus = 'Approved by CC';
          else if (lastRole === 'CM') overallStatus = 'Approved by CM';
        }
      }

      const updateData: any = {
        approvals: updatedApprovals,
        status: overallStatus
      };

      // If it was previously fully approved, we might need to remove the logistics request
      if (requestData.status === 'Approved' && overallStatus !== 'Approved' && requestData.spbNo) {
        const logisticsQuery = query(
          collection(db, 'materialRequests'),
          where('spbNo', '==', requestData.spbNo),
          where('projectId', '==', project.id)
        );
        const logisticsSnap = await getDocs(logisticsQuery);
        for (const logDoc of logisticsSnap.docs) {
          await deleteDoc(doc(db, 'materialRequests', logDoc.id));
        }
        updateData.spbNo = null;
      }

      await updateDoc(requestRef, updateData);

      // Notify requester
      await addDoc(collection(db, 'qcNotifications'), {
        projectId: project.id,
        userId: requestData.requestedBy,
        title: 'Approval Cancelled',
        message: `${userProfile.name} has cancelled their ${approval.status.toLowerCase()} for ${requestData.itemName}.`,
        type: 'MaterialRequest',
        read: false,
        createdAt: serverTimestamp(),
      });

    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'qcMaterialRequests');
    }
  };

  const handleCancelApproval = async (requestId: string) => {
    if (!isAssigned()) {
      setError('You are not assigned to this project and cannot cancel approvals.');
      return;
    }
    try {
      const requestRef = doc(db, 'qcMaterialRequests', requestId);
      const requestData = requests.find(r => r.id === requestId);
      if (!requestData) return;

      // Reset approvals
      const resetApprovals = (requestData.approvals || []).map(app => ({
        ...app,
        status: 'Pending' as const,
        approvedBy: undefined,
        approvedByName: undefined,
        approvedByEmail: undefined,
        approvalDate: undefined,
        signature: undefined,
        remarks: undefined
      }));

      await updateDoc(requestRef, {
        status: 'Pending',
        approvals: resetApprovals,
        spbNo: null,
        budgetCode: null
      });

      // Find and delete the logistics request
      if (requestData.spbNo) {
        const logisticsQuery = query(
          collection(db, 'materialRequests'),
          where('spbNo', '==', requestData.spbNo),
          where('projectId', '==', project.id)
        );
        const logisticsSnap = await getDocs(logisticsQuery);
        for (const logDoc of logisticsSnap.docs) {
          await deleteDoc(doc(db, 'materialRequests', logDoc.id));
        }
      }

      // Notify requester
      await addDoc(collection(db, 'qcNotifications'), {
        projectId: project.id,
        userId: requestData.requestedBy,
        title: 'Material Request Approval Cancelled',
        message: `The approval for your request ${requestData.itemName} has been cancelled and returned to pending.`,
        type: 'MaterialRequest',
        read: false,
        createdAt: serverTimestamp(),
      });

      setCancelConfirmId(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'qcMaterialRequests');
    }
  };

  const generatePDF = (req: QCMaterialRequest) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Header
    doc.setFontSize(18);
    doc.text('MATERIAL REQUEST REPORT', pageWidth / 2, 20, { align: 'center' });
    
    doc.setFontSize(10);
    doc.text(`Project: ${project.name}`, 20, 30);
    doc.text(`Date: ${req.date}`, 20, 35);
    doc.text(`SPB No: ${req.spbNo || 'N/A'}`, 20, 40);
    doc.text(`Budget Code: ${req.budgetCode || 'N/A'}`, 20, 45);
    
    // Details Table
    autoTable(doc, {
      startY: 55,
      head: [['Field', 'Value']],
      body: [
        ['Item Name', req.itemName],
        ['Volume', `${req.volume} ${req.unit}`],
        ['Work Item', req.workItem || '-'],
        ['Area', req.area || '-'],
        ['Requested By', req.requestedByName],
        ['Status', req.status],
        ['Budget Code', req.budgetCode || '-']
      ],
      theme: 'grid',
      headStyles: { fillColor: [16, 185, 129] }
    });
    
    // Approvals
    let currentY = (doc as any).lastAutoTable.finalY + 20;
    doc.text('APPROVALS', 20, currentY);
    currentY += 10;
    
    (req.approvals || []).forEach((app, index) => {
      doc.setFontSize(9);
      doc.text(`${app.role}: ${app.status}`, 20, currentY);
      doc.text(`By: ${app.approvedByName || '-'}`, 20, currentY + 5);
      doc.text(`Date: ${app.approvalDate ? new Date(app.approvalDate).toLocaleDateString() : '-'}`, 20, currentY + 10);
      
      if (app.signature) {
        doc.addImage(app.signature, 'PNG', 120, currentY - 5, 40, 20);
      }
      
      currentY += 25;
      if (currentY > 250) {
        doc.addPage();
        currentY = 20;
      }
    });

    doc.save(`Material_Request_${req.spbNo || req.id}.pdf`);
  };

  const getLogisticsStatus = (spbNo: string | undefined) => {
    if (!spbNo) return null;
    return logisticsRequests.find(lr => lr.spbNo === spbNo);
  };

  const filteredRequests = activeTab === 'summary' 
    ? requests.filter(r => r.status === 'Approved')
    : activeTab === 'pending'
    ? requests.filter(r => {
        const roles = userProfile.roles || [userProfile.role];
        const userPendingIndex = (r.approvals || []).findIndex(a => roles.includes(a.role) && a.status === 'Pending');
        return userPendingIndex !== -1 && isAssigned();
      })
    : requests;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white uppercase tracking-tight flex items-center gap-3">
            <Package className="text-emerald-500" />
            {activeTab === 'all' ? 'Request Material' : activeTab === 'pending' ? 'Pending Approval' : 'Approved Summary'}
          </h2>
          <p className="text-neutral-500 text-xs font-mono uppercase tracking-widest mt-1">
            {project.name} • Procurement & Inventory
          </p>
        </div>
        <div className="flex items-center gap-2 bg-neutral-900 p-1 rounded-xl border border-neutral-800">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${
              activeTab === 'all' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'text-neutral-500 hover:text-white'
            }`}
          >
            All Requests
          </button>
              {isApprover() && (
                <button
                  onClick={() => setActiveTab('pending')}
                  className={`px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${
                    activeTab === 'pending' ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20' : 'text-neutral-500 hover:text-white'
                  }`}
                >
                  Pending Approval ({requests.filter(r => {
                    const roles = userProfile.roles || [userProfile.role];
                    const userPendingIndex = (r.approvals || []).findIndex(a => roles.includes(a.role) && a.status === 'Pending');
                    return userPendingIndex !== -1 && isAssigned();
                  }).length})
                </button>
              )}
          <button
            onClick={() => setActiveTab('summary')}
            className={`px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${
              activeTab === 'summary' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'text-neutral-500 hover:text-white'
            }`}
          >
            Approved Summary
          </button>
        </div>
      </div>

      {error && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center justify-between"
        >
          <div className="flex items-center gap-3 text-red-500">
            <AlertCircle size={18} />
            <span className="text-sm font-bold uppercase tracking-tight">{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-400">
            <X size={18} />
          </button>
        </motion.div>
      )}

      <AnimatePresence mode="wait">
        <motion.div 
          key="requests"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="space-y-6"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold text-white flex items-center gap-2 uppercase tracking-tight">
              <Package className="text-emerald-500" />
              {activeTab === 'all' ? 'Material Requests' : activeTab === 'pending' ? 'Pending My Approval' : 'Approved Summary'}
            </h3>
            {activeTab === 'all' && canCreateRequest() && (
              <button 
                onClick={() => setIsRequestModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-emerald-600 transition-colors shadow-lg shadow-emerald-500/20"
              >
                <Plus size={16} />
                New Request
              </button>
            )}
          </div>

          {activeTab === 'summary' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {Array.from(new Set(filteredRequests.map(r => r.itemName))).map(itemName => {
                const totalVol = filteredRequests
                  .filter(r => r.itemName === itemName)
                  .reduce((sum, r) => sum + r.volume, 0);
                const unit = filteredRequests.find(r => r.itemName === itemName)?.unit;
                return (
                  <div key={itemName} className="bg-neutral-900 border border-neutral-800 p-4 rounded-2xl">
                    <p className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest mb-1">Total Approved</p>
                    <ExpandableText text={itemName} className="mb-1" />
                    <p className="text-xl font-bold text-emerald-500 mt-2">{totalVol} <span className="text-xs text-neutral-500">{unit}</span></p>
                  </div>
                );
              })}
            </div>
          )}

          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-neutral-950/50">
                    <th className="px-6 py-4 text-[10px] font-mono text-neutral-500 uppercase tracking-widest">Date / SPB</th>
                    <th className="px-6 py-4 text-[10px] font-mono text-neutral-500 uppercase tracking-widest">Item Name</th>
                    <th className="px-6 py-4 text-[10px] font-mono text-neutral-500 uppercase tracking-widest">Photo</th>
                    <th className="px-6 py-4 text-[10px] font-mono text-neutral-500 uppercase tracking-widest">Req Qty</th>
                    <th className="px-6 py-4 text-[10px] font-mono text-neutral-500 uppercase tracking-widest">Discipline</th>
                    <th className="px-6 py-4 text-[10px] font-mono text-neutral-500 uppercase tracking-widest">Logistics Status</th>
                    <th className="px-6 py-4 text-[10px] font-mono text-neutral-500 uppercase tracking-widest">Site Inventory</th>
                    <th className="px-6 py-4 text-[10px] font-mono text-neutral-500 uppercase tracking-widest">Approval Status</th>
                    <th className="px-6 py-4 text-[10px] font-mono text-neutral-500 uppercase tracking-widest">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800">
                  {filteredRequests.map((req) => {
                    const logistics = getLogisticsStatus(req.spbNo);
                    const usagePercent = logistics ? Math.min(100, (logistics.used / (logistics.totalVolume || 1)) * 100) : 0;
                    
                    // Determine if the current user can approve
                    const roles = userProfile.roles || [userProfile.role];
                    const userPendingIndex = (req.approvals || []).findIndex(a => roles.includes(a.role) && a.status === 'Pending');
                    const canApprove = userPendingIndex !== -1 && isAssigned();

                    return (
                      <tr key={req.id} className="hover:bg-neutral-800/30 transition-colors">
                        <td className="px-6 py-4">
                          <p className="text-xs text-neutral-400 font-mono">{req.date}</p>
                          <p className="text-[10px] text-emerald-500 font-mono mt-1">{req.spbNo || 'No SPB'}</p>
                        </td>
                        <td className="px-6 py-4">
                          <ExpandableText text={req.itemName} />
                          <p className="text-[9px] text-neutral-500 uppercase mt-0.5">{req.workItem}</p>
                          {req.area && <p className="text-[8px] text-neutral-600 uppercase italic">Area: {req.area}</p>}
                        </td>
                        <td className="px-6 py-4">
                          {req.photoUrl ? (
                            <img 
                              src={req.photoUrl} 
                              alt={req.itemName} 
                              className="w-10 h-10 rounded-lg object-cover cursor-pointer hover:scale-110 transition-transform"
                              onClick={() => window.open(req.photoUrl, '_blank')}
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-neutral-800 flex items-center justify-center text-neutral-600">
                              <Package size={16} />
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 text-xs text-neutral-300 font-bold">{req.volume} {req.unit}</td>
                        <td className="px-6 py-4">
                          <span className="px-2 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider bg-neutral-800 text-neutral-400">
                            {req.discipline}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {logistics ? (
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                                  logistics.status === 'Done' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'
                                }`}>
                                  {logistics.status}
                                </span>
                                {logistics.status === 'Done' && <Check size={10} className="text-emerald-500" />}
                              </div>
                              <div className="space-y-1">
                                <div className="flex justify-between text-[9px] font-mono">
                                  <span className="text-neutral-500 uppercase">Received</span>
                                  <span className="text-white font-bold">{logistics.totalVolume} {req.unit}</span>
                                </div>
                                <div className="w-24 h-1 bg-neutral-800 rounded-full overflow-hidden">
                                  <div 
                                    className="h-full bg-emerald-500 transition-all"
                                    style={{ width: `${Math.min(100, (logistics.totalVolume / (req.volume || 1)) * 100)}%` }}
                                  />
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 text-neutral-600 italic">
                              <Clock size={12} />
                              <span className="text-[10px]">Awaiting Logistics</span>
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {logistics && logistics.totalVolume > 0 ? (
                            <div className="space-y-2">
                              <div className="flex justify-between text-[9px] font-mono">
                                <span className="text-orange-400 uppercase">Used: {logistics.used}</span>
                                <span className="text-emerald-400 uppercase">Rem: {logistics.remaining}</span>
                              </div>
                              <div className="w-full h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-orange-500 transition-all"
                                  style={{ width: `${usagePercent}%` }}
                                />
                              </div>
                            </div>
                          ) : (
                            <span className="text-[10px] text-neutral-600 italic">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col gap-2 min-w-[150px]">
                            {(req.approvals || []).map((app, idx) => (
                              <div key={idx} className="flex items-center justify-between gap-3 p-2 rounded-lg bg-neutral-950/30 border border-neutral-800/50">
                                <div className="flex items-center gap-2">
                                  <div className={`w-1.5 h-1.5 rounded-full ${
                                    app.status === 'Approved' ? 'bg-emerald-500' :
                                    app.status === 'Rejected' ? 'bg-red-500' :
                                    'bg-neutral-700'
                                  }`} />
                                  <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-tight">
                                    {app.role}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  {app.status !== 'Pending' && (app.approvedBy === auth.currentUser?.uid || isAdmin()) && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (window.confirm(`Cancel this ${app.status.toLowerCase()}?`)) {
                                          handleCancelMyApproval(req.id);
                                        }
                                      }}
                                      className="p-1 text-neutral-600 hover:text-amber-500 transition-colors"
                                      title="Cancel my decision"
                                    >
                                      <RotateCcw size={10} />
                                    </button>
                                  )}
                                  {app.status === 'Approved' ? (
                                    <Check size={10} className="text-emerald-500" />
                                  ) : app.status === 'Rejected' ? (
                                    <X size={10} className="text-red-500" />
                                  ) : (
                                    <Clock size={10} className="text-neutral-600" />
                                  )}
                                </div>
                              </div>
                            ))}
                            <div className="mt-1 flex justify-center">
                              <span className={`px-3 py-1 rounded-full text-[8px] font-bold uppercase tracking-widest ${
                                req.status === 'Approved' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' :
                                req.status === 'Rejected' ? 'bg-red-500/10 text-red-500 border border-red-500/20' :
                                'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                              }`}>
                                {req.status}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <button 
                              onClick={() => {
                                setSelectedRequest(req);
                                setIsDetailsModalOpen(true);
                              }}
                              className="p-2 bg-neutral-800 text-neutral-400 rounded-lg hover:bg-neutral-700 hover:text-white transition-all"
                              title="View Details"
                            >
                              <Eye size={14} />
                            </button>
                            {canApprove && (
                              <button 
                                onClick={() => {
                                  setSelectedRequest(req);
                                  setIsApprovalModalOpen(true);
                                }}
                                className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500 text-white rounded-lg text-[10px] font-bold uppercase tracking-wider hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20"
                              >
                                <Check size={12} />
                                Approve
                              </button>
                            )}
                            {req.status === 'Approved' && isApprover() && (
                              <button 
                                onClick={() => setCancelConfirmId(req.id)}
                                className="p-2 bg-red-500/10 text-red-500 rounded-lg hover:bg-red-500 hover:text-white transition-all"
                                title="Cancel Approval"
                              >
                                <X size={14} />
                              </button>
                            )}
                            {req.status === 'Approved' && (
                              <button 
                                onClick={() => generatePDF(req)}
                                className="p-2 bg-neutral-800 text-neutral-400 rounded-lg hover:bg-neutral-700 hover:text-white transition-all"
                                title="Generate PDF"
                              >
                                <FileText size={14} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredRequests.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-6 py-12 text-center text-neutral-500 text-sm italic">
                        No {activeTab === 'summary' ? 'approved' : ''} material requests found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Details Modal */}
      {isDetailsModalOpen && selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-neutral-900 border border-neutral-800 rounded-3xl p-8 max-w-2xl w-full my-8"
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white uppercase tracking-tight flex items-center gap-2">
                <FileText className="text-emerald-500" />
                Request Details
              </h3>
              <button onClick={() => setIsDetailsModalOpen(false)} className="text-neutral-500 hover:text-white">
                <X size={20} />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-6">
                <div className="space-y-4">
                  <div className="p-4 bg-neutral-950/50 rounded-2xl border border-neutral-800">
                    <p className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest mb-1">Item Information</p>
                    <ExpandableText text={selectedRequest.itemName} className="text-lg" />
                    <p className="text-sm text-neutral-400 mt-1">{selectedRequest.volume} {selectedRequest.unit}</p>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="p-3 bg-neutral-950/30 rounded-xl border border-neutral-800/50">
                      <p className="text-[8px] font-mono text-neutral-500 uppercase tracking-widest mb-1">SPB No</p>
                      <p className="text-xs font-bold text-white">{selectedRequest.spbNo || '-'}</p>
                    </div>
                    <div className="p-3 bg-neutral-950/30 rounded-xl border border-neutral-800/50">
                      <p className="text-[8px] font-mono text-neutral-500 uppercase tracking-widest mb-1">Date</p>
                      <p className="text-xs font-bold text-white">{selectedRequest.date}</p>
                    </div>
                    <div className="p-3 bg-neutral-950/30 rounded-xl border border-neutral-800/50">
                      <p className="text-[8px] font-mono text-neutral-500 uppercase tracking-widest mb-1">Budget Code</p>
                      <p className="text-xs font-bold text-white">{selectedRequest.budgetCode || '-'}</p>
                    </div>
                  </div>

                  <div className="p-3 bg-neutral-950/30 rounded-xl border border-neutral-800/50">
                    <p className="text-[8px] font-mono text-neutral-500 uppercase tracking-widest mb-1">Work Item & Area</p>
                    <p className="text-xs font-bold text-white uppercase">{selectedRequest.workItem || '-'}</p>
                    <p className="text-[10px] text-neutral-500 mt-1 uppercase italic">{selectedRequest.area || '-'}</p>
                  </div>

                  <div className="p-3 bg-neutral-950/30 rounded-xl border border-neutral-800/50">
                    <p className="text-[8px] font-mono text-neutral-500 uppercase tracking-widest mb-1">Remarks</p>
                    <ExpandableText 
                      text={selectedRequest.remarks || 'No remarks provided.'} 
                      textClassName="text-xs text-neutral-400 italic"
                      maxLines={3}
                    />
                  </div>
                </div>

                {selectedRequest.photoUrl && (
                  <div className="space-y-2">
                    <p className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest">Evidence Photo</p>
                    <img 
                      src={selectedRequest.photoUrl} 
                      alt="Evidence" 
                      className="w-full rounded-2xl border border-neutral-800 cursor-pointer"
                      onClick={() => window.open(selectedRequest.photoUrl, '_blank')}
                    />
                  </div>
                )}
              </div>

              <div className="space-y-6">
                <p className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest">Approval History</p>
                <div className="space-y-4">
                  {(selectedRequest.approvals || []).map((app, idx) => (
                    <div key={idx} className="p-4 bg-neutral-950/50 rounded-2xl border border-neutral-800 relative overflow-hidden">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider">{app.role}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[8px] font-bold uppercase ${
                          app.status === 'Approved' ? 'bg-emerald-500/10 text-emerald-500' :
                          app.status === 'Rejected' ? 'bg-red-500/10 text-red-500' :
                          'bg-neutral-800 text-neutral-500'
                        }`}>
                          {app.status}
                        </span>
                      </div>
                      
                      {app.status !== 'Pending' ? (
                        <div className="space-y-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-neutral-800 flex items-center justify-center text-[10px] font-bold text-white">
                              {app.approvedByName?.[0]}
                            </div>
                            <div>
                              <p className="text-xs font-bold text-white">{app.approvedByName}</p>
                              <p className="text-[9px] text-neutral-500">{app.approvalDate ? new Date(app.approvalDate).toLocaleString() : '-'}</p>
                            </div>
                          </div>
                          {app.remarks && (
                            <ExpandableText 
                              text={app.remarks} 
                              className="bg-neutral-900 p-2 rounded-lg"
                              textClassName="text-[10px] text-neutral-400 italic"
                              maxLines={2}
                            />
                          )}
                          {app.signature && (
                            <div className="pt-2 border-t border-neutral-800">
                              <p className="text-[8px] font-mono text-neutral-600 uppercase tracking-widest mb-1">Signature</p>
                              <img src={app.signature} alt="Signature" className="h-12 object-contain filter invert opacity-80" />
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-neutral-600 italic py-2">
                          <Clock size={12} />
                          <span className="text-[10px]">Awaiting Approval</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-neutral-800 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest">Overall Status:</span>
                <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${
                  selectedRequest.status === 'Approved' ? 'bg-emerald-500/10 text-emerald-500' :
                  selectedRequest.status === 'Rejected' ? 'bg-red-500/10 text-red-500' :
                  'bg-amber-500/10 text-amber-500'
                }`}>
                  {selectedRequest.status}
                </span>
              </div>
              <div className="flex gap-3">
                {selectedRequest.status === 'Approved' && (
                  <button 
                    onClick={() => generatePDF(selectedRequest)}
                    className="flex items-center gap-2 px-4 py-2 bg-neutral-800 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-neutral-700 transition-all"
                  >
                    <Download size={14} />
                    Download PDF
                  </button>
                )}
                <button 
                  onClick={() => setIsDetailsModalOpen(false)}
                  className="px-6 py-2 bg-emerald-500 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-emerald-600 transition-all"
                >
                  Close
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Approval Modal */}
      {isApprovalModalOpen && selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-neutral-900 border border-neutral-800 rounded-3xl p-8 max-w-lg w-full my-auto flex flex-col max-h-[calc(100dvh-40px)]"
          >
            <div className="flex items-center justify-between mb-6 flex-shrink-0">
              <h3 className="text-xl font-bold text-white uppercase tracking-tight flex items-center gap-2">
                <CheckCircle className="text-emerald-500" />
                Approve Material Request
              </h3>
              <button onClick={() => setIsApprovalModalOpen(false)} className="text-neutral-500 hover:text-white">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-6 overflow-y-auto flex-1 custom-scrollbar pr-2">
              <div className="p-4 bg-neutral-950/50 rounded-2xl border border-neutral-800">
                <p className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest mb-1">Request Details</p>
                <ExpandableText text={selectedRequest.itemName} />
                <p className="text-xs text-neutral-400 mt-1">{selectedRequest.volume} {selectedRequest.unit} for {selectedRequest.workItem}</p>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="block text-[10px] font-mono text-neutral-500 uppercase tracking-widest">Signature</label>
                  <div className="flex bg-neutral-800 p-1 rounded-lg">
                    <button
                      onClick={() => setSignatureMethod('draw')}
                      className={`px-3 py-1 text-[9px] font-bold uppercase rounded-md transition-all ${
                        signatureMethod === 'draw' ? 'bg-emerald-500 text-white shadow-sm' : 'text-neutral-400 hover:text-white'
                      }`}
                    >
                      Draw
                    </button>
                    <button
                      onClick={() => setSignatureMethod('upload')}
                      className={`px-3 py-1 text-[9px] font-bold uppercase rounded-md transition-all ${
                        signatureMethod === 'upload' ? 'bg-emerald-500 text-white shadow-sm' : 'text-neutral-400 hover:text-white'
                      }`}
                    >
                      Upload
                    </button>
                  </div>
                </div>

                {signatureMethod === 'draw' ? (
                  <div className="space-y-2">
                    <div className="bg-white rounded-2xl overflow-hidden border-2 border-neutral-800">
                      <SignatureCanvas 
                        ref={sigCanvas}
                        penColor="black"
                        canvasProps={{
                          className: "w-full h-40 cursor-crosshair"
                        }}
                      />
                    </div>
                    <button 
                      type="button"
                      onClick={() => sigCanvas.current?.clear()}
                      className="text-[10px] font-bold text-neutral-500 uppercase hover:text-white transition-colors"
                    >
                      Clear Signature
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-neutral-800 rounded-2xl cursor-pointer hover:border-emerald-500/50 transition-all bg-neutral-950/30">
                      {uploadedSignature ? (
                        <img src={uploadedSignature} alt="Signature" className="h-full object-contain p-4" />
                      ) : (
                        <div className="flex flex-col items-center gap-2 text-neutral-500">
                          <Plus size={24} />
                          <span className="text-[10px] font-bold uppercase tracking-widest">Upload Signature Image</span>
                        </div>
                      )}
                      <input type="file" accept="image/*" className="hidden" onChange={handleSignatureUpload} />
                    </label>
                    {uploadedSignature && (
                      <button 
                        type="button"
                        onClick={() => setUploadedSignature(null)}
                        className="text-[10px] font-bold text-neutral-500 uppercase hover:text-white transition-colors"
                      >
                        Remove Signature
                      </button>
                    )}
                  </div>
                )}
              </div>

              {((userProfile.roles || []).includes('CC') || isAdmin()) && 
               !(userProfile.roles || []).includes('CM') && 
               !(userProfile.roles || []).includes('Project Manager') && (
                <div className="space-y-2">
                  <label className="block text-[10px] font-mono text-neutral-500 uppercase tracking-widest mb-2">Budget Code</label>
                  <input 
                    id="budgetCode"
                    className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-4 py-3 text-white outline-none focus:border-emerald-500 text-sm"
                    placeholder="e.g. B-2024-CIV-001"
                  />
                </div>
              )}

              <div className="space-y-2">
                <label className="block text-[10px] font-mono text-neutral-500 uppercase tracking-widest mb-2">Remarks (Optional)</label>
                <textarea 
                  id="approvalRemarks"
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-4 py-3 text-white outline-none focus:border-emerald-500 min-h-[80px] resize-none"
                  placeholder="Add any comments..."
                />
              </div>
            </div>

            <div className="flex gap-4 pt-6 flex-shrink-0">
              <button
                onClick={() => {
                  let signature = '';
                  if (signatureMethod === 'draw') {
                    signature = sigCanvas.current?.getTrimmedCanvas().toDataURL('image/jpeg', 0.5) || '';
                  } else {
                    signature = uploadedSignature || '';
                  }
                  
                  if (!signature) {
                    setError('Please provide a signature.');
                    return;
                  }

                  const remarks = (document.getElementById('approvalRemarks') as HTMLTextAreaElement)?.value || '';
                  const budgetCode = (document.getElementById('budgetCode') as HTMLInputElement)?.value || '';
                  handleApproveRequest(selectedRequest.id, 'Approved', signature, remarks, budgetCode);
                }}
                className="flex-1 py-4 bg-emerald-500 text-white rounded-2xl font-bold uppercase tracking-widest hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20"
              >
                Approve
              </button>
              <button
                onClick={() => {
                  const remarks = (document.getElementById('approvalRemarks') as HTMLTextAreaElement)?.value || '';
                  handleApproveRequest(selectedRequest.id, 'Rejected', '', remarks);
                }}
                className="flex-1 py-4 bg-red-500/10 text-red-500 border border-red-500/20 rounded-2xl font-bold uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all"
              >
                Reject
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* New Request Modal */}
      {isRequestModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-neutral-900 border border-neutral-800 rounded-3xl p-8 max-w-2xl w-full my-auto flex flex-col max-h-[calc(100dvh-40px)]"
          >
            <div className="flex items-center justify-between mb-6 flex-shrink-0">
              <h3 className="text-xl font-bold text-white uppercase tracking-tight flex items-center gap-2">
                <Plus className="text-emerald-500" />
                New Material Request
              </h3>
              <button onClick={() => setIsRequestModalOpen(false)} className="text-neutral-500 hover:text-white">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateRequest} className="flex flex-col flex-1 min-h-0">
              <div className="space-y-4 overflow-y-auto flex-1 custom-scrollbar pr-2 mb-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-mono text-neutral-500 uppercase tracking-widest mb-2">Requester Name</label>
                    <input 
                      name="requestedByName" 
                      defaultValue={userProfile.name}
                      required
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-white text-sm focus:border-emerald-500 outline-none transition-colors"
                      placeholder="Your Name"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono text-neutral-500 uppercase tracking-widest mb-2">Discipline</label>
                    <select 
                      name="discipline"
                      required
                      defaultValue={isAdmin() ? 'QC' : (userProfile.roles?.[0] || userProfile.role)}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-white text-sm focus:border-emerald-500 outline-none transition-colors"
                    >
                      {isAdmin() ? (
                        <>
                          <option value="QC">QC</option>
                          <option value="Civil">Civil</option>
                          <option value="Mechanical">Mechanical</option>
                          <option value="Electrical">Electrical</option>
                          <option value="Instrument">Instrument</option>
                          <option value="Piping">Piping</option>
                          <option value="Structure">Structure</option>
                          <option value="Architectural">Architectural</option>
                        </>
                      ) : (
                        (userProfile.roles || [userProfile.role]).map(role => (
                          <option key={role} value={role}>{role}</option>
                        ))
                      )}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-mono text-neutral-500 uppercase tracking-widest mb-2">SPB Number</label>
                    <input 
                      name="spbNo" 
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-white text-sm focus:border-emerald-500 outline-none transition-colors"
                      placeholder="e.g. 001/QC/..."
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono text-neutral-500 uppercase tracking-widest mb-2">Work Item</label>
                    <select 
                      name="workItem" 
                      required
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-white text-sm focus:border-emerald-500 outline-none transition-colors"
                    >
                      <option value="">Select Work Item</option>
                      <option value="Civil">Civil</option>
                      <option value="Structure">Structure</option>
                      <option value="Instrument">Instrument</option>
                      <option value="Electrical">Electrical</option>
                      <option value="Mechanical">Mechanical</option>
                      <option value="Architecture">Architecture</option>
                      <option value="Piping">Piping</option>
                      <option value="Others">Others</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-[10px] font-mono text-neutral-500 uppercase tracking-widest mb-2">Item Name</label>
                    <input 
                      name="itemName" 
                      required
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-white text-sm focus:border-emerald-500 outline-none transition-colors"
                      placeholder="Material name"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-mono text-neutral-500 uppercase tracking-widest mb-2">Volume</label>
                    <input 
                      name="volume" 
                      type="number"
                      required
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-white text-sm focus:border-emerald-500 outline-none transition-colors"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono text-neutral-500 uppercase tracking-widest mb-2">Unit</label>
                    <input 
                      name="unit" 
                      required
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-white text-sm focus:border-emerald-500 outline-none transition-colors"
                      placeholder="e.g. Pcs, Kg"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-mono text-neutral-500 uppercase tracking-widest mb-2">Area / Location</label>
                  <input 
                    name="area" 
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-white text-sm focus:border-emerald-500 outline-none transition-colors"
                    placeholder="Installation area"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono text-neutral-500 uppercase tracking-widest mb-2">Evidence Photo</label>
                  <div className="flex items-center gap-4">
                    <label className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-neutral-950 border border-neutral-800 border-dashed rounded-xl text-neutral-500 hover:text-emerald-500 hover:border-emerald-500/50 transition-all cursor-pointer">
                      <Plus size={16} />
                      <span className="text-xs font-bold uppercase tracking-wider">{isUploading ? 'Uploading...' : 'Upload Photo'}</span>
                      <input type="file" accept="image/*" className="hidden" onChange={handleRequestPhotoUpload} disabled={isUploading} />
                    </label>
                    {requestPhotoUrl && (
                      <div className="w-12 h-12 rounded-xl overflow-hidden border border-neutral-800">
                        <img src={requestPhotoUrl} alt="Preview" className="w-full h-full object-cover" />
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex gap-3 pt-4 flex-shrink-0 border-t border-neutral-800">
                <button 
                  type="button"
                  onClick={() => setIsRequestModalOpen(false)}
                  className="flex-1 px-6 py-3 bg-neutral-800 text-white rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-neutral-700 transition-all"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="flex-1 px-6 py-3 bg-emerald-500 text-white rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20"
                >
                  Submit
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
      {/* Cancel Confirmation Modal */}
      {cancelConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-neutral-900 border border-neutral-800 rounded-3xl p-8 max-w-md w-full"
          >
            <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center mb-6 mx-auto">
              <AlertCircle className="w-8 h-8 text-red-500" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2 text-center uppercase tracking-tight">Cancel Approval?</h3>
            <p className="text-neutral-400 mb-8 text-center text-sm leading-relaxed">
              This will revert the request status to Pending and remove it from the Logistics system. Are you sure?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setCancelConfirmId(null)}
                className="flex-1 px-6 py-3 bg-neutral-800 text-white font-bold rounded-xl hover:bg-neutral-700 transition-all text-xs uppercase tracking-widest"
              >
                No, Keep it
              </button>
              <button
                onClick={() => handleCancelApproval(cancelConfirmId)}
                className="flex-1 px-6 py-3 bg-red-500 text-white font-bold rounded-xl hover:bg-red-600 transition-all text-xs uppercase tracking-widest"
              >
                Yes, Cancel
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
