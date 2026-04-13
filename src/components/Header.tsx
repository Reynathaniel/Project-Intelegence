import React from 'react';
import { 
  Menu, 
  LayoutDashboard, 
  Briefcase, 
  ChevronRight, 
  Search, 
  Plus, 
  Download,
  FileType,
  FileSpreadsheet
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import NotificationBell from './NotificationBell';
import { Project } from '../types';

interface HeaderProps {
  view: string;
  setView: (view: any) => void;
  onOpenSidebar: () => void;
  selectedProject: Project | null;
  projects: Project[];
  onSelectProject: (project: Project) => void;
  showProjectDropdown: boolean;
  setShowProjectDropdown: (show: boolean) => void;
  profileId: string;
  showDownloadMenu: boolean;
  setShowDownloadMenu: (show: boolean) => void;
  selectedTemplate: string;
  setSelectedTemplate: (template: string) => void;
  onGeneratePDF: () => void;
  onGenerateExcel: () => void;
  onNewReport: () => void;
}

export default function Header({
  view,
  setView,
  onOpenSidebar,
  selectedProject,
  projects,
  onSelectProject,
  showProjectDropdown,
  setShowProjectDropdown,
  profileId,
  showDownloadMenu,
  setShowDownloadMenu,
  selectedTemplate,
  setSelectedTemplate,
  onGeneratePDF,
  onGenerateExcel,
  onNewReport
}: HeaderProps) {
  const getViewTitle = () => {
    switch (view) {
      case 'overview': return 'Strategic Overview';
      case 'qc-requests': return 'Request Material';
      case 'reports': return 'Daily Intelligence';
      case 'logistics': return 'Logistics Hub';
      case 'supervisor': return 'Supervisor Activity';
      case 'hse': return 'HSE Intelligence';
      case 'hr': return 'HR Intelligence Dashboard';
      case 'hr-attendance': return 'Attendance Monitoring';
      case 'qc': return 'QC Intelligence';
      case 'procurement': return 'Procurement Hub';
      case 'dc': return 'Document Control';
      case 'me': return 'Mechanic & Electrical';
      case 'pc': return 'Project Control';
      case 'cost-control': return 'Cost Control Hub';
      case 'cm': return 'Construction Management';
      case 'pm': return 'Project Management';
      case 'general-manpower': return 'Manpower Portal';
      case 'admin': return 'Command Center';
      case 'settings': return 'System Settings';
      default: return 'Dashboard';
    }
  };

  return (
    <header className="h-20 border-b border-neutral-800 bg-neutral-900/50 backdrop-blur-xl flex items-center justify-between px-4 lg:px-8 z-10">
      <div className="flex items-center gap-4 min-w-0">
        <button 
          onClick={onOpenSidebar}
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
          {getViewTitle()}
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
                            onSelectProject(p);
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

        <NotificationBell userId={profileId} />
        
        {view === 'reports' && selectedProject && (
          <>
            <button 
              onClick={onNewReport}
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
                      onClick={onGeneratePDF}
                      className="w-full flex items-center gap-3 px-4 py-3 text-sm text-neutral-300 hover:bg-neutral-800 hover:text-white transition-colors border-b border-neutral-800"
                    >
                      <FileType className="w-4 h-4 text-red-400" />
                      Generate PDF
                    </button>
                    <button
                      onClick={onGenerateExcel}
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
  );
}
