'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { Project } from '@/lib/types';
import * as api from '@/lib/api';
import { useAuth } from '@/components/AuthProvider';

interface ProjectSwitcherProps {
  currentProjectId: string | null;
  onSelectProject: (project: Project | null) => void;
  /** Called when the user picks an export JSON file to import as a new project. */
  onImportProject?: (file: File) => void;
}

export default function ProjectSwitcher({ currentProjectId, onSelectProject, onImportProject }: ProjectSwitcherProps) {
  const { session, logout } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [archivedProjects, setArchivedProjects] = useState<Project[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const importFileRef = useRef<HTMLInputElement>(null);

  const loadProjects = useCallback(async () => {
    setLoading(true);
    try {
      const [active, archived] = await Promise.all([
        api.fetchProjects(),
        api.fetchArchivedProjects(),
      ]);
      setProjects(active);
      setArchivedProjects(archived);
    } catch (err) {
      console.error('Failed to load projects:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  // Reload when dropdown opens
  useEffect(() => {
    if (open) loadProjects();
  }, [open, loadProjects]);

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

  const handleArchiveProject = async (id: string) => {
    try {
      await api.archiveProject(id);
      // Move from active to archived
      const project = projects.find(p => p.id === id);
      setProjects((prev) => prev.filter(p => p.id !== id));
      if (project) {
        setArchivedProjects((prev) => [...prev, { ...project, isArchived: true }]);
      }
      // If we archived the current project, clear selection
      if (id === currentProjectId) {
        const remaining = projects.find(p => p.id !== id);
        onSelectProject(remaining ?? null);
      }
    } catch (err) {
      console.error('Failed to archive project:', err);
    }
  };

  const handleUnarchiveProject = async (id: string) => {
    try {
      await api.unarchiveProject(id);
      // Move from archived to active
      const project = archivedProjects.find(p => p.id === id);
      setArchivedProjects((prev) => prev.filter(p => p.id !== id));
      if (project) {
        setProjects((prev) => [...prev, { ...project, isArchived: false }]);
      }
    } catch (err) {
      console.error('Failed to unarchive project:', err);
    }
  };

  const handleDeleteProject = async (id: string) => {
    try {
      await api.deleteProject(id);
      setProjects((prev) => prev.filter(p => p.id !== id));
      setArchivedProjects((prev) => prev.filter(p => p.id !== id));
      setConfirmDeleteId(null);
      if (id === currentProjectId) {
        // Parent component will handle null selection
        const remaining = projects.find(p => p.id !== id);
        onSelectProject(remaining ?? null);
      }
    } catch (err) {
      console.error('Failed to delete project:', err);
    }
  };

  const currentProject = projects.find(p => p.id === currentProjectId)
    ?? archivedProjects.find(p => p.id === currentProjectId);
  const canCreateProjects = session?.memberType === 'user';
  const canManageProjects = session?.memberType === 'user';

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
          <div className="fixed inset-0 z-40" onClick={() => { setOpen(false); setConfirmDeleteId(null); }} />
          <div className="absolute top-full left-0 mt-2 w-72 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl z-50 max-h-96 overflow-y-auto">
            <div className="p-2">
              {loading && (
                <div className="px-3 py-2 text-sm text-gray-400">Loading...</div>
              )}
              {!loading && projects.length === 0 && (
                <div className="px-3 py-2 text-sm text-gray-400 dark:text-gray-500">No projects yet</div>
              )}
              {projects.map((project) => (
                <div key={project.id} className="flex items-center group">
                  <button
                    onClick={() => {
                      onSelectProject(project);
                      setOpen(false);
                    }}
                    className={`flex-1 text-left px-3 py-2 rounded-md text-sm transition-colors ${
                      project.id === currentProjectId
                        ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium'
                        : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    {project.name}
                  </button>
                  {canManageProjects && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleArchiveProject(project.id); }}
                      className="px-2 py-1 mr-1 text-gray-300 dark:text-gray-600 hover:text-amber-500 dark:hover:text-amber-400 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Archive project"
                    >
                      📦
                    </button>
                  )}
                </div>
              ))}

              {/* Archived projects section */}
              {archivedProjects.length > 0 && (
                <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                  <button
                    onClick={() => setShowArchived(!showArchived)}
                    className="w-full text-left px-3 py-1.5 text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 font-medium flex items-center gap-1"
                  >
                    <span>{showArchived ? '▼' : '▶'}</span>
                    Archived ({archivedProjects.length})
                  </button>
                  {showArchived && (
                    <div className="mt-1">
                      {archivedProjects.map((project) => (
                        <div key={project.id} className="flex items-center group">
                          <button
                            onClick={() => {
                              onSelectProject(project);
                              setOpen(false);
                            }}
                            className="flex-1 text-left px-3 py-2 rounded-md text-sm text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 italic"
                          >
                            {project.name}
                          </button>
                          <div className="flex items-center mr-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={(e) => { e.stopPropagation(); handleUnarchiveProject(project.id); }}
                              className="px-2 py-1 text-gray-300 dark:text-gray-600 hover:text-green-500 dark:hover:text-green-400"
                              title="Restore project"
                            >
                              ↩️
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(project.id); }}
                              className="px-2 py-1 text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400"
                              title="Delete project"
                            >
                              🗑️
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Delete confirmation */}
              {confirmDeleteId && (
                <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700 px-2 py-2 bg-red-50 dark:bg-red-900/20 rounded-md">
                  <p className="text-xs text-red-600 dark:text-red-400 mb-2">
                    Delete this project permanently? All boards, releases, sprints, and tasks will be lost.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleDeleteProject(confirmDeleteId)}
                      className="flex-1 px-3 py-1.5 bg-red-600 text-white rounded-md text-xs font-medium hover:bg-red-700"
                    >
                      Delete
                    </button>
                    <button
                      onClick={() => setConfirmDeleteId(null)}
                      className="flex-1 px-3 py-1.5 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-md text-xs font-medium hover:bg-gray-300 dark:hover:bg-gray-500"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

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
                  {/* Import — pick an export JSON file and create a new project from it. */}
                  {onImportProject && currentProjectId ? (
                    <>
                      <input
                        ref={importFileRef}
                        type="file"
                        accept="application/json,.json"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            onImportProject(file);
                            setOpen(false);
                          }
                          // Reset so the same file can be picked again later.
                          e.target.value = '';
                        }}
                      />
                      <button
                        onClick={() => importFileRef.current?.click()}
                        className="w-full text-left px-3 py-2 rounded-md text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 font-medium"
                        title="Import a project from an exported JSON file"
                      >
                        ⬆ Import Project
                      </button>
                    </>
                  ) : null}
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