import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Briefcase,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Code2,
  Columns,
  Download,
  Eye,
  FileCode,
  FileText,
  FolderGit2,
  GraduationCap,
  Lock,
  Maximize2,
  MessageSquare,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Trash2,
  Unlock,
  UserCheck,
  Wand2,
} from 'lucide-react';
import {
  CandidateProfile,
  ProjectDomain,
  ProjectItem,
  ResumeVersion,
  RoleMode,
  SkillItem,
  SkillStageConfig,
} from '../types/resume';
import { filterEligibleResumeSkills } from '../lib/latexEngine';
import { LatexCodeEditor } from './LatexCodeEditor';
import { PdfPreviewAndValidator } from './PdfPreviewAndValidator';

interface WorkspaceViewProps {
  resume: ResumeVersion;
  profile: CandidateProfile;
  projects: ProjectItem[];
  skills: SkillItem[];
  stageConfig: SkillStageConfig;
  onAnalyzeJd: (payload: {
    company: string;
    role: string;
    jobDescription: string;
    roleMode: RoleMode;
  }) => Promise<void>;
  onUpdateSelection: (payload: {
    company?: string;
    role?: string;
    jobDescription?: string;
    roleMode?: RoleMode;
    selectedProjectIds?: string[];
    manuallyLockedProjectIds?: string[];
    selectedSkillIds?: string[];
  }) => Promise<void>;
  onTailorBullets: (projectId?: string) => Promise<void>;
  onUpdateProjectBullets: (projectId: string, bullets: string[]) => Promise<void>;
  onRenderLatex: (forceOverwriteEditor: boolean) => Promise<void>;
  onSaveLatexSource: (latexSource: string) => Promise<void>;
  onCompileSavedSource: () => Promise<void>;
  onCreateOptimizedDraft: () => Promise<void>;
  onRunExaminer: (payload: {
    action: 'generate' | 'evaluate';
    questionNumber?: number;
    userAnswer?: string;
  }) => Promise<void>;
  onUpdateProfile?: (prof: Partial<CandidateProfile>) => Promise<void>;
  onCreateProject?: (proj: Partial<ProjectItem>) => Promise<void>;
}

type StudioStep = 1 | 2 | 3 | 4;
type LayoutViewMode = 'split' | 'editor' | 'preview';

const SAMPLE_JOB_PRESETS: {
  label: string;
  company: string;
  role: string;
  roleMode: RoleMode;
  jd: string;
}[] = [
  {
    label: 'Software & ML (Databricks)',
    company: 'Databricks',
    role: 'Software & ML Systems Engineer',
    roleMode: 'software',
    jd: `We are looking for a Software & ML Systems Engineer to build high-throughput data pipelines, distributed backend services, and predictive ML workflows.
Requirements:
- Strong proficiency in Python, Go, Rust, or C++ and production SQL databases.
- Experience designing machine learning pipelines, classification models (scikit-learn, XGBoost), and evaluation metrics (ROC-AUC, precision/recall).
- Experience with real-time telemetry ingestion, Kafka, gRPC, or edge-to-cloud streaming systems.`,
  },
  {
    label: 'Embedded & Hardware (Tesla)',
    company: 'Tesla',
    role: 'Embedded Firmware & FPGA Engineer',
    roleMode: 'hardware',
    jd: `Seeking an Embedded Firmware & Hardware Acceleration Engineer for safety-critical sensor systems.
Requirements:
- Hands-on experience with C/C++, SystemVerilog, FPGA RTL design (Xilinx Vivado), and real-time microcontrollers (STM32, Arduino, ESP8266).
- Experience integrating ultrasonic, gas, or optical sensors over SPI, UART, and wireless telemetry protocols.
- Ability to verify cycle-accurate timing closure and build live sensor diagnostic dashboards.`,
  },
  {
    label: 'Hybrid Systems (Anduril)',
    company: 'Anduril Industries',
    role: 'Autonomous Sensor & Distributed Systems Engineer',
    roleMode: 'hybrid',
    jd: `Build edge-to-cloud sensor fusion and low-latency command systems.
Requirements:
- Proficiency in Rust, Go, C++, and Python alongside embedded hardware and wireless telemetry (MQTT, gRPC, WebSockets).
- Track record of building real-time dashboards, edge anomaly detection, and high-throughput backend engines.`,
  },
];

