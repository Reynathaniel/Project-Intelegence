import { useState } from 'react';
import { DailyReport, UserRole } from '../types';
import { isSuperAdmin } from '../constants';
import { FileText, User, Calendar, Tag, ChevronRight, CheckCircle2, Clock, Edit2, Trash2, AlertTriangle, X as CloseIcon, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ReportListProps {
  reports: DailyReport[];
  userRoles?: UserRole[];
  userId?: string;
  userEmail?: string;
  onEdit?: (report: DailyReport) => void;
  onDelete?: (reportId: string) => void;
}

export default function ReportList({ reports, userRoles = [], userId, userEmail, onEdit, onDelete }: ReportListProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const canModify = (report: DailyReport) => {
    // STRICT RULE: Only the author can modify their own report, 
    // AND they must currently possess the role for that discipline.
    if (userId && report.authorId === userId) {
      if (userRoles.includes(report.discipline as UserRole)) {
        return true;
      }
    }
    
    // Super Admin override is removed from UI buttons per user request 
    // to prevent confusion, but kept in rules for emergency.
    return false;
  };

  if (reports.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-neutral-600 border border-dashed border-neutral-800 rounded-3xl bg-neutral-900/20">
        <FileText className="w-12 h-12 mb-4 opacity-20" />
        <p className="text-sm font-mono uppercase tracking-widest">No intelligence reports found for this sector.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Desktop Table */}
      <div className="hidden md:block overflow-hidden bg-neutral-900/30 border border-neutral-800 rounded-2xl">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-neutral-800 bg-neutral-950/50">
              <th className="p-4 text-[10px] font-mono text-neutral-500 uppercase tracking-widest">Date</th>
              <th className="p-4 text-[10px] font-mono text-neutral-500 uppercase tracking-widest">Discipline</th>
              <th className="p-4 text-[10px] font-mono text-neutral-500 uppercase tracking-widest">Author</th>
              <th className="p-4 text-[10px] font-mono text-neutral-500 uppercase tracking-widest">Status</th>
              <th className="p-4 text-[10px] font-mono text-neutral-500 uppercase tracking-widest text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {reports.map((report) => (
              <tr 
                key={report.id} 
                className="border-b border-neutral-800/50 hover:bg-neutral-800/30 transition-colors group"
              >
                <td className="p-4">
                  <div className="flex items-center gap-3">
                    <Calendar className="w-4 h-4 text-neutral-600" />
                    <span className="text-sm font-mono text-neutral-300">{report.date}</span>
                  </div>
                </td>
                <td className="p-4">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span className="text-sm font-bold text-white">{report.discipline}</span>
                  </div>
                </td>
                <td className="p-4">
                  <div className="flex items-center gap-2 min-w-0">
                    <User className="w-4 h-4 text-neutral-600 flex-shrink-0" />
                    <span className="text-sm text-neutral-400 truncate max-w-[120px]" title={report.authorName}>{report.authorName}</span>
                  </div>
                </td>
                <td className="p-4">
                  <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-mono uppercase tracking-widest ${
                    report.status === 'Submitted' 
                      ? 'bg-emerald-500/10 text-emerald-500' 
                      : 'bg-orange-500/10 text-orange-500'
                  }`}>
                    {report.status === 'Submitted' ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                    {report.status}
                  </div>
                </td>
                <td className="p-4">
                  <div className="flex items-center justify-end gap-2">
                    {onEdit && canModify(report) && (
                      <button 
                        onClick={() => onEdit(report)}
                        className="p-2 hover:bg-neutral-800 rounded-lg text-neutral-600 hover:text-emerald-400 transition-all"
                        title="Edit Report"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    )}
                    {onDelete && canModify(report) && (
                      <button 
                        onClick={() => setDeletingId(report.id)}
                        className="p-2 hover:bg-neutral-800 rounded-lg text-neutral-600 hover:text-red-400 transition-all"
                        title="Delete Report"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                    <button className="p-2 hover:bg-neutral-800 rounded-lg text-neutral-600 hover:text-white transition-all">
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-4">
        {reports.map((report) => (
          <div 
            key={report.id}
            className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 space-y-4"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="text-sm font-bold text-white uppercase tracking-tight">{report.discipline}</span>
              </div>
              <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-mono uppercase tracking-widest ${
                report.status === 'Submitted' 
                  ? 'bg-emerald-500/10 text-emerald-500' 
                  : 'bg-orange-500/10 text-orange-500'
              }`}>
                {report.status === 'Submitted' ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                {report.status}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-[9px] text-neutral-500 uppercase font-mono tracking-widest">Date</p>
                <div className="flex items-center gap-2">
                  <Calendar className="w-3 h-3 text-neutral-600" />
                  <span className="text-xs font-mono text-neutral-300">{report.date}</span>
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-[9px] text-neutral-500 uppercase font-mono tracking-widest">Author</p>
                <div className="flex items-center gap-2">
                  <User className="w-3 h-3 text-neutral-600" />
                  <span className="text-xs text-neutral-400 truncate" title={report.authorName}>{report.authorName}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-4 border-t border-neutral-800">
              {onEdit && canModify(report) && (
                <button 
                  onClick={() => onEdit(report)}
                  className="flex-1 flex items-center justify-center gap-2 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-emerald-400 rounded-xl transition-all text-xs font-bold uppercase tracking-widest"
                >
                  <Edit2 className="w-3 h-3" />
                  Edit
                </button>
              )}
              {onDelete && canModify(report) && (
                <button 
                  onClick={() => setDeletingId(report.id)}
                  className="flex-1 flex items-center justify-center gap-2 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-red-400 rounded-xl transition-all text-xs font-bold uppercase tracking-widest"
                >
                  <Trash2 className="w-3 h-3" />
                  Delete
                </button>
              )}
              <button className="p-2 bg-neutral-800 hover:bg-neutral-700 rounded-xl text-white transition-all">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* DELETE CONFIRMATION MODAL */}
      <AnimatePresence>
        {deletingId && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-neutral-900 border border-neutral-800 rounded-3xl p-8 max-w-md w-full shadow-2xl"
            >
              <div className="flex items-center gap-4 mb-6">
                <div className="p-3 bg-red-500/10 rounded-2xl">
                  <AlertTriangle className="w-6 h-6 text-red-500" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white uppercase tracking-tight">Delete Report?</h3>
                  <p className="text-neutral-500 text-sm mt-1">This action cannot be undone. The intelligence data will be permanently purged.</p>
                </div>
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={() => setDeletingId(null)}
                  className="flex-1 px-6 py-3 bg-neutral-800 hover:bg-neutral-700 text-white rounded-xl font-bold text-xs uppercase tracking-widest transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    onDelete(deletingId);
                    setDeletingId(null);
                  }}
                  className="flex-1 px-6 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-bold text-xs uppercase tracking-widest transition-all shadow-lg shadow-red-500/20"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
