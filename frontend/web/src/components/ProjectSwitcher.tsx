'use client';

import { useEffect, useRef, useState } from 'react';
import { useProjectStore } from '@/lib/project-store';
import { ChevronDown, FolderKanban, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function ProjectSwitcher() {
  const { projects, activeProject, loading, loadProjects, setActiveProject, hydrate } = useProjectStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    hydrate();
    loadProjects();
  }, [hydrate, loadProjects]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-sm font-medium text-slate-700 transition"
      >
        <FolderKanban className="h-4 w-4 text-primary-500" />
        <span className="max-w-[140px] truncate">
          {activeProject ? activeProject.name : 'All Projects'}
        </span>
        <ChevronDown className={cn('h-4 w-4 text-slate-400 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 w-64 bg-white rounded-xl border border-slate-200 shadow-xl z-50 py-1 max-h-72 overflow-y-auto">
          {/* All Projects option */}
          <button
            onClick={() => { setActiveProject(null); setOpen(false); }}
            className={cn(
              'flex items-center gap-3 w-full px-4 py-2.5 text-sm text-left hover:bg-slate-50 transition',
              !activeProject && 'bg-primary-50 text-primary-700'
            )}
          >
            <FolderKanban className="h-4 w-4" />
            <span className="flex-1">All Projects</span>
            {!activeProject && <Check className="h-4 w-4 text-primary-600" />}
          </button>

          {projects.length > 0 && <div className="border-t border-slate-100 my-1" />}

          {loading && (
            <div className="px-4 py-3 text-sm text-slate-400">Loading projects...</div>
          )}

          {projects.map((p) => (
            <button
              key={p.id}
              onClick={() => { setActiveProject(p); setOpen(false); }}
              className={cn(
                'flex items-center gap-3 w-full px-4 py-2.5 text-sm text-left hover:bg-slate-50 transition',
                activeProject?.id === p.id && 'bg-primary-50 text-primary-700'
              )}
            >
              <div className={cn(
                'h-2 w-2 rounded-full',
                p.aiEnabled ? 'bg-violet-500' : 'bg-slate-300'
              )} />
              <span className="flex-1 truncate">{p.name}</span>
              {p.aiEnabled && <span className="text-xs text-violet-500 font-medium">AI</span>}
              {activeProject?.id === p.id && <Check className="h-4 w-4 text-primary-600" />}
            </button>
          ))}

          {!loading && projects.length === 0 && (
            <div className="px-4 py-3 text-sm text-slate-400">No projects found</div>
          )}
        </div>
      )}
    </div>
  );
}
