/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Award,
  Briefcase,
  CheckCircle2,
  Copy,
  Database,
  Download,
  FileCode,
  FolderGit2,
  FolderOpen,
  Layers,
  LayoutTemplate,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  Upload,
  UserPlus,
  Users,
  Wand2,
  X,
  LogOut,
  Compass,
} from 'lucide-react';
import {
  CandidateProfile,
  LatexTemplate,
  ProjectDomain,
  ProjectItem,
  ResumeVersion,
  SkillItem,
  SkillStageConfig,
} from './types/resume';
import { WorkspaceView } from './components/WorkspaceView';
import {
  ProjectsManagerView,
  SkillsAndCalibrationView,
  TemplatesAndTestsView,
} from './components/CataloguesAndTemplatesView';
import { AuthScreen, OnboardingWizard } from './components/AuthAndOnboarding';

type ActiveScreen = 'workspace' | 'dashboard' | 'projects' | 'skills' | 'templates';

interface UserSummary {
  userId: string;
  fullName: string;
  email: string;
  targetRole: string;
  projectCount: number;
  resumeCount: number;
}

interface DatabaseStatusInfo {
  provider: string;
  supabaseConfigured: boolean;
  lastSyncedAt?: string;
  lastSyncError?: string | null;
  activeUsers: string[];
  migrationFile: string;
  envInstructions: string[];
}

