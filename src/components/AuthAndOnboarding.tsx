import React, { useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Award,
  Briefcase,
  Check,
  CheckCircle2,
  Database,
  FileCheck,
  FolderGit2,
  GraduationCap,
  Lock,
  LogIn,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  UserCheck,
  UserPlus,
  Wand2,
} from 'lucide-react';
import { CandidateProfile, ProjectDomain, SkillStageConfig } from '../types/resume';

interface AuthScreenProps {
  onLoginSuccess: (payload: {
    token: string;
    userId: string;
    onboardingCompleted: boolean;
  }) => Promise<void>;
  onStartFreshOnboarding: () => Promise<void>;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({
  onLoginSuccess,
  onStartFreshOnboarding,
}) => {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('aarav.mehta@berkeley.edu');
  const [password, setPassword] = useState('demo1234');
  const [targetRole, setTargetRole] = useState('Software & ML Systems Engineer');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(mode);
    try {
      const endpoint = mode === 'signup' ? '/api/auth/signup' : '/api/auth/login';
      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: mode === 'signup' ? fullName : undefined,
          email,
          password,
          targetRole: mode === 'signup' ? targetRole : undefined,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data.error || 'Authentication failed');
      }
      await onLoginSuccess({
        token: data.token,
        userId: data.userId,
        onboardingCompleted:
          data.user?.onboardingCompleted !== undefined
            ? Boolean(data.user.onboardingCompleted)
            : mode !== 'signup',
      });
    } catch (err: any) {
      setError(err?.message || 'Unable to authenticate');
    } finally {
      setBusy(null);
    }
  };

  const handleQuickDemoLogin = async (userId: string, label: string) => {
    setError(null);
    setBusy(label);
    try {
      const resp = await fetch('/api/auth/demo-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Demo login failed');
      await onLoginSuccess({
        token: data.token,
        userId: data.userId,
        onboardingCompleted: true,
      });
    } catch (err: any) {
      setError(err?.message || 'Quick sign-in failed');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#F6F4EE] text-stone-900 flex flex-col lg:flex-row">
      {/* Left Column: Editorial Brand Showcase */}
      <div className="w-full lg:w-5/12 xl:w-1/2 bg-[#111716] text-stone-100 p-6 sm:p-10 lg:p-14 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-stone-800">
        <div className="space-y-8">
          {/* Brand Header */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-teal-500/20 border border-teal-400/40 flex items-center justify-center text-teal-300 font-editorial font-bold text-xl">
              L
            </div>
            <div>
              <div className="text-xl font-bold font-editorial tracking-tight text-white">
                LaTeXForge
              </div>
              <div className="text-[11px] uppercase tracking-widest text-teal-400 font-semibold">
                One-Page AI Resume Atelier
              </div>
            </div>
          </div>

          {/* Hero Copy */}
          <div className="space-y-4 max-w-xl">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-950/90 border border-teal-700/60 text-teal-300 text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              Precision LaTeX Typography · Strict 1-Page Guarantee
            </span>
            <h1 className="text-2xl sm:text-4xl font-bold font-editorial text-white leading-[1.15]">
              Craft a verified, strictly one-page resume tailored to every role.
            </h1>
            <p className="text-sm text-stone-300 leading-relaxed">
              Calibrate your candidate profile once, organize your software &amp; hardware project library, and let AI tailor your bullet points using the Google XYZ formula — without ever overwriting your manual project locks or inventing metrics.
            </p>
          </div>

          {/* Key Pillars */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 max-w-xl pt-2">
            <div className="p-4 rounded-2xl bg-[#18211F] border border-stone-800/90 space-y-1.5">
              <div className="flex items-center gap-2 text-xs font-bold text-teal-300">
                <FileCheck className="w-4 h-4 shrink-0" />
                <span>Strict 1-Page PDF Validator</span>
              </div>
              <p className="text-xs text-stone-400 leading-relaxed">
                Real-time US Letter line budget meter and binary PDF compiler ensure your resume never spills onto page two.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-[#18211F] border border-stone-800/90 space-y-1.5">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-300">
                <Lock className="w-4 h-4 shrink-0" />
                <span>Manual Selection Authority</span>
              </div>
              <p className="text-xs text-stone-400 leading-relaxed">
                Pin your favorite projects so AI job-description rankings never overwrite your personal choices.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-[#18211F] border border-stone-800/90 space-y-1.5">
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-300">
                <ShieldCheck className="w-4 h-4 shrink-0" />
                <span>4-Stage Skill Governance</span>
              </div>
              <p className="text-xs text-stone-400 leading-relaxed">
                Calibrate skills across Stages 1–3 while automatically excluding Stage 4 learning skills from every resume.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-[#18211F] border border-stone-800/90 space-y-1.5">
              <div className="flex items-center gap-2 text-xs font-bold text-stone-200">
                <Database className="w-4 h-4 text-teal-400 shrink-0" />
                <span>Isolated Multi-User &amp; Supabase</span>
              </div>
              <p className="text-xs text-stone-400 leading-relaxed">
                Each candidate account gets a private project catalogue, resume vault, and automatic Supabase sync.
              </p>
            </div>
          </div>
        </div>

        <div className="pt-8 text-xs text-stone-400 flex flex-wrap items-center justify-between gap-2 border-t border-stone-800/80 mt-8">
          <span>Jake&apos;s Resume LaTeX Architecture · ATS Verified</span>
          <span className="font-mono text-[11px] text-teal-400">
            Workday · Greenhouse · Lever · iCIMS
          </span>
        </div>
      </div>

      {/* Right Column: Sign In / Sign Up & Instant 2-User Demo Switcher */}
      <div className="flex-1 flex items-center justify-center p-5 sm:p-10 lg:p-14">
        <div className="w-full max-w-md space-y-6">
          {/* Card Container */}
          <div className="atelier-card rounded-2xl p-6 sm:p-7 space-y-5">
            {/* Mode Switcher Tabs */}
            <div className="flex items-center justify-between gap-2 border-b border-stone-200 pb-4">
              <div>
                <h2 className="text-lg font-bold font-editorial text-stone-950">
                  {mode === 'login' ? 'Sign In to Your Atelier' : 'Create Candidate Account'}
                </h2>
                <p className="text-xs text-stone-500 mt-0.5">
                  {mode === 'login'
                    ? 'Access your saved resumes, project library, and 1-page PDF compiler.'
                    : 'Includes a guided 4-step onboarding wizard to build your first 1-page resume.'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-1.5 p-1 bg-[#F3F0E8] rounded-xl border border-stone-200/80">
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setError(null);
                }}
                className={`py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  mode === 'login'
                    ? 'bg-white text-stone-950 shadow-2xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                <LogIn className="w-3.5 h-3.5 text-teal-700" />
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('signup');
                  setEmail('');
                  setPassword('');
                  setError(null);
                }}
                className={`py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  mode === 'signup'
                    ? 'bg-white text-stone-950 shadow-2xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                <UserPlus className="w-3.5 h-3.5 text-teal-700" />
                Create Account
              </button>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-900 font-medium">
                {error}
              </div>
            )}

            <form onSubmit={handleFormSubmit} className="space-y-3.5 text-xs">
              {mode === 'signup' && (
                <div>
                  <label className="block font-semibold text-stone-700 mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g., Jordan Vance"
                    className="w-full px-3.5 py-2.5 bg-white border border-stone-300 rounded-xl focus:outline-none focus:border-teal-700"
                  />
                </div>
              )}

              <div>
                <label className="block font-semibold text-stone-700 mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@university.edu"
                  className="w-full px-3.5 py-2.5 bg-white border border-stone-300 rounded-xl focus:outline-none focus:border-teal-700"
                />
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">Password</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2.5 bg-white border border-stone-300 rounded-xl focus:outline-none focus:border-teal-700"
                />
              </div>

              {mode === 'signup' && (
                <div>
                  <label className="block font-semibold text-stone-700 mb-1">
                    Primary Target Role
                  </label>
                  <input
                    type="text"
                    value={targetRole}
                    onChange={(e) => setTargetRole(e.target.value)}
                    placeholder="e.g., Full-Stack & AI Systems Engineer"
                    className="w-full px-3.5 py-2.5 bg-white border border-stone-300 rounded-xl focus:outline-none focus:border-teal-700"
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={busy !== null}
                className="w-full py-2.5 px-4 bg-teal-700 hover:bg-teal-800 disabled:bg-stone-400 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 shadow-xs cursor-pointer"
              >
                {busy === mode ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>{mode === 'signup' ? 'Creating Workspace...' : 'Signing In...'}</span>
                  </>
                ) : mode === 'signup' ? (
                  <>
                    <UserPlus className="w-4 h-4" />
                    <span>Create Account &amp; Start Onboarding</span>
                  </>
                ) : (
                  <>
                    <LogIn className="w-4 h-4" />
                    <span>Sign In to Resume Atelier</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Instant 1-Click Demo Personas & Onboarding Test Box */}
          <div className="atelier-card rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-teal-800">
                Instant 1-Click Access (Pre-Seeded Real Users)
              </span>
              <span className="text-[11px] text-stone-500 font-mono">Password: demo1234</span>
            </div>

            <div className="space-y-2">
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => handleQuickDemoLogin('user-owner-1', 'demo-1')}
                className="w-full p-3 rounded-xl border border-stone-200 hover:border-teal-600 bg-[#FAF8F5] hover:bg-teal-50/40 text-left transition-all flex items-center justify-between gap-3 cursor-pointer"
              >
                <div className="min-w-0">
                  <div className="text-xs font-bold text-stone-900">
                    1. Aarav Mehta (AI Systems &amp; Silicon Engineer)
                  </div>
                  <div className="text-[11px] text-stone-500 truncate">
                    aarav.mehta@berkeley.edu · 5 Software/Hardware Projects · 1-Page Ready
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-teal-700 shrink-0" />
              </button>

              <button
                type="button"
                disabled={busy !== null}
                onClick={() => handleQuickDemoLogin('user-owner-2', 'demo-2')}
                className="w-full p-3 rounded-xl border border-stone-200 hover:border-teal-600 bg-[#FAF8F5] hover:bg-teal-50/40 text-left transition-all flex items-center justify-between gap-3 cursor-pointer"
              >
                <div className="min-w-0">
                  <div className="text-xs font-bold text-stone-900">
                    2. Elena Rostova (Principal Cloud &amp; FinTech Architect)
                  </div>
                  <div className="text-[11px] text-stone-500 truncate">
                    elena.rostova@mit.edu · 4 Distributed FinTech Projects · 1-Page Ready
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-teal-700 shrink-0" />
              </button>

              <button
                type="button"
                disabled={busy !== null}
                onClick={async () => {
                  setBusy('onboarding-demo');
                  try {
                    await onStartFreshOnboarding();
                  } finally {
                    setBusy(null);
                  }
                }}
                className="w-full p-3 rounded-xl border border-amber-300/90 bg-amber-50/60 hover:bg-amber-50 text-left transition-all flex items-center justify-between gap-3 cursor-pointer"
              >
                <div className="min-w-0">
                  <div className="text-xs font-bold text-stone-900 flex items-center gap-1.5">
                    <Wand2 className="w-3.5 h-3.5 text-amber-700" />
                    <span>Try Guided 4-Step Candidate Onboarding Flow</span>
                  </div>
                  <div className="text-[11px] text-stone-600 truncate">
                    Walk through profile setup, Stage 1 calibration, and first 1-page resume build
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-amber-800 shrink-0" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// INTERACTIVE 4-STEP CANDIDATE ONBOARDING WIZARD
// ============================================================================

interface OnboardingWizardProps {
  profile: CandidateProfile;
  stageConfig: SkillStageConfig;
  onCompleteOnboarding: (payload: {
    profile: Partial<CandidateProfile>;
    initialProject?: {
      title: string;
      domain: ProjectDomain;
      technologies: string[];
      bullets: string[];
      githubUrl?: string;
    };
    customSkills?: { name: string; category: string; stage: 1 | 2 | 3 | 4 }[];
    targetCompany: string;
    targetRole: string;
    targetJobDescription: string;
  }) => Promise<void>;
  onSkipOnboarding: () => void;
}

export const OnboardingWizard: React.FC<OnboardingWizardProps> = ({
  profile,
  stageConfig,
  onCompleteOnboarding,
  onSkipOnboarding,
}) => {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Step 1: Identity, Contact Header & Education
  const [fullName, setFullName] = useState(profile.fullName || '');
  const [email, setEmail] = useState(profile.email || '');
  const [phone, setPhone] = useState(profile.phone || '(510) 555-0194');
  const [location, setLocation] = useState(profile.location || 'San Francisco, CA');
  const [linkedinUrl, setLinkedinUrl] = useState(
    profile.linkedinUrl || 'https://linkedin.com/in/candidate'
  );
  const [githubUrl, setGithubUrl] = useState(
    profile.githubUrl || 'https://github.com/candidate'
  );
  const [institution, setInstitution] = useState(
    profile.education[0]?.institution || 'University of California, Berkeley'
  );
  const [degree, setDegree] = useState(
    profile.education[0]?.degree || 'B.S. in Electrical Engineering & Computer Sciences (EECS)'
  );
  const [eduDates, setEduDates] = useState(profile.education[0]?.dates || 'Aug 2021 – May 2025');

  // Step 2: Stage 1 Calibration (THE TRANSLATOR)
  const [targetRoleAndCompanyType, setTargetRoleAndCompanyType] = useState(
    profile.calibrationAnswers?.targetRoleAndCompanyType ||
      'Software & Distributed Systems Engineer at high-growth AI and cloud infrastructure companies'
  );
  const [threeDifferentiators, setThreeDifferentiators] = useState(
    profile.calibrationAnswers?.threeDifferentiators ||
      '1) End-to-end systems engineering across Python, Rust, and C++; 2) Proven latency and throughput optimization in production; 3) Strong empirical verification discipline.'
  );
  const [headOnAddressing, setHeadOnAddressing] = useState(
    profile.calibrationAnswers?.headOnAddressing ||
      'Available immediately for full-time engineering roles; combining strong systems foundation with hands-on production delivery.'
  );

  // Step 3: Flagship Project & Verified Skills
  const [projTitle, setProjTitle] = useState('Real-Time Distributed Telemetry & Anomaly Engine');
  const [projDomain, setProjDomain] = useState<ProjectDomain>('software');
  const [projTech, setProjTech] = useState('Python, Go, Kafka, PostgreSQL, Docker');
  const [projGithub, setProjGithub] = useState('https://github.com/candidate/telemetry-engine');
  const [projBullets, setProjBullets] = useState(
    `Engineered a high-throughput telemetry ingestion pipeline in Go and Kafka processing 45,000+ events/sec with sub-18ms p99 latency.\nDeveloped an automated drift and anomaly classifier in Python (scikit-learn), reducing false-positive alert fatigue by 42%.\nBuilt an interactive SQL and React observability console for real-time cluster health diagnostics.`
  );
  const [stage1SkillsInput, setStage1SkillsInput] = useState('Python, Go, C++, SQL, TypeScript');
  const [stage2SkillsInput, setStage2SkillsInput] = useState('Kafka, PostgreSQL, Docker, Linux');
  const [stage4ExcludedInput, setStage4ExcludedInput] = useState('Solidity, Unreal Engine 5');

  // Step 4: First Target Job Application
  const [targetCompany, setTargetCompany] = useState('Databricks');
  const [targetRole, setTargetRole] = useState('Software & Distributed Systems Engineer');
  const [targetJd, setTargetJd] = useState(
    `We are looking for a Software & Distributed Systems Engineer to build high-throughput data pipelines, low-latency backend services, and reliable cloud observability workflows using Python, Go, C++, Kafka, and SQL.`
  );

  const handleFinish = async () => {
    setIsSubmitting(true);
    try {
      const parsedBullets = projBullets
        .split('\n')
        .map((b) => b.trim())
        .filter(Boolean);
      const parsedTech = projTech
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      const customSkills: { name: string; category: string; stage: 1 | 2 | 3 | 4 }[] = [
        ...stage1SkillsInput
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
          .map((name) => ({ name, category: 'Core Languages & Systems', stage: 1 as const })),
        ...stage2SkillsInput
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
          .map((name) => ({ name, category: 'Frameworks & Infrastructure', stage: 2 as const })),
        ...stage4ExcludedInput
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
          .map((name) => ({ name, category: 'Excluded / Learning', stage: 4 as const })),
      ];

      await onCompleteOnboarding({
        profile: {
          fullName: fullName.trim() || profile.fullName,
          email: email.trim() || profile.email,
          phone: phone.trim(),
          location: location.trim(),
          linkedinUrl: linkedinUrl.trim(),
          githubUrl: githubUrl.trim(),
          education: [
            {
              id: profile.education[0]?.id || 'edu-1',
              institution: institution.trim(),
              degree: degree.trim(),
              location: location.trim(),
              dates: eduDates.trim(),
              gpa: profile.education[0]?.gpa || '3.92/4.00',
              coursework:
                profile.education[0]?.coursework ||
                'Operating Systems, Distributed Systems, Machine Learning, Algorithms, Database Systems',
            },
          ],
          calibrationAnswers: {
            targetRoleAndCompanyType,
            threeDifferentiators,
            headOnAddressing,
            updatedAt: new Date().toISOString(),
          },
        },
        initialProject: projTitle.trim()
          ? {
              title: projTitle.trim(),
              domain: projDomain,
              technologies: parsedTech,
              bullets: parsedBullets,
              githubUrl: projGithub.trim(),
            }
          : undefined,
        customSkills,
        targetCompany,
        targetRole,
        targetJobDescription: targetJd,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const stepsMeta = [
    {
      num: 1 as const,
      title: 'Identity & Contact Header',
      subtitle: 'Name, links & education',
      icon: <UserCheck className="w-4 h-4" />,
    },
    {
      num: 2 as const,
      title: 'Stage 1: The Translator',
      subtitle: '3-question voice calibration',
      icon: <Award className="w-4 h-4" />,
    },
    {
      num: 3 as const,
      title: 'Projects & Skill Stages',
      subtitle: 'Flagship work & Stage 4 guard',
      icon: <FolderGit2 className="w-4 h-4" />,
    },
    {
      num: 4 as const,
      title: 'First 1-Page Resume',
      subtitle: 'Target role & PDF compile',
      icon: <Briefcase className="w-4 h-4" />,
    },
  ];

  return (
    <div className="min-h-screen bg-[#F6F4EE] text-stone-900 py-8 px-4 sm:px-6 flex flex-col items-center justify-center">
      <div className="w-full max-w-4xl space-y-6">
        {/* Top Onboarding Header Card */}
        <div className="atelier-card rounded-2xl p-5 sm:p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-stone-200/80 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[#111716] text-teal-300 flex items-center justify-center font-editorial font-bold text-lg">
                L
              </div>
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-teal-800">
                  Candidate Onboarding Atelier · Step {step} of 4
                </span>
                <h1 className="text-lg sm:text-xl font-bold font-editorial text-stone-950">
                  Welcome, {fullName || 'Candidate'} — Let&apos;s Calibrate Your 1-Page Resume Studio
                </h1>
              </div>
            </div>

            <button
              type="button"
              onClick={onSkipOnboarding}
              className="px-3.5 py-1.5 text-xs font-semibold text-stone-600 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 rounded-xl transition-colors cursor-pointer"
            >
              Skip to Studio →
            </button>
          </div>

          {/* 4-Step Progress Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            {stepsMeta.map((s) => {
              const isActive = step === s.num;
              const isDone = step > s.num;
              return (
                <button
                  key={s.num}
                  type="button"
                  onClick={() => setStep(s.num)}
                  className={`p-3 rounded-xl border text-left transition-all flex items-start gap-2.5 cursor-pointer ${
                    isActive
                      ? 'bg-teal-50/80 border-teal-700 text-stone-950 shadow-2xs'
                      : isDone
                        ? 'bg-[#FAF8F5] border-teal-200 text-stone-800'
                        : 'bg-[#FAF8F5] border-stone-200/80 text-stone-500'
                  }`}
                >
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold ${
                      isActive
                        ? 'bg-teal-700 text-white'
                        : isDone
                          ? 'bg-stone-900 text-teal-300'
                          : 'bg-white border border-stone-200 text-stone-500'
                    }`}
                  >
                    {isDone ? <Check className="w-3.5 h-3.5" /> : s.icon}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold truncate">
                      {s.num}. {s.title}
                    </div>
                    <div className="text-[11px] text-stone-500 truncate">{s.subtitle}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Step Body Card */}
        <div className="atelier-card rounded-2xl p-6 sm:p-8 space-y-6">
          {/* STEP 1: IDENTITY & EDUCATION */}
          {step === 1 && (
            <div className="space-y-5">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-teal-800">
                  Step 1 of 4 · Personal Contact Header &amp; Education
                </span>
                <h2 className="text-lg font-bold font-editorial text-stone-950 mt-0.5">
                  How should your name, contact links, and university appear at the top of your resume?
                </h2>
                <p className="text-xs text-stone-500 mt-1">
                  Formatted automatically into Jake&apos;s classic single-page LaTeX header.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block font-semibold text-stone-700 mb-1">Full Name</label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full px-3.5 py-2 border border-stone-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-stone-700 mb-1">Email Address</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3.5 py-2 border border-stone-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-stone-700 mb-1">Phone Number</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3.5 py-2 border border-stone-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-stone-700 mb-1">Location</label>
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full px-3.5 py-2 border border-stone-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-stone-700 mb-1">LinkedIn URL</label>
                  <input
                    type="url"
                    value={linkedinUrl}
                    onChange={(e) => setLinkedinUrl(e.target.value)}
                    className="w-full px-3.5 py-2 border border-stone-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-stone-700 mb-1">GitHub URL</label>
                  <input
                    type="url"
                    value={githubUrl}
                    onChange={(e) => setGithubUrl(e.target.value)}
                    className="w-full px-3.5 py-2 border border-stone-300 rounded-xl"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-stone-200 space-y-3 text-xs">
                <div className="font-bold text-stone-900 flex items-center gap-1.5">
                  <GraduationCap className="w-4 h-4 text-teal-700" />
                  <span>Primary Education Entry</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <input
                    type="text"
                    value={institution}
                    onChange={(e) => setInstitution(e.target.value)}
                    placeholder="University / College"
                    className="px-3.5 py-2 border border-stone-300 rounded-xl"
                  />
                  <input
                    type="text"
                    value={degree}
                    onChange={(e) => setDegree(e.target.value)}
                    placeholder="Degree & Major"
                    className="px-3.5 py-2 border border-stone-300 rounded-xl"
                  />
                  <input
                    type="text"
                    value={eduDates}
                    onChange={(e) => setEduDates(e.target.value)}
                    placeholder="Graduation Dates"
                    className="px-3.5 py-2 border border-stone-300 rounded-xl"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: STAGE 1 CALIBRATION (THE TRANSLATOR) */}
          {step === 2 && (
            <div className="space-y-5">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-teal-800">
                  Step 2 of 4 · STAGE 1, THE TRANSLATOR
                </span>
                <h2 className="text-lg font-bold font-editorial text-stone-950 mt-0.5">
                  Calibrate Your Candidate Voice &amp; Positioning
                </h2>
                <p className="text-xs text-stone-500 mt-1">
                  These three answers are saved to your calibration profile (<code className="font-mono">calibration-profile.md</code>) and guide every AI bullet rewrite and ATS diagnostic.
                </p>
              </div>

              <div className="space-y-4 text-xs">
                <div>
                  <label className="block font-bold text-stone-800 mb-1">
                    1. What is your exact target role, and what type of company are you targeting?
                  </label>
                  <textarea
                    rows={2}
                    value={targetRoleAndCompanyType}
                    onChange={(e) => setTargetRoleAndCompanyType(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-stone-300 rounded-xl leading-relaxed"
                  />
                </div>

                <div>
                  <label className="block font-bold text-stone-800 mb-1">
                    2. What are three genuine differentiators that set your work apart from other candidates?
                  </label>
                  <textarea
                    rows={3}
                    value={threeDifferentiators}
                    onChange={(e) => setThreeDifferentiators(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-stone-300 rounded-xl leading-relaxed"
                  />
                </div>

                <div>
                  <label className="block font-bold text-stone-800 mb-1">
                    3. Are there any transitions, timeline notes, or focus areas to address head-on?
                  </label>
                  <textarea
                    rows={2}
                    value={headOnAddressing}
                    onChange={(e) => setHeadOnAddressing(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-stone-300 rounded-xl leading-relaxed"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: FLAGSHIP PROJECT & 4-STAGE SKILLS */}
          {step === 3 && (
            <div className="space-y-5">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-teal-800">
                  Step 3 of 4 · Flagship Project &amp; 4-Stage Skill Governance
                </span>
                <h2 className="text-lg font-bold font-editorial text-stone-950 mt-0.5">
                  Add a Flagship Project &amp; Verify Your Skill Stages
                </h2>
                <p className="text-xs text-stone-500 mt-1">
                  Your project bullets are formatted as discrete LaTeX <code className="font-mono">\resumeItem</code> entries. Stage 4 skills are stored for reference but strictly blocked from appearing on your resume.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-[#FAF8F5] border border-stone-200 space-y-3 text-xs">
                <div className="font-bold text-stone-900">Flagship Project Entry</div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <input
                    type="text"
                    value={projTitle}
                    onChange={(e) => setProjTitle(e.target.value)}
                    placeholder="Project Title"
                    className="px-3 py-2 bg-white border border-stone-300 rounded-xl"
                  />
                  <select
                    value={projDomain}
                    onChange={(e) => setProjDomain(e.target.value as ProjectDomain)}
                    className="px-3 py-2 bg-white border border-stone-300 rounded-xl"
                  >
                    <option value="software">Software Domain</option>
                    <option value="hardware">Hardware Domain</option>
                    <option value="hybrid">Hybrid (SW + HW)</option>
                  </select>
                  <input
                    type="text"
                    value={projTech}
                    onChange={(e) => setProjTech(e.target.value)}
                    placeholder="Technologies (comma-separated)"
                    className="px-3 py-2 bg-white border border-stone-300 rounded-xl"
                  />
                </div>
                <textarea
                  rows={3}
                  value={projBullets}
                  onChange={(e) => setProjBullets(e.target.value)}
                  placeholder="One verified achievement bullet per line..."
                  className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl leading-relaxed"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-3.5 rounded-xl border border-teal-200 bg-teal-50/40 space-y-1.5">
                  <label className="block font-bold text-teal-950">
                    {stageConfig.stage1Label} (Included)
                  </label>
                  <input
                    type="text"
                    value={stage1SkillsInput}
                    onChange={(e) => setStage1SkillsInput(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-stone-300 rounded-lg"
                  />
                </div>

                <div className="p-3.5 rounded-xl border border-stone-200 bg-[#FAF8F5] space-y-1.5">
                  <label className="block font-bold text-stone-900">
                    {stageConfig.stage2Label} (Included)
                  </label>
                  <input
                    type="text"
                    value={stage2SkillsInput}
                    onChange={(e) => setStage2SkillsInput(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-stone-300 rounded-lg"
                  />
                </div>

                <div className="p-3.5 rounded-xl border border-rose-200 bg-rose-50/40 space-y-1.5">
                  <label className="block font-bold text-rose-950">
                    {stageConfig.stage4Label} (Strictly Excluded)
                  </label>
                  <input
                    type="text"
                    value={stage4ExcludedInput}
                    onChange={(e) => setStage4ExcludedInput(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-rose-300 rounded-lg"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: FIRST TARGET JOB & 1-PAGE PDF GENERATION */}
          {step === 4 && (
            <div className="space-y-5">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-teal-800">
                  Step 4 of 4 · Generate Your First Tailored 1-Page Resume
                </span>
                <h2 className="text-lg font-bold font-editorial text-stone-950 mt-0.5">
                  Choose Your First Target Role to Compile Your 1-Page PDF
                </h2>
                <p className="text-xs text-stone-500 mt-1">
                  We will immediately generate your LaTeX source, verify the 1-page US Letter line budget, and open your interactive Resume Atelier.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block font-semibold text-stone-700 mb-1">Target Company</label>
                  <input
                    type="text"
                    value={targetCompany}
                    onChange={(e) => setTargetCompany(e.target.value)}
                    className="w-full px-3.5 py-2 border border-stone-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-stone-700 mb-1">Target Job Role</label>
                  <input
                    type="text"
                    value={targetRole}
                    onChange={(e) => setTargetRole(e.target.value)}
                    className="w-full px-3.5 py-2 border border-stone-300 rounded-xl"
                  />
                </div>
              </div>

              <div className="text-xs">
                <label className="block font-semibold text-stone-700 mb-1">
                  Target Job Description (JD)
                </label>
                <textarea
                  rows={4}
                  value={targetJd}
                  onChange={(e) => setTargetJd(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-stone-300 rounded-xl leading-relaxed"
                />
              </div>

              <div className="p-4 rounded-xl bg-teal-50/80 border border-teal-200 flex items-center gap-3 text-xs text-teal-950">
                <CheckCircle2 className="w-5 h-5 text-teal-700 shrink-0" />
                <div>
                  <div className="font-bold">Ready to Compile Your 1-Page Resume</div>
                  <div className="text-teal-800 mt-0.5">
                    Your flagship project will be pinned (<code className="font-mono">manuallyLocked</code>), Stage 4 skills will be excluded, and your 1-page PDF will be compiled automatically.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Footer Navigation Controls */}
          <div className="flex items-center justify-between gap-3 pt-4 border-t border-stone-200">
            {step > 1 ? (
              <button
                type="button"
                onClick={() => setStep((s) => (s - 1) as 1 | 2 | 3 | 4)}
                className="px-4 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Previous Step
              </button>
            ) : (
              <div />
            )}

            {step < 4 ? (
              <button
                type="button"
                onClick={() => setStep((s) => (s + 1) as 1 | 2 | 3 | 4)}
                className="px-5 py-2.5 bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                Continue to Step {step + 1}
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleFinish}
                className="px-6 py-2.5 bg-teal-700 hover:bg-teal-800 disabled:bg-stone-400 text-white text-xs sm:text-sm font-semibold rounded-xl inline-flex items-center gap-2 shadow-xs cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Compiling Your 1-Page Resume...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-amber-200" />
                    <span>Complete Onboarding &amp; Launch Atelier</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
