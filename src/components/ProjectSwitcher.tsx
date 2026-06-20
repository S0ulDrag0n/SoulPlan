'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Project } from '@/lib/types';
import * as api from '@/lib/api';
import { useAuth } from '@/components/AuthProvider';

interface ProjectSwitcherProps {
  currentProjectId: string | null;
  onSelectProject: (project: Project) => void;
}

export default function ProjectSwitcher({ currentProjectId, onSelectProject }: ProjectSwitcherProps) {
  const { session, logout } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');

  const loadProjects = useCallback(async () => {
    setLoading(true);
    try {
      const list = await api.fetchProjects();
      setProjects(list);
    } catch (err) {
      console.error('Failed to load projects:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return;
    try {
      const project = await api.createProject({ name: newProjectName.trim() });
      setProjects((prev) => [...prev, project]);
      setNewProjectName('');
      setCreating(false);
      onSelectProject(project);
      setOpen(false);
    } catch (err) {
      console.error('Failed to create project:', err);
    }
  };

  const currentProject = projects.find(p => p.id === currentProjectId);
  const canCreateProjects = session?.memberType === 'user';

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm font-medium text-gray-700 dark:text-gray-200"
      >
        <span className="text-gray-500 dark:text-gray-400">📁</span>
        <span>{currentProject ? currentProject.name : 'Select Project'}</span>
        <span className="text-gray-400">▼</span>
      </button>

      {open && (
        <>
          {/* Click-outside overlay */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-2 w-72 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl z-50 max-h-96 overflow-y-auto">
            <div className="p-2">
              {loading && (
                <div className="px-3 py-2 text-sm text-gray-400">Loading...</div>
              )}
              {!loading && projects.length === 0 && (
                <div className="px-3 py-2 text-sm text-gray-400 dark:text-gray-500">No projects yet</div>
              )}
              {projects.map((project) => (
                <button
                  key={project.id}
                  onClick={() => {
                    onSelectProject(project);
                    setOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                    project.id === currentProjectId
                      ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium'
                      : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  {project.name}
                </button>
              ))}

              {canCreateProjects && (
                <>
                  {creating ? (
                    <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700 px-1">
                      <input
                        type="text"
                        value={newProjectName}
                        onChange={(e) => setNewProjectName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleCreateProject();
                          if (e.key === 'Escape') { setCreating(false); setNewProjectName(''); }
                        }}
                        placeholder="Project name"
                        autoFocus
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={handleCreateProject}
                          className="flex-1 px-3 py-1.5 bg-blue-600 text-white rounded-md text-xs font-medium hover:bg-blue-700"
                        >
                          Create
                        </button>
                        <button
                          onClick={() => { setCreating(false); setNewProjectName(''); }}
                          className="flex-1 px-3 py-1.5 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-md text-xs font-medium hover:bg-gray-300 dark:hover:bg-gray-500"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setCreating(true)}
                      className="w-full text-left px-3 py-2 rounded-md text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 font-medium mt-2 pt-2 border-t border-gray-200 dark:border-gray-700"
                    >
                      + New Project
                    </button>
                  )}
                </>
              )}

              {/* User info + logout */}
              <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700 px-3 py-2 flex items-center justify-between">
                <div className="text-xs text-gray-400 dark:text-gray-500">
                  {session?.displayName} ({session?.memberType})
                </div>
                <button
                  onClick={() => { logout(); }}
                  className="text-xs text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400"
                >
                  Logout
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}