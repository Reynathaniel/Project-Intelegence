import { useState, useEffect } from 'react';
import { FirebaseUser, db, collection, query, where, onSnapshot, addDoc, serverTimestamp, handleFirestoreError, OperationType, deleteDoc, doc } from '../firebase';
import { UserProfile, Project, DailyReport, UserRole } from '../types';
import { isSuperAdmin } from '../constants';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LayoutDashboard, 
  Briefcase, 
  FileText, 
  Settings as SettingsIcon, 
  LogOut, 
  Plus, 
  Download,
  ChevronRight,
  User as UserIcon,
  ShieldCheck,
  HardHat,
  Truck,
  ClipboardCheck,
  Users,
  UserCheck,
  MapPin,
  AlertCircle,
  Menu,
  X,
  ArrowDownCircle,
  ArrowUpCircle,
  Fuel,
  Activity,
  Package,
  Bell,
  Search,
  Filter,
  FileType,
  FileSpreadsheet
} from 'lucide-react';
import ReportForm from './ReportForm';
import ReportList from './ReportList';
import AdminPanel from './AdminPanel';
import NotificationBell from './NotificationBell';
import LogisticsDashboard from './LogisticsDashboard';
import SupervisorDashboard from './SupervisorDashboard';
import HSEDashboard from './HSEDashboard';
import HRDashboard from './HRDashboard';
import HRAttendance from './HRAttendance';
import CostControlDashboard from './CostControlDashboard';
import ConstructionManagerDashboard from './ConstructionManagerDashboard';
import QCDashboard from './QCDashboard';
import QCMaterialRequests from './QCMaterialRequests';
import GeneralManpowerDashboard from './GeneralManpowerDashboard';
import PMDashboard from './PMDashboard';
import { generateProjectReport } from '../services/pdfService';
import { generateProjectExcel } from '../services/excelService';

import Sidebar from './Sidebar';
import Header from './Header';
import CommandCenter from './CommandCenter';
import Settings from './Settings';

interface DashboardProps {
  user: FirebaseUser;
  profile: UserProfile;
  onLogout: () => void;
}

type View = 'overview' | 'reports' | 'admin' | 'logistics' | 'hr' | 'hr-attendance' | 'qc-requests' | 'supervisor' | 'hse' | 'cost-control' | 'cm' | 'qc' | 'procurement' | 'dc' | 'me' | 'pc' | 'pm' | 'general-manpower' | 'settings';