export default function App() {
  const [authSessionToken, setAuthSessionToken] = useState<string | null>(() => {
    try {
      return localStorage.getItem('lf_session_token');
    } catch {
      return null;
    }
  });
  const [activeUserId, setActiveUserId] = useState<string>(() => {
    try {
      return localStorage.getItem('lf_active_user_id') || 'user-owner-1';
    } catch {
      return 'user-owner-1';
    }
  });
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    try {
      return Boolean(localStorage.getItem('lf_session_token'));
    } catch {
      return false;
    }
  });
  const [showOnboardingWizard, setShowOnboardingWizard] = useState<boolean>(false);

  const [usersList, setUsersList] = useState<UserSummary[]>([]);
  const [dbStatus, setDbStatus] = useState<DatabaseStatusInfo | null>(null);

  const [activeScreen, setActiveScreen] = useState<ActiveScreen>('workspace');
  const [loading, setLoading] = useState(true);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [isHeaderSyncing, setIsHeaderSyncing] = useState(false);

  // Modals
  const [showQuickImportModal, setShowQuickImportModal] = useState(false);
  const [importTab, setImportTab] = useState<'project' | 'template'>('project');
  const [showSupabaseModal, setShowSupabaseModal] = useState(false);
  const [showNewUserModal, setShowNewUserModal] = useState(false);

  // New Candidate Modal State
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserRole, setNewUserRole] = useState('');

  // Quick Import Modal State
  const [quickProjTitle, setQuickProjTitle] = useState('');
  const [quickProjDomain, setQuickProjDomain] = useState<ProjectDomain>('software');
  const [quickProjTech, setQuickProjTech] = useState('');
  const [quickProjBullets, setQuickProjBullets] = useState('');
  const [quickProjGithub, setQuickProjGithub] = useState('');
  const [quickTemplateLatex, setQuickTemplateLatex] = useState('');
  const [importSuccessMsg, setImportSuccessMsg] = useState('');

  const [profile, setProfile] = useState<CandidateProfile | null>(null);
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [skills, setSkills] = useState<SkillItem[]>([]);
  const [skillStageConfig, setSkillStageConfig] = useState<SkillStageConfig | null>(null);
  const [templates, setTemplates] = useState<LatexTemplate[]>([]);
  const [resumes, setResumes] = useState<ResumeVersion[]>([]);
  const [activeResumeId, setActiveResumeId] = useState<string | null>(null);

  const apiFetch = async (url: string, options: RequestInit = {}, overrideUserId?: string) => {
    const targetUser = overrideUserId || activeUserId;
    const headers = new Headers(options.headers || {});
    headers.set('x-user-id', targetUser);
    if (authSessionToken && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${authSessionToken}`);
    }
    if (options.body && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
    return fetch(url, {
      ...options,
      headers,
    });
  };

  const handleSignOut = async () => {
    try {
      if (authSessionToken) {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${authSessionToken}` },
        });
      }
    } catch {
      // ignore network error on logout
    }
    try {
      localStorage.removeItem('lf_session_token');
    } catch {
      // ignore storage error
    }
    setAuthSessionToken(null);
    setIsAuthenticated(false);
    setShowOnboardingWizard(false);
  };

  const fetchUsersAndDbStatus = async () => {
    try {
      const [uResp, dbResp] = await Promise.all([
        fetch('/api/users'),
        fetch('/api/database/status'),
      ]);
      if (uResp.ok) {
        const uData = await uResp.json();
        setUsersList(uData.users || []);
      }
      if (dbResp.ok) {
        const dData = await dbResp.json();
        setDbStatus(dData);
      }
    } catch {
      // ignore background status errors
    }
  };

  const fetchStateForUser = async (targetUserId: string) => {
    setLoading(true);
    setErrorBanner(null);
    try {
      const resp = await apiFetch(
        `/api/state?userId=${encodeURIComponent(targetUserId)}`,
        {},
        targetUserId
      );
      if (!resp.ok) throw new Error('Failed to load workspace state');
      const data = await resp.json();
      setProfile(data.profile);
      setProjects(data.projects);
      setSkills(data.skills);
      setSkillStageConfig(data.skillStageConfig);
      setTemplates(data.templates);
      setResumes(data.resumes);
      if (data.templates?.[0]?.latexSource) {
        setQuickTemplateLatex(data.templates[0].latexSource);
      }
      if (data.resumes && data.resumes.length > 0) {
        setActiveResumeId(data.resumes[0].id);
      } else {
        setActiveResumeId(null);
      }
      await fetchUsersAndDbStatus();
    } catch (err: any) {
      setErrorBanner(err?.message || 'Error connecting to server');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStateForUser(activeUserId);
  }, [activeUserId]);

  const activeResume = resumes.find((r) => r.id === activeResumeId) || resumes[0] || null;
  const userQuery = `?userId=${encodeURIComponent(activeUserId)}`;

  const updateResumeInList = (updated: ResumeVersion) => {
    setResumes((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
  };

  const handleCreateNewResumeVersion = async (parentVersionId?: string) => {
    try {
      setErrorBanner(null);
      const resp = await apiFetch('/api/resumes', {
        method: 'POST',
        body: JSON.stringify({
          parentVersionId,
          company: parentVersionId ? undefined : 'Anthropic',
          role: parentVersionId ? undefined : 'Systems & ML Infrastructure Engineer',
          jobDescription: parentVersionId
            ? undefined
            : 'Seeking a Systems & ML Infrastructure Engineer with strong Python, Rust, Go, and SQL experience to build reliable data pipelines, distributed services, and telemetry dashboards.',
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Failed to create resume version');
      setResumes(data.resumes);
      setActiveResumeId(data.resume.id);
      setActiveScreen('workspace');
      fetchUsersAndDbStatus();
    } catch (err: any) {
      setErrorBanner(err?.message);
    }
  };

  const handleDeleteResumeVersion = async (id: string) => {
    try {
      const resp = await apiFetch(`/api/resumes/${id}`, { method: 'DELETE' });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Failed to delete resume');
      setResumes(data.resumes);
      if (activeResumeId === id && data.resumes.length > 0) {
        setActiveResumeId(data.resumes[0].id);
      }
      fetchUsersAndDbStatus();
    } catch (err: any) {
      setErrorBanner(err?.message);
    }
  };

  const handleCreateProject = async (proj: Partial<ProjectItem>) => {
    const resp = await apiFetch('/api/projects', {
      method: 'POST',
      body: JSON.stringify(proj),
    });
    const data = await resp.json();
    if (resp.ok) {
      setProjects(data.projects);
      fetchUsersAndDbStatus();
    }
  };

  const handleUpdateProfile = async (prof: Partial<CandidateProfile>) => {
    const resp = await apiFetch('/api/profile', {
      method: 'PUT',
      body: JSON.stringify(prof),
    });
    const data = await resp.json();
    if (resp.ok) {
      setProfile(data.profile);
      fetchUsersAndDbStatus();
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName.trim()) return;
    try {
      const resp = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: newUserName.trim(),
          email: newUserEmail.trim() || `${newUserName.trim().toLowerCase().replace(/\s+/g, '.')}@example.com`,
          targetRole: newUserRole.trim() || 'Senior Software & Systems Engineer',
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Failed to create candidate profile');
      setUsersList(data.users || []);
      setNewUserName('');
      setNewUserEmail('');
      setNewUserRole('');
      setShowNewUserModal(false);
      try {
        localStorage.setItem('lf_active_user_id', data.userId);
      } catch {
        // ignore
      }
      setActiveUserId(data.userId);
      setShowOnboardingWizard(true);
    } catch (err: any) {
      setErrorBanner(err?.message);
    }
  };

  if (!isAuthenticated) {
    return (
      <AuthScreen
        onLoginSuccess={async ({ token, userId, onboardingCompleted }) => {
          try {
            localStorage.setItem('lf_session_token', token);
            localStorage.setItem('lf_active_user_id', userId);
          } catch {
            // ignore
          }
          setAuthSessionToken(token);
          setActiveUserId(userId);
          setIsAuthenticated(true);
          setShowOnboardingWizard(!onboardingCompleted);
          await fetchStateForUser(userId);
        }}
        onStartFreshOnboarding={async () => {
          const resp = await fetch('/api/auth/demo-login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: 'user-owner-1' }),
          });
          const data = await resp.json();
          if (resp.ok) {
            try {
              localStorage.setItem('lf_session_token', data.token);
              localStorage.setItem('lf_active_user_id', data.userId);
            } catch {
              // ignore
            }
            setAuthSessionToken(data.token);
            setActiveUserId(data.userId);
            setIsAuthenticated(true);
            setShowOnboardingWizard(true);
            await fetchStateForUser(data.userId);
          }
        }}
      />
    );
  }

  if (loading || !profile || !skillStageConfig || templates.length === 0) {
    return (
      <div className="min-h-screen bg-[#F6F4EE] flex items-center justify-center p-6">
        <div className="atelier-card rounded-2xl px-6 py-5 flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-teal-700 animate-ping" />
          <div className="text-sm text-stone-800 font-semibold font-editorial">
            Loading LaTeXForge Resume Atelier...
          </div>
        </div>
      </div>
    );
  }

  if (showOnboardingWizard) {
    return (
      <OnboardingWizard
        profile={profile}
        stageConfig={skillStageConfig}
        onSkipOnboarding={() => setShowOnboardingWizard(false)}
        onCompleteOnboarding={async (payload) => {
          const resp = await apiFetch('/api/onboarding/complete', {
            method: 'POST',
            body: JSON.stringify(payload),
          });
          const data = await resp.json();
          if (!resp.ok) {
            throw new Error(data.error || 'Failed to complete onboarding');
          }
          if (data.profile) setProfile(data.profile);
          if (data.projects) setProjects(data.projects);
          if (data.skills) setSkills(data.skills);
          if (data.resumes) {
            setResumes(data.resumes);
            if (data.resumes.length > 0) {
              setActiveResumeId(data.resumes[0].id);
            }
          }
          if (data.users) setUsersList(data.users);
          setShowOnboardingWizard(false);
          setActiveScreen('workspace');
        }}
      />
    );
  }

  const navItems: {
    id: ActiveScreen;
    label: string;
    subtitle: string;
    count?: number;
    icon: React.ReactNode;
  }[] = [
    {
      id: 'workspace',
      label: 'Resume Atelier',
      subtitle: 'Guided 4-Step Builder',
      icon: <Wand2 className="w-4 h-4" />,
    },
    {
      id: 'dashboard',
      label: 'Application Vault',
      subtitle: 'Saved Job Versions',
      count: resumes.length,
      icon: <Briefcase className="w-4 h-4" />,
    },
    {
      id: 'projects',
      label: 'Project Catalogue',
      subtitle: 'Verified Work & Facts',
      count: projects.length,
      icon: <FolderGit2 className="w-4 h-4" />,
    },
    {
      id: 'skills',
      label: 'Profile & 4-Stage Skills',
      subtitle: 'Calibration & Experience',
      count: skills.filter((s) => s.stage !== 4).length,
      icon: <Award className="w-4 h-4" />,
    },
    {
      id: 'templates',
      label: 'LaTeX & Diagnostics',
      subtitle: 'Template & E2E Tests',
      icon: <LayoutTemplate className="w-4 h-4" />,
    },
  ];

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-[#F6F4EE] text-stone-900 overflow-x-hidden">
      {/* =====================================================================
          LEFT EDITORIAL NAVIGATION RAIL (DEEP FOREST-OBSIDIAN THEME)
         ===================================================================== */}
      <aside className="w-full lg:w-68 xl:w-72 bg-[#111716] text-stone-100 shrink-0 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-stone-800 lg:sticky lg:top-0 lg:h-screen z-30">
        <div className="p-4 sm:p-5 space-y-5">
          {/* Brand Wordmark & New Resume Action */}
          <div className="flex items-center justify-between gap-2">
            <a
              href="#workspace"
              onClick={(e) => {
                e.preventDefault();
                setActiveScreen('workspace');
              }}
              className="flex items-center gap-2.5 group"
            >
              <div className="w-8 h-8 rounded-xl bg-teal-600/20 border border-teal-500/40 flex items-center justify-center text-teal-300 font-editorial font-bold text-base">
                L
              </div>
              <div>
                <div className="text-base font-bold font-editorial tracking-tight text-white">
                  LaTeXForge
                </div>
                <div className="text-[10px] uppercase tracking-widest text-teal-400 font-semibold">
                  1-Page Resume Atelier
                </div>
              </div>
            </a>

            <button
              type="button"
              onClick={() => handleCreateNewResumeVersion(activeResume?.id)}
              className="px-3 py-1.5 text-xs font-semibold text-stone-950 bg-teal-400 hover:bg-teal-300 rounded-xl transition-colors inline-flex items-center gap-1 shadow-xs cursor-pointer"
              title="Create a new tailored resume version"
            >
              <Plus className="w-3.5 h-3.5" />
              New
            </button>
          </div>

          {/* Multi-User Candidate Switcher (Real User 1 & User 2 + Add Candidate) */}
          <div className="p-3 rounded-xl bg-[#1A2220] border border-stone-800 space-y-2">
            <div className="flex items-center justify-between text-[11px] text-stone-400">
              <span className="font-semibold uppercase tracking-wider flex items-center gap-1.5 text-stone-300">
                <Users className="w-3.5 h-3.5 text-teal-400" />
                Active Candidate
              </span>
              <button
                type="button"
                onClick={() => setShowNewUserModal(true)}
                className="text-teal-400 hover:text-teal-300 font-semibold inline-flex items-center gap-1 cursor-pointer"
              >
                <UserPlus className="w-3 h-3" />
                + Add User
              </button>
            </div>

            <select
              aria-label="Switch Active Candidate User"
              value={activeUserId}
              onChange={(e) => {
                const nextId = e.target.value;
                try {
                  localStorage.setItem('lf_active_user_id', nextId);
                } catch {
                  // ignore
                }
                setActiveUserId(nextId);
                setActiveScreen('workspace');
              }}
              className="w-full px-2.5 py-2 bg-[#111716] border border-stone-700 rounded-lg text-xs font-semibold text-white focus:outline-none focus:border-teal-400 cursor-pointer"
            >
              {usersList.map((u) => (
                <option key={u.userId} value={u.userId}>
                  {u.fullName} ({u.projectCount} Proj · {u.resumeCount} CV)
                </option>
              ))}
            </select>

            <div className="flex items-center justify-between gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowOnboardingWizard(true)}
                className="text-[11px] font-semibold text-amber-300 hover:text-amber-200 inline-flex items-center gap-1 cursor-pointer"
                title="Launch 4-Step Candidate Onboarding Wizard"
              >
                <Compass className="w-3 h-3" />
                Onboarding Wizard
              </button>
              <button
                type="button"
                onClick={handleSignOut}
                className="text-[11px] font-semibold text-stone-400 hover:text-rose-300 inline-flex items-center gap-1 cursor-pointer"
                title="Sign out or switch account"
              >
                <LogOut className="w-3 h-3" />
                Sign Out
              </button>
            </div>
          </div>

          {/* Primary Navigation Links */}
          <nav
            aria-label="Main Navigation"
            className="flex lg:flex-col gap-1.5 overflow-x-auto no-scrollbar pb-1 lg:pb-0"
          >
            {navItems.map((item) => {
              const isActive = activeScreen === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveScreen(item.id)}
                  className={`flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl text-left transition-all whitespace-nowrap lg:whitespace-normal shrink-0 cursor-pointer ${
                    isActive
                      ? 'bg-teal-700 text-white shadow-xs'
                      : 'text-stone-300 hover:bg-[#1A2220] hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={isActive ? 'text-amber-200' : 'text-stone-400'}>
                      {item.icon}
                    </span>
                    <div className="min-w-0">
                      <div className="text-xs font-bold leading-tight">{item.label}</div>
                      <div
                        className={`text-[10px] hidden lg:block truncate mt-0.5 ${
                          isActive ? 'text-teal-100' : 'text-stone-400'
                        }`}
                      >
                        {item.subtitle}
                      </div>
                    </div>
                  </div>
                  {item.count !== undefined && (
                    <span
                      className={`text-[11px] font-mono font-semibold px-2 py-0.5 rounded-md tabular-nums ${
                        isActive
                          ? 'bg-teal-900/70 text-teal-100'
                          : 'bg-stone-800 text-stone-300'
                      }`}
                    >
                      {item.count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom Rail Controls: Quick Import & Supabase Database Status */}
        <div className="hidden lg:flex flex-col gap-2.5 p-4 border-t border-stone-800/90 bg-[#0D1211]">
          <button
            type="button"
            onClick={() => {
              setImportSuccessMsg('');
              setShowQuickImportModal(true);
            }}
            className="w-full px-3 py-2 bg-[#1A2220] hover:bg-stone-800 text-stone-200 border border-stone-700/80 rounded-xl text-xs font-semibold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5 text-teal-400" />
            Import Project / .tex Format
          </button>

          <button
            type="button"
            onClick={() => setShowSupabaseModal(true)}
            className="w-full px-3 py-2 rounded-xl bg-[#141C1A] hover:bg-[#1A2422] border border-stone-800 flex items-center justify-between gap-2 text-left transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2 min-w-0">
              <Database
                className={`w-3.5 h-3.5 shrink-0 ${
                  dbStatus?.supabaseConfigured ? 'text-emerald-400' : 'text-amber-400'
                }`}
              />
              <div className="min-w-0">
                <div className="text-[11px] font-semibold text-stone-200 truncate">
                  {dbStatus?.supabaseConfigured
                    ? 'Supabase Cloud Active'
                    : 'Supabase Ready (.env)'}
                </div>
                <div className="text-[10px] text-stone-400 truncate">
                  Click for SQL &amp; .env config
                </div>
              </div>
            </div>
            <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
          </button>
        </div>
      </aside>

      {/* =====================================================================
          RIGHT MAIN ATELIER WORKSPACE CONTAINER
         ===================================================================== */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Sleek Context Sub-Header Bar with Live Compilation Progress Indicator */}
        <header className="bg-[#FAF8F5] border-b border-[#E5E0D5] sticky top-0 z-20 min-w-0">
          <div className="px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs min-w-0">
            <div className="flex flex-wrap items-center gap-2.5 min-w-0 flex-1">
              <span className="font-semibold text-stone-600 shrink-0 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-teal-700" />
                Active Application:
              </span>
              <select
                value={activeResume?.id || ''}
                onChange={(e) => {
                  setActiveResumeId(e.target.value);
                  setActiveScreen('workspace');
                }}
                aria-label="Select Active Resume Version"
                className="px-3 py-1.5 bg-white border border-stone-300 rounded-xl font-semibold text-stone-900 focus:outline-none focus:border-teal-700 max-w-xs sm:max-w-md truncate cursor-pointer"
              >
                {resumes.map((r) => (
                  <option key={r.id} value={r.id}>
                    v{r.versionNumber} — {r.company} ({r.role})
                  </option>
                ))}
              </select>

              {isHeaderSyncing && (
                <span
                  role="status"
                  aria-live="polite"
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-teal-50 border border-teal-300 text-teal-900 font-semibold shadow-2xs"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-teal-700 animate-spin shrink-0" />
                  <span>Syncing LaTeX to PDF...</span>
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              <span className="text-stone-600 hidden xl:inline">
                Candidate: <strong className="text-stone-900">{profile.fullName}</strong> ·{' '}
                {projects.length} Verified Projects ·{' '}
                {skills.filter((s) => s.stage !== 4).length} Active Skills
              </span>

              <button
                type="button"
                onClick={() => {
                  setImportSuccessMsg('');
                  setShowQuickImportModal(true);
                }}
                className="lg:hidden px-3 py-1.5 bg-white hover:bg-stone-50 text-stone-800 border border-stone-300 rounded-xl font-semibold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5 text-teal-700" />
                Quick Import
              </button>

              <button
                type="button"
                onClick={() => setShowOnboardingWizard(true)}
                className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100/80 text-amber-950 border border-amber-300 rounded-xl font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                title="Run 4-Step Candidate Onboarding Wizard"
              >
                <Compass className="w-3.5 h-3.5 text-amber-700" />
                <span className="hidden sm:inline">Onboarding</span>
              </button>

              <button
                type="button"
                onClick={() => setShowSupabaseModal(true)}
                className="px-3 py-1.5 bg-white hover:bg-teal-50/50 text-stone-700 border border-stone-300 rounded-xl font-semibold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Database className="w-3.5 h-3.5 text-teal-700" />
                <span className="hidden sm:inline">Supabase DB</span>
              </button>

              <button
                type="button"
                onClick={handleSignOut}
                className="px-2.5 py-1.5 bg-white hover:bg-rose-50 text-stone-600 hover:text-rose-800 border border-stone-300 rounded-xl font-semibold inline-flex items-center gap-1 cursor-pointer"
                title="Sign Out"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Sign Out</span>
              </button>
            </div>
          </div>

          {isHeaderSyncing && (
            <div className="h-1 w-full bg-teal-100 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-teal-600 via-emerald-500 to-teal-700 atelier-progress-bar" />
            </div>
          )}
        </header>

        {errorBanner && (
          <div className="max-w-[1440px] w-full mx-auto px-4 sm:px-6 pt-4">
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900 flex items-center justify-between gap-3">
              <span>{errorBanner}</span>
              <button
                type="button"
                onClick={() => setErrorBanner(null)}
                className="text-rose-700 font-semibold shrink-0 cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* Main View Area */}
        <main className="flex-1 max-w-[1440px] w-full mx-auto px-4 sm:px-6 py-5 min-w-0">
          {activeScreen === 'dashboard' && (
            <div className="space-y-6 min-w-0">
              <div className="atelier-card rounded-2xl p-5 sm:p-6 flex flex-wrap items-center justify-between gap-4">
                <div className="min-w-0">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-teal-800">
                    Candidate Application Vault · {profile.fullName}
                  </span>
                  <h1 className="text-lg sm:text-xl font-bold font-editorial text-stone-950 mt-0.5">
                    Saved Tailored Resumes ({resumes.length})
                  </h1>
                  <p className="text-xs text-stone-600 mt-1">
                    Every version preserves your exact project selections, pinned locks, tailored bullets, and 1-page PDF.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleCreateNewResumeVersion()}
                  className="px-4 py-2.5 bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 shadow-xs cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  Tailor for a New Job
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {resumes.map((r) => {
                  const isValidPdf = Boolean(
                    r.compilationResult?.isOnePageValid && !r.isPdfStale
                  );
                  return (
                    <div
                      key={r.id}
                      className="atelier-card rounded-2xl p-5 flex flex-col justify-between gap-4 min-w-0"
                    >
                      <div className="space-y-2 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <span className="text-xs font-mono font-bold text-teal-700 tabular-nums">
                              Version v{r.versionNumber}
                            </span>
                            <h2 className="text-base font-bold font-editorial text-stone-950 truncate mt-0.5">
                              {r.company} — {r.role}
                            </h2>
                          </div>
                          <div className="shrink-0">
                            {isValidPdf ? (
                              <span className="inline-flex items-center gap-1 text-xs font-semibold text-teal-900 bg-teal-50 border border-teal-200 px-2.5 py-1 rounded-lg">
                                <CheckCircle2 className="w-3.5 h-3.5 text-teal-700" />
                                1-Page Ready
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg">
                                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                                Ready to Sync
                              </span>
                            )}
                          </div>
                        </div>

                        <p className="text-xs text-stone-500">
                          {r.selectedProjectIds.length} Projects Included ·{' '}
                          {r.manuallyLockedProjectIds.length} Pinned · Updated{' '}
                          {new Date(r.updatedAt).toLocaleDateString()}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-stone-100">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setActiveResumeId(r.id);
                              setActiveScreen('workspace');
                            }}
                            className="px-3.5 py-1.5 bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 cursor-pointer"
                          >
                            <FolderOpen className="w-3.5 h-3.5 text-teal-400" />
                            Open in Atelier
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCreateNewResumeVersion(r.id)}
                            className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-medium rounded-xl inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Copy className="w-3.5 h-3.5" />
                            Duplicate
                          </button>
                        </div>

                        <div className="flex items-center gap-1.5">
                          {isValidPdf && (
                            <a
                              href={`/api/resumes/${r.id}/download/pdf${userQuery}`}
                              download
                              className="px-3 py-1.5 bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold rounded-xl inline-flex items-center gap-1"
                            >
                              <Download className="w-3.5 h-3.5" />
                              PDF
                            </a>
                          )}
                          <a
                            href={`/api/resumes/${r.id}/download/tex${userQuery}`}
                            download
                            className="px-2.5 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-medium rounded-xl inline-flex items-center gap-1"
                          >
                            <FileCode className="w-3.5 h-3.5" />
                            .tex
                          </a>
                          {resumes.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleDeleteResumeVersion(r.id)}
                              title="Delete Version"
                              className="p-1.5 text-stone-400 hover:text-rose-600 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeScreen === 'workspace' && activeResume && (
            <WorkspaceView
              resume={activeResume}
              profile={profile}
              projects={projects}
              skills={skills}
              stageConfig={skillStageConfig}
              onAnalyzeJd={async (payload) => {
                const resp = await apiFetch(`/api/resumes/${activeResume.id}/analyze`, {
                  method: 'POST',
                  body: JSON.stringify(payload),
                });
                const data = await resp.json();
                if (!resp.ok) throw new Error(data.error);
                updateResumeInList(data.resume);
              }}
              onUpdateSelection={async (payload) => {
                const resp = await apiFetch(`/api/resumes/${activeResume.id}/selection`, {
                  method: 'PUT',
                  body: JSON.stringify(payload),
                });
                const data = await resp.json();
                if (!resp.ok) throw new Error(data.error);
                updateResumeInList(data.resume);
              }}
              onTailorBullets={async (projectId) => {
                const resp = await apiFetch(`/api/resumes/${activeResume.id}/tailor-bullets`, {
                  method: 'POST',
                  body: JSON.stringify({ projectId }),
                });
                const data = await resp.json();
                if (!resp.ok) throw new Error(data.error);
                updateResumeInList(data.resume);
              }}
              onUpdateProjectBullets={async (projectId, bullets) => {
                const resp = await apiFetch(`/api/resumes/${activeResume.id}/bullets`, {
                  method: 'PUT',
                  body: JSON.stringify({ projectId, bullets }),
                });
                const data = await resp.json();
                if (!resp.ok) throw new Error(data.error);
                updateResumeInList(data.resume);
              }}
              onRenderLatex={async (forceOverwriteEditor) => {
                setIsHeaderSyncing(true);
                try {
                  const resp = await apiFetch(`/api/resumes/${activeResume.id}/render-latex`, {
                    method: 'POST',
                    body: JSON.stringify({ forceOverwriteEditor }),
                  });
                  const data = await resp.json();
                  if (!resp.ok) throw new Error(data.error);
                  updateResumeInList(data.resume);
                } finally {
                  setIsHeaderSyncing(false);
                }
              }}
              onSaveLatexSource={async (latexSource) => {
                setIsHeaderSyncing(true);
                try {
                  const resp = await apiFetch(`/api/resumes/${activeResume.id}/save-latex`, {
                    method: 'PUT',
                    body: JSON.stringify({ latexSource }),
                  });
                  const data = await resp.json();
                  if (!resp.ok) throw new Error(data.error);
                  updateResumeInList(data.resume);
                } finally {
                  setIsHeaderSyncing(false);
                }
              }}
              onCompileSavedSource={async () => {
                setIsHeaderSyncing(true);
                try {
                  const resp = await apiFetch(`/api/resumes/${activeResume.id}/compile`, {
                    method: 'POST',
                    body: JSON.stringify({ expectedSourceHash: activeResume.savedSourceHash }),
                  });
                  const data = await resp.json();
                  if (!resp.ok) throw new Error(data.error);
                  updateResumeInList(data.resume);
                } finally {
                  setIsHeaderSyncing(false);
                }
              }}
              onCreateOptimizedDraft={async () => {
                setIsHeaderSyncing(true);
                try {
                  const resp = await apiFetch(`/api/resumes/${activeResume.id}/optimize-page-fit`, {
                    method: 'POST',
                  });
                  const data = await resp.json();
                  if (!resp.ok) throw new Error(data.error);
                  setResumes(data.resumes);
                  setActiveResumeId(data.optimizedResume.id);
                } finally {
                  setIsHeaderSyncing(false);
                }
              }}
              onRunExaminer={async (payload) => {
                const resp = await apiFetch(`/api/resumes/${activeResume.id}/examiner`, {
                  method: 'POST',
                  body: JSON.stringify(payload),
                });
                const data = await resp.json();
                if (!resp.ok) throw new Error(data.error);
                updateResumeInList(data.resume);
              }}
              onUpdateProfile={handleUpdateProfile}
              onCreateProject={handleCreateProject}
            />
          )}

          {activeScreen === 'projects' && (
            <ProjectsManagerView
              projects={projects}
              onCreateProject={handleCreateProject}
              onUpdateProject={async (id, proj) => {
                const resp = await apiFetch(`/api/projects/${id}`, {
                  method: 'PUT',
                  body: JSON.stringify(proj),
                });
                const data = await resp.json();
                if (resp.ok) setProjects(data.projects);
              }}
              onDeleteProject={async (id) => {
                const resp = await apiFetch(`/api/projects/${id}`, { method: 'DELETE' });
                const data = await resp.json();
                if (resp.ok) {
                  setProjects(data.projects);
                  if (data.resumes) setResumes(data.resumes);
                  fetchUsersAndDbStatus();
                }
              }}
            />
          )}

          {activeScreen === 'skills' && (
            <SkillsAndCalibrationView
              skills={skills}
              stageConfig={skillStageConfig}
              profile={profile}
              onAddSkill={async (payload) => {
                const resp = await apiFetch('/api/skills', {
                  method: 'POST',
                  body: JSON.stringify(payload),
                });
                const data = await resp.json();
                if (resp.ok) setSkills(data.skills);
              }}
              onUpdateSkill={async (id, payload) => {
                const resp = await apiFetch(`/api/skills/${id}`, {
                  method: 'PUT',
                  body: JSON.stringify(payload),
                });
                const data = await resp.json();
                if (resp.ok) setSkills(data.skills);
              }}
              onDeleteSkill={async (id) => {
                const resp = await apiFetch(`/api/skills/${id}`, { method: 'DELETE' });
                const data = await resp.json();
                if (resp.ok) setSkills(data.skills);
              }}
              onUpdateStageConfig={async (cfg) => {
                const resp = await apiFetch('/api/skills-config', {
                  method: 'PUT',
                  body: JSON.stringify(cfg),
                });
                const data = await resp.json();
                if (resp.ok) setSkillStageConfig(data.skillStageConfig);
              }}
              onUpdateProfile={handleUpdateProfile}
            />
          )}

          {activeScreen === 'templates' && (
            <TemplatesAndTestsView
              template={templates[0]}
              onSaveTemplateVersion={async (payload) => {
                const resp = await apiFetch(`/api/templates/${templates[0].id}`, {
                  method: 'PUT',
                  body: JSON.stringify(payload),
                });
                const data = await resp.json();
                if (resp.ok) setTemplates([data.template]);
              }}
              onRestoreTemplateVersion={async (version) => {
                const resp = await apiFetch(`/api/templates/${templates[0].id}/restore`, {
                  method: 'POST',
                  body: JSON.stringify({ version }),
                });
                const data = await resp.json();
                if (resp.ok) setTemplates([data.template]);
              }}
              onRunTests={async () => {
                const resp = await apiFetch('/api/tests/run', { method: 'POST' });
                return await resp.json();
              }}
            />
          )}
        </main>
      </div>

      {/* =====================================================================
          MODAL 1: CREATE NEW CANDIDATE USER WORKSPACE
         ===================================================================== */}
      {showNewUserModal && (
        <div className="fixed inset-0 z-50 bg-stone-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="atelier-card rounded-2xl max-w-md w-full p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-stone-200 pb-3">
              <div>
                <h2 className="text-base font-bold font-editorial text-stone-950 flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-teal-700" />
                  <span>Create New Candidate Workspace</span>
                </h2>
                <p className="text-xs text-stone-500 mt-0.5">
                  Each candidate has a strictly isolated project library, skill inventory, and resume vault.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowNewUserModal(false)}
                className="p-1.5 text-stone-400 hover:text-stone-700 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-stone-700 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  placeholder="e.g., Marcus Vance"
                  className="w-full px-3 py-2 border border-stone-300 rounded-xl"
                />
              </div>
              <div>
                <label className="block font-semibold text-stone-700 mb-1">Email Address</label>
                <input
                  type="email"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  placeholder="marcus.vance@stanford.edu"
                  className="w-full px-3 py-2 border border-stone-300 rounded-xl"
                />
              </div>
              <div>
                <label className="block font-semibold text-stone-700 mb-1">Target Role</label>
                <input
                  type="text"
                  value={newUserRole}
                  onChange={(e) => setNewUserRole(e.target.value)}
                  placeholder="e.g., Staff Robotics & Controls Engineer"
                  className="w-full px-3 py-2 border border-stone-300 rounded-xl"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewUserModal(false)}
                  className="px-4 py-2 bg-stone-100 text-stone-700 font-semibold rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white font-semibold rounded-xl cursor-pointer"
                >
                  Create &amp; Switch User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 2: SUPABASE DATABASE CONNECTION & .ENV SETUP
         ===================================================================== */}
      {showSupabaseModal && (
        <div className="fixed inset-0 z-50 bg-stone-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="atelier-card rounded-2xl max-w-2xl w-full p-5 sm:p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-stone-200 pb-3">
              <div>
                <h2 className="text-base font-bold font-editorial text-stone-950 flex items-center gap-2">
                  <Database className="w-4 h-4 text-teal-700" />
                  <span>Supabase PostgreSQL Persistence &amp; .env Configuration</span>
                </h2>
                <p className="text-xs text-stone-500 mt-0.5">
                  Add your Supabase credentials in <code className="font-mono">.env</code> to sync all users, projects, and resumes to Supabase PostgreSQL automatically.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowSupabaseModal(false)}
                className="p-1.5 text-stone-400 hover:text-stone-700 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-[#FAF8F5] border border-stone-200 flex items-center justify-between gap-3 text-xs">
              <div>
                <div className="font-bold text-stone-900">
                  Current Storage Engine:{' '}
                  <span className="text-teal-800">
                    {dbStatus?.provider || 'Supabase-Ready Multi-User Store'}
                  </span>
                </div>
                <div className="text-stone-500 mt-0.5">
                  Active Isolated Candidate Profiles:{' '}
                  <span className="font-mono font-semibold text-stone-800">
                    {usersList.map((u) => u.fullName).join(', ')}
                  </span>
                </div>
              </div>
              <span
                className={`px-2.5 py-1 rounded-lg font-semibold ${
                  dbStatus?.supabaseConfigured
                    ? 'bg-teal-50 text-teal-800 border border-teal-200'
                    : 'bg-amber-50 text-amber-800 border border-amber-200'
                }`}
              >
                {dbStatus?.supabaseConfigured ? 'Connected to Supabase' : 'Ready for .env Keys'}
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="font-bold text-stone-900">
                1. Add these variables to your <code className="font-mono">.env</code> file:
              </div>
              <pre className="p-3 bg-[#111716] text-teal-300 font-mono text-[11px] rounded-xl overflow-x-auto">
{`SUPABASE_URL="https://your-project-id.supabase.co"
SUPABASE_ANON_KEY="your-supabase-anon-key"
SUPABASE_SERVICE_ROLE_KEY="your-supabase-service-role-key"

VITE_SUPABASE_URL="https://your-project-id.supabase.co"
VITE_SUPABASE_ANON_KEY="your-supabase-anon-key"`}
              </pre>
            </div>

            <div className="space-y-2 text-xs">
              <div className="font-bold text-stone-900">
                2. Run the included SQL migration in your Supabase SQL Editor:
              </div>
              <p className="text-stone-600">
                Full migration file saved at:{' '}
                <code className="font-mono font-semibold text-stone-900">
                  supabase/migrations/001_init_latexforge.sql
                </code>
              </p>
              <pre className="p-3 bg-[#111716] text-stone-200 font-mono text-[11px] rounded-xl overflow-x-auto max-h-44">
{`CREATE TABLE IF NOT EXISTS public.latexforge_user_workspaces (
  user_id TEXT PRIMARY KEY,
  email TEXT,
  full_name TEXT,
  profile_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  projects_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  skills_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  skill_stage_config_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  templates_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  resumes_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);`}
              </pre>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setShowSupabaseModal(false)}
                className="px-4 py-2 bg-stone-900 text-white text-xs font-semibold rounded-xl cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 3: QUICK IMPORT CUSTOM PROJECT OR .TEX RESUME FORMAT
         ===================================================================== */}
      {showQuickImportModal && (
        <div className="fixed inset-0 z-50 bg-stone-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="atelier-card rounded-2xl max-w-2xl w-full p-5 sm:p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-stone-200 pb-3">
              <div>
                <h2 className="text-base font-bold font-editorial text-stone-950 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-teal-700" />
                  <span>Quickly Add Your Own Projects or Resume Format</span>
                </h2>
                <p className="text-xs text-stone-500 mt-0.5">
                  Add a new project in plain English or paste your custom LaTeX template for{' '}
                  <strong>{profile.fullName}</strong>.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowQuickImportModal(false)}
                className="p-1.5 text-stone-400 hover:text-stone-700 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-1 p-1 bg-stone-100 rounded-xl w-fit">
              <button
                type="button"
                onClick={() => setImportTab('project')}
                className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                  importTab === 'project'
                    ? 'bg-white text-stone-900 shadow-2xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                1. Add a New Project
              </button>
              <button
                type="button"
                onClick={() => setImportTab('template')}
                className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                  importTab === 'template'
                    ? 'bg-white text-stone-900 shadow-2xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                2. Paste Custom Resume Format (.tex)
              </button>
            </div>

            {importSuccessMsg && (
              <div className="p-3 bg-teal-50 border border-teal-200 rounded-xl text-xs font-semibold text-teal-900 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-teal-700 shrink-0" />
                <span>{importSuccessMsg}</span>
              </div>
            )}

            {importTab === 'project' ? (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!quickProjTitle.trim()) return;
                  const bullets = quickProjBullets
                    .split('\n')
                    .map((s) => s.trim())
                    .filter(Boolean);
                  const techs = quickProjTech
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean);
                  await handleCreateProject({
                    title: quickProjTitle.trim(),
                    domain: quickProjDomain,
                    githubUrl: quickProjGithub.trim(),
                    technologies: techs.length > 0 ? techs : ['Python'],
                    keywords: techs.map((t) => t.toLowerCase()),
                    sourceDescription: bullets.join(' '),
                    verifiedFacts:
                      bullets.length > 0 ? bullets : ['Implemented and verified project.'],
                    defaultBullets:
                      bullets.length > 0 ? bullets : ['Implemented and verified project.'],
                    metrics: ['Verified project implementation'],
                  });
                  setQuickProjTitle('');
                  setQuickProjTech('');
                  setQuickProjBullets('');
                  setQuickProjGithub('');
                  setImportSuccessMsg('Project added to your library!');
                }}
                className="space-y-3 text-xs"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-stone-700 mb-1">
                      Project Title
                    </label>
                    <input
                      type="text"
                      required
                      value={quickProjTitle}
                      onChange={(e) => setQuickProjTitle(e.target.value)}
                      placeholder="e.g., Smart Grid Telemetry Pipeline"
                      className="w-full px-3 py-2 border border-stone-300 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-stone-700 mb-1">
                      Project Category
                    </label>
                    <select
                      value={quickProjDomain}
                      onChange={(e) => setQuickProjDomain(e.target.value as ProjectDomain)}
                      className="w-full px-3 py-2 border border-stone-300 rounded-xl bg-white"
                    >
                      <option value="software">Software</option>
                      <option value="hardware">Hardware</option>
                      <option value="hybrid">Hybrid (Hardware + Software)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-stone-700 mb-1">
                      Technologies Used (comma-separated)
                    </label>
                    <input
                      type="text"
                      value={quickProjTech}
                      onChange={(e) => setQuickProjTech(e.target.value)}
                      placeholder="Python, C++, Docker, AWS"
                      className="w-full px-3 py-2 border border-stone-300 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-stone-700 mb-1">
                      GitHub Link (Optional)
                    </label>
                    <input
                      type="url"
                      value={quickProjGithub}
                      onChange={(e) => setQuickProjGithub(e.target.value)}
                      placeholder="https://github.com/..."
                      className="w-full px-3 py-2 border border-stone-300 rounded-xl"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-stone-700 mb-1">
                    Project Bullet Points or Description (One bullet per line)
                  </label>
                  <textarea
                    rows={4}
                    required
                    value={quickProjBullets}
                    onChange={(e) => setQuickProjBullets(e.target.value)}
                    placeholder="Paste your project bullet points or notes here..."
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl leading-relaxed"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowQuickImportModal(false)}
                    className="px-4 py-2 bg-stone-100 text-stone-700 font-semibold rounded-xl cursor-pointer"
                  >
                    Done
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white font-semibold rounded-xl cursor-pointer"
                  >
                    Save Project to Library
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-3 text-xs">
                <p className="text-stone-600">
                  Paste your custom <code className="font-mono">.tex</code> resume template below. Your existing versions remain intact while new versions will use your updated format.
                </p>
                <textarea
                  rows={10}
                  value={quickTemplateLatex}
                  onChange={(e) => setQuickTemplateLatex(e.target.value)}
                  spellCheck={false}
                  className="w-full p-3 bg-[#111716] text-stone-100 font-mono text-xs rounded-xl border border-stone-800"
                />
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowQuickImportModal(false)}
                    className="px-4 py-2 bg-stone-100 text-stone-700 font-semibold rounded-xl cursor-pointer"
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      const resp = await apiFetch(`/api/templates/${templates[0].id}`, {
                        method: 'PUT',
                        body: JSON.stringify({
                          name: templates[0].name,
                          latexSource: quickTemplateLatex,
                          spacingConfig: templates[0].spacingConfig,
                          sectionConfig: templates[0].sectionConfig,
                          changeNote: 'Updated custom LaTeX template via Quick Import',
                        }),
                      });
                      const data = await resp.json();
                      if (resp.ok) {
                        setTemplates([data.template]);
                        setImportSuccessMsg('Custom resume template saved!');
                      }
                    }}
                    className="px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white font-semibold rounded-xl cursor-pointer"
                  >
                    Save Custom Template
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