export const WorkspaceView: React.FC<WorkspaceViewProps> = ({
  resume,
  profile,
  projects,
  skills,
  stageConfig,
  onAnalyzeJd,
  onUpdateSelection,
  onTailorBullets,
  onUpdateProjectBullets,
  onRenderLatex,
  onSaveLatexSource,
  onCompileSavedSource,
  onCreateOptimizedDraft,
  onRunExaminer,
  onUpdateProfile,
  onCreateProject,
}) => {
  const [activeStep, setActiveStep] = useState<StudioStep>(1);
  // Layout mode lets users switch between Split View, Guided Editor, and Full Preview at any screen size
  const [layoutMode, setLayoutMode] = useState<LayoutViewMode>('split');
  const [step3SubTab, setStep3SubTab] = useState<'projects' | 'experience' | 'header'>('projects');
  const [showAdvancedLatex, setShowAdvancedLatex] = useState(false);
  const [showQuickAddProject, setShowQuickAddProject] = useState(false);

  // Quick Add Project Form State
  const [newProjTitle, setNewProjTitle] = useState('');
  const [newProjDomain, setNewProjDomain] = useState<ProjectDomain>('software');
  const [newProjTech, setNewProjTech] = useState('');
  const [newProjBullets, setNewProjBullets] = useState('');
  const [newProjGithub, setNewProjGithub] = useState('');

  const [company, setCompany] = useState(resume.company);
  const [role, setRole] = useState(resume.role);
  const [jobDescription, setJobDescription] = useState(resume.jobDescription);
  const [roleMode, setRoleMode] = useState<RoleMode>(resume.roleMode || 'all');
  const [catalogueSearch, setCatalogueSearch] = useState('');
  const [editorLatex, setEditorLatex] = useState(resume.savedLatexSource);

  // Quick Header & Experience Visual Editor State
  const [headerName, setHeaderName] = useState(profile.fullName);
  const [headerEmail, setHeaderEmail] = useState(profile.email);
  const [headerPhone, setHeaderPhone] = useState(profile.phone);
  const [headerLinkedin, setHeaderLinkedin] = useState(profile.linkedinUrl);
  const [headerGithub, setHeaderGithub] = useState(profile.githubUrl);
  const [profileSavedToast, setProfileSavedToast] = useState('');

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isTailoring, setIsTailoring] = useState<string | null>(null);
  const [isRenderingLatex, setIsRenderingLatex] = useState(false);
  const [isSavingLatex, setIsSavingLatex] = useState(false);
  const [isCompiling, setIsCompiling] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [examinerAnswers, setExaminerAnswers] = useState<Record<number, string>>({});

  useEffect(() => {
    setCompany(resume.company);
    setRole(resume.role);
    setJobDescription(resume.jobDescription);
    setRoleMode(resume.roleMode || 'all');
    setEditorLatex(resume.savedLatexSource);
  }, [resume.id, resume.savedSourceHash]);

  useEffect(() => {
    setHeaderName(profile.fullName);
    setHeaderEmail(profile.email);
    setHeaderPhone(profile.phone);
    setHeaderLinkedin(profile.linkedinUrl);
    setHeaderGithub(profile.githubUrl);
  }, [profile]);

  const filteredCatalogueProjects = useMemo(() => {
    return projects.filter((proj) => {
      const domainMatch = roleMode === 'all' || proj.domain === roleMode;
      if (!domainMatch) return false;
      if (!catalogueSearch.trim()) return true;
      const q = catalogueSearch.toLowerCase();
      return (
        proj.title.toLowerCase().includes(q) ||
        proj.technologies.some((t) => t.toLowerCase().includes(q)) ||
        proj.keywords.some((k) => k.toLowerCase().includes(q)) ||
        proj.domain.toLowerCase().includes(q)
      );
    });
  }, [projects, roleMode, catalogueSearch]);

  const selectedProjectsOrdered = useMemo(
    () =>
      resume.selectedProjectIds
        .map((id) => projects.find((p) => p.id === id)!)
        .filter(Boolean),
    [resume.selectedProjectIds, projects]
  );

  const eligibleSkills = useMemo(() => filterEligibleResumeSkills(skills), [skills]);
  const stage4ExcludedSkills = useMemo(() => skills.filter((s) => s.stage === 4), [skills]);

  const averageAtsScore = useMemo(() => {
    if (!resume.jobAnalysis?.atsScores?.length) return null;
    const sum = resume.jobAnalysis.atsScores.reduce((acc, s) => acc + s.score, 0);
    return Math.round(sum / resume.jobAnalysis.atsScores.length);
  }, [resume.jobAnalysis]);

  const usedLines =
    resume.pageFitAnalysis?.estimatedLineCount ||
    resume.compilationResult?.estimatedLinesUsed ||
    38;
  const maxLines =
    resume.pageFitAnalysis?.maxAllowedLineCount ||
    resume.compilationResult?.maxSinglePageLines ||
    54;
  const isOnePageValid = Boolean(
    resume.compilationResult?.isOnePageValid && !resume.isPdfStale && usedLines <= maxLines
  );

  const handleAddRecommendedProject = async (projectId: string) => {
    const nextSelected = resume.selectedProjectIds.includes(projectId)
      ? resume.selectedProjectIds
      : [...resume.selectedProjectIds, projectId];
    const nextLocked = resume.manuallyLockedProjectIds.includes(projectId)
      ? resume.manuallyLockedProjectIds
      : [...resume.manuallyLockedProjectIds, projectId];
    await onUpdateSelection({
      selectedProjectIds: nextSelected,
      manuallyLockedProjectIds: nextLocked,
    });
  };

  const handleToggleManualProject = async (projectId: string) => {
    const isSelected = resume.selectedProjectIds.includes(projectId);
    let nextSelected: string[];
    let nextLocked: string[];
    if (isSelected) {
      nextSelected = resume.selectedProjectIds.filter((id) => id !== projectId);
      nextLocked = resume.manuallyLockedProjectIds.filter((id) => id !== projectId);
    } else {
      nextSelected = [...resume.selectedProjectIds, projectId];
      nextLocked = Array.from(new Set([...resume.manuallyLockedProjectIds, projectId]));
    }
    await onUpdateSelection({
      selectedProjectIds: nextSelected,
      manuallyLockedProjectIds: nextLocked,
    });
  };

  const handleToggleLock = async (projectId: string) => {
    const isLocked = resume.manuallyLockedProjectIds.includes(projectId);
    const nextLocked = isLocked
      ? resume.manuallyLockedProjectIds.filter((id) => id !== projectId)
      : [...resume.manuallyLockedProjectIds, projectId];
    await onUpdateSelection({ manuallyLockedProjectIds: nextLocked });
  };

  const handleMoveProject = async (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= resume.selectedProjectIds.length) return;
    const next = [...resume.selectedProjectIds];
    const [moved] = next.splice(index, 1);
    next.splice(targetIndex, 0, moved);
    const nextLocked = Array.from(new Set([...resume.manuallyLockedProjectIds, moved]));
    await onUpdateSelection({
      selectedProjectIds: next,
      manuallyLockedProjectIds: nextLocked,
    });
  };

  const handleRoleModeSwitch = async (nextMode: RoleMode) => {
    setRoleMode(nextMode);
    await onUpdateSelection({
      company,
      role,
      jobDescription,
      roleMode: nextMode,
    });
  };

  const [compileStageText, setCompileStageText] = useState<string | null>(null);
  const [justSyncedFlash, setJustSyncedFlash] = useState(false);

  const isBusyCompilingPdf =
    isRenderingLatex || isCompiling || isSavingLatex || isOptimizing || Boolean(compileStageText);

  const handleApplyAndRefreshPdf = async () => {
    setIsRenderingLatex(true);
    setCompileStageText('Rendering LaTeX source...');
    try {
      await onRenderLatex(false);
      setIsCompiling(true);
      setCompileStageText('Compiling & validating 1-page PDF...');
      await Promise.all([
        onCompileSavedSource(),
        new Promise((resolve) => setTimeout(resolve, 260)),
      ]);
      setJustSyncedFlash(true);
      setTimeout(() => setJustSyncedFlash(false), 2500);
    } finally {
      setIsRenderingLatex(false);
      setIsCompiling(false);
      setCompileStageText(null);
    }
  };

  const handleQuickCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjTitle.trim() || !onCreateProject) return;
    const bullets = newProjBullets
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
    const techs = newProjTech
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    await onCreateProject({
      title: newProjTitle.trim(),
      domain: newProjDomain,
      githubUrl: newProjGithub.trim(),
      technologies: techs.length > 0 ? techs : ['Python'],
      keywords: techs.map((t) => t.toLowerCase()),
      sourceDescription: bullets.join(' '),
      verifiedFacts: bullets.length > 0 ? bullets : ['Built and verified project implementation.'],
      defaultBullets:
        bullets.length > 0 ? bullets : ['Built and verified project implementation.'],
      metrics: ['Verified implementation'],
    });
    setNewProjTitle('');
    setNewProjTech('');
    setNewProjBullets('');
    setNewProjGithub('');
    setShowQuickAddProject(false);
  };

  const steps: {
    num: StudioStep;
    title: string;
    subtitle: string;
    badge: string;
    icon: React.ReactNode;
  }[] = [
    {
      num: 1,
      title: 'Target Job & Match',
      subtitle: resume.company || 'Enter job details',
      badge: averageAtsScore ? `${averageAtsScore}% Match` : 'Step 1',
      icon: <Briefcase className="w-4 h-4" />,
    },
    {
      num: 2,
      title: 'Select Projects',
      subtitle: `${selectedProjectsOrdered.length} included · ${resume.manuallyLockedProjectIds.length} pinned`,
      badge: `${selectedProjectsOrdered.length} Active`,
      icon: <FolderGit2 className="w-4 h-4" />,
    },
    {
      num: 3,
      title: 'Polish Content',
      subtitle: 'Bullets, Experience & Header',
      badge: 'AI Assisted',
      icon: <Wand2 className="w-4 h-4" />,
    },
    {
      num: 4,
      title: 'Export & Interview Prep',
      subtitle: isOnePageValid ? '1-Page PDF Verified' : 'Review & Download',
      badge: isOnePageValid ? 'Ready' : 'Export',
      icon: <Download className="w-4 h-4" />,
    },
  ];

  const userQuery = `?userId=${encodeURIComponent(resume.userId || 'user-owner-1')}`;

  return (
    <div className="space-y-5 w-full min-w-0 overflow-hidden">
      {/* =====================================================================
          EXECUTIVE STUDIO COMMAND BAR & READINESS SCORECARD
         ===================================================================== */}
      <div className="atelier-card rounded-2xl overflow-hidden min-w-0">
        {/* Live Top Edge Compilation Progress Bar */}
        <div
          className={`h-1.5 w-full transition-colors overflow-hidden ${
            isBusyCompilingPdf
              ? 'bg-teal-100'
              : isOnePageValid
                ? 'bg-teal-700/85'
                : 'bg-amber-500/80'
          }`}
          role="progressbar"
          aria-busy={isBusyCompilingPdf}
          aria-label={
            isBusyCompilingPdf
              ? compileStageText || 'Syncing and compiling LaTeX source to PDF'
              : 'Resume compilation status'
          }
        >
          {isBusyCompilingPdf && (
            <div className="h-full bg-gradient-to-r from-teal-600 via-emerald-500 to-teal-700 rounded-full atelier-progress-bar" />
          )}
        </div>

        <div className="p-4 sm:p-5 space-y-4 min-w-0">
          {/* Top Row: Title + Live Syncing Indicator + View Mode Switcher + Primary Actions */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-stone-200/80 pb-4 min-w-0">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-teal-800">
                  Resume Tailoring Atelier
                </span>
                <span className="text-stone-300">•</span>
                <span className="text-xs font-mono font-semibold text-stone-600 tabular-nums">
                  Version v{resume.versionNumber}
                </span>
                {averageAtsScore !== null && (
                  <>
                    <span className="text-stone-300">•</span>
                    <span className="text-xs font-semibold text-teal-700">
                      {averageAtsScore}% ATS Match
                    </span>
                  </>
                )}

                {/* Immediate Visual Syncing / Compiling Indicator Pill in Header */}
                {isBusyCompilingPdf ? (
                  <span
                    role="status"
                    aria-live="polite"
                    className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-teal-50 text-teal-900 border border-teal-300 shadow-2xs animate-pulse"
                  >
                    <RefreshCw className="w-3 h-3 text-teal-700 animate-spin shrink-0" />
                    <span>{compileStageText || 'Syncing LaTeX to PDF...'}</span>
                  </span>
                ) : justSyncedFlash ? (
                  <span
                    role="status"
                    aria-live="polite"
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200"
                  >
                    <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                    <span>PDF Synced &amp; Verified</span>
                  </span>
                ) : null}
              </div>
              <h1 className="text-lg sm:text-xl font-bold font-editorial text-stone-950 truncate mt-0.5">
                {resume.company || 'Target Company'} — {resume.role || 'Target Role'}
              </h1>
            </div>

            {/* Right Controls: Responsive Layout Switcher + Sync + Download */}
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {/* Layout Mode Switcher (Works on Medium AND Desktop screens to prevent any cramped overflow) */}
              <div
                className="inline-flex items-center bg-[#F3F0E8] p-1 rounded-xl border border-stone-200/90"
                role="group"
                aria-label="Workspace Layout Mode"
              >
                <button
                  type="button"
                  onClick={() => setLayoutMode('split')}
                  className={`hidden xl:inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                    layoutMode === 'split'
                      ? 'bg-white text-stone-900 shadow-2xs'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                  title="Side-by-side Guided Editor and Live 1-Page Preview"
                >
                  <Columns className="w-3.5 h-3.5 text-teal-700" />
                  Split View
                </button>
                <button
                  type="button"
                  onClick={() => setLayoutMode('editor')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                    layoutMode === 'editor' || (layoutMode === 'split' && true)
                      ? layoutMode === 'editor'
                        ? 'bg-white text-stone-900 shadow-2xs'
                        : 'bg-white xl:bg-transparent text-stone-900 xl:text-stone-600 shadow-2xs xl:shadow-none'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  <Wand2 className="w-3.5 h-3.5 text-teal-700" />
                  Guided Steps
                </button>
                <button
                  type="button"
                  onClick={() => setLayoutMode('preview')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                    layoutMode === 'preview'
                      ? 'bg-white text-stone-900 shadow-2xs'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  <Eye className="w-3.5 h-3.5 text-emerald-700" />
                  1-Page Preview ({usedLines}/{maxLines} lines)
                </button>
              </div>

              <button
                type="button"
                onClick={handleApplyAndRefreshPdf}
                disabled={isBusyCompilingPdf}
                className="px-3.5 py-2 bg-teal-700 hover:bg-teal-800 disabled:bg-teal-800/80 text-white text-xs font-semibold rounded-xl transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shadow-2xs cursor-pointer"
              >
                {isBusyCompilingPdf ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 text-amber-200 animate-spin" />
                    <span>Syncing PDF...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-amber-200" />
                    <span>Sync &amp; Verify PDF</span>
                  </>
                )}
              </button>

              {isOnePageValid && (
                <a
                  href={`/api/resumes/${resume.id}/download/pdf${userQuery}`}
                  download
                  className="px-3.5 py-2 bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold rounded-xl transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shadow-2xs"
                >
                  <Download className="w-3.5 h-3.5 text-teal-400" />
                  Download PDF
                </a>
              )}
            </div>
          </div>

          {/* Active Background Compilation Banner inside Header when Busy */}
          {isBusyCompilingPdf && (
            <div
              role="status"
              aria-live="assertive"
              className="px-3.5 py-2.5 rounded-xl bg-teal-50/90 border border-teal-200 flex flex-wrap items-center justify-between gap-3 text-xs text-teal-950"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <RefreshCw className="w-4 h-4 text-teal-700 animate-spin shrink-0" />
                <div className="min-w-0">
                  <span className="font-bold">
                    {compileStageText || 'Compiling LaTeX Source to 1-Page PDF...'}
                  </span>
                  <span className="text-teal-700 ml-2 hidden sm:inline">
                    Verifying US Letter page bounds, Stage 4 skill exclusion, and ATS text extraction
                  </span>
                </div>
              </div>
              <span className="font-mono text-[11px] font-semibold text-teal-800 bg-white/80 px-2.5 py-0.5 rounded-md border border-teal-200 shrink-0 tabular-nums">
                pdfTeX Active
              </span>
            </div>
          )}

        {/* 4-Step Guided Progress Stepper */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 min-w-0">
          {steps.map((st) => {
            const isActive = activeStep === st.num;
            const isCompleted = activeStep > st.num;
            return (
              <button
                key={st.num}
                type="button"
                onClick={() => {
                  setActiveStep(st.num);
                  if (layoutMode === 'preview') {
                    setLayoutMode('split');
                  }
                }}
                className={`p-3 rounded-xl border text-left transition-all flex items-start gap-3 min-w-0 cursor-pointer ${
                  isActive
                    ? 'bg-teal-50/70 border-teal-700 text-stone-950 shadow-2xs'
                    : isCompleted
                      ? 'bg-[#FAF8F5] border-teal-200/80 text-stone-800 hover:bg-teal-50/40'
                      : 'bg-[#FAF8F5] border-stone-200/80 text-stone-600 hover:bg-stone-100/80 hover:text-stone-900'
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 font-bold text-xs ${
                    isActive
                      ? 'bg-teal-700 text-white shadow-2xs'
                      : isCompleted
                        ? 'bg-stone-900 text-teal-300'
                        : 'bg-white border border-stone-200 text-stone-600'
                  }`}
                >
                  {isCompleted ? <Check className="w-4 h-4" /> : st.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs font-bold truncate">
                      {st.num}. {st.title}
                    </span>
                  </div>
                  <div className="text-[11px] text-stone-500 truncate mt-0.5">{st.subtitle}</div>
                </div>
              </button>
            );
          })}
        </div>
        </div>
      </div>

      {/* =====================================================================
          MAIN WORKBENCH GRID (OVERFLOW-PROOF ON ALL SCREEN SIZES)
         ===================================================================== */}
      <div
        className={`grid grid-cols-1 ${
          layoutMode === 'split' ? 'xl:grid-cols-12' : 'grid-cols-1'
        } gap-6 items-start w-full min-w-0`}
      >
        {/* LEFT PANE: Guided Step Editor */}
        <div
          className={`${
            layoutMode === 'split'
              ? 'xl:col-span-7 block'
              : layoutMode === 'editor'
                ? 'block max-w-4xl mx-auto w-full'
                : 'hidden'
          } min-w-0 w-full space-y-6`}
        >
          {/* =====================================================================
              STEP 1: TARGET JOB & ATS MATCH ANALYSIS
             ===================================================================== */}
          {activeStep === 1 && (
            <div className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 shadow-xs space-y-6 min-w-0">
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200/80 pb-4">
                <div className="min-w-0 flex-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600">
                    Step 1 of 4 · Job Targeting
                  </span>
                  <h2 className="text-base sm:text-lg font-bold text-slate-900 mt-0.5">
                    Target Job Description &amp; Instant ATS Match
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Paste the job posting you are applying for. We will extract the top keywords, rank your most relevant projects, and check your resume against 6 major hiring portals.
                  </p>
                </div>

                {/* Role Domain Filter */}
                <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200/80 shrink-0">
                  {(['all', 'software', 'hardware', 'hybrid'] as RoleMode[]).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => handleRoleModeSwitch(mode)}
                      className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors capitalize whitespace-nowrap shrink-0 cursor-pointer ${
                        roleMode === mode
                          ? 'bg-white text-slate-900 shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {mode === 'all' ? 'All Roles' : mode}
                    </button>
                  ))}
                </div>
              </div>

              {/* One-Click Sample Role Presets */}
              <div className="p-3.5 bg-slate-50/90 border border-slate-200/80 rounded-xl space-y-2">
                <div className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  <span>Quick-Fill a Sample Job Posting (or paste your own below):</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {SAMPLE_JOB_PRESETS.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={async () => {
                        setCompany(preset.company);
                        setRole(preset.role);
                        setRoleMode(preset.roleMode);
                        setJobDescription(preset.jd);
                        await onUpdateSelection({
                          company: preset.company,
                          role: preset.role,
                          roleMode: preset.roleMode,
                          jobDescription: preset.jd,
                        });
                      }}
                      className="px-3 py-1.5 text-xs font-semibold bg-white hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200/90 hover:border-blue-200 rounded-lg transition-colors shadow-2xs cursor-pointer"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Company & Job Title Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="min-w-0">
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Target Company Name
                  </label>
                  <input
                    type="text"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    onBlur={() => onUpdateSelection({ company, role, jobDescription, roleMode })}
                    placeholder="e.g., Databricks, Apple, Stripe"
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50/60 border border-slate-300 rounded-xl focus:outline-none focus:bg-white focus:border-blue-600 transition-colors"
                  />
                </div>
                <div className="min-w-0">
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Target Job Role
                  </label>
                  <input
                    type="text"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    onBlur={() => onUpdateSelection({ company, role, jobDescription, roleMode })}
                    placeholder="e.g., Software Engineer, Firmware Engineer"
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50/60 border border-slate-300 rounded-xl focus:outline-none focus:bg-white focus:border-blue-600 transition-colors"
                  />
                </div>
              </div>

              {/* Job Description Textarea */}
              <div className="min-w-0">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-700">
                    Job Description &amp; Requirements
                  </label>
                  <span className="text-[11px] text-slate-400">
                    Pinned projects are never overwritten when you analyze a new job
                  </span>
                </div>
                <textarea
                  rows={5}
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  onBlur={() => onUpdateSelection({ company, role, jobDescription, roleMode })}
                  placeholder="Paste the full job description, responsibilities, and required qualifications here..."
                  className="w-full px-3.5 py-2.5 text-xs leading-relaxed bg-slate-50/60 border border-slate-300 rounded-xl focus:outline-none focus:bg-white focus:border-blue-600 transition-colors"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <button
                  type="button"
                  disabled={isAnalyzing}
                  onClick={async () => {
                    setIsAnalyzing(true);
                    try {
                      await onAnalyzeJd({ company, role, jobDescription, roleMode });
                    } finally {
                      setIsAnalyzing(false);
                    }
                  }}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white text-xs sm:text-sm font-semibold rounded-xl transition-colors inline-flex items-center gap-2 shadow-xs cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" />
                  {isAnalyzing
                    ? 'Analyzing Job & Ranking Projects...'
                    : 'Analyze Job & Rank My Projects'}
                </button>

                <button
                  type="button"
                  onClick={() => setActiveStep(2)}
                  className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                >
                  Continue to Step 2: Select Projects
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Rich Visual ATS Match Scorecard */}
              {resume.jobAnalysis && (
                <div className="pt-6 border-t border-slate-200/80 space-y-5 min-w-0">
                  <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white flex flex-wrap items-center justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-blue-300">
                        ATS Screening Diagnostic
                      </div>
                      <h3 className="text-base font-bold mt-0.5 break-words">
                        {resume.company} · {resume.role}
                      </h3>
                      <p className="text-xs text-slate-300 mt-0.5">
                        Role Focus:{' '}
                        <strong className="capitalize text-white">
                          {resume.jobAnalysis.detectedDomain}
                        </strong>{' '}
                        · Level: <strong className="text-white">{resume.jobAnalysis.seniorityLevel}</strong>
                      </p>
                    </div>

                    {averageAtsScore !== null && (
                      <div className="px-4 py-2.5 bg-white/10 border border-white/15 rounded-xl text-right shrink-0">
                        <div className="text-[10px] uppercase tracking-wider text-slate-300">
                          Overall Match Score
                        </div>
                        <div className="text-xl font-bold font-mono text-emerald-400 tabular-nums">
                          {averageAtsScore}%
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Top 5 Keywords & 10-Second Recruiter Scan */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 bg-slate-50/90 border border-slate-200/90 rounded-xl space-y-2.5 min-w-0">
                      <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                        <span>Top 5 High-Priority Keywords in This Job</span>
                      </div>
                      <p className="text-[11px] text-slate-500">
                        Hiring portals scan your bullets and skills for these exact terms:
                      </p>
                      <div className="space-y-1.5">
                        {resume.jobAnalysis.fiveCriticalKeywords.map((kw, i) => {
                          const isCovered = resume.jobAnalysis?.confirmedSkillMatches.some(
                            (m) =>
                              m.toLowerCase().includes(kw.toLowerCase()) ||
                              kw.toLowerCase().includes(m.toLowerCase())
                          );
                          return (
                            <div
                              key={i}
                              className="px-3 py-1.5 bg-white border border-slate-200/90 rounded-lg flex items-center justify-between gap-2 text-xs min-w-0"
                            >
                              <span className="font-semibold text-slate-800 truncate">
                                {i + 1}. {kw}
                              </span>
                              <span
                                className={`text-[10px] font-semibold px-2 py-0.5 rounded shrink-0 ${
                                  isCovered
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : 'bg-blue-50 text-blue-700 border border-blue-200'
                                }`}
                              >
                                {isCovered ? 'In Your Profile' : 'Target Keyword'}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="p-4 bg-slate-50/90 border border-slate-200/90 rounded-xl space-y-2.5 min-w-0">
                      <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>What Recruiters Will Notice in 10 Seconds</span>
                      </div>
                      <p className="text-[11px] text-slate-500">
                        Key points to highlight so your application passes the initial screen:
                      </p>
                      <div className="space-y-2">
                        {resume.jobAnalysis.threeRedFlags.map((rf, i) => (
                          <div
                            key={i}
                            className="p-2.5 bg-white border border-slate-200/90 rounded-lg text-xs text-slate-700 leading-relaxed break-words"
                          >
                            <strong className="text-slate-900">#{i + 1}:</strong> {rf}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Verified Skill Matches vs Unverified Gaps */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 bg-emerald-50/60 border border-emerald-200 rounded-xl min-w-0">
                      <div className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>Your Verified Matching Skills</span>
                      </div>
                      <p className="text-xs text-emerald-900 mt-1.5 leading-relaxed break-words font-medium">
                        {resume.jobAnalysis.confirmedSkillMatches.join(' · ') || 'None detected'}
                      </p>
                    </div>
                    <div className="p-4 bg-amber-50/60 border border-amber-200 rounded-xl min-w-0">
                      <div className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                        <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>Not in Your Verified Profile (Never Fabricated)</span>
                      </div>
                      <p className="text-xs text-amber-900 mt-1.5 leading-relaxed break-words">
                        {resume.jobAnalysis.missingRequirements.join(' · ') ||
                          'All core requirements matched!'}
                      </p>
                    </div>
                  </div>

                  {/* 6 ATS Portal Compatibility Cards */}
                  <div>
                    <div className="text-xs font-bold text-slate-800 mb-2.5">
                      Estimated Compatibility Across Major Hiring Systems
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                      {resume.jobAnalysis.atsScores.map((ats) => (
                        <div
                          key={ats.platform}
                          className="p-3 bg-white border border-slate-200/90 rounded-xl space-y-1.5 min-w-0"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-bold text-slate-900 truncate">
                              {ats.platform}
                            </span>
                            <span className="font-mono text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded tabular-nums shrink-0">
                              {ats.score}%
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 leading-snug break-words">
                            {ats.evidenceNote}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* =====================================================================
              STEP 2: CHOOSE & ORDER PROJECTS (AI SUGGESTIONS VS FULL LIBRARY)
             ===================================================================== */}
          {activeStep === 2 && (
            <div className="space-y-6 min-w-0">
              {/* Part 1: Your Confirmed Selected Projects (Always in User Control) */}
              <div className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 shadow-xs space-y-4 min-w-0">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 pb-4">
                  <div className="min-w-0 flex-1">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600">
                      Step 2 of 4 · Project Selection
                    </span>
                    <h2 className="text-base sm:text-lg font-bold text-slate-900 mt-0.5">
                      Your Confirmed Resume Projects ({selectedProjectsOrdered.length} Selected)
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      You are always in 100% control. Reorder projects with the arrows or <strong>Pin</strong> any project so AI never replaces it.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setActiveStep(1)}
                      className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors inline-flex items-center gap-1 cursor-pointer"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      Back
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveStep(3)}
                      className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      Next: Polish Bullets
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {selectedProjectsOrdered.length === 0 ? (
                  <div className="py-8 px-4 text-center text-xs text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                    No projects selected yet. Click <strong>+ Add to Resume</strong> on any AI suggestion or library project below.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {selectedProjectsOrdered.map((proj, idx) => {
                      const isLocked = resume.manuallyLockedProjectIds.includes(proj.id);
                      const isAiRec = resume.aiRecommendations.some((r) => r.projectId === proj.id);
                      return (
                        <div
                          key={proj.id}
                          className="p-3.5 rounded-xl border border-slate-200/90 bg-slate-50/60 hover:bg-slate-50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 min-w-0"
                        >
                          <div className="flex items-start gap-3 min-w-0 flex-1">
                            <span className="font-mono text-xs font-bold text-white bg-blue-600 rounded-lg px-2.5 py-1 tabular-nums shrink-0 mt-0.5">
                              #{idx + 1}
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-sm font-bold text-slate-900 break-words">
                                  {proj.title}
                                </span>
                                <span className="text-[11px] font-medium text-slate-500 capitalize">
                                  ({proj.domain})
                                </span>
                              </div>
                              <div className="text-xs text-slate-600 mt-0.5 break-words">
                                {proj.technologies.slice(0, 6).join(' · ')}
                                <span className="text-slate-400"> · </span>
                                <span className="text-blue-700 font-medium">
                                  {isAiRec ? 'Recommended for this job' : 'Hand-picked by you'}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleMoveProject(idx, -1)}
                              disabled={idx === 0}
                              title="Move Project Up"
                              className="p-1.5 text-slate-600 hover:text-slate-900 disabled:opacity-30 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 cursor-pointer"
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMoveProject(idx, 1)}
                              disabled={idx === selectedProjectsOrdered.length - 1}
                              title="Move Project Down"
                              className="p-1.5 text-slate-600 hover:text-slate-900 disabled:opacity-30 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 cursor-pointer"
                            >
                              <ArrowDown className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleToggleLock(proj.id)}
                              title={
                                isLocked
                                  ? 'Pinned: Protected from automatic removal'
                                  : 'Click to Pin this project'
                              }
                              className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg border inline-flex items-center gap-1 whitespace-nowrap cursor-pointer ${
                                isLocked
                                  ? 'bg-slate-900 text-white border-slate-900'
                                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                              }`}
                            >
                              {isLocked ? (
                                <>
                                  <Lock className="w-3 h-3" />
                                  Pinned
                                </>
                              ) : (
                                <>
                                  <Unlock className="w-3 h-3" />
                                  Pin
                                </>
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleToggleManualProject(proj.id)}
                              className="px-2.5 py-1.5 text-xs font-semibold text-rose-700 bg-white hover:bg-rose-50 border border-rose-200 rounded-lg whitespace-nowrap cursor-pointer"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Part 2: AI-Recommended Projects for This Job */}
              <div className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 shadow-xs space-y-4 min-w-0">
                <div className="border-b border-slate-200/80 pb-3.5 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-blue-600 shrink-0" />
                      <span>AI-Recommended Projects for {resume.company || 'This Job'}</span>
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Suggestions ranked by how closely your project achievements match the job posting.
                    </p>
                  </div>
                </div>

                {resume.aiRecommendations.length === 0 ? (
                  <div className="py-6 text-center text-xs text-slate-500">
                    Click <strong>Analyze Job &amp; Rank My Projects</strong> in Step 1 to generate tailored project recommendations.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {resume.aiRecommendations.map((rec) => {
                      const proj = projects.find((p) => p.id === rec.projectId);
                      if (!proj) return null;
                      const isSelected = resume.selectedProjectIds.includes(proj.id);
                      return (
                        <div
                          key={rec.projectId}
                          className={`p-4 rounded-xl border transition-all space-y-2.5 min-w-0 ${
                            isSelected
                              ? 'bg-emerald-50/30 border-emerald-200'
                              : 'bg-slate-50/50 border-slate-200/90 hover:border-blue-300'
                          }`}
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="px-2 py-0.5 bg-blue-600 text-white font-mono text-[11px] font-bold rounded tabular-nums">
                                  #{rec.rank} Match · {rec.relevanceScore}%
                                </span>
                                <span className="text-xs font-medium text-slate-500 capitalize">
                                  {proj.domain} Project
                                </span>
                              </div>
                              <h4 className="text-sm font-bold text-slate-900 mt-1 break-words">
                                {proj.title}
                              </h4>
                            </div>

                            {isSelected ? (
                              <button
                                type="button"
                                onClick={() => handleToggleManualProject(proj.id)}
                                className="px-3 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-100 hover:bg-emerald-200/80 rounded-lg inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
                              >
                                <Check className="w-3.5 h-3.5" />
                                Included on Resume
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleAddRecommendedProject(proj.id)}
                                className="px-3.5 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors inline-flex items-center gap-1 whitespace-nowrap shrink-0 shadow-2xs cursor-pointer"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                Add to Resume
                              </button>
                            )}
                          </div>

                          <p className="text-xs text-slate-700 leading-relaxed break-words">
                            {rec.rationale}
                          </p>

                          <div className="text-[11px] text-slate-600 bg-white/80 px-3 py-1.5 rounded-lg border border-slate-200/70 break-words">
                            <strong className="text-slate-800">Matching Skills &amp; Keywords:</strong>{' '}
                            {[...rec.matchingTechnologies, ...rec.matchingKeywords]
                              .slice(0, 7)
                              .join(' · ')}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Part 3: Full Searchable Project Library + Inline Quick-Add */}
              <div className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 shadow-xs space-y-4 min-w-0">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 pb-3.5">
                  <div className="min-w-0">
                    <h3 className="text-sm sm:text-base font-bold text-slate-900">
                      Your Complete Project Library ({filteredCatalogueProjects.length} Available)
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Include any project from your collection—even if AI did not suggest it.
                    </p>
                  </div>

                  {onCreateProject && (
                    <button
                      type="button"
                      onClick={() => setShowQuickAddProject((v) => !v)}
                      className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 shrink-0 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      {showQuickAddProject ? 'Close Form' : 'Quick-Add New Project'}
                    </button>
                  )}
                </div>

                {/* Inline Quick-Add Project Modal Form */}
                {showQuickAddProject && (
                  <form
                    onSubmit={handleQuickCreateProject}
                    className="p-4 bg-blue-50/50 border border-blue-200 rounded-xl space-y-3"
                  >
                    <div className="text-xs font-bold text-slate-900">
                      Add a New Project Directly to Your Library
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <input
                        type="text"
                        required
                        value={newProjTitle}
                        onChange={(e) => setNewProjTitle(e.target.value)}
                        placeholder="Project Title (e.g., Autonomous Drone Navigation)"
                        className="px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                      />
                      <select
                        value={newProjDomain}
                        onChange={(e) => setNewProjDomain(e.target.value as ProjectDomain)}
                        className="px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                      >
                        <option value="software">Software Project</option>
                        <option value="hardware">Hardware Project</option>
                        <option value="hybrid">Hybrid Project</option>
                      </select>
                      <input
                        type="text"
                        value={newProjTech}
                        onChange={(e) => setNewProjTech(e.target.value)}
                        placeholder="Technologies (e.g., Python, ROS, C++)"
                        className="px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                      />
                    </div>
                    <textarea
                      rows={3}
                      required
                      value={newProjBullets}
                      onChange={(e) => setNewProjBullets(e.target.value)}
                      placeholder="Enter 2–3 bullet points (one per line) describing what you built and measured..."
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                    />
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <input
                        type="url"
                        value={newProjGithub}
                        onChange={(e) => setNewProjGithub(e.target.value)}
                        placeholder="Optional GitHub link (https://github.com/...)"
                        className="flex-1 min-w-[200px] px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                      />
                      <button
                        type="submit"
                        className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg cursor-pointer"
                      >
                        Save Project to Library
                      </button>
                    </div>
                  </form>
                )}

                {/* Search & Domain Filter Bar */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl overflow-x-auto no-scrollbar">
                    {(['all', 'software', 'hardware', 'hybrid'] as RoleMode[]).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => handleRoleModeSwitch(mode)}
                        className={`px-3 py-1 text-xs font-semibold rounded-lg capitalize transition-colors whitespace-nowrap cursor-pointer ${
                          roleMode === mode
                            ? 'bg-white text-slate-900 shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {mode === 'all' ? 'All Domains' : mode}
                      </button>
                    ))}
                  </div>

                  <div className="relative flex-1 sm:max-w-xs min-w-[180px]">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={catalogueSearch}
                      onChange={(e) => setCatalogueSearch(e.target.value)}
                      placeholder="Filter by title or tech..."
                      className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
                    />
                  </div>
                </div>

                {/* Project Cards */}
                <div className="space-y-2.5">
                  {filteredCatalogueProjects.map((proj) => {
                    const isSelected = resume.selectedProjectIds.includes(proj.id);
                    return (
                      <div
                        key={proj.id}
                        className={`p-3.5 rounded-xl border transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 min-w-0 ${
                          isSelected
                            ? 'bg-blue-50/40 border-blue-200'
                            : 'bg-white border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="text-xs sm:text-sm font-bold text-slate-900 break-words">
                            {proj.title}
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5 break-words">
                            <span className="capitalize font-semibold text-slate-700">
                              {proj.domain}
                            </span>{' '}
                            · {proj.technologies.join(' · ')}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleToggleManualProject(proj.id)}
                          className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                            isSelected
                              ? 'bg-slate-900 text-white hover:bg-slate-800'
                              : 'bg-slate-100 text-slate-800 hover:bg-slate-200'
                          }`}
                        >
                          {isSelected ? 'Included (Click to Remove)' : '+ Include on Resume'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* =====================================================================
              STEP 3: VISUAL CONTENT & BULLET EDITOR (NO LATEX KNOWLEDGE NEEDED)
             ===================================================================== */}
          {activeStep === 3 && (
            <div className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 shadow-xs space-y-6 min-w-0">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 pb-4">
                <div className="min-w-0 flex-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600">
                    Step 3 of 4 · Visual Resume Editor
                  </span>
                  <h2 className="text-base sm:text-lg font-bold text-slate-900 mt-0.5">
                    Polish Bullet Points, Experience &amp; Contact Header
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Edit any section visually in plain English. All changes automatically format into your 1-page resume.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setActiveStep(2)}
                    className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors inline-flex items-center gap-1 cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await handleApplyAndRefreshPdf();
                      setActiveStep(4);
                    }}
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Sync &amp; Go to Export
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Sub-Navigation Tabs inside Step 3: Project Bullets | Work & Education | Contact Header */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200/80 overflow-x-auto no-scrollbar">
                  <button
                    type="button"
                    onClick={() => setStep3SubTab('projects')}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                      step3SubTab === 'projects'
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Project Bullet Points ({selectedProjectsOrdered.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep3SubTab('experience')}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                      step3SubTab === 'experience'
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Experience &amp; Education
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep3SubTab('header')}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                      step3SubTab === 'header'
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Personal Contact Header
                  </button>
                </div>

                {step3SubTab === 'projects' && (
                  <button
                    type="button"
                    disabled={isTailoring !== null}
                    onClick={async () => {
                      setIsTailoring('all');
                      try {
                        await onTailorBullets();
                        await onRenderLatex(false);
                        await onCompileSavedSource();
                      } finally {
                        setIsTailoring(null);
                      }
                    }}
                    className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 shadow-2xs cursor-pointer"
                  >
                    <Wand2 className="w-3.5 h-3.5" />
                    {isTailoring === 'all'
                      ? 'Polishing All Bullets...'
                      : 'AI Polish All Project Bullets'}
                  </button>
                )}
              </div>

              {/* SUB-TAB A: PROJECT BULLET POINTS */}
              {step3SubTab === 'projects' && (
                <div className="space-y-4">
                  {selectedProjectsOrdered.map((proj, pIdx) => {
                    const currentBullets =
                      resume.projectBulletsMap[proj.id] &&
                      resume.projectBulletsMap[proj.id].length > 0
                        ? resume.projectBulletsMap[proj.id]
                        : proj.defaultBullets;
                    const surgeonRecords = resume.bulletSurgeonHistory[proj.id] || [];

                    return (
                      <div
                        key={proj.id}
                        className="p-4 rounded-xl border border-slate-200/90 bg-slate-50/50 space-y-3 min-w-0"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-mono font-bold text-blue-600">
                                Project #{pIdx + 1}
                              </span>
                              <h3 className="text-sm font-bold text-slate-900 break-words">
                                {proj.title}
                              </h3>
                            </div>
                            <p className="text-[11px] text-slate-500 mt-0.5 break-words">
                              Verified Facts: {proj.metrics.join(' · ') || 'Grounded in your library'}
                            </p>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 shrink-0">
                            <button
                              type="button"
                              disabled={isTailoring !== null}
                              onClick={async () => {
                                setIsTailoring(proj.id);
                                try {
                                  await onTailorBullets(proj.id);
                                } finally {
                                  setIsTailoring(null);
                                }
                              }}
                              className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-semibold rounded-lg transition-colors inline-flex items-center gap-1 whitespace-nowrap cursor-pointer"
                            >
                              <Sparkles className="w-3.5 h-3.5" />
                              {isTailoring === proj.id ? 'Polishing...' : 'AI Polish for This Job'}
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                onUpdateProjectBullets(proj.id, [
                                  ...currentBullets,
                                  'Implemented and verified feature using project technologies.',
                                ])
                              }
                              className="px-2.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-medium rounded-lg whitespace-nowrap cursor-pointer"
                            >
                              + Add Bullet
                            </button>
                          </div>
                        </div>

                        <div className="space-y-2.5">
                          {currentBullets.map((bullet, bIdx) => {
                            const approxLines = Math.max(1, Math.ceil(bullet.length / 95));
                            return (
                              <div key={bIdx} className="space-y-1 min-w-0">
                                <div className="flex items-start gap-2 min-w-0">
                                  <span className="text-xs font-bold text-slate-400 pt-2 select-none">
                                    •
                                  </span>
                                  <textarea
                                    rows={2}
                                    value={bullet}
                                    onChange={(e) => {
                                      const updated = [...currentBullets];
                                      updated[bIdx] = e.target.value;
                                      onUpdateProjectBullets(proj.id, updated);
                                    }}
                                    className="flex-1 min-w-0 px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600 leading-relaxed"
                                  />
                                  {currentBullets.length > 1 && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const updated = currentBullets.filter((_, i) => i !== bIdx);
                                        onUpdateProjectBullets(proj.id, updated);
                                      }}
                                      title="Remove Bullet"
                                      className="p-1.5 text-slate-400 hover:text-rose-600 mt-1 cursor-pointer"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                                <div className="pl-4 flex items-center justify-between text-[10px] text-slate-400">
                                  <span>Action-oriented achievement bullet</span>
                                  <span className="font-mono tabular-nums">
                                    {bullet.length} chars (~{approxLines} PDF line
                                    {approxLines > 1 ? 's' : ''})
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {surgeonRecords.length > 0 && (
                          <div className="pt-2 border-t border-slate-200/80 space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-semibold text-emerald-800">
                                Recent AI Improvement (100% Fact-Grounded):
                              </span>
                              <button
                                type="button"
                                onClick={() => onUpdateProjectBullets(proj.id, proj.defaultBullets)}
                                className="text-[11px] text-slate-500 hover:text-slate-800 underline cursor-pointer"
                              >
                                Revert to Original Bullets
                              </button>
                            </div>
                            {surgeonRecords.slice(0, 1).map((rec, rIdx) => (
                              <div
                                key={rIdx}
                                className="p-2.5 bg-white rounded-lg border border-emerald-200/80 text-[11px] space-y-1 break-words"
                              >
                                <div className="text-slate-500">
                                  <strong>Before:</strong> {rec.before}
                                </div>
                                <div className="text-emerald-900 font-medium">
                                  <strong>After:</strong> {rec.after}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Active Skills Summary Banner */}
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/90 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-bold text-slate-900">
                        Verified Skills Printed on Your Resume ({eligibleSkills.length} Active)
                      </span>
                      <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-md inline-flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3 text-emerald-600" />
                        Stage 4 Skills Automatically Hidden ({stage4ExcludedSkills.length} excluded)
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed break-words">
                      {eligibleSkills.map((s) => s.name).join(' · ')}
                    </p>
                  </div>
                </div>
              )}

              {/* SUB-TAB B: VISUAL EXPERIENCE & EDUCATION EDITOR */}
              {step3SubTab === 'experience' && (
                <div className="space-y-5">
                  <div className="space-y-3">
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                      <Briefcase className="w-4 h-4 text-blue-600" />
                      <span>Work Experience Entries</span>
                    </h3>
                    {profile.experience.map((exp, expIdx) => (
                      <div
                        key={exp.id}
                        className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3"
                      >
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <input
                            type="text"
                            value={exp.role}
                            onChange={(e) => {
                              if (!onUpdateProfile) return;
                              const nextExp = [...profile.experience];
                              nextExp[expIdx] = { ...exp, role: e.target.value };
                              onUpdateProfile({ experience: nextExp });
                            }}
                            placeholder="Role Title"
                            className="px-3 py-1.5 text-xs font-semibold bg-white border border-slate-300 rounded-lg"
                          />
                          <input
                            type="text"
                            value={exp.company}
                            onChange={(e) => {
                              if (!onUpdateProfile) return;
                              const nextExp = [...profile.experience];
                              nextExp[expIdx] = { ...exp, company: e.target.value };
                              onUpdateProfile({ experience: nextExp });
                            }}
                            placeholder="Company"
                            className="px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                          />
                        </div>
                        <div className="space-y-1.5">
                          {exp.bullets.map((b, bIdx) => (
                            <textarea
                              key={bIdx}
                              rows={2}
                              value={b}
                              onChange={(e) => {
                                if (!onUpdateProfile) return;
                                const nextExp = [...profile.experience];
                                const nextBullets = [...exp.bullets];
                                nextBullets[bIdx] = e.target.value;
                                nextExp[expIdx] = { ...exp, bullets: nextBullets };
                                onUpdateProfile({ experience: nextExp });
                              }}
                              className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-3 pt-3 border-t border-slate-200">
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                      <GraduationCap className="w-4 h-4 text-blue-600" />
                      <span>Education</span>
                    </h3>
                    {profile.education.map((edu, eduIdx) => (
                      <div
                        key={edu.id}
                        className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 grid grid-cols-1 sm:grid-cols-2 gap-3"
                      >
                        <input
                          type="text"
                          value={edu.institution}
                          onChange={(e) => {
                            if (!onUpdateProfile) return;
                            const nextEdu = [...profile.education];
                            nextEdu[eduIdx] = { ...edu, institution: e.target.value };
                            onUpdateProfile({ education: nextEdu });
                          }}
                          placeholder="University / Institution"
                          className="px-3 py-1.5 text-xs font-semibold bg-white border border-slate-300 rounded-lg"
                        />
                        <input
                          type="text"
                          value={edu.degree}
                          onChange={(e) => {
                            if (!onUpdateProfile) return;
                            const nextEdu = [...profile.education];
                            nextEdu[eduIdx] = { ...edu, degree: e.target.value };
                            onUpdateProfile({ education: nextEdu });
                          }}
                          placeholder="Degree & Major"
                          className="px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* SUB-TAB C: VISUAL CONTACT HEADER EDITOR */}
              {step3SubTab === 'header' && (
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <UserCheck className="w-4 h-4 text-blue-600" />
                      <span>Resume Contact Header</span>
                    </div>
                    {profileSavedToast && (
                      <span className="text-xs font-semibold text-emerald-700">
                        {profileSavedToast}
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Full Name
                      </label>
                      <input
                        type="text"
                        value={headerName}
                        onChange={(e) => setHeaderName(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Email Address
                      </label>
                      <input
                        type="email"
                        value={headerEmail}
                        onChange={(e) => setHeaderEmail(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Phone Number
                      </label>
                      <input
                        type="text"
                        value={headerPhone}
                        onChange={(e) => setHeaderPhone(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        LinkedIn Profile
                      </label>
                      <input
                        type="url"
                        value={headerLinkedin}
                        onChange={(e) => setHeaderLinkedin(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        GitHub / Portfolio Link
                      </label>
                      <input
                        type="url"
                        value={headerGithub}
                        onChange={(e) => setHeaderGithub(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                      />
                    </div>
                  </div>
                  {onUpdateProfile && (
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={async () => {
                          await onUpdateProfile({
                            fullName: headerName,
                            email: headerEmail,
                            phone: headerPhone,
                            linkedinUrl: headerLinkedin,
                            githubUrl: headerGithub,
                          });
                          setProfileSavedToast('Header updated!');
                          setTimeout(() => setProfileSavedToast(''), 2500);
                        }}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl cursor-pointer"
                      >
                        Save Header Info
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* =====================================================================
              STEP 4: EXPORT, INTERVIEW COACH & COLLAPSIBLE ADVANCED LATEX EDITOR
             ===================================================================== */}
          {activeStep === 4 && (
            <div className="space-y-6 min-w-0">
              {/* Primary Export Card for Non-Technical End Users */}
              <div className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 shadow-xs space-y-4 min-w-0">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
                      Step 4 of 4 · Ready to Export
                    </span>
                    <h2 className="text-base sm:text-lg font-bold text-slate-900 mt-0.5">
                      Download Your Tailored One-Page Resume
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Your resume is formatted using the classic single-page layout and verified for ATS readability.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                    {isOnePageValid ? (
                      <a
                        href={`/api/resumes/${resume.id}/download/pdf${userQuery}`}
                        download
                        className="px-5 py-2.5 bg-teal-700 hover:bg-teal-800 text-white text-xs sm:text-sm font-semibold rounded-xl inline-flex items-center gap-2 shadow-xs"
                      >
                        <Download className="w-4 h-4" />
                        Download Final 1-Page PDF
                      </a>
                    ) : (
                      <button
                        type="button"
                        onClick={handleApplyAndRefreshPdf}
                        disabled={isBusyCompilingPdf}
                        className="px-5 py-2.5 bg-teal-700 hover:bg-teal-800 text-white text-xs sm:text-sm font-semibold rounded-xl inline-flex items-center gap-2 cursor-pointer"
                      >
                        {isBusyCompilingPdf ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <CheckCircle2 className="w-4 h-4" />
                        )}
                        {isBusyCompilingPdf ? 'Verifying 1-Page Fit...' : 'Sync & Unlock 1-Page PDF'}
                      </button>
                    )}

                    <a
                      href={`/api/resumes/${resume.id}/download/tex${userQuery}`}
                      download
                      className="px-4 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-semibold rounded-xl inline-flex items-center gap-1.5"
                    >
                      <FileCode className="w-4 h-4" />
                      Download .tex Source
                    </a>
                  </div>
                </div>
              </div>

              {/* Hiring Manager Interview Practice Coach */}
              <div className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 shadow-xs space-y-4 min-w-0">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 pb-3.5">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
                      <MessageSquare className="w-4 h-4 text-blue-600 shrink-0" />
                      <span>Tailored Interview Practice Coach for {resume.company}</span>
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Practice 5 role-specific interview questions based on your selected projects. Automatically detects hesitant phrasing and suggests confident rewrites.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onRunExaminer({ action: 'generate' })}
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    {resume.examinerQuestions && resume.examinerQuestions.length > 0
                      ? 'Generate New Questions'
                      : 'Start 5-Question Mock Interview'}
                  </button>
                </div>

                {resume.examinerQuestions && resume.examinerQuestions.length > 0 ? (
                  <div className="space-y-3">
                    {resume.examinerQuestions.map((q) => (
                      <div
                        key={q.number}
                        className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-2.5 min-w-0"
                      >
                        <div className="text-xs font-bold text-slate-900 break-words">
                          Q{q.number} ({q.category}): {q.question}
                        </div>
                        <div className="flex flex-col sm:flex-row gap-2">
                          <input
                            type="text"
                            value={examinerAnswers[q.number] ?? q.userAnswer ?? ''}
                            onChange={(e) =>
                              setExaminerAnswers({
                                ...examinerAnswers,
                                [q.number]: e.target.value,
                              })
                            }
                            placeholder="Type your response here to get instant feedback..."
                            className="flex-1 min-w-0 px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              onRunExaminer({
                                action: 'evaluate',
                                questionNumber: q.number,
                                userAnswer: examinerAnswers[q.number] ?? q.userAnswer ?? '',
                              })
                            }
                            className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            Score My Answer
                          </button>
                        </div>

                        {q.score !== undefined && (
                          <div className="p-3 bg-white rounded-lg border border-slate-200 text-xs space-y-1.5 break-words">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="font-bold text-slate-900 font-mono tabular-nums">
                                Confidence Score: {q.score}/10
                              </span>
                              <span className="text-slate-500">
                                Hesitant Words:{' '}
                                {q.detectedHedges && q.detectedHedges.length > 0
                                  ? q.detectedHedges.join(', ')
                                  : 'None — Strong Direct Ownership'}
                              </span>
                            </div>
                            {q.commitStatementRewrite && (
                              <div className="text-emerald-800">
                                <strong>Stronger Phrasing:</strong> {q.commitStatementRewrite}
                              </div>
                            )}
                            {q.improvementNote && (
                              <div className="text-slate-600">
                                <strong>Coaching Tip:</strong> {q.improvementNote}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-6 text-center text-xs text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                    Click <strong>Start 5-Question Mock Interview</strong> above to practice answering questions about your resume.
                  </div>
                )}
              </div>

              {/* Progressive Disclosure: Collapsible Advanced LaTeX Code Editor */}
              <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-xs min-w-0">
                <button
                  type="button"
                  onClick={() => setShowAdvancedLatex((v) => !v)}
                  className="w-full px-5 py-4 flex items-center justify-between gap-3 text-left hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center shrink-0">
                      <Code2 className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs sm:text-sm font-bold text-slate-900">
                        Advanced Mode: View or Edit Raw LaTeX (.tex) Code
                      </div>
                      <div className="text-[11px] text-slate-500 truncate">
                        Optional for technical users — inspect or customize the exact LaTeX source code before compiling.
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 shrink-0">
                    <span>{showAdvancedLatex ? 'Hide Code Editor' : 'Open Code Editor'}</span>
                    {showAdvancedLatex ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </div>
                </button>

                {showAdvancedLatex && (
                  <div className="border-t border-slate-200 p-4 sm:p-5">
                    <LatexCodeEditor
                      resume={resume}
                      editorSource={editorLatex}
                      onChangeEditorSource={setEditorLatex}
                      onSaveSource={async () => {
                        setIsSavingLatex(true);
                        setCompileStageText('Saving authoritative LaTeX source...');
                        try {
                          await onSaveLatexSource(editorLatex);
                        } finally {
                          setIsSavingLatex(false);
                          setCompileStageText(null);
                        }
                      }}
                      onCompileSavedSource={async () => {
                        setIsCompiling(true);
                        setCompileStageText('Compiling saved LaTeX source to PDF...');
                        try {
                          await Promise.all([
                            onCompileSavedSource(),
                            new Promise((resolve) => setTimeout(resolve, 260)),
                          ]);
                          setJustSyncedFlash(true);
                          setTimeout(() => setJustSyncedFlash(false), 2500);
                        } finally {
                          setIsCompiling(false);
                          setCompileStageText(null);
                        }
                      }}
                      onReRenderFromSelection={async (forceOverwrite) => {
                        setIsRenderingLatex(true);
                        setCompileStageText('Re-rendering LaTeX from selections...');
                        try {
                          await onRenderLatex(forceOverwrite);
                        } finally {
                          setIsRenderingLatex(false);
                          setCompileStageText(null);
                        }
                      }}
                      isSaving={isSavingLatex}
                      isCompiling={isCompiling}
                    />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT PANE: Sticky Live 1-Page Resume Preview & Validator */}
        <div
          className={`${
            layoutMode === 'split'
              ? 'xl:col-span-5 hidden xl:block xl:sticky xl:top-20'
              : layoutMode === 'preview'
                ? 'block max-w-4xl mx-auto w-full'
                : 'hidden'
          } min-w-0 w-full`}
        >
          <PdfPreviewAndValidator
            resume={resume}
            profile={profile}
            projects={projects}
            skills={skills}
            stageConfig={stageConfig}
            onCreateOptimizedDraft={async () => {
              setIsOptimizing(true);
              setCompileStageText('Auto-optimizing 1-page layout & compiling PDF...');
              try {
                await onCreateOptimizedDraft();
              } finally {
                setIsOptimizing(false);
                setCompileStageText(null);
              }
            }}
            onCompileSavedSource={handleApplyAndRefreshPdf}
            isOptimizing={isOptimizing}
            isCompiling={isBusyCompilingPdf}
            compactMode={layoutMode === 'split'}
          />
        </div>
      </div>
    </div>
  );
};