export default function Dashboard({ user, profile, onLogout }: DashboardProps) {
  const [view, setView] = useState<View>('overview');
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [showReportForm, setShowReportForm] = useState(false);
  const [editingReport, setEditingReport] = useState<DailyReport | null>(null);
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState('Standard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [disciplineFilter, setDisciplineFilter] = useState<UserRole | 'All'>('All');
  const [showProjectDropdown, setShowProjectDropdown] = useState(false);
  const [users, setUsers] = useState<UserProfile[]>([]);

  const roleViews: Record<string, { label: string, icon: any, view: View }> = {
    'Logistics': { label: 'Logistics Hub', icon: <Truck className="w-5 h-5" />, view: 'logistics' },
    'Supervisor': { label: 'Field Activity', icon: <Activity className="w-5 h-5" />, view: 'supervisor' },
    'HSE': { label: 'Safety Intelligence', icon: <ShieldCheck className="w-5 h-5" />, view: 'hse' },
    'HR': { label: 'Human Resources', icon: <Users className="w-5 h-5" />, view: 'hr' },
    'QC': { label: 'Quality Control', icon: <ClipboardCheck className="w-5 h-5" />, view: 'qc' },
    'Procurement': { label: 'Procurement Hub', icon: <Package className="w-5 h-5" />, view: 'procurement' },
    'Document Control': { label: 'Document Control', icon: <FileText className="w-5 h-5" />, view: 'dc' },
    'Mechanic & Electrical': { label: 'M&E Intelligence', icon: <Activity className="w-5 h-5" />, view: 'me' },
    'Project Control': { label: 'Project Control', icon: <Activity className="w-5 h-5" />, view: 'pc' },
    'CC': { label: 'Cost Control Hub', icon: <Activity className="w-5 h-5" />, view: 'cost-control' },
    'CM': { label: 'Construction Mgmt', icon: <HardHat className="w-5 h-5" />, view: 'cm' },
    'Project Manager': { label: 'Project Mgmt', icon: <Briefcase className="w-5 h-5" />, view: 'pm' },
    'Project Director': { label: 'Director Command', icon: <ShieldCheck className="w-5 h-5" />, view: 'pm' },
    'Admin': { label: 'Command Center', icon: <ShieldCheck className="w-5 h-5" />, view: 'admin' },
  };

  useEffect(() => {
    const superAdmin = isSuperAdmin(user.email);
    const isAdmin = profile.roles.includes('Admin') || superAdmin;
    const q = isAdmin
      ? query(collection(db, 'projects'))
      : query(collection(db, 'projects'), where('id', 'in', profile.projects.length > 0 ? profile.projects : ['none']));
    
    const unsubscribeProjects = onSnapshot(q, (snapshot) => {
      const projectList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Project));
      setProjects(projectList);
      if (projectList.length > 0 && !selectedProject) {
        setSelectedProject(projectList[0]);
      }
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'projects');
    });

    return () => unsubscribeProjects();
  }, [profile]);

  useEffect(() => {
    if (!selectedProject) return;

    const superAdmin = isSuperAdmin(user.email);
    const isAdmin = profile.roles.includes('Admin') || superAdmin;
    const q = isAdmin 
      ? query(collection(db, 'reports'), where('projectId', '==', selectedProject.id))
      : query(collection(db, 'reports'), where('projectId', '==', selectedProject.id), where('discipline', 'in', profile.roles));

    const unsubscribeReports = onSnapshot(q, (snapshot) => {
      const reportList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DailyReport));
      setReports(reportList.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'reports');
    });

    return () => unsubscribeReports();
  }, [selectedProject]);

  useEffect(() => {
    const q = query(collection(db, 'users'));
    const unsubscribeUsers = onSnapshot(q, (snapshot) => {
      setUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserProfile)));
    });
    return () => unsubscribeUsers();
  }, []);

  const handleGeneratePDF = () => {
    if (selectedProject) {
      const todayReports = reports.filter(r => r.date === new Date().toISOString().split('T')[0] && r.status === 'Submitted');
      const isAdmin = profile.roles.includes('Admin') || isSuperAdmin(user.email);
      const filterRole = isAdmin ? undefined : profile.roles[0];
      generateProjectReport(selectedProject, todayReports, filterRole, selectedTemplate);
      setShowDownloadMenu(false);
    }
  };

  const handleGenerateExcel = () => {
    if (selectedProject) {
      const todayReports = reports.filter(r => r.date === new Date().toISOString().split('T')[0] && r.status === 'Submitted');
      generateProjectExcel(selectedProject, todayReports);
      setShowDownloadMenu(false);
    }
  };

  const handleDeleteReport = async (reportId: string) => {
    try {
      const reportToDelete = reports.find(r => r.id === reportId);
      await deleteDoc(doc(db, 'reports', reportId));

      if (reportToDelete && reportToDelete.authorId !== profile.id) {
        const privilegedRoles = ['Admin', 'Super Admin', 'Project Control', 'Project Manager'];
        const isPrivileged = profile.roles.some(role => privilegedRoles.includes(role)) || isSuperAdmin(user.email);
        
        if (isPrivileged) {
          await addDoc(collection(db, 'qcNotifications'), {
            projectId: reportToDelete.projectId,
            userId: reportToDelete.authorId,
            title: 'Report Deleted',
            message: `Your ${reportToDelete.discipline} report for ${reportToDelete.date} has been deleted by ${profile.name}.`,
            type: 'ReportDeleted',
            read: false,
            createdAt: serverTimestamp()
          });
        }
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `reports/${reportId}`);
    }
  };

  const getRoleIcon = (role: UserRole) => {
    switch (role) {
      case 'Admin': return <ShieldCheck className="w-5 h-5 text-emerald-500" />;
      case 'Logistics': return <Truck className="w-5 h-5 text-blue-500" />;
      case 'Supervisor': return <HardHat className="w-5 h-5 text-orange-500" />;
      case 'HSE': return <AlertCircle className="w-5 h-5 text-red-500" />;
      case 'QC': return <ClipboardCheck className="w-5 h-5 text-purple-500" />;
      case 'HR': return <Users className="w-5 h-5 text-pink-500" />;
      case 'Procurement': return <Briefcase className="w-5 h-5 text-yellow-500" />;
      case 'Document Control': return <SettingsIcon className="w-5 h-5 text-cyan-500" />;
      case 'Mechanic & Electrical': return <HardHat className="w-5 h-5 text-amber-500" />;
      case 'Project Control': return <ShieldCheck className="w-5 h-5 text-emerald-500" />;
      case 'CC': return <Activity className="w-5 h-5 text-emerald-500" />;
      case 'CM': return <HardHat className="w-5 h-5 text-blue-500" />;
      case 'Project Manager': return <Briefcase className="w-5 h-5 text-emerald-500" />;
      case 'Project Director': return <ShieldCheck className="w-5 h-5 text-emerald-500" />;
      case 'General Manpower': return <UserCheck className="w-5 h-5 text-emerald-500" />;
      default: return <Activity className="w-5 h-5 text-neutral-500" />;
    }
  };

  const renderView = () => {
    if (view === 'overview') {
      return (
        <CommandCenter 
          projects={projects} 
          reports={reports} 
          profile={profile} 
        />
      );
    }

    if (view === 'settings') {
      return (
        <Settings 
          profile={profile} 
          projects={projects} 
        />
      );
    }

    if (view === 'reports') {
      return (
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <h2 className="text-xl font-bold text-white uppercase tracking-tighter">Sector Intelligence Logs</h2>
              <p className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest">Real-time field activity synchronization</p>
            </div>
            {!selectedProject && (
              <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-center gap-3 text-blue-400">
                <AlertCircle className="w-4 h-4" />
                <span className="text-xs font-bold uppercase tracking-tight">Select a sector to view intelligence logs</span>
              </div>
            )}
          </div>
          {selectedProject ? (
            <ReportList 
              reports={disciplineFilter === 'All' ? reports : reports.filter(r => r.discipline === disciplineFilter)} 
              userRoles={profile.roles} 
              userId={profile.id}
              userEmail={user.email || ''}
              onEdit={(report) => {
                setEditingReport(report);
                setShowReportForm(true);
              }}
              onDelete={handleDeleteReport}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {projects.map(project => (
                <button
                  key={project.id}
                  onClick={() => setSelectedProject(project)}
                  className="p-6 bg-neutral-900 border border-neutral-800 rounded-2xl text-left hover:border-emerald-500/30 transition-all group"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-3 bg-neutral-950 border border-neutral-800 rounded-xl group-hover:border-emerald-500/30 transition-all">
                      <Briefcase className="w-5 h-5 text-emerald-500" />
                    </div>
                    <ChevronRight className="w-5 h-5 text-neutral-700 group-hover:text-emerald-500 transition-all" />
                  </div>
                  <h4 className="text-lg font-bold text-white mb-1">{project.name}</h4>
                  <p className="text-xs text-neutral-500 font-mono uppercase tracking-widest">{project.location}</p>
                </button>
              ))}
            </div>
          )}
        </div>
      );
    }

    if (view === 'admin') {
      return <AdminPanel projects={projects} users={users} currentUserEmail={user.email || ''} />;
    }

    if (view === 'general-manpower') {
      return <GeneralManpowerDashboard user={user} profile={profile} project={selectedProject} />;
    }

    if (view === 'qc-requests') {
      return <QCMaterialRequests project={selectedProject!} userProfile={profile} />;
    }

    // Role-specific views
    const roleViewMap: Record<string, React.ReactNode> = {
      'logistics': selectedProject && <LogisticsDashboard project={selectedProject} profile={profile} />,
      'supervisor': selectedProject && <SupervisorDashboard project={selectedProject} reports={reports} />,
      'hse': selectedProject && <HSEDashboard project={selectedProject} reports={reports} />,
      'hr': selectedProject && <HRDashboard project={selectedProject} reports={reports} />,
      'hr-attendance': selectedProject && <HRAttendance project={selectedProject} />,
      'qc': selectedProject && <QCDashboard project={selectedProject} reports={reports} userProfile={profile} onNavigateToRequests={() => setView('qc-requests')} />,
      'procurement': selectedProject && <div className="p-8 text-center text-neutral-500">Procurement Dashboard coming soon</div>,
      'dc': selectedProject && <div className="p-8 text-center text-neutral-500">Document Control Dashboard coming soon</div>,
      'me': selectedProject && <div className="p-8 text-center text-neutral-500">M&E Dashboard coming soon</div>,
      'pc': selectedProject && <div className="p-8 text-center text-neutral-500">Project Control Dashboard coming soon</div>,
      'cost-control': selectedProject && <CostControlDashboard project={selectedProject} userProfile={profile} onNavigate={(v) => setView(v as View)} />,
      'cm': selectedProject && <ConstructionManagerDashboard project={selectedProject} userProfile={profile} reports={reports} onNavigate={(v) => setView(v as View)} />,
      'pm': selectedProject && <PMDashboard project={selectedProject} userProfile={profile} />,
    };

    return roleViewMap[view] || (
      <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
        <div className="w-16 h-16 bg-neutral-950 border border-neutral-800 rounded-2xl flex items-center justify-center">
          <Activity className="w-8 h-8 text-neutral-700" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-white uppercase tracking-tight">Intelligence Module Offline</h3>
          <p className="text-neutral-500 text-sm">This sector specific dashboard is currently being synchronized.</p>
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-screen bg-black text-white overflow-hidden font-sans">
      <Sidebar 
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        view={view}
        setView={setView}
        profile={profile}
        userEmail={user.email || ''}
        onLogout={onLogout}
        roleViews={roleViews}
        getRoleIcon={getRoleIcon}
      />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header 
          view={view}
          setView={setView}
          onOpenSidebar={() => setIsSidebarOpen(true)}
          selectedProject={selectedProject}
          projects={projects}
          onSelectProject={setSelectedProject}
          showProjectDropdown={showProjectDropdown}
          setShowProjectDropdown={setShowProjectDropdown}
          profileId={profile.id}
          showDownloadMenu={showDownloadMenu}
          setShowDownloadMenu={setShowDownloadMenu}
          selectedTemplate={selectedTemplate}
          setSelectedTemplate={setSelectedTemplate}
          onGeneratePDF={handleGeneratePDF}
          onGenerateExcel={handleGenerateExcel}
          onNewReport={() => setShowReportForm(true)}
        />

        <main className="flex-1 overflow-y-auto p-4 lg:p-8 custom-scrollbar">
          <AnimatePresence mode="wait">
            <motion.div
              key={view + (selectedProject?.id || '')}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {showReportForm && selectedProject ? (
                <ReportForm 
                  project={selectedProject} 
                  profile={profile} 
                  initialReport={editingReport || undefined}
                  defaultDiscipline={disciplineFilter !== 'All' ? disciplineFilter : undefined}
                  onClose={() => {
                    setShowReportForm(false);
                    setEditingReport(null);
                  }} 
                />
              ) : renderView()}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
