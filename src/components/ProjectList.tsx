import { Project } from '../types';
import { MapPin, Calendar, ChevronRight, Briefcase } from 'lucide-react';

interface ProjectListProps {
  projects: Project[];
  onSelect: (project: Project) => void;
  selectedId?: string;
}

export default function ProjectList({ projects, onSelect, selectedId }: ProjectListProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {projects.map((project) => (
        <button
          key={project.id}
          onClick={() => onSelect(project)}
          className={`group flex flex-col p-6 rounded-2xl border transition-all text-left ${
            selectedId === project.id 
              ? 'bg-emerald-500/10 border-emerald-500/30' 
              : 'bg-neutral-900 border-neutral-800 hover:border-neutral-700'
          }`}
        >
          <div className="flex items-center justify-between mb-4">
            <div className={`p-3 rounded-xl transition-colors ${
              selectedId === project.id ? 'bg-emerald-500 text-black' : 'bg-neutral-800 text-neutral-400 group-hover:text-emerald-400'
            }`}>
              <Briefcase className="w-6 h-6" />
            </div>
            <span className={`px-2 py-1 rounded-md text-[10px] font-mono uppercase tracking-widest ${
              project.status === 'Active' ? 'bg-emerald-500/20 text-emerald-500' : 'bg-neutral-800 text-neutral-500'
            }`}>
              {project.status}
            </span>
          </div>

          <h3 className="text-xl font-bold text-white mb-2 group-hover:text-emerald-400 transition-colors truncate w-full" title={project.name}>
            {project.name}
          </h3>
          <p className="text-neutral-400 text-sm line-clamp-2 mb-6 min-h-[2.5rem]">
            {project.description}
          </p>

          <div className="mt-auto space-y-3">
            <div className="flex items-center gap-2 text-xs text-neutral-500 min-w-0">
              <MapPin className="w-4 h-4 flex-shrink-0" />
              <span className="truncate">{project.location}</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-neutral-500">
              <Calendar className="w-4 h-4" />
              <span>{project.startDate} — {project.endDate}</span>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-neutral-800/50 flex items-center justify-between">
            <span className="text-[10px] font-mono text-neutral-600 uppercase tracking-tighter">
              Project ID: {project.id.slice(0, 8)}
            </span>
            <ChevronRight className={`w-4 h-4 transition-transform ${selectedId === project.id ? 'translate-x-1 text-emerald-500' : 'text-neutral-700'}`} />
          </div>
        </button>
      ))}
    </div>
  );
}
