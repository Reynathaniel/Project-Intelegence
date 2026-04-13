import React, { useState, useEffect, useCallback } from 'react';
import { Project, UserProfile, UserRole, DailyReport, AttendanceRecord } from '../types';
import { db, collection, addDoc, getDocs, updateDoc, doc, query, where, handleFirestoreError, OperationType, deleteDoc, orderBy, limit } from '../firebase';
import { compressImage } from '../services/imageService';
import { seedPMData } from '../services/pmService';
import { isSuperAdmin } from '../constants';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Users, Briefcase, ShieldAlert, CheckCircle2, XCircle, ChevronRight, UserPlus, Settings, ShieldCheck, Search, Trash2, Edit2, ArrowUpCircle, ArrowDownCircle, Clock, Mail, MapPin, Zap } from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell,
  LineChart,
  Line,
  AreaChart,
  Area,
  Legend
} from 'recharts';

interface AdminPanelProps {
  projects: Project[];
  users: UserProfile[];
  currentUserEmail: string;
}

export default function AdminPanel({ projects, users: initialUsers, currentUserEmail }: AdminPanelProps) {
  const [activeTab, setActiveTab] = useState<'projects' | 'users' | 'analytics' | 'attendance'>('projects');
  const [users, setUsers] = useState<UserProfile[]>(initialUsers);
  const [reports, setReports] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState<string>('All');
  const [userProjectFilter, setUserProjectFilter] = useState<string>('All');
  const [attendanceSearchTerm, setAttendanceSearchTerm] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [userDeleteConfirm, setUserDeleteConfirm] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [seedingId, setSeedingId] = useState<string | null>(null);
  const [userForm, setUserForm] = useState({
    name: '',
    email: '',
    roles: [] as UserRole[],
    projects: [] as string[]
  });

  const filteredAttendance = attendance.filter(record => 
    record.userName.toLowerCase().includes(attendanceSearchTerm.toLowerCase()) ||
    record.projectName.toLowerCase().includes(attendanceSearchTerm.toLowerCase())
  );

  const filteredUsers = users.filter(user => {
    const userRoles = (user.roles || (user.role ? [user.role] : []));
    const matchesSearch = user.name.toLowerCase().includes(userSearchTerm.toLowerCase()) || 
                         user.email.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
                         userRoles.some(r => r.toLowerCase().includes(userSearchTerm.toLowerCase()));
    const matchesRole = userRoleFilter === 'All' || 
                       userRoles.includes(userRoleFilter as UserRole);
    const matchesProject = userProjectFilter === 'All' || 
                          user.projects?.includes(userProjectFilter);
    return matchesSearch && matchesRole && matchesProject;
  });

  const handleDeleteProject = async (projectId: string) => {
    try {
      await deleteDoc(doc(db, 'projects', projectId));
      setDeleteConfirm(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `projects/${projectId}`);
    }
  };

  const handleSeedPMData = async (projectId: string) => {
    setSeedingId(projectId);
    try {
      await seedPMData(projectId);
      setError(null);
    } catch (err) {
      setError('Failed to seed PM intelligence data.');
    } finally {
      setSeedingId(null);
    }
  };

  // New Project Form State
  const [newProject, setNewProject] = useState({
    name: '',
    description: '',
    location: '',
    latitude: 0,
    longitude: 0,
    radius: 500, // Default 500m
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
    status: 'Active' as const,
    managerId: currentUserEmail,
    contractNo: '',
    client: '',
    contractorName: '',
    clientLogo: '',
    contractorLogo: '',
    assignedUserEmail: '',
    approvalConfig: {
      qcMaterialRequestRoles: ['CM', 'CC', 'Project Manager'] as UserRole[]
    }
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [userSnap, reportSnap, attendanceSnap] = await Promise.all([
          getDocs(collection(db, 'users')).catch(err => {
            handleFirestoreError(err, OperationType.LIST, 'users');
            throw err;
          }),
          getDocs(collection(db, 'reports')).catch(err => {
            handleFirestoreError(err, OperationType.LIST, 'reports');
            throw err;
          }),
          getDocs(collection(db, 'attendance')).catch(err => {
            handleFirestoreError(err, OperationType.LIST, 'attendance');
            throw err;
          })
        ]);
        setUsers(userSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserProfile)));
        setReports(reportSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        setAttendance(attendanceSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as AttendanceRecord))
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
      } catch (err) {
        console.error('AdminPanel fetchData error:', err);
      }
    };
    fetchData();
  }, []);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'client' | 'contractor') => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const compressedBase64 = await compressImage(file, 400, 400, 0.8); // Logos can be smaller
        if (editingProject) {
          setEditingProject(prev => prev ? ({
            ...prev,
            [type === 'client' ? 'clientLogo' : 'contractorLogo']: compressedBase64
          }) : null);
        } else {
          setNewProject(prev => ({
            ...prev,
            [type === 'client' ? 'clientLogo' : 'contractorLogo']: compressedBase64
          }));
        }
      } catch (err) {
        console.error('Failed to compress logo:', err);
        setError('Failed to process logo image. Please try a different image.');
      }
    }
  };

  const handleSubmitProject = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (editingProject) {
        const { id, ...projectData } = editingProject;
        await updateDoc(doc(db, 'projects', id), projectData);
      } else {
        await addDoc(collection(db, 'projects'), newProject);
      }
      setShowProjectModal(false);
      setEditingProject(null);
      setNewProject({
        name: '',
        description: '',
        location: '',
        latitude: 0,
        longitude: 0,
        radius: 500,
        startDate: new Date().toISOString().split('T')[0],
        endDate: '',
        status: 'Active',
        managerId: currentUserEmail,
        contractNo: '',
        client: '',
        contractorName: '',
        clientLogo: '',
        contractorLogo: '',
        assignedUserEmail: '',
        approvalConfig: {
          qcMaterialRequestRoles: ['CM', 'CC', 'Project Manager']
        }
      });
    } catch (err) {
      handleFirestoreError(err, editingProject ? OperationType.UPDATE : OperationType.CREATE, 'projects');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    try {
      await deleteDoc(doc(db, 'users', userId));
      setUsers(users.filter(u => u.id !== userId));
      setUserDeleteConfirm(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `users/${userId}`);
    }
  };

  const toggleUserRole = async (userId: string, role: UserRole) => {
    setError(null);
    const user = users.find(u => u.id === userId);
    if (!user) return;

    const currentRoles = user.roles || [user.role];
    const isRemoving = currentRoles.includes(role);
    
    if (isRemoving && currentRoles.length <= 1) {
      setError('User must have at least one role.');
      return;
    }

    if (role === 'Admin' && !isSuperAdmin(currentUserEmail)) {
      setError('Only the application owner can assign the Admin role.');
      return;
    }

    const newRoles = isRemoving
      ? currentRoles.filter(r => r !== role)
      : [...currentRoles, role];

    try {
      await updateDoc(doc(db, 'users', userId), { 
        roles: newRoles,
        role: newRoles[0], // Keep legacy role as the first one
        name: user.name,
        email: user.email
      });
      setUsers(users.map(u => u.id === userId ? { ...u, roles: newRoles, role: newRoles[0] } : u));
    } catch (err: any) {
      console.error('Failed to update roles:', err);
      const isPermissionError = err.message?.includes('permission') || err.code === 'permission-denied';
      setError(isPermissionError ? 'Missing or insufficient permissions. Only the super admin can perform this action.' : 'Failed to update roles.');
      handleFirestoreError(err, OperationType.UPDATE, `users/${userId}`);
    }
  };

  const toggleProjectAccess = async (userId: string, projectId: string) => {
    const user = users.find(u => u.id === userId);
    if (!user) return;

    const newProjects = user.projects.includes(projectId)
      ? user.projects.filter(id => id !== projectId)
      : [...user.projects, projectId];

    try {
      await updateDoc(doc(db, 'users', userId), { 
        projects: newProjects,
        name: user.name,
        email: user.email,
        role: user.role
      });
      setUsers(users.map(u => u.id === userId ? { ...u, projects: newProjects } : u));
    } catch (err: any) {
      console.error('Failed to toggle project access:', err);
      const isPermissionError = err.message?.includes('permission') || err.code === 'permission-denied';
      setError(isPermissionError ? 'Missing or insufficient permissions. Only the super admin can perform this action.' : 'Failed to update project access.');
      handleFirestoreError(err, OperationType.UPDATE, `users/${userId}`);
    }
  };

  const filteredProjects = projects.filter(project =>
    project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    project.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (project.client || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8">
      {/* Error Message */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3 text-red-500"
          >
            <ShieldAlert className="w-5 h-5" />
            <span className="text-sm font-medium">{error}</span>
            <button 
              onClick={() => setError(null)}
              className="ml-auto p-1 hover:bg-red-500/20 rounded-lg transition-colors"
            >
              <XCircle className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2 sm:gap-4 bg-neutral-900 p-1 rounded-2xl border border-neutral-800 w-full sm:w-auto overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab('projects')}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 sm:px-6 py-3 rounded-xl transition-all font-bold text-xs sm:text-sm whitespace-nowrap ${
              activeTab === 'projects' ? 'bg-emerald-500 text-black' : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Briefcase className="w-4 h-4" />
            PROJECTS
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 sm:px-6 py-3 rounded-xl transition-all font-bold text-xs sm:text-sm whitespace-nowrap ${
              activeTab === 'users' ? 'bg-emerald-500 text-black' : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Users className="w-4 h-4" />
            PERSONNEL
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 sm:px-6 py-3 rounded-xl transition-all font-bold text-xs sm:text-sm whitespace-nowrap ${
              activeTab === 'analytics' ? 'bg-emerald-500 text-black' : 'text-neutral-400 hover:text-white'
            }`}
          >
            <ShieldAlert className="w-4 h-4" />
            ANALYTICS
          </button>
          <button
            onClick={() => setActiveTab('attendance')}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 sm:px-6 py-3 rounded-xl transition-all font-bold text-xs sm:text-sm whitespace-nowrap ${
              activeTab === 'attendance' ? 'bg-emerald-500 text-black' : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Clock className="w-4 h-4" />
            ATTENDANCE
          </button>
        </div>

        {activeTab === 'projects' && (
          <button
            onClick={() => {
              setEditingProject(null);
              setShowProjectModal(true);
            }}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-white text-black font-bold rounded-xl hover:bg-emerald-500 hover:text-white transition-all text-sm"
          >
            <Plus className="w-4 h-4" />
            CREATE NEW SECTOR
          </button>
        )}
      </div>

      {activeTab === 'projects' ? (
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <h2 className="text-xl font-bold text-white uppercase tracking-tighter">Sector Management</h2>
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
              <input
                type="text"
                placeholder="SEARCH SECTORS..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-neutral-900 border border-neutral-800 rounded-xl text-white text-xs font-mono placeholder-neutral-600 focus:outline-none focus:border-emerald-500 transition-all"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProjects.map(project => (
              <div key={project.id} className="p-6 bg-neutral-900 border border-neutral-800 rounded-2xl flex flex-col group min-w-0 hover:border-emerald-500/30 transition-all">
                <div className="flex items-start justify-between mb-4">
                  <div className="min-w-0 flex-1 mr-4">
                    <h4 className="text-lg font-bold text-white mb-1 truncate" title={project.name}>{project.name}</h4>
                    <p className="text-xs text-neutral-500 font-mono uppercase tracking-widest truncate" title={project.location}>{project.location}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => {
                        setEditingProject({
                          ...project,
                          latitude: project.latitude || 0,
                          longitude: project.longitude || 0,
                          radius: project.radius || 500,
                          contractNo: project.contractNo || '',
                          client: project.client || '',
                          contractorName: project.contractorName || '',
                          description: project.description || '',
                          location: project.location || '',
                          endDate: project.endDate || '',
                          assignedUserEmail: project.assignedUserEmail || '',
                          approvalConfig: project.approvalConfig || {
                            qcMaterialRequestRoles: ['CM', 'CC', 'Project Manager']
                          }
                        });
                        setShowProjectModal(true);
                      }}
                      className="p-2 hover:bg-neutral-800 rounded-lg text-neutral-600 hover:text-emerald-400 transition-all"
                      title="Edit Project"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => setDeleteConfirm(project.id)}
                      className="p-2 hover:bg-red-500/10 rounded-lg text-neutral-600 hover:text-red-400 transition-all"
                      title="Delete Project"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => handleSeedPMData(project.id)}
                      disabled={seedingId === project.id}
                      className={`p-2 rounded-lg transition-all ${seedingId === project.id ? 'bg-emerald-500/20 text-emerald-500 animate-pulse' : 'hover:bg-emerald-500/10 text-neutral-600 hover:text-emerald-400'}`}
                      title="Seed PM Intelligence Data"
                    >
                      <Zap className={`w-4 h-4 ${seedingId === project.id ? 'animate-bounce' : ''}`} />
                    </button>
                  </div>
                </div>

                <div className="space-y-3 mb-6">
                  <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-widest">
                    <span className="text-neutral-500">Client</span>
                    <span className="text-neutral-300 font-bold">{project.client || 'N/A'}</span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-widest">
                    <span className="text-neutral-500">Contractor</span>
                    <span className="text-neutral-300 font-bold">{project.contractorName || 'N/A'}</span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-widest">
                    <span className="text-neutral-500">Contract No</span>
                    <span className="text-neutral-300 font-bold truncate max-w-[150px]" title={project.contractNo}>{project.contractNo || 'N/A'}</span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-widest">
                    <span className="text-neutral-500">Duration</span>
                    <span className="text-neutral-300">
                      {project.startDate ? new Date(project.startDate).toLocaleDateString() : 'N/A'} - {project.endDate ? new Date(project.endDate).toLocaleDateString() : 'N/A'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between mt-auto pt-4 border-t border-neutral-800">
                  <span className={`px-2 py-1 rounded-md text-[10px] font-mono uppercase tracking-widest font-bold ${
                    project.status === 'Active' ? 'bg-emerald-500/10 text-emerald-500' : 
                    project.status === 'Completed' ? 'bg-blue-500/10 text-blue-400' :
                    'bg-neutral-800 text-neutral-500'
                  }`}>
                    {project.status}
                  </span>
                  <div className="flex -space-x-2">
                    {users.filter(u => u.projects.includes(project.id)).slice(0, 3).map((u, i) => (
                      <div key={u.id} className="w-6 h-6 rounded-full bg-neutral-800 border-2 border-neutral-900 flex items-center justify-center text-[8px] font-bold text-emerald-500" title={u.name}>
                        {u.name[0]}
                      </div>
                    ))}
                    {users.filter(u => u.projects.includes(project.id)).length > 3 && (
                      <div className="w-6 h-6 rounded-full bg-neutral-800 border-2 border-neutral-900 flex items-center justify-center text-[8px] font-bold text-neutral-500">
                        +{users.filter(u => u.projects.includes(project.id)).length - 3}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : activeTab === 'users' ? (
        <div className="space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-1">
              <h2 className="text-xl font-bold text-white uppercase tracking-tighter">Personnel Directory</h2>
              <p className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest">Manage command authority and sector assignments</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                <input
                  type="text"
                  placeholder="SEARCH NAME OR EMAIL..."
                  className="w-full pl-10 pr-4 py-2 bg-neutral-900 border border-neutral-800 rounded-xl text-white text-[10px] font-mono placeholder-neutral-600 focus:outline-none focus:border-emerald-500 transition-all"
                  value={userSearchTerm}
                  onChange={(e) => setUserSearchTerm(e.target.value)}
                />
              </div>
              <select
                value={userRoleFilter}
                onChange={(e) => setUserRoleFilter(e.target.value)}
                className="bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 text-[10px] text-neutral-400 font-mono outline-none focus:border-emerald-500 transition-all"
              >
                <option value="All">ALL ROLES</option>
                {['Admin', 'Logistics', 'Supervisor', 'HSE', 'QC', 'HR', 'Procurement', 'Document Control', 'Mechanic & Electrical', 'Project Control', 'CC', 'CM', 'Project Manager', 'Project Director', 'General Manpower', 'Engineering', 'campbos', 'Permit Officer', 'Paramedic', 'Super Admin', 'Subcontractor Super Admin'].map(role => (
                  <option key={role} value={role}>{role.toUpperCase()}</option>
                ))}
              </select>
              <select
                value={userProjectFilter}
                onChange={(e) => setUserProjectFilter(e.target.value)}
                className="bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 text-[10px] text-neutral-400 font-mono outline-none focus:border-emerald-500 transition-all max-w-[150px]"
              >
                <option value="All">ALL SECTORS</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.name.toUpperCase()}</option>
                ))}
              </select>
              {(userSearchTerm || userRoleFilter !== 'All' || userProjectFilter !== 'All') && (
                <button
                  onClick={() => {
                    setUserSearchTerm('');
                    setUserRoleFilter('All');
                    setUserProjectFilter('All');
                  }}
                  className="p-2 text-neutral-500 hover:text-white transition-colors"
                  title="Clear Filters"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              )}
              <button
                onClick={() => {
                  setEditingUser(null);
                  setUserForm({
                    name: '',
                    email: '',
                    roles: ['Supervisor'],
                    projects: []
                  });
                  setShowUserModal(true);
                }}
                className="px-4 py-2 bg-emerald-500 text-black font-bold rounded-xl hover:bg-emerald-400 transition-all text-xs flex items-center gap-2"
              >
                <UserPlus className="w-4 h-4" />
                ADD PERSONNEL
              </button>
            </div>
          </div>
          
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden overflow-x-auto shadow-2xl">
            <table className="w-full text-left border-collapse min-w-[1000px]">
              <thead>
                <tr className="border-b border-neutral-800 bg-neutral-900/50">
                  <th className="p-4 text-[10px] font-mono text-neutral-500 uppercase tracking-widest">Personnel</th>
                  <th className="p-4 text-[10px] font-mono text-neutral-500 uppercase tracking-widest">Email Assignment</th>
                  <th className="p-4 text-[10px] font-mono text-neutral-500 uppercase tracking-widest">Designation</th>
                  <th className="p-4 text-[10px] font-mono text-neutral-500 uppercase tracking-widest">Assign to Project</th>
                  <th className="p-4 text-[10px] font-mono text-neutral-500 uppercase tracking-widest">Active Assignments</th>
                  <th className="p-4 text-[10px] font-mono text-neutral-500 uppercase tracking-widest text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map(user => (
                  <tr key={user.id} className="border-b border-neutral-800/50 hover:bg-neutral-800/30 transition-colors group">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-neutral-800 border border-neutral-700 flex items-center justify-center text-sm font-bold text-emerald-500 shadow-inner">
                          {user.name[0]}
                        </div>
                        <span className="text-sm font-bold text-white">{user.name}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2 text-xs text-neutral-400 font-mono">
                        <Mail className="w-3 h-3 text-neutral-600" />
                        <span>{user.email}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex flex-col gap-2">
                        <div className="flex flex-wrap gap-1">
                          {(user.roles || (user.role ? [user.role] : [])).map(role => (
                            <span 
                              key={role} 
                              className="group/tag flex items-center gap-1 px-2 py-0.5 bg-emerald-500/10 text-emerald-500 rounded text-[9px] font-mono uppercase tracking-widest border border-emerald-500/20 cursor-pointer hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/20 transition-all"
                              onClick={() => toggleUserRole(user.id, role)}
                              title="Click to remove role"
                            >
                              {role}
                              <XCircle className="w-2 h-2 opacity-0 group-hover/tag:opacity-100 transition-opacity" />
                            </span>
                          ))}
                        </div>
                        <select 
                          className="bg-neutral-800 border border-neutral-700 rounded-lg px-2 py-1 text-[10px] text-white outline-none focus:border-emerald-500 w-full cursor-pointer"
                          onChange={(e) => {
                            if (e.target.value) {
                              toggleUserRole(user.id, e.target.value as UserRole);
                              e.target.value = '';
                            }
                          }}
                        >
                          <option value="">+ ADD ROLE</option>
                          {['Admin', 'Logistics', 'Supervisor', 'HSE', 'QC', 'HR', 'Procurement', 'Document Control', 'Mechanic & Electrical', 'Project Control', 'CC', 'CM', 'Project Manager', 'Project Director', 'General Manpower', 'Engineering', 'campbos', 'Permit Officer', 'Paramedic', 'Super Admin', 'Subcontractor Super Admin']
                            .filter(r => !(user.roles || (user.role ? [user.role] : [])).includes(r as UserRole))
                            .map(role => (
                              <option key={role} value={role}>{role}</option>
                            ))}
                        </select>
                      </div>
                    </td>
                    <td className="p-4">
                      <select 
                        className="bg-neutral-800 border border-neutral-700 rounded-lg px-2 py-1 text-[10px] text-white outline-none focus:border-emerald-500 w-full cursor-pointer"
                        onChange={(e) => {
                          if (e.target.value) {
                            toggleProjectAccess(user.id, e.target.value);
                            e.target.value = '';
                          }
                        }}
                      >
                        <option value="">+ ASSIGN PROJECT</option>
                        {projects.filter(p => !user.projects?.includes(p.id)).map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    </td>
                    <td className="p-4">
                      <div className="flex flex-wrap gap-1">
                        {user.projects?.map(pid => {
                          const p = projects.find(proj => proj.id === pid);
                          return p ? (
                            <span 
                              key={pid} 
                              className="group/tag flex items-center gap-1 px-2 py-0.5 bg-neutral-800 text-neutral-400 rounded text-[9px] font-mono uppercase tracking-widest border border-neutral-700 cursor-pointer hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/20 transition-all"
                              onClick={() => toggleProjectAccess(user.id, pid)}
                              title="Click to remove project"
                            >
                              {p.name}
                              <XCircle className="w-2 h-2 opacity-0 group-hover/tag:opacity-100 transition-opacity" />
                            </span>
                          ) : null;
                        })}
                        {(!user.projects || user.projects.length === 0) && (
                          <span className="text-[9px] text-neutral-600 italic font-mono uppercase tracking-widest">No Active Sectors</span>
                        )}
                      </div>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => {
                            setEditingUser(user);
                            setUserForm({
                              name: user.name,
                              email: user.email,
                              roles: user.roles || (user.role ? [user.role] : []),
                              projects: user.projects || []
                            });
                            setShowUserModal(true);
                          }}
                          className="p-2 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-lg transition-all"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setUserDeleteConfirm(user.id)}
                          className="p-2 text-neutral-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : activeTab === 'attendance' ? (
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <h2 className="text-xl font-bold text-white uppercase tracking-tighter">Attendance Logs</h2>
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
              <input
                type="text"
                placeholder="SEARCH BY NAME OR PROJECT..."
                className="w-full pl-10 pr-4 py-2 bg-neutral-900 border border-neutral-800 rounded-xl text-white text-xs font-mono placeholder-neutral-600 focus:outline-none focus:border-emerald-500 transition-all"
                value={attendanceSearchTerm}
                onChange={(e) => setAttendanceSearchTerm(e.target.value)}
              />
            </div>
          </div>
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="border-b border-neutral-800">
                  <th className="p-4 text-[10px] font-mono text-neutral-500 uppercase tracking-widest">Personnel</th>
                  <th className="p-4 text-[10px] font-mono text-neutral-500 uppercase tracking-widest">Project</th>
                  <th className="p-4 text-[10px] font-mono text-neutral-500 uppercase tracking-widest">Type</th>
                  <th className="p-4 text-[10px] font-mono text-neutral-500 uppercase tracking-widest">Timestamp</th>
                  <th className="p-4 text-[10px] font-mono text-neutral-500 uppercase tracking-widest">Location</th>
                  <th className="p-4 text-[10px] font-mono text-neutral-500 uppercase tracking-widest">Verification</th>
                </tr>
              </thead>
              <tbody>
                {filteredAttendance.map(record => (
                  <tr key={record.id} className="border-b border-neutral-800/50 hover:bg-neutral-800/30 transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-neutral-800 border border-neutral-700 flex items-center justify-center text-xs font-bold text-emerald-500">
                          {record.userName[0]}
                        </div>
                        <span className="text-sm font-bold text-white">{record.userName}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="text-[10px] text-neutral-400 font-mono uppercase tracking-widest">{record.projectName}</span>
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded text-[9px] font-bold uppercase tracking-widest ${
                        record.type === 'Check-in' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-orange-500/10 text-orange-500'
                      }`}>
                        {record.type}
                      </span>
                    </td>
                    <td className="p-4">
                      <p className="text-[10px] text-neutral-300 font-mono">{new Date(record.timestamp).toLocaleString()}</p>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-1 text-[10px] text-neutral-400 font-mono">
                        <MapPin className="w-3 h-3" />
                        <span>{record.location.latitude.toFixed(4)}, {record.location.longitude.toFixed(4)}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      {record.photo && (
                        <div className="w-12 h-12 rounded-lg overflow-hidden border border-neutral-800">
                          <img src={record.photo} alt="Verification" className="w-full h-full object-cover" />
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {filteredAttendance.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-neutral-600 text-xs italic">No attendance records found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <AnalyticsView reports={reports} projects={projects} users={users} attendance={attendance} />
      )}

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-neutral-900 border border-neutral-800 p-8 rounded-3xl max-w-md w-full shadow-2xl my-auto max-h-[calc(100dvh-40px)] overflow-y-auto custom-scrollbar"
            >
              <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center mb-6 mx-auto">
                <Trash2 className="w-8 h-8 text-red-500" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-2 text-center">Delete Project?</h3>
              <p className="text-neutral-400 mb-8 text-center text-sm leading-relaxed">
                This action is permanent and will remove the project reference from the system. Historical reports will remain but will no longer be linked to an active project.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="flex-1 px-6 py-3 bg-neutral-800 text-white font-bold rounded-xl hover:bg-neutral-700 transition-all text-sm"
                >
                  CANCEL
                </button>
                <button
                  onClick={() => handleDeleteProject(deleteConfirm)}
                  className="flex-1 px-6 py-3 bg-red-500 text-white font-bold rounded-xl hover:bg-red-600 transition-all text-sm"
                >
                  DELETE
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* User Delete Confirmation Modal */}
      <AnimatePresence>
        {userDeleteConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-neutral-900 border border-neutral-800 p-8 rounded-3xl max-w-md w-full shadow-2xl my-auto max-h-[calc(100dvh-40px)] overflow-y-auto custom-scrollbar"
            >
              <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center mb-6 mx-auto">
                <Trash2 className="w-8 h-8 text-red-500" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-2 text-center">Delete Personnel?</h3>
              <p className="text-neutral-400 mb-8 text-center text-sm leading-relaxed">
                Are you sure you want to remove this personnel from the system? This action is permanent.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setUserDeleteConfirm(null)}
                  className="flex-1 px-6 py-3 bg-neutral-800 text-white font-bold rounded-xl hover:bg-neutral-700 transition-all text-sm"
                >
                  CANCEL
                </button>
                <button
                  onClick={() => handleDeleteUser(userDeleteConfirm)}
                  className="flex-1 px-6 py-3 bg-red-500 text-white font-bold rounded-xl hover:bg-red-600 transition-all text-sm"
                >
                  DELETE
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Project Modal */}
      {showProjectModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-lg bg-neutral-900 border border-neutral-800 rounded-3xl overflow-hidden shadow-2xl my-auto flex flex-col max-h-[calc(100dvh-40px)]"
          >
            <form onSubmit={handleSubmitProject} className="flex flex-col min-h-0">
              <div className="p-6 border-b border-neutral-800 flex items-center justify-between flex-shrink-0">
                <h3 className="text-xl font-bold text-white tracking-tight uppercase">
                  {editingProject ? 'Modify Sector Details' : 'Initialize New Sector'}
                </h3>
                <button 
                  type="button" 
                  onClick={() => {
                    setShowProjectModal(false);
                    setEditingProject(null);
                  }} 
                  className="text-neutral-500 hover:text-white"
                >
                  <XCircle className="w-6 h-6" />
                </button>
              </div>
              <div className="p-8 space-y-8 overflow-y-auto flex-1 custom-scrollbar">
                {/* Basic Information Section */}
                <div className="space-y-4">
                  <h4 className="text-[10px] font-mono text-emerald-500 uppercase tracking-[0.3em] font-bold border-b border-neutral-800 pb-2">Basic Information</h4>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest">Sector Name</label>
                      <input
                        required
                        value={(editingProject ? editingProject.name : newProject.name) || ''}
                        onChange={e => {
                          if (editingProject) setEditingProject({...editingProject, name: e.target.value});
                          else setNewProject({...newProject, name: e.target.value});
                        }}
                        className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-4 py-3 text-white outline-none focus:border-emerald-500 transition-all"
                        placeholder="e.g. Project Alpha"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest">Contract No</label>
                        <input
                          value={(editingProject ? editingProject.contractNo : newProject.contractNo) || ''}
                          onChange={e => {
                            if (editingProject) setEditingProject({...editingProject, contractNo: e.target.value});
                            else setNewProject({...newProject, contractNo: e.target.value});
                          }}
                          className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-4 py-3 text-white outline-none focus:border-emerald-500 transition-all"
                          placeholder="e.g. NO.PT-MSIFP-FW-006"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest">Status</label>
                        <select
                          value={(editingProject ? editingProject.status : newProject.status) || ''}
                          onChange={e => {
                            const status = e.target.value as any;
                            if (editingProject) setEditingProject({...editingProject, status});
                            else setNewProject({...newProject, status});
                          }}
                          className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-4 py-3 text-white outline-none focus:border-emerald-500 transition-all"
                        >
                          <option value="Active">Active</option>
                          <option value="Completed">Completed</option>
                          <option value="On Hold">On Hold</option>
                        </select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest">Location</label>
                      <input
                        required
                        value={(editingProject ? editingProject.location : newProject.location) || ''}
                        onChange={e => {
                          if (editingProject) setEditingProject({...editingProject, location: e.target.value});
                          else setNewProject({...newProject, location: e.target.value});
                        }}
                        className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-4 py-3 text-white outline-none focus:border-emerald-500 transition-all"
                        placeholder="e.g. Jakarta, Indonesia"
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest">Latitude</label>
                        <input
                          type="number"
                          step="any"
                          value={(editingProject ? editingProject.latitude : newProject.latitude) || 0}
                          onChange={e => {
                            const val = parseFloat(e.target.value);
                            if (editingProject) setEditingProject({...editingProject, latitude: val});
                            else setNewProject({...newProject, latitude: val});
                          }}
                          className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-4 py-3 text-white outline-none focus:border-emerald-500 transition-all"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest">Longitude</label>
                        <input
                          type="number"
                          step="any"
                          value={(editingProject ? editingProject.longitude : newProject.longitude) || 0}
                          onChange={e => {
                            const val = parseFloat(e.target.value);
                            if (editingProject) setEditingProject({...editingProject, longitude: val});
                            else setNewProject({...newProject, longitude: val});
                          }}
                          className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-4 py-3 text-white outline-none focus:border-emerald-500 transition-all"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest">Radius (m)</label>
                        <input
                          type="number"
                          value={(editingProject ? editingProject.radius : newProject.radius) || 500}
                          onChange={e => {
                            const val = parseInt(e.target.value);
                            if (editingProject) setEditingProject({...editingProject, radius: val});
                            else setNewProject({...newProject, radius: val});
                          }}
                          className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-4 py-3 text-white outline-none focus:border-emerald-500 transition-all"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Stakeholders Section */}
                <div className="space-y-4">
                  <h4 className="text-[10px] font-mono text-emerald-500 uppercase tracking-[0.3em] font-bold border-b border-neutral-800 pb-2">Stakeholders</h4>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest">Client Name</label>
                        <input
                          value={(editingProject ? editingProject.client : newProject.client) || ''}
                          onChange={e => {
                            if (editingProject) setEditingProject({...editingProject, client: e.target.value});
                            else setNewProject({...newProject, client: e.target.value});
                          }}
                          className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-4 py-3 text-white outline-none focus:border-emerald-500 transition-all"
                          placeholder="e.g. PT Layar Nusantara"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest">Contractor Name</label>
                        <input
                          value={(editingProject ? editingProject.contractorName : newProject.contractorName) || ''}
                          onChange={e => {
                            if (editingProject) setEditingProject({...editingProject, contractorName: e.target.value});
                            else setNewProject({...newProject, contractorName: e.target.value});
                          }}
                          className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-4 py-3 text-white outline-none focus:border-emerald-500 transition-all"
                          placeholder="e.g. PT Rey-Command Indonesia"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest">Client Logo</label>
                        <div className="flex items-center gap-3">
                          <input
                            type="file"
                            accept="image/*"
                            onChange={e => handleLogoUpload(e, 'client')}
                            className="hidden"
                            id="client-logo-upload"
                          />
                          <label 
                            htmlFor="client-logo-upload"
                            className="flex-1 bg-neutral-800 border border-neutral-700 rounded-xl px-4 py-3 text-[10px] text-neutral-400 cursor-pointer hover:border-emerald-500 transition-colors flex items-center justify-center gap-2"
                          >
                            <Plus className="w-3 h-3" />
                            {(editingProject?.clientLogo || newProject.clientLogo) ? 'CHANGE LOGO' : 'UPLOAD LOGO'}
                          </label>
                          {(editingProject?.clientLogo || newProject.clientLogo) && (
                            <div className="w-12 h-12 rounded-xl bg-white p-1 border border-neutral-700">
                              <img src={editingProject?.clientLogo || newProject.clientLogo} className="w-full h-full object-contain" alt="Client Logo" />
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest">Contractor Logo</label>
                        <div className="flex items-center gap-3">
                          <input
                            type="file"
                            accept="image/*"
                            onChange={e => handleLogoUpload(e, 'contractor')}
                            className="hidden"
                            id="contractor-logo-upload"
                          />
                          <label 
                            htmlFor="contractor-logo-upload"
                            className="flex-1 bg-neutral-800 border border-neutral-700 rounded-xl px-4 py-3 text-[10px] text-neutral-400 cursor-pointer hover:border-emerald-500 transition-colors flex items-center justify-center gap-2"
                          >
                            <Plus className="w-3 h-3" />
                            {(editingProject?.contractorLogo || newProject.contractorLogo) ? 'CHANGE LOGO' : 'UPLOAD LOGO'}
                          </label>
                          {(editingProject?.contractorLogo || newProject.contractorLogo) && (
                            <div className="w-12 h-12 rounded-xl bg-white p-1 border border-neutral-700">
                              <img src={editingProject?.contractorLogo || newProject.contractorLogo} className="w-full h-full object-contain" alt="Contractor Logo" />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Schedule Section */}
                <div className="space-y-4">
                  <h4 className="text-[10px] font-mono text-emerald-500 uppercase tracking-[0.3em] font-bold border-b border-neutral-800 pb-2">Schedule & Assignment</h4>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest">Start Date</label>
                        <input
                          type="date"
                          required
                          value={(editingProject ? editingProject.startDate : newProject.startDate) || ''}
                          onChange={e => {
                            if (editingProject) setEditingProject({...editingProject, startDate: e.target.value});
                            else setNewProject({...newProject, startDate: e.target.value});
                          }}
                          className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-4 py-3 text-white outline-none focus:border-emerald-500 transition-all"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest">End Date</label>
                        <input
                          type="date"
                          required
                          value={(editingProject ? editingProject.endDate : newProject.endDate) || ''}
                          onChange={e => {
                            if (editingProject) setEditingProject({...editingProject, endDate: e.target.value});
                            else setNewProject({...newProject, endDate: e.target.value});
                          }}
                          className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-4 py-3 text-white outline-none focus:border-emerald-500 transition-all"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest">Project Manager Email</label>
                      <input
                        value={(editingProject ? (editingProject.assignedUserEmail || '') : (newProject.assignedUserEmail || '')) || ''}
                        onChange={e => {
                          if (editingProject) setEditingProject({...editingProject, assignedUserEmail: e.target.value});
                          else setNewProject({...newProject, assignedUserEmail: e.target.value});
                        }}
                        className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-4 py-3 text-white outline-none focus:border-emerald-500 transition-all"
                        placeholder="e.g. pm@example.com"
                      />
                    </div>
                  </div>
                </div>

                {/* Additional Details Section */}
                <div className="space-y-4">
                  <h4 className="text-[10px] font-mono text-emerald-500 uppercase tracking-[0.3em] font-bold border-b border-neutral-800 pb-2">Additional Details</h4>
                  <div className="space-y-2">
                    <label className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest">Description</label>
                    <textarea
                      value={(editingProject ? editingProject.description : newProject.description) || ''}
                      onChange={e => {
                        if (editingProject) setEditingProject({...editingProject, description: e.target.value});
                        else setNewProject({...newProject, description: e.target.value});
                      }}
                      className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-4 py-3 text-white outline-none focus:border-emerald-500 min-h-[100px] resize-none transition-all"
                      placeholder="Project mission details..."
                    />
                  </div>
                </div>

                {/* Approval Chain Section */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
                    <h4 className="text-[10px] font-mono text-emerald-500 uppercase tracking-[0.3em] font-bold">QC Approval Chain</h4>
                    <select
                      onChange={(e) => {
                        const role = e.target.value as UserRole;
                        if (!role) return;
                        const currentRoles = (editingProject?.approvalConfig?.qcMaterialRequestRoles || newProject.approvalConfig?.qcMaterialRequestRoles) || [];
                        if (currentRoles.includes(role)) return;
                        const newRoles = [...currentRoles, role];
                        
                        if (editingProject) {
                          setEditingProject({
                            ...editingProject,
                            approvalConfig: { ...editingProject.approvalConfig, qcMaterialRequestRoles: newRoles }
                          });
                        } else {
                          setNewProject({
                            ...newProject,
                            approvalConfig: { ...newProject.approvalConfig, qcMaterialRequestRoles: newRoles }
                          });
                        }
                        e.target.value = '';
                      }}
                      className="bg-neutral-800 border border-neutral-700 rounded-lg px-2 py-1 text-[10px] text-white outline-none focus:border-emerald-500"
                    >
                      <option value="">+ ADD ROLE</option>
                      {['CM', 'CC', 'Project Manager', 'Project Director', 'QC', 'Supervisor', 'HSE', 'Logistics', 'Procurement', 'Document Control', 'Mechanic & Electrical', 'Project Control', 'Engineering', 'campbos', 'Permit Officer', 'Paramedic', 'Super Admin', 'Subcontractor Super Admin'].map(role => (
                        <option key={role} value={role}>{role}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    {((editingProject?.approvalConfig?.qcMaterialRequestRoles || newProject.approvalConfig?.qcMaterialRequestRoles) || []).map((role, index, arr) => (
                      <div 
                        key={`${role}-${index}`}
                        className="flex items-center justify-between p-3 bg-neutral-800/50 border border-neutral-700 rounded-xl group"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-6 h-6 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-[10px] font-bold text-emerald-500">
                            {index + 1}
                          </div>
                          <span className="text-xs font-bold text-white uppercase tracking-wider">{role}</span>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            disabled={index === 0}
                            onClick={() => {
                              const currentRoles = [...arr];
                              const temp = currentRoles[index];
                              currentRoles[index] = currentRoles[index - 1];
                              currentRoles[index - 1] = temp;
                              
                              if (editingProject) {
                                setEditingProject({
                                  ...editingProject,
                                  approvalConfig: { ...editingProject.approvalConfig, qcMaterialRequestRoles: currentRoles }
                                });
                              } else {
                                setNewProject({
                                  ...newProject,
                                  approvalConfig: { ...newProject.approvalConfig, qcMaterialRequestRoles: currentRoles }
                                });
                              }
                            }}
                            className="p-1.5 hover:bg-neutral-700 rounded-lg text-neutral-400 hover:text-white disabled:opacity-30"
                          >
                            <ArrowUpCircle size={14} />
                          </button>
                          <button
                            type="button"
                            disabled={index === arr.length - 1}
                            onClick={() => {
                              const currentRoles = [...arr];
                              const temp = currentRoles[index];
                              currentRoles[index] = currentRoles[index + 1];
                              currentRoles[index + 1] = temp;
                              
                              if (editingProject) {
                                setEditingProject({
                                  ...editingProject,
                                  approvalConfig: { ...editingProject.approvalConfig, qcMaterialRequestRoles: currentRoles }
                                });
                              } else {
                                setNewProject({
                                  ...newProject,
                                  approvalConfig: { ...newProject.approvalConfig, qcMaterialRequestRoles: currentRoles }
                                });
                              }
                            }}
                            className="p-1.5 hover:bg-neutral-700 rounded-lg text-neutral-400 hover:text-white disabled:opacity-30"
                          >
                            <ArrowDownCircle size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const newRoles = arr.filter((_, i) => i !== index);
                              if (editingProject) {
                                setEditingProject({
                                  ...editingProject,
                                  approvalConfig: { ...editingProject.approvalConfig, qcMaterialRequestRoles: newRoles }
                                });
                              } else {
                                setNewProject({
                                  ...newProject,
                                  approvalConfig: { ...newProject.approvalConfig, qcMaterialRequestRoles: newRoles }
                                });
                              }
                            }}
                            className="p-1.5 hover:bg-red-500/10 rounded-lg text-neutral-400 hover:text-red-500"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                    {((editingProject?.approvalConfig?.qcMaterialRequestRoles || newProject.approvalConfig?.qcMaterialRequestRoles) || []).length === 0 && (
                      <div className="p-8 border-2 border-dashed border-neutral-800 rounded-2xl text-center">
                        <p className="text-xs text-neutral-500 italic">No approval roles configured. Using default chain.</p>
                      </div>
                    )}
                  </div>
                  <p className="text-[9px] text-neutral-600 italic">Define the sequence of approvers. The last role in the list will be the final authority.</p>
                </div>
              </div>
              <div className="p-6 border-t border-neutral-800 bg-neutral-900/50 flex justify-end flex-shrink-0">
                <button
                  type="submit"
                  disabled={loading}
                  className="px-8 py-3 bg-emerald-500 text-black font-bold rounded-xl hover:bg-emerald-400 transition-all text-sm disabled:opacity-50"
                >
                  {loading ? 'SAVING...' : (editingProject ? 'UPDATE SECTOR' : 'CONFIRM INITIALIZATION')}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* User Modal */}
      {showUserModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-lg bg-neutral-900 border border-neutral-800 rounded-3xl overflow-hidden shadow-2xl my-auto"
          >
            <div className="p-6 border-b border-neutral-800 flex items-center justify-between">
              <h3 className="text-xl font-bold text-white tracking-tight uppercase">
                {editingUser ? 'Modify Personnel Profile' : 'Register New Personnel'}
              </h3>
              <button 
                onClick={() => {
                  setShowUserModal(false);
                  setEditingUser(null);
                }} 
                className="text-neutral-500 hover:text-white"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={async (e) => {
              e.preventDefault();
              setLoading(true);
              const userData = {
                name: userForm.name,
                email: userForm.email,
                roles: userForm.roles,
                role: userForm.roles[0] || 'Supervisor', // Keep legacy role as the first one
                projects: userForm.projects,
              };

              try {
                if (editingUser) {
                  await updateDoc(doc(db, 'users', editingUser.id), userData);
                } else {
                  await addDoc(collection(db, 'users'), userData);
                }
                setShowUserModal(false);
                setEditingUser(null);
                setUserForm({
                  name: '',
                  email: '',
                  roles: [],
                  projects: []
                });
              } catch (err) {
                handleFirestoreError(err, editingUser ? OperationType.UPDATE : OperationType.CREATE, 'users');
              } finally {
                setLoading(false);
              }
            }} className="p-8 space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest">Full Name</label>
                <input
                  name="name"
                  required
                  value={userForm.name}
                  onChange={e => setUserForm({...userForm, name: e.target.value})}
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-4 py-3 text-white outline-none focus:border-emerald-500 transition-all"
                  placeholder="e.g. John Doe"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest">Email Address</label>
                <input
                  name="email"
                  type="email"
                  required
                  value={userForm.email}
                  onChange={e => setUserForm({...userForm, email: e.target.value})}
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-4 py-3 text-white outline-none focus:border-emerald-500 transition-all"
                  placeholder="e.g. john@example.com"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest">Designations / Roles</label>
                <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto p-2 bg-neutral-800/50 rounded-xl border border-neutral-700 custom-scrollbar">
                  {['Admin', 'Logistics', 'Supervisor', 'HSE', 'QC', 'HR', 'Procurement', 'Document Control', 'Mechanic & Electrical', 'Project Control', 'CC', 'CM', 'Project Manager', 'Project Director', 'General Manpower', 'Engineering', 'campbos', 'Permit Officer', 'Paramedic', 'Super Admin', 'Subcontractor Super Admin'].map(role => (
                    <label key={role} className="flex items-center gap-2 p-2 hover:bg-neutral-700 rounded-lg cursor-pointer transition-colors">
                      <input
                        type="checkbox"
                        checked={userForm.roles.includes(role as UserRole)}
                        onChange={e => {
                          const newRoles = e.target.checked
                            ? [...userForm.roles, role as UserRole]
                            : userForm.roles.filter(r => r !== role);
                          setUserForm({...userForm, roles: newRoles});
                        }}
                        className="w-4 h-4 rounded border-neutral-700 text-emerald-500 focus:ring-emerald-500 bg-neutral-900"
                      />
                      <span className="text-[10px] text-neutral-300 font-mono uppercase truncate">{role}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest">Assigned Sectors</label>
                <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto p-2 bg-neutral-800/50 rounded-xl border border-neutral-700 custom-scrollbar">
                  {projects.map(project => (
                    <label key={project.id} className="flex items-center gap-2 p-2 hover:bg-neutral-700 rounded-lg cursor-pointer transition-colors">
                      <input
                        type="checkbox"
                        checked={userForm.projects.includes(project.id)}
                        onChange={e => {
                          const newProjects = e.target.checked
                            ? [...userForm.projects, project.id]
                            : userForm.projects.filter(id => id !== project.id);
                          setUserForm({...userForm, projects: newProjects});
                        }}
                        className="w-4 h-4 rounded border-neutral-700 text-emerald-500 focus:ring-emerald-500 bg-neutral-900"
                      />
                      <span className="text-[10px] text-neutral-300 font-mono uppercase truncate">{project.name}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="pt-4">
                <button
                  type="submit"
                  className="w-full py-4 bg-emerald-500 text-black font-bold rounded-xl hover:bg-emerald-400 transition-all text-sm tracking-widest"
                >
                  {editingUser ? 'UPDATE PROFILE' : 'CONFIRM REGISTRATION'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Footer */}
      <div className="mt-12 pt-8 border-t border-neutral-800 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-2 text-neutral-600">
          <ShieldCheck className="w-4 h-4" />
          <span className="text-[10px] font-mono uppercase tracking-[0.2em]">Command Authority: {currentUserEmail}</span>
        </div>
        <div className="text-[10px] font-mono text-neutral-700 uppercase tracking-widest">
          Control Center & Analytics Hub v2.0
        </div>
      </div>
    </div>
  );
}

function AnalyticsView({ reports, projects, users, attendance }: { reports: DailyReport[], projects: Project[], users: UserProfile[], attendance: AttendanceRecord[] }) {
  const disciplineData = reports.reduce((acc: any[], report) => {
    const existing = acc.find(d => d.name === report.discipline);
    if (existing) {
      existing.value += 1;
    } else {
      acc.push({ name: report.discipline, value: 1 });
    }
    return acc;
  }, []);

  const timelineData = reports.reduce((acc: any[], report) => {
    const date = new Date(report.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const existing = acc.find(d => d.date === date);
    if (existing) {
      existing.count += 1;
    } else {
      acc.push({ date, count: 1 });
    }
    return acc;
  }, []).sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const projectStatusData = [
    { name: 'Active', value: projects.filter(p => p.status === 'Active').length },
    { name: 'Completed', value: projects.filter(p => p.status === 'Completed').length },
    { name: 'On Hold', value: projects.filter(p => p.status === 'On Hold').length },
  ].filter(d => d.value > 0);

  const manpowerByProject = projects.map(project => {
    const projectReports = reports.filter(r => r.projectId === project.id);
    const totalManpower = projectReports.reduce((sum, r) => sum + (r.manpower?.total || 0), 0);
    return {
      name: project.name,
      manpower: totalManpower,
      reports: projectReports.length
    };
  }).filter(p => p.manpower > 0 || p.reports > 0);

  const manpowerData = reports
    .filter(r => r.manpower)
    .reduce((acc: any[], report) => {
      const date = new Date(report.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const existing = acc.find(d => d.date === date);
      if (existing) {
        existing.direct += report.manpower?.direct || 0;
        existing.indirect += report.manpower?.indirect || 0;
      } else {
        acc.push({ 
          date, 
          direct: report.manpower?.direct || 0, 
          indirect: report.manpower?.indirect || 0 
        });
      }
      return acc;
    }, [])
    .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(-7);

  const weatherData = reports
    .filter(r => r.weather)
    .reduce((acc: any, report) => {
      const w = report.weather!;
      acc.Rainy += w.rainy || 0;
      acc.Drizzle += w.drizzle || 0;
      acc.Cloudy += w.cloudy || 0;
      acc.Sunny += w.sunny || 0;
      return acc;
    }, { Rainy: 0, Drizzle: 0, Cloudy: 0, Sunny: 0 });

  const weatherChartData = Object.entries(weatherData).map(([name, value]) => ({ name, value }));

  const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
  const WEATHER_COLORS = {
    Rainy: '#3b82f6',
    Drizzle: '#60a5fa',
    Cloudy: '#94a3b8',
    Sunny: '#f59e0b'
  };

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-neutral-900 p-6 rounded-2xl border border-neutral-800">
          <p className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest mb-2">Total Reports</p>
          <p className="text-3xl font-bold text-white">{reports.length}</p>
        </div>
        <div className="bg-neutral-900 p-6 rounded-2xl border border-neutral-800">
          <p className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest mb-2">Active Projects</p>
          <p className="text-3xl font-bold text-white">{projects.filter(p => p.status === 'Active').length}</p>
        </div>
        <div className="bg-neutral-900 p-6 rounded-2xl border border-neutral-800">
          <p className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest mb-2">Total Personnel</p>
          <p className="text-3xl font-bold text-white">{users.length}</p>
        </div>
        <div className="bg-neutral-900 p-6 rounded-2xl border border-neutral-800">
          <p className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest mb-2">Latest Manpower</p>
          <p className="text-3xl font-bold text-white">
            {manpowerData.length > 0 ? (manpowerData[manpowerData.length - 1].direct + manpowerData[manpowerData.length - 1].indirect) : 0}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Discipline Distribution */}
        <div className="bg-neutral-900 p-6 rounded-2xl border border-neutral-800">
          <h3 className="text-sm font-bold text-white mb-6 uppercase tracking-widest font-mono">Reports by Discipline</h3>
          <div className="h-[300px] w-full">
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
                  {disciplineData.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: '#171717', border: '1px solid #333', borderRadius: '8px' }}
                  itemStyle={{ color: '#fff' }}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Reporting Timeline */}
        <div className="bg-neutral-900 p-6 rounded-2xl border border-neutral-800">
          <h3 className="text-sm font-bold text-white mb-6 uppercase tracking-widest font-mono">Reporting Activity</h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={timelineData}>
                <defs>
                  <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                <XAxis dataKey="date" stroke="#666" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="#666" fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#171717', border: '1px solid #333', borderRadius: '8px' }}
                  itemStyle={{ color: '#fff' }}
                />
                <Area type="monotone" dataKey="count" stroke="#10b981" fillOpacity={1} fill="url(#colorCount)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Manpower Trends */}
        <div className="bg-neutral-900 p-6 rounded-2xl border border-neutral-800">
          <h3 className="text-sm font-bold text-white mb-6 uppercase tracking-widest font-mono">Manpower Trends (Last 7 Days)</h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={manpowerData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                <XAxis dataKey="date" stroke="#666" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="#666" fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#171717', border: '1px solid #333', borderRadius: '8px' }}
                  itemStyle={{ color: '#fff' }}
                />
                <Legend />
                <Bar dataKey="direct" name="Direct" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="indirect" name="Indirect" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Project Activity */}
        <div className="bg-neutral-900 p-6 rounded-2xl border border-neutral-800">
          <h3 className="text-sm font-bold text-white mb-6 uppercase tracking-widest font-mono">Project Activity Matrix</h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={manpowerByProject} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#333" horizontal={false} />
                <XAxis type="number" stroke="#666" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis dataKey="name" type="category" stroke="#666" fontSize={10} tickLine={false} axisLine={false} width={100} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#171717', border: '1px solid #333', borderRadius: '8px' }}
                  itemStyle={{ color: '#fff' }}
                />
                <Legend />
                <Bar dataKey="reports" name="Total Reports" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                <Bar dataKey="manpower" name="Total Manpower" fill="#ec4899" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Weather Distribution */}
        <div className="bg-neutral-900 p-6 rounded-2xl border border-neutral-800">
          <h3 className="text-sm font-bold text-white mb-6 uppercase tracking-widest font-mono">Weather Distribution</h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={weatherChartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {weatherChartData.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={WEATHER_COLORS[entry.name as keyof typeof WEATHER_COLORS]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: '#171717', border: '1px solid #333', borderRadius: '8px' }}
                  itemStyle={{ color: '#fff' }}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
