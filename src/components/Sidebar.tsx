import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LayoutDashboard, 
  Briefcase, 
  FileText, 
  Settings as SettingsIcon, 
  LogOut, 
  Truck, 
  Activity, 
  ShieldCheck, 
  ClipboardCheck, 
  Users, 
  UserCheck, 
  HardHat,
  X,
  Package
} from 'lucide-react';
import { UserProfile, UserRole } from '../types';
import { isSuperAdmin } from '../constants';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  view: string;
  setView: (view: any) => void;
  profile: UserProfile;
  userEmail: string;
  onLogout: () => void;
  roleViews: Record<string, { label: string, icon: any, view: any }>;
  getRoleIcon: (role: UserRole) => React.ReactNode;
}

export default function Sidebar({ 
  isOpen, 
  onClose, 
  view, 
  setView, 
  profile, 
  userEmail, 
  onLogout, 
  roleViews,
  getRoleIcon 
}: SidebarProps) {
  return (
    <>
      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-72 bg-neutral-900 border-r border-neutral-800 flex flex-col transition-transform duration-300 lg:relative lg:translate-x-0
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="p-6 border-b border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-500 rounded-lg flex items-center justify-center font-bold text-black shadow-lg shadow-emerald-500/20">
              RC
            </div>
            <div>
              <h2 className="font-bold text-white tracking-tight">REY-COMMAND</h2>
              <p className="text-[10px] text-neutral-500 font-mono uppercase tracking-widest">Nexus v1.0</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-neutral-500 hover:text-white lg:hidden"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto custom-scrollbar">
          <div className="pb-4">
            <p className="px-4 text-[9px] font-mono text-neutral-600 uppercase tracking-widest mb-2">Main Intelligence</p>
            <NavItem 
              icon={<LayoutDashboard className="w-5 h-5" />} 
              label="Overview" 
              active={view === 'overview'} 
              onClick={() => { setView('overview'); onClose(); }} 
            />
            <NavItem 
              icon={<FileText className="w-5 h-5" />} 
              label="Daily Intelligence" 
              active={view === 'reports'} 
              onClick={() => { setView('reports'); onClose(); }} 
            />
            <NavItem 
              icon={<UserCheck className="w-5 h-5" />} 
              label="Manpower Portal" 
              active={view === 'general-manpower'} 
              onClick={() => { setView('general-manpower'); onClose(); }} 
            />
          </div>

          <div className="pb-4">
            <p className="px-4 text-[9px] font-mono text-neutral-600 uppercase tracking-widest mb-2">Role Dashboards</p>
            {[...profile.roles, ...(isSuperAdmin(userEmail) && !profile.roles.includes('Admin') ? ['Admin'] : [])].map(role => {
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
                      onClose(); 
                    }} 
                  />
                );
              }
              return null;
            })}
          </div>

          <div className="pb-4">
            <p className="px-4 text-[9px] font-mono text-neutral-600 uppercase tracking-widest mb-2">System</p>
            <NavItem 
              icon={<SettingsIcon className="w-5 h-5" />} 
              label="Settings" 
              active={view === 'settings'} 
              onClick={() => { setView('settings'); onClose(); }} 
            />
          </div>
        </nav>

        <div className="p-4 border-t border-neutral-800 space-y-4">
          <div className="flex items-center gap-3 p-3 bg-neutral-800/50 rounded-xl border border-neutral-700/50">
            <div className="w-10 h-10 rounded-full bg-neutral-700 overflow-hidden border border-neutral-600">
              <img src={`https://ui-avatars.com/api/?name=${profile.name}`} alt={profile.name} referrerPolicy="no-referrer" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white truncate">{profile.name}</p>
              <div className="flex flex-wrap gap-1 mt-1">
                {profile.roles.slice(0, 2).map(role => (
                  <span key={role} className="px-1.5 py-0.5 bg-neutral-700 text-[8px] font-mono text-neutral-400 uppercase rounded">
                    {role}
                  </span>
                ))}
                {profile.roles.length > 2 && (
                  <span className="px-1.5 py-0.5 bg-neutral-700 text-[8px] font-mono text-neutral-400 uppercase rounded">
                    +{profile.roles.length - 2}
                  </span>
                )}
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
    </>
  );
}

function NavItem({ icon, label, active, onClick }: { icon: any, label: string, active: boolean, onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all group ${
        active 
          ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/20' 
          : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
      }`}
    >
      <span className={`transition-transform group-hover:scale-110 ${active ? 'text-black' : 'text-neutral-500 group-hover:text-emerald-500'}`}>
        {icon}
      </span>
      {label}
    </button>
  );
}
