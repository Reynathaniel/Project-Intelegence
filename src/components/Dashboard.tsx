import { useState, useEffect } from 'react';
import { FirebaseUser, db, collection, query, where, onSnapshot, addDoc, serverTimestamp, handleFirestoreError, OperationType, deleteDoc, doc } from '../firebase';
import { UserProfile, Project, DailyReport, UserRole } from '../types';
import { isSuperAdmin } from '../constants';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LayoutDashboard, 
  Briefcase, 
  FileText, 
  Settings, 
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
  Filter
} from 'lucide-react';
import ProjectList from './ProjectList';
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
import { generateProjectReport } from '../services/pdfService';
import { generateProjectExcel } from '../services/excelService';
import { FileSpreadsheet, FileType } from 'lucide-react';

interface DashboardProps {
  user: FirebaseUser;
  profile: UserProfile;
  onLogout: () => void;
}

type View = 'overview' | 'reports' | 'admin' | 'logistics' | 'hr' | 'hr-attendance' | 'qc-requests' | 'supervisor' | 'hse' | 'cost-control' | 'cm' | 'qc' | 'procurement' | 'dc' | 'me' | 'pc' | 'pm' | 'general-manpower';

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

  const roleViews: Record<string, { label: string, icon: any, view: View }> = {
    'Logistics': { label: 'Logistics Hub', icon: <Truck className="w-5 h-5" />, view: 'logistics' },
    'Supervisor': { label: 'Supervisor Dashboard', icon: <Activity className="w-5 h-5" />, view: 'supervisor' },
    'HSE': { label: 'HSE Dashboard', icon: <ShieldCheck className="w-5 h-5" />, view: 'hse' },
    'HR': { label: 'HR Dashboard', icon: <LayoutDashboard className="w-5 h-5" />, view: 'hr' },
    'QC': { label: 'QC Dashboard', icon: <ClipboardCheck className="w-5 h-5" />, view: 'qc' },
    'Procurement': { label: 'Procurement Hub', icon: <Briefcase className="w-5 h-5" />, view: 'procurement' },
    'Document Control': { label: 'Document Control', icon: <Settings className="w-5 h-5" />, view: 'dc' },
    'Mechanic & Electrical': { label: 'M&E Dashboard', icon: <HardHat className="w-5 h-5" />, view: 'me' },
    'Project Control': { label: 'Project Control', icon: <ShieldCheck className="w-5 h-5" />, view: 'pc' },
    'CC': { label: 'Cost Control Hub', icon: <Activity className="w-5 h-5" />, view: 'cost-control' },
    'CM': { label: 'CM Dashboard', icon: <HardHat className="w-5 h-5" />, view: 'cm' },
    'Project Manager': { label: 'PM Dashboard', icon: <ShieldCheck className="w-5 h-5" />, view: 'pm' },
    'Super Admin': { label: 'Super Admin Panel', icon: <ShieldCheck className="w-5 h-5" />, view: 'admin' },
    'Admin': { label: 'Admin Panel', icon: <Settings className="w-5 h-5" />, view: 'admin' },
  };

  useEffect(() => {
    // Fetch projects
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

  const handleGeneratePDF = () => {
    if (selectedProject) {
      const todayReports = reports.filter(r => r.date === new Date().toISOString().split('T')[0] && r.status === 'Submitted');
      const isAdmin = profile.roles.includes('Admin') || isSuperAdmin(user.email);
      const filterRole = isAdmin ? undefined : profile.roles[0]; // Use first role as default filter
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

      // Send notification if the person deleting is not the author
      if (reportToDelete && reportToDelete.authorId !== profile.id) {
        const privilegedRoles = ['Admin', 'Super Admin', 'Project Control', 'Project Manager'];
        const isPrivileged = profile.roles.some(role => privilegedRoles.includes(role)) || isSuperAdmin(user.email);
        
        if (isPrivileged) {
          await addDoc(collection(db, 'qcNotifications'), {
            projectId: reportToDelete.projectId,
            userId: reportToDelete.authorId,
            title: 'Report Deleted',
            message: `Your ${reportToDelete.discipline} report for ${reportToDelete.date} has been deleted by ${profile.name} (${profile.roles.join(', ')}).`,
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

  const renderRoleSummary = (role: UserRole) => {
    const today = new Date().toISOString().split('T')[0];
    const todayReports = reports.filter(r => r.date === today && (role === 'Admin' || r.discipline === role));

    const getStats = () => {
      switch (role) {
        case 'Logistics':
          const matReqs = todayReports.reduce((acc, r) => acc + (JSON.parse(r.data).materialRequests?.length || 0), 0);
          const receipts = todayReports.reduce((acc, r) => acc + (JSON.parse(r.data).materialReceipts?.length || 0), 0);
          const usages = todayReports.reduce((acc, r) => acc + (JSON.parse(r.data).materialUsages?.length || 0), 0);
          return [
            { title: 'Material Requests', value: matReqs.toString(), icon: <Truck className="text-blue-500" /> },
            { title: 'Material Receipts', value: receipts.toString(), icon: <ArrowDownCircle className="text-emerald-500" /> },
            { title: 'Material Usages', value: usages.toString(), icon: <ArrowUpCircle className="text-orange-500" /> },
            { title: 'Fuel Records', value: todayReports.reduce((acc, r) => acc + (JSON.parse(r.data).fuelIn?.length || 0) + (JSON.parse(r.data).fuelOut?.length || 0), 0).toString(), icon: <Fuel className="text-purple-500" /> }
          ];
        case 'Supervisor':
          const activities = todayReports.reduce((acc, r) => acc + (JSON.parse(r.data).activities?.length || 0), 0);
          const totalManpower = todayReports.reduce((acc, r) => {
            const data = JSON.parse(r.data);
            return acc + (data.activities?.reduce((sum: number, act: any) => sum + (Number(act.manpowerDirect) || 0), 0) || 0);
          }, 0);
          const totalOT = todayReports.reduce((acc, r) => {
            const data = JSON.parse(r.data);
            return acc + (data.activities?.reduce((sum: number, act: any) => sum + (Number(act.overtime?.hours) || 0), 0) || 0);
          }, 0);
          return [
            { title: 'Activities Logged', value: activities.toString(), icon: <HardHat className="text-orange-500" /> },
            { title: 'Total Manpower', value: totalManpower.toString(), icon: <Users className="text-blue-500" /> },
            { title: 'Overtime Hours', value: totalOT.toString(), icon: <ClipboardCheck className="text-emerald-500" /> },
            { title: 'Assistance Requests', value: todayReports.filter(r => JSON.parse(r.data).assistanceNeeded).length.toString(), icon: <AlertCircle className="text-red-500" /> }
          ];
        case 'HSE':
          const totalMH = todayReports.reduce((acc, r) => acc + (JSON.parse(r.data).manhours?.total || 0), 0);
          const openPermits = todayReports.filter(r => JSON.parse(r.data).permitStatus === 'Open').length;
          const swoCount = todayReports.filter(r => JSON.parse(r.data).stopWorkOrder?.number).length;
          return [
            { title: 'Total Manhours', value: totalMH.toLocaleString(), icon: <Users className="text-orange-500" /> },
            { title: 'Open Permits', value: openPermits.toString(), icon: <FileText className="text-blue-500" /> },
            { title: 'Stop Work Orders', value: swoCount.toString(), icon: <AlertCircle className="text-red-500" /> },
            { title: 'Health Issues', value: todayReports.reduce((acc, r) => {
              const hs = JSON.parse(r.data).healthStatus;
              return acc + (hs?.directSick || 0) + (hs?.indirectSick || 0);
            }, 0).toString(), icon: <ShieldCheck className="text-emerald-500" /> }
          ];
        case 'HR':
          const totalPersonnel = todayReports.reduce((acc, r) => acc + (JSON.parse(r.data).personnelList?.length || 0), 0);
          const activePersonnel = todayReports.reduce((acc, r) => {
            const data = JSON.parse(r.data);
            return acc + (data.personnelList?.filter((p: any) => p.activeStatus === 'Active').length || 0);
          }, 0);
          const onSitePersonnel = todayReports.reduce((acc, r) => {
            const data = JSON.parse(r.data);
            return acc + (data.personnelList?.filter((p: any) => p.activeStatus === 'Active' && p.siteStatus === 'On Site').length || 0);
          }, 0);
          return [
            { title: 'Total Personnel', value: totalPersonnel.toString(), icon: <Users className="text-pink-500" /> },
            { title: 'Active Staff', value: activePersonnel.toString(), icon: <UserCheck className="text-emerald-500" /> },
            { title: 'On Site', value: onSitePersonnel.toString(), icon: <MapPin className="text-blue-500" /> },
            { title: 'HR Reports', value: todayReports.length.toString(), icon: <FileText className="text-orange-500" /> }
          ];
        case 'Procurement':
          return [
            { title: 'PO Issued', value: todayReports.filter(r => JSON.parse(r.data).poIssued).length.toString(), icon: <FileText className="text-yellow-500" /> },
            { title: 'Vendor Status', value: todayReports.filter(r => JSON.parse(r.data).vendorStatus).length.toString(), icon: <Truck className="text-blue-500" /> },
            { title: 'Deliveries', value: todayReports.filter(r => JSON.parse(r.data).deliveryTracking).length.toString(), icon: <Truck className="text-emerald-500" /> },
            { title: 'Material Requests', value: todayReports.reduce((acc, r) => acc + (JSON.parse(r.data).materialRequests?.length || 0), 0).toString(), icon: <Briefcase className="text-purple-500" /> }
          ];
        case 'Document Control':
          return [
            { title: 'Drawing Status', value: todayReports.filter(r => JSON.parse(r.data).drawingStatus).length.toString(), icon: <Settings className="text-cyan-500" /> },
            { title: 'RFI Status', value: todayReports.filter(r => JSON.parse(r.data).rfiStatus).length.toString(), icon: <AlertCircle className="text-red-500" /> },
            { title: 'Tech Queries', value: todayReports.filter(r => JSON.parse(r.data).technicalQueries).length.toString(), icon: <FileText className="text-blue-500" /> },
            { title: 'Material Requests', value: todayReports.reduce((acc, r) => acc + (JSON.parse(r.data).materialRequests?.length || 0), 0).toString(), icon: <Briefcase className="text-purple-500" /> }
          ];
        case 'Mechanic & Electrical':
          return [
            { title: 'Work Progress', value: todayReports.filter(r => JSON.parse(r.data).workProgress).length.toString(), icon: <HardHat className="text-amber-500" /> },
            { title: 'Manpower Direct', value: todayReports.reduce((acc, r) => acc + (Number(JSON.parse(r.data).manpowerDirect) || 0), 0).toString(), icon: <Users className="text-blue-500" /> },
            { title: 'Equipment Status', value: todayReports.filter(r => JSON.parse(r.data).equipmentStatus).length.toString(), icon: <Settings className="text-neutral-500" /> },
            { title: 'Site Issues', value: todayReports.filter(r => JSON.parse(r.data).siteIssues).length.toString(), icon: <AlertCircle className="text-red-500" /> }
          ];
        case 'Project Control':
          return [
            { title: 'Schedule Variance', value: todayReports.filter(r => JSON.parse(r.data).scheduleVariance).length.toString(), icon: <LayoutDashboard className="text-emerald-500" /> },
            { title: 'Cost Status', value: todayReports.filter(r => JSON.parse(r.data).costStatus).length.toString(), icon: <Briefcase className="text-blue-500" /> },
            { title: 'Narrative Reports', value: todayReports.filter(r => JSON.parse(r.data).narrative).length.toString(), icon: <FileText className="text-purple-500" /> },
            { title: 'Material Requests', value: todayReports.reduce((acc, r) => acc + (JSON.parse(r.data).materialRequests?.length || 0), 0).toString(), icon: <Briefcase className="text-orange-500" /> }
          ];
        case 'QC':
          return [
            { title: 'Inspections', value: todayReports.length.toString(), icon: <ClipboardCheck className="text-purple-500" /> },
            { title: 'Non-Conformities', value: todayReports.filter(r => JSON.parse(r.data).nonConformity).length.toString(), icon: <AlertCircle className="text-red-500" /> },
            { title: 'Test Results', value: todayReports.filter(r => JSON.parse(r.data).testResults).length.toString(), icon: <FileText className="text-blue-500" /> },
            { title: 'Punch List Items', value: todayReports.filter(r => JSON.parse(r.data).punchList).length.toString(), icon: <Settings className="text-neutral-500" /> }
          ];
        case 'CC':
        case 'CM':
        case 'Project Manager':
          return [
            { title: 'Active Projects', value: projects.length.toString(), icon: <Briefcase className="text-blue-500" /> },
            { title: 'Reports Today', value: todayReports.length.toString(), icon: <FileText className="text-emerald-500" /> },
            { title: 'Material Requests', value: reports.reduce((acc, r) => acc + (JSON.parse(r.data).materialRequests?.length || 0), 0).toString(), icon: <Package className="text-orange-500" /> },
            { title: 'Status', value: 'Operational', icon: <ShieldCheck className="text-purple-500" /> }
          ];
        default:
          return [
            { title: 'Active Projects', value: projects.length.toString(), icon: <Briefcase className="text-blue-500" /> },
            { title: 'Reports Today', value: todayReports.length.toString(), icon: <FileText className="text-emerald-500" /> },
            { title: 'Discipline', value: role, icon: getRoleIcon(role) },
            { title: 'Status', value: 'Operational', icon: <ShieldCheck className="text-purple-500" /> }
          ];
      }
    };

    const stats = getStats();

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          {getRoleIcon(role)}
          <h3 className="text-sm font-bold text-neutral-400 uppercase tracking-widest">{role} Summary</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((stat, i) => (
            <StatCard key={i} title={stat.title} value={stat.value} icon={stat.icon} />
          ))}
        </div>
      </div>
    );
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
      case 'Document Control': return <Settings className="w-5 h-5 text-cyan-500" />;
      case 'Mechanic & Electrical': return <HardHat className="w-5 h-5 text-amber-500" />;
      case 'Project Control': return <ShieldCheck className="w-5 h-5 text-emerald-500" />;
      case 'CC': return <Activity className="w-5 h-5 text-emerald-500" />;
      case 'CM': return <HardHat className="w-5 h-5 text-blue-500" />;
      case 'Project Manager': return <ShieldCheck className="w-5 h-5 text-emerald-500" />;
      case 'General Manpower': return <UserCheck className="w-5 h-5 text-emerald-500" />;
    }
  };

  return (
    <div className="flex h-[100dvh] overflow-hidden relative">
      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-72 bg-neutral-900 border-r border-neutral-800 flex flex-col transition-transform duration-300 lg:relative lg:translate-x-0
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="p-6 border-b border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-500 rounded-lg flex items-center justify-center font-bold text-black">
              RC
            </div>
            <div>
              <h2 className="font-bold text-white tracking-tight">REY-COMMAND</h2>
              <p className="text-[10px] text-neutral-500 font-mono uppercase tracking-widest">Nexus v1.0</p>
            </div>
          </div>
          <button 
            onClick={() => setIsSidebarOpen(false)}
            className="p-2 text-neutral-500 hover:text-white lg:hidden"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          <NavItem 
            icon={<LayoutDashboard className="w-5 h-5" />} 
            label="Overview" 
            active={view === 'overview'} 
            onClick={() => { setView('overview'); setIsSidebarOpen(false); }} 
          />
          {selectedProject && (
            <NavItem 
              icon={<Package className="w-5 h-5" />} 
              label="Request Material" 
              active={view === 'qc-requests'} 
              onClick={() => { setView('qc-requests'); setIsSidebarOpen(false); }} 
            />
          )}
          <NavItem 
            icon={<FileText className="w-5 h-5" />} 
            label="Daily Reports" 
            active={view === 'reports'} 
            onClick={() => { setView('reports'); setIsSidebarOpen(false); }} 
          />
          <NavItem 
            icon={<UserCheck className="w-5 h-5" />} 
            label="Manpower Portal" 
            active={view === 'general-manpower'} 
            onClick={() => { setView('general-manpower'); setIsSidebarOpen(false); }} 
          />
          {profile.roles.includes('HR') && (
            <NavItem 
              icon={<Users className="w-5 h-5" />} 
              label="Daftar Hadir" 
              active={view === 'hr-attendance'} 
              onClick={() => { setView('hr-attendance'); setIsSidebarOpen(false); }} 
            />
          )}
          {[...profile.roles, ...(isSuperAdmin(user.email) && !profile.roles.includes('Admin') ? ['Admin'] : [])].map(role => {
            const config = roleViews[role as string];
            if (config) {
              return (
                <NavItem 
                  key={role}
                  icon={config.icon} 
                  label={config.label} 
                  active={view === config.view} 
                  onClick={() => { 
                    setView(config.view);
                    setIsSidebarOpen(false); 
                  }} 
                />
              );
            }
            return null;
          })}
        </nav>

        <div className="p-4 border-t border-neutral-800 space-y-4">
          <div className="flex items-center gap-3 p-3 bg-neutral-800/50 rounded-xl border border-neutral-700/50">
            <div className="w-10 h-10 rounded-full bg-neutral-700 overflow-hidden">
              <img src={user.photoURL || `https://ui-avatars.com/api/?name=${profile.name}`} alt={profile.name} referrerPolicy="no-referrer" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white truncate">{profile.name}</p>
              <div className="flex flex-wrap gap-1">
                {profile.roles.map(role => {
                  const config = roleViews[role];
                  return (
                    <button 
                      key={role} 
                      onClick={() => config && setView(config.view)}
                      className={`flex items-center gap-1 px-1.5 py-0.5 rounded border transition-all ${
                        config && view === config.view
                          ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                          : 'bg-neutral-700/50 border-neutral-600/50 text-neutral-400 hover:bg-neutral-700 hover:border-neutral-500'
                      }`}
                    >
                      {getRoleIcon(role)}
                      <p className="text-[8px] font-mono uppercase">{role}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          <button 
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 p-3 text-neutral-400 hover:text-red-400 hover:bg-red-400/10 rounded-xl transition-all font-bold text-xs uppercase tracking-widest"
          >
            <LogOut className="w-4 h-4" />
            Terminate Session
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col bg-neutral-950 overflow-hidden">
        {/* Header */}
        <header className="h-20 border-b border-neutral-800 bg-neutral-900/50 backdrop-blur-xl flex items-center justify-between px-4 lg:px-8 z-10">
          <div className="flex items-center gap-4 min-w-0">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="p-2 text-neutral-400 hover:text-white lg:hidden"
            >
              <Menu className="w-6 h-6" />
            </button>
            {view !== 'overview' && (
              <button 
                onClick={() => setView('overview')}
                className="p-2 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-lg transition-all hidden sm:block"
                title="Back to Overview"
              >
                <LayoutDashboard className="w-5 h-5" />
              </button>
            )}
            <h1 className="text-lg lg:text-xl font-bold text-white uppercase tracking-tight truncate text-left">
            {view === 'overview' && 'Strategic Overview'}
            {view === 'qc-requests' && 'Request Material'}
            {view === 'reports' && 'Daily Intelligence'}
            {view === 'logistics' && 'Logistics Hub'}
            {view === 'supervisor' && 'Supervisor Activity'}
            {view === 'hse' && 'HSE Intelligence'}
            {view === 'hr' && 'HR Intelligence Dashboard'}
            {view === 'hr-attendance' && 'Attendance Monitoring'}
            {view === 'qc' && 'QC Intelligence'}
            {view === 'procurement' && 'Procurement Hub'}
            {view === 'dc' && 'Document Control'}
            {view === 'me' && 'Mechanic & Electrical'}
            {view === 'pc' && 'Project Control'}
            {view === 'cost-control' && 'Cost Control Hub'}
            {view === 'cm' && 'Construction Management'}
            {view === 'pm' && 'Project Management'}
            {view === 'general-manpower' && 'Manpower Portal'}
            {view === 'admin' && 'Command Center'}
            </h1>
            {selectedProject && (
              <div className="relative ml-2 sm:ml-4">
                <button 
                  onClick={() => setShowProjectDropdown(!showProjectDropdown)}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 rounded-xl border border-emerald-500/20 transition-all group"
                >
                  <Briefcase className="w-4 h-4" />
                  <span className="text-xs font-bold uppercase tracking-tight truncate max-w-[100px] sm:max-w-[200px]">{selectedProject.name}</span>
                  <ChevronRight className={`w-4 h-4 transition-transform ${showProjectDropdown ? 'rotate-90' : ''}`} />
                </button>

                <AnimatePresence>
                  {showProjectDropdown && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setShowProjectDropdown(false)} />
                      <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        className="absolute left-0 mt-2 w-64 bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl z-50 overflow-hidden"
                      >
                        <div className="p-3 border-b border-neutral-800 bg-neutral-950/50">
                          <p className="text-[9px] text-neutral-500 uppercase font-mono tracking-widest">Switch Project</p>
                        </div>
                        <div className="max-h-64 overflow-y-auto custom-scrollbar">
                          {projects.map(p => (
                            <button
                              key={p.id}
                              onClick={() => {
                                setSelectedProject(p);
                                setShowProjectDropdown(false);
                              }}
                              className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                                selectedProject.id === p.id 
                                  ? 'bg-emerald-500/10 text-emerald-500' 
                                  : 'text-neutral-400 hover:bg-neutral-800 hover:text-white'
                              }`}
                            >
                              <div className={`w-1.5 h-1.5 rounded-full ${selectedProject.id === p.id ? 'bg-emerald-500' : 'bg-neutral-700'}`} />
                              <div className="min-w-0">
                                <p className="text-xs font-bold truncate">{p.name}</p>
                                <p className="text-[9px] text-neutral-500 truncate">{p.location}</p>
                              </div>
                            </button>
                          ))}
                        </div>
                        <div className="p-2 border-t border-neutral-800 bg-neutral-950/50">
                          <button
                            onClick={() => {
                              setView('overview');
                              setShowProjectDropdown(false);
                            }}
                            className="w-full flex items-center justify-center gap-2 py-2 text-[10px] font-bold text-neutral-400 hover:text-white transition-colors"
                          >
                            <LayoutDashboard className="w-3 h-3" />
                            VIEW ALL PROJECTS
                          </button>
                        </div>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 lg:gap-4">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-neutral-800/50 border border-neutral-700/50 rounded-xl text-neutral-500">
              <Search className="w-4 h-4" />
              <input 
                type="text" 
                placeholder="Search intelligence..." 
                className="bg-transparent border-none outline-none text-[10px] font-mono uppercase tracking-widest w-32"
              />
            </div>

            <NotificationBell userId={profile.id} />
            
            {view === 'reports' && selectedProject && (
              <>
                <button 
                  onClick={() => setShowReportForm(true)}
                  className="flex items-center gap-2 px-3 lg:px-4 py-2 bg-emerald-500 text-black font-bold rounded-lg hover:bg-emerald-400 transition-all text-xs lg:text-sm"
                >
                  <Plus className="w-4 h-4" />
                  <span className="hidden sm:inline">NEW REPORT</span>
                  <span className="sm:hidden">NEW</span>
                </button>
                
                <div className="relative">
                  <button 
                    onClick={() => setShowDownloadMenu(!showDownloadMenu)}
                    className="flex items-center gap-2 px-3 lg:px-4 py-2 bg-neutral-800 text-white font-bold rounded-lg hover:bg-neutral-700 transition-all text-xs lg:text-sm border border-neutral-700"
                  >
                    <Download className="w-4 h-4" />
                    <span className="hidden sm:inline">DOWNLOAD REPORT</span>
                    <span className="sm:hidden">EXPORT</span>
                  </button>

                  <AnimatePresence>
                    {showDownloadMenu && (
                      <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        className="absolute right-0 mt-2 w-48 bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl z-50 overflow-hidden"
                      >
                        <div className="p-4 border-b border-neutral-800 bg-neutral-950/50">
                          <label className="text-[9px] text-neutral-500 uppercase font-mono tracking-widest mb-2 block">Template</label>
                          <select 
                            value={selectedTemplate}
                            onChange={(e) => setSelectedTemplate(e.target.value)}
                            className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-2 py-1.5 text-[10px] text-white outline-none focus:border-emerald-500 transition-all"
                          >
                            <option value="Standard">Standard Corporate</option>
                            <option value="Modern">Modern Minimalist</option>
                            <option value="Compact">Compact Data-Grid</option>
                            <option value="Detailed">Detailed Technical</option>
                          </select>
                        </div>
                        <button
                          onClick={handleGeneratePDF}
                          className="w-full flex items-center gap-3 px-4 py-3 text-sm text-neutral-300 hover:bg-neutral-800 hover:text-white transition-colors border-b border-neutral-800"
                        >
                          <FileType className="w-4 h-4 text-red-400" />
                          Generate PDF
                        </button>
                        <button
                          onClick={handleGenerateExcel}
                          className="w-full flex items-center gap-3 px-4 py-3 text-sm text-neutral-300 hover:bg-neutral-800 hover:text-white transition-colors"
                        >
                          <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                          Download Excel
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </>
            )}
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={view + (selectedProject?.id || '')}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {view === 'overview' && (
                <div className="space-y-10">
                  {/* PROJECT SELECTOR */}
                  <section className="space-y-6">
                    <div className="flex items-center gap-2">
                      <div className="w-1 h-6 bg-emerald-500 rounded-full" />
                      <h2 className="text-xl font-bold text-white uppercase tracking-tight">
                        Select Project
                      </h2>
                    </div>
                    <ProjectList 
                      projects={projects} 
                      onSelect={setSelectedProject} 
                      selectedId={selectedProject?.id} 
                    />
                  </section>

                  {/* DASHBOARD SUMMARY */}
                  <section className="space-y-6">
                    <div className="flex items-center gap-2">
                      <div className="w-1 h-6 bg-emerald-500 rounded-full" />
                      <h2 className="text-xl font-bold text-white uppercase tracking-tight">
                        Dashboard Summary
                      </h2>
                    </div>
                    <div className="space-y-10">
                      {profile.roles.map(role => (
                        <div key={role}>
                          {renderRoleSummary(role)}
                        </div>
                      ))}
                    </div>
                  </section>

                  {/* TODAY'S DETAIL ACTIVITY */}
                  <section className="space-y-6">
                    <div className="flex items-center gap-2">
                      <div className="w-1 h-6 bg-blue-500 rounded-full" />
                      <h2 className="text-xl font-bold text-white uppercase tracking-tight">
                        Daily Intelligence
                      </h2>
                    </div>
                    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden">
                      <ReportList 
                        reports={reports.filter(r => r.date === new Date().toISOString().split('T')[0])} 
                        userRoles={profile.roles} 
                        userId={profile.id}
                        onEdit={(report) => {
                          setEditingReport(report);
                          setShowReportForm(true);
                        }}
                        onDelete={handleDeleteReport}
                      />
                    </div>
                  </section>
                </div>
              )}

              {view === 'qc-requests' && selectedProject && (
                <QCMaterialRequests project={selectedProject} userProfile={profile} />
              )}

              {view === 'reports' && (
                <div className="space-y-6">
                  {!showReportForm && profile.roles.length > 1 && (
                    <div className="flex items-center gap-2 p-1 bg-neutral-800/50 rounded-xl border border-neutral-700/50 w-fit">
                      <button
                        onClick={() => setDisciplineFilter('All')}
                        className={`px-4 py-1.5 rounded-lg text-[10px] font-bold transition-all ${
                          disciplineFilter === 'All' ? 'bg-emerald-500 text-black' : 'text-neutral-500 hover:text-white'
                        }`}
                      >
                        ALL
                      </button>
                      {profile.roles.map(role => (
                        <button
                          key={role}
                          onClick={() => setDisciplineFilter(role)}
                          className={`px-4 py-1.5 rounded-lg text-[10px] font-bold transition-all ${
                            disciplineFilter === role ? 'bg-emerald-500 text-black' : 'text-neutral-500 hover:text-white'
                          }`}
                        >
                          {role.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  )}
                  {showReportForm ? (
                    <ReportForm 
                      project={selectedProject!} 
                      profile={profile} 
                      initialReport={editingReport || undefined}
                      defaultDiscipline={disciplineFilter !== 'All' ? disciplineFilter : undefined}
                      onClose={() => {
                        setShowReportForm(false);
                        setEditingReport(null);
                      }} 
                    />
                  ) : (
                    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden">
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
                    </div>
                  )}
                </div>
              )}

              {view === 'admin' && (
                <AdminPanel projects={projects} users={[]} currentUserEmail={user.email || ''} />
              )}

              {view === 'logistics' && selectedProject && (
                <LogisticsDashboard project={selectedProject} profile={profile} />
              )}

              {view === 'supervisor' && selectedProject && (
                <SupervisorDashboard project={selectedProject} reports={reports} />
              )}

              {view === 'hse' && selectedProject && (
                <HSEDashboard project={selectedProject} reports={reports} />
              )}

              {view === 'cost-control' && selectedProject && (
                <CostControlDashboard project={selectedProject} userProfile={profile} onNavigate={(v) => setView(v as View)} />
              )}

              {view === 'cm' && selectedProject && (
                <ConstructionManagerDashboard project={selectedProject} userProfile={profile} reports={reports} onNavigate={(v) => setView(v as View)} />
              )}

              {view === 'hr' && selectedProject && (
                <HRDashboard project={selectedProject} reports={reports} />
              )}

              {view === 'hr-attendance' && selectedProject && (
                <HRAttendance project={selectedProject} />
              )}

              {view === 'qc' && selectedProject && (
                <QCDashboard 
                  project={selectedProject} 
                  reports={reports} 
                  userProfile={profile} 
                  onNavigateToRequests={() => setView('qc-requests')} 
                />
              )}

              {view === 'procurement' && selectedProject && (
                <div className="space-y-6">
                  <div className="p-8 bg-neutral-900 border border-neutral-800 rounded-3xl text-center">
                    <Briefcase className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
                    <h3 className="text-xl font-bold text-white uppercase tracking-tight">Procurement Hub</h3>
                    <p className="text-neutral-500 mt-2">View and manage procurement reports and material requests.</p>
                  </div>
                  <ReportList 
                    reports={reports.filter(r => r.discipline === 'Procurement')} 
                    userRoles={profile.roles}
                    userId={profile.id}
                    userEmail={user.email || ''}
                    onEdit={(report) => {
                      setEditingReport(report);
                      setShowReportForm(true);
                    }}
                    onDelete={handleDeleteReport}
                  />
                </div>
              )}

              {view === 'dc' && selectedProject && (
                <div className="space-y-6">
                  <div className="p-8 bg-neutral-900 border border-neutral-800 rounded-3xl text-center">
                    <Settings className="w-12 h-12 text-cyan-500 mx-auto mb-4" />
                    <h3 className="text-xl font-bold text-white uppercase tracking-tight">Document Control</h3>
                    <p className="text-neutral-500 mt-2">Manage drawings, RFIs, and technical queries.</p>
                  </div>
                  <ReportList 
                    reports={reports.filter(r => r.discipline === 'Document Control')} 
                    userRoles={profile.roles}
                    userId={profile.id}
                    userEmail={user.email || ''}
                    onEdit={(report) => {
                      setEditingReport(report);
                      setShowReportForm(true);
                    }}
                    onDelete={handleDeleteReport}
                  />
                </div>
              )}

              {view === 'me' && selectedProject && (
                <div className="space-y-6">
                  <div className="p-8 bg-neutral-900 border border-neutral-800 rounded-3xl text-center">
                    <HardHat className="w-12 h-12 text-amber-500 mx-auto mb-4" />
                    <h3 className="text-xl font-bold text-white uppercase tracking-tight">Mechanic & Electrical</h3>
                    <p className="text-neutral-500 mt-2">Monitor M&E work progress and equipment status.</p>
                  </div>
                  <ReportList 
                    reports={reports.filter(r => r.discipline === 'Mechanic & Electrical')} 
                    userRoles={profile.roles}
                    userId={profile.id}
                    userEmail={user.email || ''}
                    onEdit={(report) => {
                      setEditingReport(report);
                      setShowReportForm(true);
                    }}
                    onDelete={handleDeleteReport}
                  />
                </div>
              )}

              {view === 'pc' && selectedProject && (
                <div className="space-y-6">
                  <div className="p-8 bg-neutral-900 border border-neutral-800 rounded-3xl text-center">
                    <ShieldCheck className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
                    <h3 className="text-xl font-bold text-white uppercase tracking-tight">Project Control</h3>
                    <p className="text-neutral-500 mt-2">Track schedule variance, cost status, and project narratives.</p>
                  </div>
                  <ReportList 
                    reports={reports.filter(r => r.discipline === 'Project Control')} 
                    userRoles={profile.roles}
                    userId={profile.id}
                    userEmail={user.email || ''}
                    onEdit={(report) => {
                      setEditingReport(report);
                      setShowReportForm(true);
                    }}
                    onDelete={handleDeleteReport}
                  />
                </div>
              )}

              {view === 'pm' && selectedProject && (
                <div className="space-y-6">
                  <div className="p-8 bg-neutral-900 border border-neutral-800 rounded-3xl text-center">
                    <ShieldCheck className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
                    <h3 className="text-xl font-bold text-white uppercase tracking-tight">Project Management</h3>
                    <p className="text-neutral-500 mt-2">Executive overview of project health and performance.</p>
                  </div>
                  <ReportList 
                    reports={reports.filter(r => r.discipline === 'Project Manager')} 
                    userRoles={profile.roles}
                    userId={profile.id}
                    userEmail={user.email || ''}
                    onEdit={(report) => {
                      setEditingReport(report);
                      setShowReportForm(true);
                    }}
                    onDelete={handleDeleteReport}
                  />
                </div>
              )}

              {view === 'general-manpower' && (
                selectedProject ? (
                  <GeneralManpowerDashboard user={user} profile={profile} project={selectedProject} />
                ) : (
                  <div className="p-8 bg-neutral-900 border border-neutral-800 rounded-3xl text-center space-y-4">
                    <MapPin className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
                    <h3 className="text-xl font-bold text-white uppercase tracking-tight">Select Project First</h3>
                    <p className="text-neutral-500">Please select a project from the Overview to enable attendance features.</p>
                    <button 
                      onClick={() => setView('overview')}
                      className="px-6 py-2 bg-emerald-500 text-black font-bold rounded-xl hover:bg-emerald-400 transition-all"
                    >
                      GO TO OVERVIEW
                    </button>
                  </div>
                )
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

function NavItem({ icon, label, active, onClick }: { icon: any, label: string, active: boolean, onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all group ${
        active 
          ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' 
          : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
      }`}
    >
      <span className={`${active ? 'text-emerald-500' : 'text-neutral-500 group-hover:text-emerald-400'} transition-colors`}>
        {icon}
      </span>
      <span className="text-sm font-bold tracking-tight uppercase">{label}</span>
    </button>
  );
}

function StatCard({ title, value, icon }: any) {
  return (
    <div className="p-6 bg-neutral-900 border border-neutral-800 rounded-2xl hover:border-neutral-700 transition-all group">
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs font-mono text-neutral-500 uppercase tracking-widest">{title}</p>
        <div className="p-2 bg-neutral-800 rounded-lg group-hover:scale-110 transition-transform">
          {icon}
        </div>
      </div>
      <p className="text-3xl font-bold text-white">{value}</p>
    </div>
  );
}
