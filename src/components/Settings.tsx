import React, { useState } from 'react';
import { UserProfile, Project } from '../types';
import { motion } from 'motion/react';
import { 
  Settings as SettingsIcon, 
  Building2, 
  Palette, 
  Bell, 
  Shield, 
  CreditCard,
  Check,
  Upload,
  Globe,
  Mail,
  Phone
} from 'lucide-react';

interface SettingsProps {
  profile: UserProfile;
  projects: Project[];
}

export default function Settings({ profile, projects }: SettingsProps) {
  const [activeSection, setActiveSection] = useState<'profile' | 'organization' | 'notifications' | 'security' | 'billing'>('profile');

  const sections = [
    { id: 'profile', label: 'Personal Profile', icon: <SettingsIcon className="w-4 h-4" /> },
    { id: 'organization', label: 'Organization', icon: <Building2 className="w-4 h-4" /> },
    { id: 'notifications', label: 'Notifications', icon: <Bell className="w-4 h-4" /> },
    { id: 'security', label: 'Security & Access', icon: <Shield className="w-4 h-4" /> },
    { id: 'billing', label: 'Subscription', icon: <CreditCard className="w-4 h-4" /> },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row gap-8">
        {/* Sidebar Navigation */}
        <aside className="w-full md:w-64 space-y-1">
          {sections.map((section) => (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id as any)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${
                activeSection === section.id
                  ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/20'
                  : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
              }`}
            >
              {section.icon}
              {section.label}
            </button>
          ))}
        </aside>

        {/* Content Area */}
        <main className="flex-1 bg-neutral-900 border border-neutral-800 rounded-3xl p-8 shadow-2xl">
          {activeSection === 'profile' && (
            <div className="space-y-8">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-bold text-white">Personal Profile</h3>
                  <p className="text-neutral-500 text-sm">Manage your personal information and preferences.</p>
                </div>
                <button className="px-6 py-2 bg-emerald-500 text-black font-bold rounded-xl hover:bg-emerald-400 transition-all text-sm">
                  SAVE CHANGES
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest">Full Name</label>
                  <input 
                    type="text" 
                    defaultValue={profile.name}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-white focus:border-emerald-500 outline-none transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest">Email Address</label>
                  <input 
                    type="email" 
                    defaultValue={profile.email}
                    disabled
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-neutral-500 cursor-not-allowed"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest">Designation</label>
                  <div className="flex flex-wrap gap-2">
                    {profile.roles.map(role => (
                      <span key={role} className="px-3 py-1 bg-neutral-800 border border-neutral-700 rounded-lg text-xs text-neutral-300">
                        {role}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="pt-8 border-t border-neutral-800">
                <h4 className="text-lg font-bold text-white mb-4">Profile Picture</h4>
                <div className="flex items-center gap-6">
                  <div className="w-24 h-24 rounded-2xl bg-neutral-800 border border-neutral-700 flex items-center justify-center overflow-hidden">
                    <img src={`https://ui-avatars.com/api/?name=${profile.name}&size=128`} alt={profile.name} />
                  </div>
                  <div className="space-y-3">
                    <button className="flex items-center gap-2 px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-xl text-xs font-bold text-white hover:bg-neutral-700 transition-all">
                      <Upload className="w-4 h-4" />
                      UPLOAD NEW PHOTO
                    </button>
                    <p className="text-[10px] text-neutral-500 font-mono uppercase tracking-widest">JPG, PNG or GIF. Max size 2MB.</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'organization' && (
            <div className="space-y-8">
              <div>
                <h3 className="text-2xl font-bold text-white">Organization Settings</h3>
                <p className="text-neutral-500 text-sm">Configure your company profile and branding.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest">Company Name</label>
                  <input 
                    type="text" 
                    placeholder="Enter company name"
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-white focus:border-emerald-500 outline-none transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest">Website</label>
                  <div className="relative">
                    <Globe className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                    <input 
                      type="text" 
                      placeholder="https://company.com"
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl pl-12 pr-4 py-3 text-white focus:border-emerald-500 outline-none transition-all"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="text-lg font-bold text-white">Branding</h4>
                <div className="p-6 bg-neutral-950 border border-neutral-800 rounded-2xl space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-emerald-500 rounded-xl flex items-center justify-center font-bold text-black">
                        RC
                      </div>
                      <div>
                        <p className="text-sm font-bold text-white">Primary Logo</p>
                        <p className="text-xs text-neutral-500">Used in sidebar and reports.</p>
                      </div>
                    </div>
                    <button className="text-xs font-bold text-emerald-500 hover:text-emerald-400">CHANGE</button>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-emerald-500 rounded-xl"></div>
                      <div>
                        <p className="text-sm font-bold text-white">Brand Color</p>
                        <p className="text-xs text-neutral-500">Primary accent color for the UI.</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'].map(color => (
                        <button 
                          key={color}
                          className="w-6 h-6 rounded-full border border-neutral-800"
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'billing' && (
            <div className="space-y-8">
              <div>
                <h3 className="text-2xl font-bold text-white">Subscription Plan</h3>
                <p className="text-neutral-500 text-sm">Manage your commercial license and usage limits.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-6 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="px-3 py-1 bg-emerald-500 text-black text-[10px] font-bold rounded-full uppercase tracking-widest">Current Plan</span>
                    <span className="text-2xl font-bold text-white">Enterprise</span>
                  </div>
                  <p className="text-sm text-neutral-400">Unlimited projects, advanced analytics, and priority support.</p>
                  <div className="pt-4 border-t border-emerald-500/10 flex items-center justify-between">
                    <span className="text-xs text-neutral-500">Next billing date: May 12, 2026</span>
                    <button className="text-xs font-bold text-emerald-500 hover:text-emerald-400">MANAGE</button>
                  </div>
                </div>

                <div className="p-6 bg-neutral-950 border border-neutral-800 rounded-2xl space-y-4">
                  <h4 className="text-sm font-bold text-white uppercase tracking-widest">Usage Metrics</h4>
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] font-mono uppercase tracking-widest">
                        <span className="text-neutral-500">Active Projects</span>
                        <span className="text-white">{projects.length} / 50</span>
                      </div>
                      <div className="h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500" style={{ width: `${(projects.length / 50) * 100}%` }}></div>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] font-mono uppercase tracking-widest">
                        <span className="text-neutral-500">Total Personnel</span>
                        <span className="text-white">124 / 500</span>
                      </div>
                      <div className="h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500" style={{ width: '25%' }}></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Placeholder for other sections */}
          {(activeSection === 'notifications' || activeSection === 'security') && (
            <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
              <div className="w-16 h-16 bg-neutral-950 border border-neutral-800 rounded-2xl flex items-center justify-center">
                <SettingsIcon className="w-8 h-8 text-neutral-700" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">Under Construction</h3>
                <p className="text-neutral-500 text-sm">This settings module is being finalized for production.</p>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
