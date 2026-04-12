import React, { useMemo, useState, useEffect } from 'react';
import { Project, DailyReport, QCFolder, QCFile, UserProfile, QCNotification } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ClipboardCheck, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  FileText,
  BarChart3,
  Activity,
  Search,
  FolderPlus,
  Upload,
  Folder,
  File,
  Trash2,
  ChevronRight,
  X,
  Bell
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
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  doc, 
  serverTimestamp, 
  deleteDoc,
  orderBy
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { handleFirestoreError, OperationType } from '../firebase';
import { compressImage } from '../services/imageService';
import { isSuperAdmin } from '../constants';

interface QCDashboardProps {
  project: Project;
  reports: DailyReport[];
  userProfile: UserProfile;
  onNavigateToRequests: () => void;
}

export default function QCDashboard({ project, reports, userProfile, onNavigateToRequests }: QCDashboardProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'files'>('overview');
  const [folders, setFolders] = useState<QCFolder[]>([]);
  const [files, setFiles] = useState<QCFile[]>([]);
  const [notifications, setNotifications] = useState<QCNotification[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isAdmin = () => (userProfile.roles || []).includes('Admin') || isSuperAdmin(auth.currentUser?.email);

  const breadcrumbs = useMemo(() => {
    const crumbs: QCFolder[] = [];
    let current = folders.find(f => f.id === currentFolderId);
    while (current) {
      crumbs.unshift(current);
      current = folders.find(f => f.id === (current as QCFolder).parentId);
    }
    return crumbs;
  }, [currentFolderId, folders]);

  // Fetch QC Folders
  useEffect(() => {
    const q = query(
      collection(db, 'qcFolders'),
      where('projectId', '==', project.id)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const flds = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as QCFolder));
      setFolders(flds);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'qcFolders');
    });

    return () => unsubscribe();
  }, [project.id]);

  // Fetch QC Files
  useEffect(() => {
    const q = query(
      collection(db, 'qcFiles'),
      where('projectId', '==', project.id)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fls = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as QCFile));
      setFiles(fls);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'qcFiles');
    });

    return () => unsubscribe();
  }, [project.id]);

  // Fetch QC Notifications
  useEffect(() => {
    if (!auth.currentUser) return;
    const q = query(
      collection(db, 'qcNotifications'),
      where('projectId', '==', project.id),
      where('userId', '==', auth.currentUser.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notifs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as QCNotification));
      setNotifications(notifs);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'qcNotifications');
    });

    return () => unsubscribe();
  }, [project.id]);

  const qcReports = useMemo(() => 
    reports.filter(r => r.discipline === 'QC' && r.projectId === project.id),
    [reports, project.id]
  );

  const stats = useMemo(() => {
    const allInspections = qcReports.flatMap(r => {
      try {
        const parsedData = JSON.parse(r.data);
        return parsedData.inspections || [];
      } catch (e) {
        return [];
      }
    });
    const total = allInspections.length;
    const approved = allInspections.filter(i => i.status === 'Approved').length;
    const pending = allInspections.filter(i => i.status === 'Pending').length;
    const rejected = allInspections.filter(i => i.status === 'Rejected').length;
    
    // Group by discipline
    const disciplineData = allInspections.reduce((acc: any, curr) => {
      const disc = curr.discipline || 'Other';
      acc[disc] = (acc[disc] || 0) + 1;
      return acc;
    }, {});

    const chartData = Object.entries(disciplineData).map(([name, value]) => ({ name, value }));

    // Status distribution for pie chart
    const statusData = [
      { name: 'Approved', value: approved, color: '#10b981' },
      { name: 'Pending', value: pending, color: '#f59e0b' },
      { name: 'Rejected', value: rejected, color: '#ef4444' }
    ].filter(d => d.value > 0);

    return { total, approved, pending, rejected, chartData, statusData, allInspections };
  }, [qcReports]);

  const handleCreateFolder = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const newFolder = {
      projectId: project.id,
      name: formData.get('folderName') as string,
      parentId: currentFolderId,
      createdBy: auth.currentUser?.uid || '',
      createdAt: serverTimestamp(),
    };

    try {
      await addDoc(collection(db, 'qcFolders'), newFolder);
      setIsFolderModalOpen(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'qcFolders');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file size for non-images (Firestore 1MB limit)
    // Base64 is ~1.33x the size of binary. 750KB binary is ~1MB base64.
    if (!file.type.startsWith('image/') && file.size > 750000) {
      setError('File is too large. Maximum size for non-image files is 750KB.');
      return;
    }

    setIsUploading(true);
    setError(null);
    try {
      let fileUrl = '';
      
      // Only compress if it's an image
      if (file.type.startsWith('image/')) {
        fileUrl = await compressImage(file, 800, 800, 0.6);
      } else {
        // For non-images, we still use base64 for demo purposes, 
        // but in a real app this should be Firebase Storage
        const reader = new FileReader();
        fileUrl = await new Promise((resolve, reject) => {
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = () => reject(new Error('Failed to read file'));
          reader.readAsDataURL(file);
        });
      }

      const newFile = {
        projectId: project.id,
        folderId: currentFolderId,
        name: file.name,
        url: fileUrl,
        type: file.type,
        size: file.size,
        uploadedBy: auth.currentUser?.uid || '',
        uploadedByName: userProfile.name,
        uploadedAt: serverTimestamp(),
      };

      await addDoc(collection(db, 'qcFiles'), newFile);
    } catch (err) {
      console.error('File upload failed:', err);
      handleFirestoreError(err, OperationType.CREATE, 'qcFiles');
      setError('Failed to upload file. It might be too large for the database.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteFolder = async (folderId: string) => {
    if (!(userProfile.roles || []).includes('Project Control') && !isAdmin()) {
      // If not Project Control, request deletion
      try {
        await updateDoc(doc(db, 'qcFolders', folderId), {
          deleteRequested: true,
          deleteRequestedBy: auth.currentUser?.uid,
          deleteRequestedByName: userProfile.name,
          deleteRequestedAt: serverTimestamp(),
        });

        // Notify Project Control
        const pcUsersQuery = query(collection(db, 'users'), where('roles', 'array-contains', 'Project Control'));
        onSnapshot(pcUsersQuery, (snapshot) => {
          snapshot.docs.forEach(async (userDoc) => {
            await addDoc(collection(db, 'qcNotifications'), {
              projectId: project.id,
              userId: userDoc.id,
              title: 'Folder Deletion Request',
              message: `${userProfile.name} requested to delete folder: ${folders.find(f => f.id === folderId)?.name}.`,
              type: 'alert',
              link: `/qc/files?folderId=${folderId}`,
              read: false,
              createdAt: serverTimestamp(),
            });
          });
        }, { once: true } as any);

        setError('Deletion request sent to Project Control.');
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, 'qcFolders');
      }
      return;
    }

    if (!confirm('Are you sure you want to delete this folder and all its contents?')) return;

    try {
      await deleteDoc(doc(db, 'qcFolders', folderId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'qcFolders');
    }
  };

  const handleDeleteFile = async (fileId: string) => {
    if (!(userProfile.roles || []).includes('Project Control') && !isAdmin()) {
      // If not Project Control, request deletion
      try {
        await updateDoc(doc(db, 'qcFiles', fileId), {
          deleteRequested: true,
          deleteRequestedBy: auth.currentUser?.uid,
          deleteRequestedByName: userProfile.name,
          deleteRequestedAt: serverTimestamp(),
        });

        // Notify Project Control
        const pcUsersQuery = query(collection(db, 'users'), where('roles', 'array-contains', 'Project Control'));
        onSnapshot(pcUsersQuery, (snapshot) => {
          snapshot.docs.forEach(async (userDoc) => {
            await addDoc(collection(db, 'qcNotifications'), {
              projectId: project.id,
              userId: userDoc.id,
              title: 'File Deletion Request',
              message: `${userProfile.name} requested to delete file: ${files.find(f => f.id === fileId)?.name}.`,
              type: 'alert',
              link: `/qc/files?fileId=${fileId}`,
              read: false,
              createdAt: serverTimestamp(),
            });
          });
        }, { once: true } as any);

        setError('Deletion request sent to Project Control.');
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, 'qcFiles');
      }
      return;
    }

    if (!confirm('Are you sure you want to delete this file?')) return;

    try {
      await deleteDoc(doc(db, 'qcFiles', fileId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'qcFiles');
    }
  };

  const handleApproveDelete = async (item: QCFolder | QCFile, type: 'folder' | 'file') => {
    if (!(userProfile.roles || []).includes('Project Control') && !isAdmin()) return;

    try {
      const collectionName = type === 'folder' ? 'qcFolders' : 'qcFiles';
      await deleteDoc(doc(db, collectionName, item.id));

      // Notify requester
      if (item.deleteRequestedBy) {
        await addDoc(collection(db, 'qcNotifications'), {
          projectId: project.id,
          userId: item.deleteRequestedBy,
          title: 'Deletion Approved',
          message: `Your request to delete ${item.name} has been approved.`,
          type: 'success',
          link: '/qc/files',
          read: false,
          createdAt: serverTimestamp(),
        });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, type === 'folder' ? 'qcFolders' : 'qcFiles');
    }
  };

  const handleRejectDelete = async (item: QCFolder | QCFile, type: 'folder' | 'file') => {
    if (!(userProfile.roles || []).includes('Project Control') && !isAdmin()) return;

    try {
      const collectionName = type === 'folder' ? 'qcFolders' : 'qcFiles';
      await updateDoc(doc(db, collectionName, item.id), {
        deleteRequested: false,
        deleteRequestedBy: null,
        deleteRequestedByName: null,
        deleteRequestedAt: null,
      });

      // Notify requester
      if (item.deleteRequestedBy) {
        await addDoc(collection(db, 'qcNotifications'), {
          projectId: project.id,
          userId: item.deleteRequestedBy,
          title: 'Deletion Rejected',
          message: `Your request to delete ${item.name} has been rejected.`,
          type: 'error',
          link: '/qc/files',
          read: false,
          createdAt: serverTimestamp(),
        });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, type === 'folder' ? 'qcFolders' : 'qcFiles');
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white uppercase tracking-tight flex items-center gap-3">
            <ClipboardCheck className="text-emerald-500" />
            QC Dashboard
          </h2>
          <p className="text-neutral-500 text-xs font-mono uppercase tracking-widest mt-1">
            {project.name} • Quality Intelligence
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-4">
          <div className="relative">
            <button 
              onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
              className="p-2 bg-neutral-900 border border-neutral-800 rounded-xl text-neutral-400 hover:text-emerald-500 transition-all relative"
            >
              <Bell size={20} />
              {notifications.filter(n => !n.read).length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold flex items-center justify-center rounded-full border-2 border-neutral-950">
                  {notifications.filter(n => !n.read).length}
                </span>
              )}
            </button>

            <AnimatePresence>
              {isNotificationsOpen && (
                <motion.div 
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute right-0 mt-2 w-80 bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl z-50 overflow-hidden"
                >
                  <div className="p-4 border-b border-neutral-800 flex items-center justify-between">
                    <h4 className="text-xs font-bold text-white uppercase tracking-widest">Notifications</h4>
                    <button 
                      onClick={() => setIsNotificationsOpen(false)}
                      className="text-neutral-500 hover:text-white"
                    >
                      <X size={14} />
                    </button>
                  </div>
                  <div className="max-h-96 overflow-y-auto divide-y divide-neutral-800">
                    {notifications.length > 0 ? (
                      notifications.map((notification) => (
                        <div 
                          key={notification.id} 
                          className={`p-4 hover:bg-neutral-800/50 transition-colors cursor-pointer ${!notification.read ? 'bg-emerald-500/5' : ''}`}
                          onClick={async () => {
                            await updateDoc(doc(db, 'qcNotifications', notification.id), { read: true });
                            if (notification.link) {
                              // Handle link navigation
                              setIsNotificationsOpen(false);
                            }
                          }}
                        >
                          <div className="flex gap-3">
                            <div className={`p-2 rounded-lg shrink-0 ${
                              notification.type === 'Approval' ? 'bg-emerald-500/10 text-emerald-500' :
                              notification.type === 'Rejection' ? 'bg-red-500/10 text-red-500' :
                              'bg-blue-500/10 text-blue-500'
                            }`}>
                              {notification.type === 'Approval' ? <CheckCircle2 size={14} /> : 
                               notification.type === 'Rejection' ? <X size={14} /> : 
                               <Bell size={14} />}
                            </div>
                            <div>
                              <p className="text-xs font-bold text-white">{notification.title}</p>
                              <p className="text-[10px] text-neutral-400 mt-1 leading-relaxed">{notification.message}</p>
                              <p className="text-[8px] text-neutral-600 mt-2 font-mono uppercase">
                                {notification.createdAt?.toDate?.()?.toLocaleString() || 'Just now'}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="p-8 text-left text-neutral-500 text-xs italic">
                        No notifications yet.
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="flex bg-neutral-900/50 p-1 rounded-xl border border-neutral-800">
          <button 
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${activeTab === 'overview' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'text-neutral-400 hover:text-white hover:bg-neutral-800'}`}
          >
            Overview
          </button>
          <button 
            onClick={onNavigateToRequests}
            className="px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all text-neutral-400 hover:text-white hover:bg-neutral-800"
          >
            Material Requests
          </button>
          <button 
            onClick={() => setActiveTab('files')}
            className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${activeTab === 'files' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'text-neutral-400 hover:text-white hover:bg-neutral-800'}`}
          >
            File Manager
          </button>
        </div>
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
        {activeTab === 'overview' && (
          <motion.div 
            key="overview"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-8"
          >
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <StatCard 
                title="Total Inspections" 
                value={stats.total} 
                icon={<Search className="w-5 h-5 text-blue-400" />}
                trend="All Time"
              />
              <StatCard 
                title="Approved" 
                value={stats.approved} 
                icon={<CheckCircle2 className="w-5 h-5 text-emerald-400" />}
                trend={`${((stats.approved / (stats.total || 1)) * 100).toFixed(1)}% Rate`}
              />
              <StatCard 
                title="Pending" 
                value={stats.pending} 
                icon={<Clock className="w-5 h-5 text-amber-400" />}
                trend="Awaiting Review"
              />
              <StatCard 
                title="Rejected" 
                value={stats.rejected} 
                icon={<AlertCircle className="w-5 h-5 text-red-400" />}
                trend="Action Required"
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Discipline Distribution */}
              <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-8">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-emerald-500" />
                    Inspections by Discipline
                  </h3>
                </div>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#262626" vertical={false} />
                      <XAxis 
                        dataKey="name" 
                        stroke="#737373" 
                        fontSize={10} 
                        tickLine={false} 
                        axisLine={false}
                      />
                      <YAxis 
                        stroke="#737373" 
                        fontSize={10} 
                        tickLine={false} 
                        axisLine={false}
                      />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#171717', border: '1px solid #262626', borderRadius: '12px' }}
                        itemStyle={{ color: '#fff', fontSize: '12px' }}
                      />
                      <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                        {stats.chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={index % 2 === 0 ? '#10b981' : '#3b82f6'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Status Distribution */}
              <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-8">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <Activity className="w-5 h-5 text-emerald-500" />
                    Status Distribution
                  </h3>
                </div>
                <div className="h-[300px] w-full flex items-center justify-start">
                  {stats.statusData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={stats.statusData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {stats.statusData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#171717', border: '1px solid #262626', borderRadius: '12px' }}
                          itemStyle={{ color: '#fff', fontSize: '12px' }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="text-neutral-500 text-sm font-mono">No Data Available</div>
                  )}
                </div>
                <div className="flex justify-start gap-6 mt-4">
                  {stats.statusData.map((d) => (
                    <div key={d.name} className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: d.color }} />
                      <span className="text-xs text-neutral-400 font-mono uppercase">{d.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Recent Inspections Table */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-3xl overflow-hidden">
              <div className="p-6 border-b border-neutral-800 flex items-center justify-between">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <FileText className="w-5 h-5 text-emerald-500" />
                  Recent Inspection Activities
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-neutral-950/50">
                      <th className="px-6 py-4 text-[10px] font-mono text-neutral-500 uppercase tracking-widest">Discipline</th>
                      <th className="px-6 py-4 text-[10px] font-mono text-neutral-500 uppercase tracking-widest">RFI Number</th>
                      <th className="px-6 py-4 text-[10px] font-mono text-neutral-500 uppercase tracking-widest">Type</th>
                      <th className="px-6 py-4 text-[10px] font-mono text-neutral-500 uppercase tracking-widest">Area</th>
                      <th className="px-6 py-4 text-[10px] font-mono text-neutral-500 uppercase tracking-widest">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-800">
                    {stats.allInspections.slice(-10).reverse().map((inspection, idx) => (
                      <tr key={idx} className="hover:bg-neutral-800/30 transition-colors">
                        <td className="px-6 py-4">
                          <span className="text-xs font-bold text-white">{inspection.discipline}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-xs font-mono text-neutral-400">{inspection.rfiNumber || '-'}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-xs text-neutral-300">{inspection.inspectionType}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-xs text-neutral-300">{inspection.area}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            inspection.status === 'Approved' ? 'bg-emerald-500/10 text-emerald-500' :
                            inspection.status === 'Rejected' ? 'bg-red-500/10 text-red-500' :
                            'bg-amber-500/10 text-amber-500'
                          }`}>
                            {inspection.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {stats.allInspections.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-left text-neutral-500 text-sm italic">
                          No inspection records found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'files' && (
          <motion.div 
            key="files"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <h3 className="text-xl font-bold text-white flex items-center gap-2 uppercase tracking-tight">
                  <Folder className="text-emerald-500" />
                  QC File Manager
                </h3>
              </div>
              <div className="flex items-center gap-3">
                {(userProfile.roles || []).includes('QC') && (
                  <>
                    <button 
                      onClick={() => setIsFolderModalOpen(true)}
                      className="flex items-center gap-2 px-4 py-2 bg-neutral-800 text-white rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-neutral-700 transition-colors"
                    >
                      <FolderPlus size={16} />
                      New Folder
                    </button>
                    <label className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-emerald-600 transition-colors shadow-lg shadow-emerald-500/20 cursor-pointer">
                      <Upload size={16} />
                      {isUploading ? 'Uploading...' : 'Upload File'}
                      <input type="file" className="hidden" onChange={handleFileUpload} disabled={isUploading} />
                    </label>
                  </>
                )}
              </div>
            </div>

            {/* Breadcrumbs */}
            <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-neutral-500 overflow-x-auto pb-2 border-b border-neutral-800/50">
              <button 
                onClick={() => setCurrentFolderId(null)}
                className={`hover:text-emerald-500 transition-colors ${!currentFolderId ? 'text-emerald-500 font-bold' : ''}`}
              >
                Root
              </button>
              {breadcrumbs.map((crumb) => (
                <React.Fragment key={crumb.id}>
                  <ChevronRight size={10} className="shrink-0 text-neutral-700" />
                  <button 
                    onClick={() => setCurrentFolderId(crumb.id)}
                    className={`hover:text-emerald-500 transition-colors whitespace-nowrap ${currentFolderId === crumb.id ? 'text-emerald-500 font-bold' : ''}`}
                  >
                    {crumb.name}
                  </button>
                </React.Fragment>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Folders */}
              {folders.filter(f => f.parentId === currentFolderId).map(folder => (
                <div 
                  key={folder.id}
                  className="p-4 bg-neutral-900 border border-neutral-800 rounded-2xl hover:border-emerald-500/50 transition-all group relative"
                >
                  <div className="flex items-center justify-between">
                    <div 
                      className="flex items-center gap-3 cursor-pointer flex-1 min-w-0"
                      onClick={() => setCurrentFolderId(folder.id)}
                    >
                      <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-500">
                        <Folder size={24} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-white truncate uppercase tracking-tight">{folder.name}</p>
                        <p className="text-[10px] text-neutral-500 font-mono">Folder</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => handleDeleteFolder(folder.id)}
                      className={`p-2 transition-colors ${folder.deleteRequested ? 'text-red-500' : 'text-neutral-500 hover:text-red-500'}`}
                      title={folder.deleteRequested ? "Deletion Requested" : "Delete Folder"}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>

                  {folder.deleteRequested && (
                    <div className="mt-4 p-3 bg-red-500/10 rounded-xl border border-red-500/20">
                      <p className="text-[10px] font-bold text-red-500 uppercase tracking-wider flex items-center gap-2">
                        <AlertCircle size={12} />
                        Deletion Requested
                      </p>
                      <p className="text-[9px] text-neutral-400 mt-1">By {folder.deleteRequestedByName}</p>
                      {((userProfile.roles || []).includes('Project Control') || isAdmin()) && (
                        <div className="flex items-center gap-2 mt-2">
                          <button 
                            onClick={() => handleApproveDelete(folder, 'folder')}
                            className="flex-1 py-1 bg-emerald-500 text-white rounded-lg text-[9px] font-bold uppercase tracking-wider hover:bg-emerald-600 transition-colors"
                          >
                            Approve
                          </button>
                          <button 
                            onClick={() => handleRejectDelete(folder, 'folder')}
                            className="flex-1 py-1 bg-neutral-800 text-white rounded-lg text-[9px] font-bold uppercase tracking-wider hover:bg-neutral-700 transition-colors"
                          >
                            Reject
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}

              {/* Files */}
              {files.filter(f => f.folderId === currentFolderId).map(file => (
                <div 
                  key={file.id}
                  className="p-4 bg-neutral-900 border border-neutral-800 rounded-2xl hover:border-blue-500/50 transition-all group relative"
                >
                  <div className="flex items-center justify-between">
                    <a 
                      href={file.url} 
                      target="_blank" 
                      rel="noreferrer"
                      className="flex items-center gap-3 flex-1 min-w-0"
                    >
                      <div className="p-3 bg-blue-500/10 rounded-xl text-blue-500">
                        <File size={24} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-white truncate uppercase tracking-tight">{file.name}</p>
                        <p className="text-[10px] text-neutral-500 font-mono">{(file.size / 1024).toFixed(1)} KB</p>
                      </div>
                    </a>
                    <button 
                      onClick={() => handleDeleteFile(file.id)}
                      className={`p-2 transition-colors ${file.deleteRequested ? 'text-red-500' : 'text-neutral-500 hover:text-red-500'}`}
                      title={file.deleteRequested ? "Deletion Requested" : "Delete File"}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>

                  {file.deleteRequested && (
                    <div className="mt-4 p-3 bg-red-500/10 rounded-xl border border-red-500/20">
                      <p className="text-[10px] font-bold text-red-500 uppercase tracking-wider flex items-center gap-2">
                        <AlertCircle size={12} />
                        Deletion Requested
                      </p>
                      <p className="text-[9px] text-neutral-400 mt-1">By {file.deleteRequestedByName}</p>
                      {((userProfile.roles || []).includes('Project Control') || isAdmin()) && (
                        <div className="flex items-center gap-2 mt-2">
                          <button 
                            onClick={() => handleApproveDelete(file, 'file')}
                            className="flex-1 py-1 bg-emerald-500 text-white rounded-lg text-[9px] font-bold uppercase tracking-wider hover:bg-emerald-600 transition-colors"
                          >
                            Approve
                          </button>
                          <button 
                            onClick={() => handleRejectDelete(file, 'file')}
                            className="flex-1 py-1 bg-neutral-800 text-white rounded-lg text-[9px] font-bold uppercase tracking-wider hover:bg-neutral-700 transition-colors"
                          >
                            Reject
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}

              {folders.filter(f => f.parentId === currentFolderId).length === 0 && 
               files.filter(f => f.folderId === currentFolderId).length === 0 && (
                <div className="col-span-full py-12 text-left px-8 text-neutral-500 text-sm italic border-2 border-dashed border-neutral-800 rounded-3xl">
                  This folder is empty.
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Folder Modal */}
      {isFolderModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-neutral-900 border border-neutral-800 rounded-3xl p-8 max-w-md w-full"
          >
            <h3 className="text-xl font-bold text-white mb-6 uppercase tracking-tight flex items-center gap-2">
              <FolderPlus className="text-emerald-500" />
              Create New Folder
            </h3>
            <form onSubmit={handleCreateFolder} className="space-y-4">
              <div>
                <label className="block text-[10px] font-mono text-neutral-500 uppercase tracking-widest mb-2">Folder Name</label>
                <input 
                  name="folderName" 
                  required 
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-white text-sm focus:border-emerald-500 outline-none transition-colors"
                  placeholder="e.g. Inspection Photos"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button 
                  type="button" 
                  onClick={() => setIsFolderModalOpen(false)}
                  className="flex-1 px-4 py-3 bg-neutral-800 text-white rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-neutral-700 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="flex-1 px-4 py-3 bg-emerald-500 text-white rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-emerald-600 transition-colors shadow-lg shadow-emerald-500/20"
                >
                  Create
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}

function StatCard({ title, value, icon, trend }: any) {
  return (
    <div className="p-6 bg-neutral-900 border border-neutral-800 rounded-2xl hover:border-neutral-700 transition-all group">
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs font-mono text-neutral-500 uppercase tracking-widest">{title}</p>
        <div className="p-2 bg-neutral-800 rounded-lg group-hover:scale-110 transition-transform">
          {icon}
        </div>
      </div>
      <div className="flex items-baseline gap-2">
        <p className="text-3xl font-bold text-white">{value}</p>
        <span className="text-[10px] font-mono text-neutral-500 uppercase">{trend}</span>
      </div>
    </div>
  );
}
