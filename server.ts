import 'dotenv/config';
import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import {
  calculatePageFitAndSuggestions,
  computeSourceHash,
  filterEligibleResumeSkills,
  generateCompleteLatexResume,
  reconcileProjectSelections,
} from './src/lib/latexEngine';
import { compileAndValidateLatexSource } from './src/lib/pdfCompiler';
import {
  authenticateUserAccount,
  createSessionToken,
  formatUserSummary,
  listAvailableUsers,
  loadDatabase,
  registerUserAccount,
  resolveSessionToken,
  revokeSessionToken,
  saveDatabase,
} from './src/server/db';
import {
  analyzeJobDescription,
  analyzeSkillMatches,
  buildExaminerQuestionBatch,
  evaluateExaminerAnswerWithHedgeDetection,
  recommendProjects,
  tailorProjectBullets,
} from './src/server/geminiService';
import { runAllVerificationTests } from './src/tests/testSuite';
import { AuditLogEntry, ProjectItem, ResumeVersion, SkillItem } from './src/types/resume';

function createAuditEntry(
  action: AuditLogEntry['action'],
  actor: AuditLogEntry['actor'],
  summary: string,
  sourceHash?: string
): AuditLogEntry {
  return {
    id: `aud-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString(),
    action,
    actor,
    summary,
    sourceHash,
  };
}

function resolveUserId(req: express.Request): string {
  const fromHeader = req.headers['x-user-id'];
  if (typeof fromHeader === 'string' && fromHeader.trim()) {
    return fromHeader.trim();
  }
  const fromQuery = req.query.userId;
  if (typeof fromQuery === 'string' && fromQuery.trim()) {
    return fromQuery.trim();
  }
  return 'user-owner-1';
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '10mb' }));

  // Initialize both seeded real user workspaces on startup
  await loadDatabase('user-owner-1');
  await loadDatabase('user-owner-2');

  // =========================================================================
  // AUTHENTICATION & ONBOARDING ENDPOINTS
  // =========================================================================

  // Sign up a new user account (starts with onboardingCompleted: false)
  app.post('/api/auth/signup', async (req, res) => {
    try {
      const fullName = String(req.body.fullName || '').trim();
      const email = String(req.body.email || '').trim();
      const password = String(req.body.password || '');
      const targetRole = String(req.body.targetRole || '').trim();

      if (!fullName) {
        return res.status(400).json({ error: 'Full name is required.' });
      }
      const result = await registerUserAccount({ fullName, email, password, targetRole });
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err?.message || 'Registration failed' });
    }
  });

  // Sign in with email and password
  app.post('/api/auth/login', async (req, res) => {
    try {
      const email = String(req.body.email || '').trim();
      const password = String(req.body.password || '');
      const result = await authenticateUserAccount({ email, password });
      res.json(result);
    } catch (err: any) {
      res.status(401).json({ error: err?.message || 'Invalid credentials' });
    }
  });

  // Instant 1-click demo login (for User 1, User 2, or fresh Onboarding Sandbox)
  app.post('/api/auth/demo-login', async (req, res) => {
    try {
      const targetUserId = String(req.body.userId || 'user-owner-1').trim();
      const db = await loadDatabase(targetUserId);
      const session = await createSessionToken(targetUserId);
      const users = await listAvailableUsers();
      res.json({
        token: session.token,
        userId: targetUserId,
        user: formatUserSummary(db),
        users,
      });
    } catch (err: any) {
      res.status(400).json({ error: err?.message || 'Failed to start demo session' });
    }
  });

  // Resolve current authenticated session
  app.get('/api/auth/me', async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      const tokenUserId = await resolveSessionToken(
        typeof authHeader === 'string' ? authHeader : null
      );
      const userId = tokenUserId || resolveUserId(req);
      const db = await loadDatabase(userId);
      const users = await listAvailableUsers();
      res.json({
        userId,
        user: formatUserSummary(db),
        onboardingCompleted: db.auth ? db.auth.onboardingCompleted : true,
        users,
      });
    } catch (err: any) {
      res.status(401).json({ error: err?.message || 'Not authenticated' });
    }
  });

  // Sign out session
  app.post('/api/auth/logout', async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      await revokeSessionToken(typeof authHeader === 'string' ? authHeader : null);
      res.json({ success: true });
    } catch (err: any) {
      res.status(400).json({ error: err?.message || 'Logout failed' });
    }
  });

  // Complete 4-Step Candidate Onboarding Wizard & Generate First 1-Page Resume
  app.post('/api/onboarding/complete', async (req, res) => {
    try {
      const userId = resolveUserId(req);
      const db = await loadDatabase(userId);
      const now = new Date().toISOString();

      // 1. Update Contact Header, Education, and Experience
      if (req.body.profile) {
        const p = req.body.profile;
        db.profile = {
          ...db.profile,
          fullName: p.fullName ? String(p.fullName).trim() : db.profile.fullName,
          email: p.email ? String(p.email).trim() : db.profile.email,
          phone: p.phone ? String(p.phone).trim() : db.profile.phone,
          location: p.location ? String(p.location).trim() : db.profile.location,
          linkedinUrl: p.linkedinUrl !== undefined ? String(p.linkedinUrl).trim() : db.profile.linkedinUrl,
          githubUrl: p.githubUrl !== undefined ? String(p.githubUrl).trim() : db.profile.githubUrl,
          education: Array.isArray(p.education) && p.education.length > 0 ? p.education : db.profile.education,
          experience: Array.isArray(p.experience) && p.experience.length > 0 ? p.experience : db.profile.experience,
          calibrationAnswers: {
            ...db.profile.calibrationAnswers,
            ...(p.calibrationAnswers || {}),
            updatedAt: now,
          },
        };
      }

      // 2. Add custom flagship project if provided during onboarding
      if (req.body.initialProject && req.body.initialProject.title) {
        const ip = req.body.initialProject;
        const bullets = Array.isArray(ip.bullets)
          ? ip.bullets.filter(Boolean)
          : ['Designed, implemented, and verified production architecture with measurable impact.'];
        const techs = Array.isArray(ip.technologies) && ip.technologies.length > 0
          ? ip.technologies.filter(Boolean)
          : ['Python', 'TypeScript', 'PostgreSQL'];
        const newProj: ProjectItem = {
          id: `proj-onboard-${Date.now().toString().slice(-5)}`,
          title: String(ip.title).trim(),
          domain: ['software', 'hardware', 'hybrid'].includes(ip.domain) ? ip.domain : 'software',
          githubUrl: ip.githubUrl ? String(ip.githubUrl).trim() : '',
          technologies: techs,
          keywords: techs.map((t: string) => t.toLowerCase()),
          sourceDescription: bullets.join(' '),
          verifiedFacts: bullets,
          defaultBullets: bullets,
          metrics: bullets.slice(0, 2),
          priority: 1,
          createdAt: now,
          updatedAt: now,
        };
        // Prepend flagship project to user's catalogue
        db.projects = [newProj, ...db.projects.map((pr, idx) => ({ ...pr, priority: idx + 2 }))];
      }

      // 3. Add custom skills if provided during onboarding
      if (Array.isArray(req.body.customSkills) && req.body.customSkills.length > 0) {
        for (const sk of req.body.customSkills) {
          if (!sk.name) continue;
          const exists = db.skills.some(
            (existing) => existing.name.toLowerCase() === String(sk.name).trim().toLowerCase()
          );
          if (!exists) {
            db.skills.push({
              id: `sk-onboard-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
              name: String(sk.name).trim(),
              category: sk.category || 'Core Languages & Systems',
              stage: [1, 2, 3, 4].includes(Number(sk.stage)) ? (Number(sk.stage) as 1 | 2 | 3 | 4) : 1,
              verified: Number(sk.stage) !== 4,
              createdAt: now,
              updatedAt: now,
            });
          }
        }
      }

      // 4. Configure and compile the user's primary 1-page resume version
      const targetCompany = String(req.body.targetCompany || db.resumes[0]?.company || 'Stripe').trim();
      const targetRole = String(
        req.body.targetRole ||
          db.profile.calibrationAnswers.targetRoleAndCompanyType.split(' at ')[0] ||
          'Senior Software & Systems Engineer'
      ).trim();
      const targetJd = String(
        req.body.targetJobDescription ||
          db.resumes[0]?.jobDescription ||
          `Seeking a ${targetRole} at ${targetCompany} to design, build, and scale reliable production systems.`
      ).trim();

      const primaryResume = db.resumes[0];
      if (primaryResume) {
        primaryResume.company = targetCompany;
        primaryResume.role = targetRole;
        primaryResume.jobDescription = targetJd;
        primaryResume.selectedProjectIds = db.projects.slice(0, 3).map((p) => p.id);
        primaryResume.manuallyLockedProjectIds = [db.projects[0].id];

        const bulletsMap: Record<string, string[]> = {};
        for (const pid of primaryResume.selectedProjectIds) {
          const pr = db.projects.find((p) => p.id === pid);
          if (pr) bulletsMap[pid] = [...pr.defaultBullets];
        }
        primaryResume.projectBulletsMap = bulletsMap;

        const selectedProjects = primaryResume.selectedProjectIds
          .map((pid) => db.projects.find((p) => p.id === pid)!)
          .filter(Boolean);

        const tex = generateCompleteLatexResume({
          template: db.templates[0],
          profile: db.profile,
          selectedProjects,
          projectBulletsMap: bulletsMap,
          skills: db.skills,
          stageConfig: db.skillStageConfig,
          targetCompany,
          targetRole,
        });

        const hash = computeSourceHash(tex);
        const compiled = await compileAndValidateLatexSource({
          latexSource: tex,
          expectedSourceHash: hash,
          stage4Skills: db.skills.filter((s) => s.stage === 4),
        });

        primaryResume.generatedLatexSource = tex;
        primaryResume.savedLatexSource = tex;
        primaryResume.savedSourceHash = hash;
        primaryResume.compiledSourceHash = hash;
        primaryResume.compilationResult = compiled;
        primaryResume.isPdfStale = false;
        primaryResume.updatedAt = now;
      }

      if (!db.auth) {
        db.auth = {
          email: db.profile.email.toLowerCase(),
          passwordHash: '',
          salt: '',
          onboardingCompleted: true,
          onboardingStep: 4,
          createdAt: now,
          lastLoginAt: now,
        };
      } else {
        db.auth.onboardingCompleted = true;
        db.auth.onboardingStep = 4;
      }

      saveDatabase(db, userId);
      const users = await listAvailableUsers();

      res.json({
        success: true,
        onboardingCompleted: true,
        user: formatUserSummary(db),
        users,
        profile: db.profile,
        projects: db.projects,
        skills: db.skills,
        resumes: db.resumes,
      });
    } catch (err: any) {
      res.status(400).json({ error: err?.message || 'Failed to complete onboarding' });
    }
  });

  // Allow re-opening onboarding wizard for any user
  app.post('/api/onboarding/reset', async (req, res) => {
    try {
      const userId = resolveUserId(req);
      const db = await loadDatabase(userId);
      if (db.auth) {
        db.auth.onboardingCompleted = false;
        db.auth.onboardingStep = 1;
      }
      saveDatabase(db, userId);
      res.json({ onboardingCompleted: false });
    } catch (err: any) {
      res.status(400).json({ error: err?.message || 'Failed to reset onboarding' });
    }
  });

  // 0. Multi-User Account Directory & Creation
  app.get('/api/users', async (_req, res) => {
    try {
      const users = await listAvailableUsers();
      res.json({ users });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to list users' });
    }
  });

  app.post('/api/users', async (req, res) => {
    try {
      const fullName = String(req.body.fullName || 'New Candidate').trim();
      const email = String(req.body.email || `${fullName.toLowerCase().replace(/\s+/g, '.')}@example.com`).trim();
      const password = String(req.body.password || 'demo1234');
      const targetRole = String(req.body.targetRole || 'Senior Software Engineer').trim();

      const registered = await registerUserAccount({
        fullName,
        email,
        password,
        targetRole,
      });

      res.json({
        userId: registered.userId,
        token: registered.token,
        user: registered.user,
        users: registered.users,
      });
    } catch (err: any) {
      res.status(400).json({ error: err?.message || 'Failed to create user profile' });
    }
  });

  // 1. Get full application state for active user
  app.get('/api/state', async (req, res) => {
    try {
      const userId = resolveUserId(req);
      const db = await loadDatabase(userId);
      const users = await listAvailableUsers();
      res.json({
        userId,
        onboardingCompleted: db.auth ? db.auth.onboardingCompleted : true,
        users,
        profile: db.profile,
        projects: [...db.projects].sort((a, b) => (a.priority || 99) - (b.priority || 99)),
        skills: db.skills,
        eligibleSkills: filterEligibleResumeSkills(db.skills),
        skillStageConfig: db.skillStageConfig,
        templates: db.templates,
        resumes: db.resumes
          .filter((r) => r.userId === userId)
          .sort((a, b) => b.versionNumber - a.versionNumber),
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to load state' });
    }
  });

  // 2. Update Candidate Profile & Stage 1 Calibration
  app.put('/api/profile', async (req, res) => {
    try {
      const userId = resolveUserId(req);
      const db = await loadDatabase(userId);
      db.profile = {
        ...db.profile,
        ...req.body,
        calibrationAnswers: {
          ...db.profile.calibrationAnswers,
          ...(req.body.calibrationAnswers || {}),
          updatedAt: new Date().toISOString(),
        },
      };
      saveDatabase(db, userId);
      res.json({ profile: db.profile });
    } catch (err: any) {
      res.status(400).json({ error: err?.message || 'Failed to update profile' });
    }
  });

  // 3. Project Catalogue CRUD (User-Isolated)
  app.post('/api/projects', async (req, res) => {
    try {
      const userId = resolveUserId(req);
      const db = await loadDatabase(userId);
      const now = new Date().toISOString();
      const newProject: ProjectItem = {
        id: `proj-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        title: String(req.body.title || 'Untitled Project').trim(),
        sourceDescription: String(req.body.sourceDescription || '').trim(),
        verifiedFacts: Array.isArray(req.body.verifiedFacts)
          ? req.body.verifiedFacts.filter(Boolean)
          : [],
        defaultBullets: Array.isArray(req.body.defaultBullets)
          ? req.body.defaultBullets.filter(Boolean)
          : [],
        domain: ['software', 'hardware', 'hybrid'].includes(req.body.domain)
          ? req.body.domain
          : 'software',
        technologies: Array.isArray(req.body.technologies)
          ? req.body.technologies.filter(Boolean)
          : [],
        keywords: Array.isArray(req.body.keywords) ? req.body.keywords.filter(Boolean) : [],
        githubUrl: req.body.githubUrl ? String(req.body.githubUrl).trim() : '',
        priority: Number(req.body.priority) || db.projects.length + 1,
        metrics: Array.isArray(req.body.metrics) ? req.body.metrics.filter(Boolean) : [],
        createdAt: now,
        updatedAt: now,
      };
      db.projects.push(newProject);
      saveDatabase(db, userId);
      res.json({ project: newProject, projects: db.projects });
    } catch (err: any) {
      res.status(400).json({ error: err?.message || 'Failed to create project' });
    }
  });

  app.put('/api/projects/:id', async (req, res) => {
    try {
      const userId = resolveUserId(req);
      const db = await loadDatabase(userId);
      const idx = db.projects.findIndex((p) => p.id === req.params.id);
      if (idx === -1) return res.status(404).json({ error: 'Project not found' });

      db.projects[idx] = {
        ...db.projects[idx],
        ...req.body,
        id: db.projects[idx].id,
        updatedAt: new Date().toISOString(),
      };
      saveDatabase(db, userId);
      res.json({ project: db.projects[idx], projects: db.projects });
    } catch (err: any) {
      res.status(400).json({ error: err?.message || 'Failed to update project' });
    }
  });

  app.delete('/api/projects/:id', async (req, res) => {
    try {
      const userId = resolveUserId(req);
      const db = await loadDatabase(userId);
      const deletedId = req.params.id;
      db.projects = db.projects.filter((p) => p.id !== deletedId);

      // Clean up any dangling references to the deleted project across user's resumes
      const tpl = db.templates[0];
      for (const resume of db.resumes) {
        if (resume.selectedProjectIds.includes(deletedId)) {
          resume.selectedProjectIds = resume.selectedProjectIds.filter((id) => id !== deletedId);
          resume.manuallyLockedProjectIds = resume.manuallyLockedProjectIds.filter(
            (id) => id !== deletedId
          );
          delete resume.projectBulletsMap[deletedId];
          const selectedProjects = resume.selectedProjectIds
            .map((id) => db.projects.find((p) => p.id === id)!)
            .filter(Boolean);
          resume.pageFitAnalysis = calculatePageFitAndSuggestions({
            profile: db.profile,
            selectedProjects,
            manuallyLockedProjectIds: resume.manuallyLockedProjectIds,
            projectBulletsMap: resume.projectBulletsMap,
            spacingConfig: { ...tpl.spacingConfig, ...(resume.spacingOverrides || {}) },
          });
        }
      }

      saveDatabase(db, userId);
      res.json({ projects: db.projects, resumes: db.resumes });
    } catch (err: any) {
      res.status(400).json({ error: err?.message || 'Failed to delete project' });
    }
  });

  // 4. Skills & Four-Stage Configuration CRUD
  app.post('/api/skills', async (req, res) => {
    try {
      const userId = resolveUserId(req);
      const db = await loadDatabase(userId);
      const stageNum = Number(req.body.stage);
      if (![1, 2, 3, 4].includes(stageNum)) {
        return res.status(400).json({ error: 'Skill stage must be 1, 2, 3, or 4.' });
      }
      const now = new Date().toISOString();
      const newSkill: SkillItem = {
        id: `sk-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        name: String(req.body.name || '').trim(),
        category: String(req.body.category || 'General').trim(),
        stage: stageNum as 1 | 2 | 3 | 4,
        verified: req.body.verified !== false,
        createdAt: now,
        updatedAt: now,
      };
      db.skills.push(newSkill);
      saveDatabase(db, userId);
      res.json({
        skill: newSkill,
        skills: db.skills,
        eligibleSkills: filterEligibleResumeSkills(db.skills),
      });
    } catch (err: any) {
      res.status(400).json({ error: err?.message || 'Failed to add skill' });
    }
  });

  app.put('/api/skills/:id', async (req, res) => {
    try {
      const userId = resolveUserId(req);
      const db = await loadDatabase(userId);
      const idx = db.skills.findIndex((s) => s.id === req.params.id);
      if (idx === -1) return res.status(404).json({ error: 'Skill not found' });

      const stageNum =
        req.body.stage !== undefined ? Number(req.body.stage) : db.skills[idx].stage;
      if (![1, 2, 3, 4].includes(stageNum)) {
        return res.status(400).json({ error: 'Skill stage must be 1, 2, 3, or 4.' });
      }
      db.skills[idx] = {
        ...db.skills[idx],
        ...req.body,
        stage: stageNum as 1 | 2 | 3 | 4,
        updatedAt: new Date().toISOString(),
      };
      saveDatabase(db, userId);
      res.json({
        skill: db.skills[idx],
        skills: db.skills,
        eligibleSkills: filterEligibleResumeSkills(db.skills),
      });
    } catch (err: any) {
      res.status(400).json({ error: err?.message || 'Failed to update skill' });
    }
  });

  app.delete('/api/skills/:id', async (req, res) => {
    try {
      const userId = resolveUserId(req);
      const db = await loadDatabase(userId);
      db.skills = db.skills.filter((s) => s.id !== req.params.id);
      saveDatabase(db, userId);
      res.json({
        skills: db.skills,
        eligibleSkills: filterEligibleResumeSkills(db.skills),
      });
    } catch (err: any) {
      res.status(400).json({ error: err?.message || 'Failed to delete skill' });
    }
  });

  app.put('/api/skills-config', async (req, res) => {
    try {
      const userId = resolveUserId(req);
      const db = await loadDatabase(userId);
      db.skillStageConfig = {
        ...db.skillStageConfig,
        ...req.body,
      };
      saveDatabase(db, userId);
      res.json({ skillStageConfig: db.skillStageConfig });
    } catch (err: any) {
      res.status(400).json({ error: err?.message || 'Failed to update skill stage labels' });
    }
  });

  // 5. LaTeX Template Management & Versioning
  app.put('/api/templates/:id', async (req, res) => {
    try {
      const userId = resolveUserId(req);
      const db = await loadDatabase(userId);
      const tpl = db.templates.find((t) => t.id === req.params.id) || db.templates[0];
      if (!tpl) return res.status(404).json({ error: 'Template not found' });

      const nextVersion = tpl.version + 1;
      const now = new Date().toISOString();

      if (req.body.name) tpl.name = String(req.body.name);
      if (req.body.latexSource) tpl.latexSource = String(req.body.latexSource);
      if (req.body.sectionConfig) {
        tpl.sectionConfig = { ...tpl.sectionConfig, ...req.body.sectionConfig };
      }
      if (req.body.spacingConfig) {
        const sc = req.body.spacingConfig;
        tpl.spacingConfig = {
          marginInches: Math.max(
            0.35,
            Math.min(0.85, Number(sc.marginInches ?? tpl.spacingConfig.marginInches))
          ),
          itemSepPt: Math.max(
            -5,
            Math.min(2, Number(sc.itemSepPt ?? tpl.spacingConfig.itemSepPt))
          ),
          sectionSpacePt: Math.max(
            -10,
            Math.min(2, Number(sc.sectionSpacePt ?? tpl.spacingConfig.sectionSpacePt))
          ),
          maxBulletsPerProject: Math.max(
            1,
            Math.min(5, Number(sc.maxBulletsPerProject ?? tpl.spacingConfig.maxBulletsPerProject))
          ),
          fontSizePt: sc.fontSizePt === 11 ? 11 : 10,
        };
      }

      tpl.version = nextVersion;
      tpl.updatedAt = now;
      tpl.history.unshift({
        version: nextVersion,
        name: tpl.name,
        latexSource: tpl.latexSource,
        sectionConfig: structuredClone(tpl.sectionConfig),
        spacingConfig: structuredClone(tpl.spacingConfig),
        savedAt: now,
        changeNote: String(req.body.changeNote || `Saved template version v${nextVersion}`),
      });

      saveDatabase(db, userId);
      res.json({ template: tpl });
    } catch (err: any) {
      res.status(400).json({ error: err?.message || 'Failed to save template version' });
    }
  });

  app.post('/api/templates/:id/restore', async (req, res) => {
    try {
      const userId = resolveUserId(req);
      const db = await loadDatabase(userId);
      const tpl = db.templates.find((t) => t.id === req.params.id) || db.templates[0];
      if (!tpl) return res.status(404).json({ error: 'Template not found' });

      const targetVersion = Number(req.body.version);
      const snapshot = tpl.history.find((h) => h.version === targetVersion);
      if (!snapshot) return res.status(404).json({ error: 'Template version snapshot not found' });

      const nextVer = tpl.version + 1;
      const now = new Date().toISOString();
      tpl.name = snapshot.name;
      tpl.latexSource = snapshot.latexSource;
      tpl.sectionConfig = structuredClone(snapshot.sectionConfig);
      tpl.spacingConfig = structuredClone(snapshot.spacingConfig);
      tpl.version = nextVer;
      tpl.updatedAt = now;
      tpl.history.unshift({
        version: nextVer,
        name: tpl.name,
        latexSource: tpl.latexSource,
        sectionConfig: structuredClone(tpl.sectionConfig),
        spacingConfig: structuredClone(tpl.spacingConfig),
        savedAt: now,
        changeNote: `Restored from template v${targetVersion}`,
      });

      saveDatabase(db, userId);
      res.json({ template: tpl });
    } catch (err: any) {
      res.status(400).json({ error: err?.message || 'Failed to restore template version' });
    }
  });

  // 6. Create a new Resume Version (Strictly User-Scoped & Compiled Out-of-the-Box!)
  app.post('/api/resumes', async (req, res) => {
    try {
      const userId = resolveUserId(req);
      const db = await loadDatabase(userId);
      const maxVer = db.resumes.reduce((max, r) => Math.max(max, r.versionNumber), 0);
      const nextVer = maxVer + 1;
      const now = new Date().toISOString();
      const tpl = db.templates[0];

      // Strictly scope parent lookup to the same userId
      const parent = req.body.parentVersionId
        ? db.resumes.find((r) => r.id === req.body.parentVersionId && r.userId === userId)
        : undefined;

      const selectedProjectIds: string[] = parent
        ? parent.selectedProjectIds.filter((id) => db.projects.some((p) => p.id === id))
        : Array.isArray(req.body.selectedProjectIds) && req.body.selectedProjectIds.length > 0
          ? req.body.selectedProjectIds.filter((id: string) =>
              db.projects.some((p) => p.id === id)
            )
          : db.projects.slice(0, 3).map((p) => p.id);

      const manuallyLockedProjectIds: string[] = parent
        ? parent.manuallyLockedProjectIds.filter((id) => selectedProjectIds.includes(id))
        : Array.isArray(req.body.manuallyLockedProjectIds)
          ? req.body.manuallyLockedProjectIds
          : [];

      const projectBulletsMap: Record<string, string[]> = parent
        ? structuredClone(parent.projectBulletsMap)
        : {};

      for (const proj of db.projects) {
        if (!projectBulletsMap[proj.id]) {
          projectBulletsMap[proj.id] = [...proj.defaultBullets];
        }
      }

      const eligibleSkills = filterEligibleResumeSkills(db.skills);
      const selectedSkillIds = eligibleSkills.map((s) => s.id);

      const selectedProjects = selectedProjectIds
        .map((id) => db.projects.find((p) => p.id === id)!)
        .filter(Boolean);

      const company = String(req.body.company ?? parent?.company ?? 'Target Company').trim();
      const role = String(req.body.role ?? parent?.role ?? 'Software Engineer').trim();
      const jobDescription = String(
        req.body.jobDescription ?? parent?.jobDescription ?? ''
      ).trim();

      const generatedLatex = generateCompleteLatexResume({
        template: tpl,
        profile: db.profile,
        selectedProjects,
        projectBulletsMap,
        skills: eligibleSkills,
        stageConfig: db.skillStageConfig,
        targetCompany: company,
        targetRole: role,
      });

      const sourceHash = computeSourceHash(generatedLatex);
      const pageFit = calculatePageFitAndSuggestions({
        profile: db.profile,
        selectedProjects,
        manuallyLockedProjectIds,
        projectBulletsMap,
        spacingConfig: tpl.spacingConfig,
        latexSourceOverride: generatedLatex,
      });

      // Pre-compile the new version immediately so its 1-page PDF is ready right away
      const stage4Skills = db.skills.filter((s) => s.stage === 4);
      const compiled = await compileAndValidateLatexSource({
        latexSource: generatedLatex,
        expectedSourceHash: sourceHash,
        stage4Skills,
      });

      const newResume: ResumeVersion = {
        id: `res-ver-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        userId,
        versionNumber: nextVer,
        parentVersionId: parent?.id,
        company,
        role,
        jobDescription,
        roleMode: req.body.roleMode || parent?.roleMode || 'all',
        jobStatus: compiled.isOnePageValid ? 'COMPLETED' : 'DRAFT_READY',
        templateId: tpl.id,
        templateVersion: tpl.version,
        aiRecommendations: parent ? structuredClone(parent.aiRecommendations) : [],
        selectedProjectIds,
        manuallyLockedProjectIds,
        projectBulletsMap,
        bulletSurgeonHistory: parent ? structuredClone(parent.bulletSurgeonHistory) : {},
        selectedSkillIds,
        jobAnalysis: parent?.jobAnalysis ? structuredClone(parent.jobAnalysis) : undefined,
        pageFitAnalysis: pageFit,
        aiGeneratedLatex: generatedLatex,
        savedLatexSource: generatedLatex,
        savedSourceHash: sourceHash,
        isUserEdited: false,
        compiledSourceHash: compiled.isOnePageValid ? sourceHash : undefined,
        isPdfStale: !compiled.isOnePageValid,
        compilationResult: compiled,
        auditLog: [
          createAuditEntry(
            'DRAFT_CREATED',
            'user',
            `Created Resume Version v${nextVer} for ${company} — ${role}.`,
            sourceHash
          ),
        ],
        createdAt: now,
        updatedAt: now,
      };

      db.resumes.unshift(newResume);
      saveDatabase(db, userId);
      res.json({ resume: newResume, resumes: db.resumes });
    } catch (err: any) {
      res.status(400).json({ error: err?.message || 'Failed to create resume version' });
    }
  });

  // Delete Resume Version
  app.delete('/api/resumes/:id', async (req, res) => {
    try {
      const userId = resolveUserId(req);
      const db = await loadDatabase(userId);
      const target = db.resumes.find((r) => r.id === req.params.id);
      if (!target) return res.status(404).json({ error: 'Resume version not found' });
      if (target.userId !== userId) {
        return res.status(403).json({ error: 'Unauthorized: You do not own this resume version' });
      }
      db.resumes = db.resumes.filter((r) => r.id !== req.params.id);
      saveDatabase(db, userId);
      res.json({ resumes: db.resumes });
    } catch (err: any) {
      res.status(400).json({ error: err?.message || 'Failed to delete resume version' });
    }
  });

  // 7. AI Job Analysis & Project Recommendations (NEVER overwrites manual selections!)
  app.post('/api/resumes/:id/analyze', async (req, res) => {
    try {
      const userId = resolveUserId(req);
      const db = await loadDatabase(userId);
      const resume = db.resumes.find((r) => r.id === req.params.id);
      if (!resume) return res.status(404).json({ error: 'Resume version not found' });
      if (resume.userId !== userId) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      if (req.body.company !== undefined) resume.company = String(req.body.company).trim();
      if (req.body.role !== undefined) resume.role = String(req.body.role).trim();
      if (req.body.jobDescription !== undefined) {
        resume.jobDescription = String(req.body.jobDescription).trim();
      }
      if (req.body.roleMode !== undefined) resume.roleMode = req.body.roleMode;

      resume.jobStatus = 'ANALYZING';
      saveDatabase(db, userId);

      const [jobAnalysis, recommendations, skillMatches] = await Promise.all([
        analyzeJobDescription({
          company: resume.company,
          role: resume.role,
          jobDescription: resume.jobDescription,
          verifiedSkills: db.skills,
          projects: db.projects,
          profile: db.profile,
        }),
        recommendProjects({
          company: resume.company,
          role: resume.role,
          jobDescription: resume.jobDescription,
          roleMode: resume.roleMode,
          projects: db.projects,
        }),
        analyzeSkillMatches({
          jobDescription: resume.jobDescription,
          allSkills: db.skills,
        }),
      ]);

      // Preserve manual selections and locks when new recommendations arrive!
      const reconciled = reconcileProjectSelections({
        currentSelectedIds: resume.selectedProjectIds,
        manuallyLockedIds: resume.manuallyLockedProjectIds,
        newRecommendedIds: recommendations.map((r) => r.projectId),
      });

      resume.jobAnalysis = jobAnalysis;
      resume.aiRecommendations = recommendations;
      resume.selectedProjectIds = reconciled.selectedProjectIds;
      resume.manuallyLockedProjectIds = reconciled.manuallyLockedProjectIds;
      resume.selectedSkillIds = skillMatches.prioritizedSkillIds;
      resume.jobStatus = 'DRAFT_READY';
      resume.updatedAt = new Date().toISOString();

      resume.auditLog.unshift(
        createAuditEntry(
          'JD_ANALYZED',
          'ai',
          `Analyzed JD for ${resume.company} (${resume.role}) and ranked ${recommendations.length} projects without modifying manual selections.`
        )
      );

      saveDatabase(db, userId);
      res.json({ resume, skillMatchSummary: skillMatches });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'AI Job Analysis failed' });
    }
  });

  // 8. Manual Project Selection, Lock, Ordering & Metadata Updates
  app.put('/api/resumes/:id/selection', async (req, res) => {
    try {
      const userId = resolveUserId(req);
      const db = await loadDatabase(userId);
      const resume = db.resumes.find((r) => r.id === req.params.id);
      if (!resume) return res.status(404).json({ error: 'Resume version not found' });
      if (resume.userId !== userId) return res.status(403).json({ error: 'Forbidden' });

      if (req.body.company !== undefined) resume.company = String(req.body.company);
      if (req.body.role !== undefined) resume.role = String(req.body.role);
      if (req.body.jobDescription !== undefined) {
        resume.jobDescription = String(req.body.jobDescription);
      }
      if (req.body.roleMode !== undefined) resume.roleMode = req.body.roleMode;

      if (Array.isArray(req.body.selectedProjectIds)) {
        resume.selectedProjectIds = req.body.selectedProjectIds.filter((id: string) =>
          db.projects.some((p) => p.id === id)
        );
      }
      if (Array.isArray(req.body.manuallyLockedProjectIds)) {
        resume.manuallyLockedProjectIds = req.body.manuallyLockedProjectIds.filter((id: string) =>
          resume.selectedProjectIds.includes(id)
        );
      }
      if (Array.isArray(req.body.selectedSkillIds)) {
        const eligibleIds = new Set(filterEligibleResumeSkills(db.skills).map((s) => s.id));
        resume.selectedSkillIds = req.body.selectedSkillIds.filter((id: string) =>
          eligibleIds.has(id)
        );
      }
      if (req.body.spacingOverrides) {
        resume.spacingOverrides = {
          ...(resume.spacingOverrides || {}),
          ...req.body.spacingOverrides,
        };
      }

      const tpl = db.templates.find((t) => t.id === resume.templateId) || db.templates[0];
      const selectedProjects = resume.selectedProjectIds
        .map((id) => db.projects.find((p) => p.id === id)!)
        .filter(Boolean);

      resume.pageFitAnalysis = calculatePageFitAndSuggestions({
        profile: db.profile,
        selectedProjects,
        manuallyLockedProjectIds: resume.manuallyLockedProjectIds,
        projectBulletsMap: resume.projectBulletsMap,
        spacingConfig: { ...tpl.spacingConfig, ...(resume.spacingOverrides || {}) },
      });

      resume.updatedAt = new Date().toISOString();
      resume.auditLog.unshift(
        createAuditEntry(
          'MANUAL_PROJECT_SELECTION_UPDATED',
          'user',
          `Updated manual project selection (${resume.selectedProjectIds.length} selected, ${resume.manuallyLockedProjectIds.length} locked).`
        )
      );

      saveDatabase(db, userId);
      res.json({ resume });
    } catch (err: any) {
      res.status(400).json({ error: err?.message || 'Failed to update selection' });
    }
  });

  // 9. STAGE 3, THE SURGEON — AI Bullet Tailoring & Manual Bullet Editing
  app.post('/api/resumes/:id/tailor-bullets', async (req, res) => {
    try {
      const userId = resolveUserId(req);
      const db = await loadDatabase(userId);
      const resume = db.resumes.find((r) => r.id === req.params.id);
      if (!resume) return res.status(404).json({ error: 'Resume version not found' });
      if (resume.userId !== userId) return res.status(403).json({ error: 'Forbidden' });

      const tpl = db.templates.find((t) => t.id === resume.templateId) || db.templates[0];
      const maxBullets =
        resume.spacingOverrides?.maxBulletsPerProject || tpl.spacingConfig.maxBulletsPerProject || 3;

      const targetProjectIds: string[] = req.body.projectId
        ? [String(req.body.projectId)]
        : resume.selectedProjectIds;

      for (const pid of targetProjectIds) {
        const proj = db.projects.find((p) => p.id === pid);
        if (!proj) continue;
        const tailored = await tailorProjectBullets({
          project: proj,
          company: resume.company,
          role: resume.role,
          jobDescription: resume.jobDescription,
          maxBullets,
        });
        resume.projectBulletsMap[pid] = tailored.bullets;
        resume.bulletSurgeonHistory[pid] = tailored.surgeonHistory;
      }

      const selectedProjects = resume.selectedProjectIds
        .map((id) => db.projects.find((p) => p.id === id)!)
        .filter(Boolean);

      resume.pageFitAnalysis = calculatePageFitAndSuggestions({
        profile: db.profile,
        selectedProjects,
        manuallyLockedProjectIds: resume.manuallyLockedProjectIds,
        projectBulletsMap: resume.projectBulletsMap,
        spacingConfig: { ...tpl.spacingConfig, ...(resume.spacingOverrides || {}) },
      });

      resume.updatedAt = new Date().toISOString();
      resume.auditLog.unshift(
        createAuditEntry(
          'BULLETS_TAILORED',
          'ai',
          `Tailored project bullets via STAGE 3, THE SURGEON (Google XYZ structure) for ${targetProjectIds.length} project(s).`
        )
      );

      saveDatabase(db, userId);
      res.json({ resume });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to tailor bullets' });
    }
  });

  app.put('/api/resumes/:id/bullets', async (req, res) => {
    try {
      const userId = resolveUserId(req);
      const db = await loadDatabase(userId);
      const resume = db.resumes.find((r) => r.id === req.params.id);
      if (!resume) return res.status(404).json({ error: 'Resume version not found' });
      if (resume.userId !== userId) return res.status(403).json({ error: 'Forbidden' });

      const { projectId, bullets } = req.body;
      if (!projectId || !Array.isArray(bullets)) {
        return res.status(400).json({ error: 'projectId and bullets array required' });
      }
      resume.projectBulletsMap[projectId] = bullets.map((b: string) => String(b));

      const tpl = db.templates.find((t) => t.id === resume.templateId) || db.templates[0];
      const selectedProjects = resume.selectedProjectIds
        .map((id) => db.projects.find((p) => p.id === id)!)
        .filter(Boolean);

      resume.pageFitAnalysis = calculatePageFitAndSuggestions({
        profile: db.profile,
        selectedProjects,
        manuallyLockedProjectIds: resume.manuallyLockedProjectIds,
        projectBulletsMap: resume.projectBulletsMap,
        spacingConfig: { ...tpl.spacingConfig, ...(resume.spacingOverrides || {}) },
      });

      resume.updatedAt = new Date().toISOString();
      saveDatabase(db, userId);
      res.json({ resume });
    } catch (err: any) {
      res.status(400).json({ error: err?.message || 'Failed to update project bullets' });
    }
  });

  // 10. Generate / Render LaTeX Source from Confirmed Selection
  app.post('/api/resumes/:id/render-latex', async (req, res) => {
    try {
      const userId = resolveUserId(req);
      const db = await loadDatabase(userId);
      const resume = db.resumes.find((r) => r.id === req.params.id);
      if (!resume) return res.status(404).json({ error: 'Resume version not found' });
      if (resume.userId !== userId) return res.status(403).json({ error: 'Forbidden' });

      resume.jobStatus = 'RENDERING';
      const tpl = db.templates.find((t) => t.id === resume.templateId) || db.templates[0];
      const selectedProjects = resume.selectedProjectIds
        .map((id) => db.projects.find((p) => p.id === id)!)
        .filter(Boolean);

      const eligibleSkills = filterEligibleResumeSkills(db.skills).filter((s) =>
        resume.selectedSkillIds.includes(s.id)
      );

      const renderedLatex = generateCompleteLatexResume({
        template: tpl,
        profile: db.profile,
        selectedProjects,
        projectBulletsMap: resume.projectBulletsMap,
        skills: eligibleSkills.length > 0 ? eligibleSkills : filterEligibleResumeSkills(db.skills),
        stageConfig: db.skillStageConfig,
        spacingOverrides: resume.spacingOverrides,
        targetCompany: resume.company,
        targetRole: resume.role,
      });

      resume.aiGeneratedLatex = renderedLatex;

      const forceOverwrite = Boolean(req.body.forceOverwriteEditor);
      if (!resume.isUserEdited || forceOverwrite) {
        resume.savedLatexSource = renderedLatex;
        resume.savedSourceHash = computeSourceHash(renderedLatex);
        resume.isUserEdited = false;
        resume.isPdfStale = resume.savedSourceHash !== resume.compiledSourceHash;
      }

      resume.pageFitAnalysis = calculatePageFitAndSuggestions({
        profile: db.profile,
        selectedProjects,
        manuallyLockedProjectIds: resume.manuallyLockedProjectIds,
        projectBulletsMap: resume.projectBulletsMap,
        spacingConfig: { ...tpl.spacingConfig, ...(resume.spacingOverrides || {}) },
        latexSourceOverride: resume.savedLatexSource,
      });

      resume.jobStatus = 'DRAFT_READY';
      resume.updatedAt = new Date().toISOString();
      resume.auditLog.unshift(
        createAuditEntry(
          'LATEX_RENDERED',
          'user',
          `Rendered LaTeX source from ${selectedProjects.length} selected projects.`,
          resume.savedSourceHash
        )
      );

      saveDatabase(db, userId);
      res.json({ resume });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to render LaTeX' });
    }
  });

  // 11. Save User-Edited Authoritative LaTeX Source to Database
  app.put('/api/resumes/:id/save-latex', async (req, res) => {
    try {
      const userId = resolveUserId(req);
      const db = await loadDatabase(userId);
      const resume = db.resumes.find((r) => r.id === req.params.id);
      if (!resume) return res.status(404).json({ error: 'Resume version not found' });
      if (resume.userId !== userId) return res.status(403).json({ error: 'Forbidden' });

      const latexSource = String(req.body.latexSource ?? '');
      if (!latexSource.trim()) {
        return res.status(400).json({ error: 'LaTeX source cannot be empty' });
      }

      const newHash = computeSourceHash(latexSource);
      resume.savedLatexSource = latexSource;
      resume.savedSourceHash = newHash;
      resume.isUserEdited = latexSource.trim() !== resume.aiGeneratedLatex.trim();
      resume.isPdfStale = newHash !== resume.compiledSourceHash;
      resume.updatedAt = new Date().toISOString();

      const tpl = db.templates.find((t) => t.id === resume.templateId) || db.templates[0];
      const selectedProjects = resume.selectedProjectIds
        .map((id) => db.projects.find((p) => p.id === id)!)
        .filter(Boolean);

      resume.pageFitAnalysis = calculatePageFitAndSuggestions({
        profile: db.profile,
        selectedProjects,
        manuallyLockedProjectIds: resume.manuallyLockedProjectIds,
        projectBulletsMap: resume.projectBulletsMap,
        spacingConfig: { ...tpl.spacingConfig, ...(resume.spacingOverrides || {}) },
        latexSourceOverride: latexSource,
      });

      resume.auditLog.unshift(
        createAuditEntry(
          'LATEX_SAVED',
          'user',
          `Saved authoritative LaTeX source (${latexSource.split('\n').length} lines, hash ${newHash}).`,
          newHash
        )
      );

      saveDatabase(db, userId);
      res.json({ resume });
    } catch (err: any) {
      res.status(400).json({ error: err?.message || 'Failed to save LaTeX source' });
    }
  });

  // 12. Compile Exact Saved LaTeX Source & Validate 1-Page PDF
  app.post('/api/resumes/:id/compile', async (req, res) => {
    try {
      const userId = resolveUserId(req);
      const db = await loadDatabase(userId);
      const resume = db.resumes.find((r) => r.id === req.params.id);
      if (!resume) return res.status(404).json({ error: 'Resume version not found' });
      if (resume.userId !== userId) return res.status(403).json({ error: 'Forbidden' });

      const expectedHash = req.body.expectedSourceHash || resume.savedSourceHash;
      resume.jobStatus = 'COMPILING';
      saveDatabase(db, userId);

      const stage4Skills = db.skills.filter((s) => s.stage === 4);
      resume.jobStatus = 'VALIDATING';

      const compilationResult = await compileAndValidateLatexSource({
        latexSource: resume.savedLatexSource,
        expectedSourceHash: expectedHash,
        stage4Skills,
      });

      resume.compilationResult = compilationResult;

      if (compilationResult.success && compilationResult.isOnePageValid) {
        resume.compiledSourceHash = compilationResult.sourceHash;
        resume.isPdfStale = false;
        resume.jobStatus = 'COMPLETED';
        resume.auditLog.unshift(
          createAuditEntry(
            'PDF_COMPILED',
            'worker',
            `Compiled exact saved source (${compilationResult.sourceHash}) and passed 1-page PDF validation (1 page, ${compilationResult.pdfSizeBytes} bytes).`,
            compilationResult.sourceHash
          )
        );
      } else {
        resume.jobStatus = 'FAILED';
        const reason =
          compilationResult.errors.length > 0
            ? compilationResult.errors[0]
            : `PDF page count is ${compilationResult.pageCount} (must be exactly 1 page).`;
        resume.auditLog.unshift(
          createAuditEntry(
            'PDF_VALIDATION_FAILED',
            'worker',
            `Compilation/Validation failed: ${reason}`,
            compilationResult.sourceHash
          )
        );
      }

      resume.updatedAt = new Date().toISOString();
      saveDatabase(db, userId);
      res.json({ resume, compilationResult });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'PDF compilation failed' });
    }
  });

  // 13. Explicit AI Page-Fit Optimization (Creates a SEPARATE new draft version; never mutates current version!)
  app.post('/api/resumes/:id/optimize-page-fit', async (req, res) => {
    try {
      const userId = resolveUserId(req);
      const db = await loadDatabase(userId);
      const sourceResume = db.resumes.find((r) => r.id === req.params.id);
      if (!sourceResume) return res.status(404).json({ error: 'Resume version not found' });
      if (sourceResume.userId !== userId) return res.status(403).json({ error: 'Forbidden' });

      const maxVer = db.resumes.reduce((max, r) => Math.max(max, r.versionNumber), 0);
      const nextVer = maxVer + 1;
      const now = new Date().toISOString();
      const tpl = db.templates.find((t) => t.id === sourceResume.templateId) || db.templates[0];

      const lockedSet = new Set(sourceResume.manuallyLockedProjectIds);
      const optimizedSelectedIds = sourceResume.selectedProjectIds.filter(
        (id, idx) => lockedSet.has(id) || idx < 3
      );

      const optimizedBulletsMap: Record<string, string[]> = {};
      for (const pid of optimizedSelectedIds) {
        const currentBullets = sourceResume.projectBulletsMap[pid] || [];
        optimizedBulletsMap[pid] = lockedSet.has(pid)
          ? currentBullets.slice(0, 3)
          : currentBullets.slice(0, 2);
      }

      const optimizedSpacing = {
        marginInches: 0.45,
        itemSepPt: -3,
        sectionSpacePt: -7,
        maxBulletsPerProject: 3,
        fontSizePt: 10 as const,
      };

      const selectedProjects = optimizedSelectedIds
        .map((id) => db.projects.find((p) => p.id === id)!)
        .filter(Boolean);

      const eligibleSkills = filterEligibleResumeSkills(db.skills).filter((s) =>
        sourceResume.selectedSkillIds.includes(s.id)
      );

      const optimizedLatex = generateCompleteLatexResume({
        template: tpl,
        profile: db.profile,
        selectedProjects,
        projectBulletsMap: optimizedBulletsMap,
        skills: eligibleSkills,
        stageConfig: db.skillStageConfig,
        spacingOverrides: optimizedSpacing,
        targetCompany: sourceResume.company,
        targetRole: sourceResume.role,
      });

      const newHash = computeSourceHash(optimizedLatex);
      const pageFit = calculatePageFitAndSuggestions({
        profile: db.profile,
        selectedProjects,
        manuallyLockedProjectIds: sourceResume.manuallyLockedProjectIds,
        projectBulletsMap: optimizedBulletsMap,
        spacingConfig: optimizedSpacing,
        latexSourceOverride: optimizedLatex,
      });

      const stage4Skills = db.skills.filter((s) => s.stage === 4);
      const compiled = await compileAndValidateLatexSource({
        latexSource: optimizedLatex,
        expectedSourceHash: newHash,
        stage4Skills,
      });

      const optimizedDraft: ResumeVersion = {
        ...structuredClone(sourceResume),
        id: `res-ver-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        userId,
        versionNumber: nextVer,
        parentVersionId: sourceResume.id,
        jobStatus: compiled.isOnePageValid ? 'COMPLETED' : 'DRAFT_READY',
        selectedProjectIds: optimizedSelectedIds,
        projectBulletsMap: optimizedBulletsMap,
        spacingOverrides: optimizedSpacing,
        pageFitAnalysis: pageFit,
        aiGeneratedLatex: optimizedLatex,
        savedLatexSource: optimizedLatex,
        savedSourceHash: newHash,
        isUserEdited: false,
        compiledSourceHash: compiled.isOnePageValid ? newHash : undefined,
        isPdfStale: !compiled.isOnePageValid,
        compilationResult: compiled,
        createdAt: now,
        updatedAt: now,
        auditLog: [
          createAuditEntry(
            'PAGE_FIT_OPTIMIZED',
            'ai',
            `Created separate one-page optimized draft v${nextVer} from v${sourceResume.versionNumber} (preserved all ${sourceResume.manuallyLockedProjectIds.length} locked project(s)).`,
            newHash
          ),
        ],
      };

      db.resumes.unshift(optimizedDraft);
      saveDatabase(db, userId);
      res.json({ optimizedResume: optimizedDraft, resumes: db.resumes });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to create optimized page-fit draft' });
    }
  });

  // 14. STAGE 4, THE EXAMINER — Interview Questions & Hedge Detection
  app.post('/api/resumes/:id/examiner', async (req, res) => {
    try {
      const userId = resolveUserId(req);
      const db = await loadDatabase(userId);
      const resume = db.resumes.find((r) => r.id === req.params.id);
      if (!resume) return res.status(404).json({ error: 'Resume version not found' });
      if (resume.userId !== userId) return res.status(403).json({ error: 'Forbidden' });

      if (req.body.action === 'evaluate' && req.body.questionNumber !== undefined) {
        const qNum = Number(req.body.questionNumber);
        const answerText = String(req.body.userAnswer || '');
        const evaluation = evaluateExaminerAnswerWithHedgeDetection(answerText);

        if (!resume.examinerQuestions) {
          resume.examinerQuestions = [];
        }
        const qIdx = resume.examinerQuestions.findIndex((q) => q.number === qNum);
        if (qIdx !== -1) {
          resume.examinerQuestions[qIdx] = {
            ...resume.examinerQuestions[qIdx],
            userAnswer: answerText,
            ...evaluation,
          };
        }
        saveDatabase(db, userId);
        return res.json({ resume, evaluation });
      }

      const selectedProjects = resume.selectedProjectIds
        .map((id) => db.projects.find((p) => p.id === id)!)
        .filter(Boolean);

      resume.examinerQuestions = buildExaminerQuestionBatch({
        company: resume.company,
        role: resume.role,
        selectedProjects,
        redFlags: resume.jobAnalysis?.threeRedFlags || [],
      });
      saveDatabase(db, userId);
      res.json({ resume });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Examiner operation failed' });
    }
  });

  // 15. Download Validated One-Page PDF & .tex Source (Supports ?userId=... for native <a> links)
  app.get('/api/resumes/:id/download/pdf', async (req, res) => {
    const userId = resolveUserId(req);
    const db = await loadDatabase(userId);
    const resume = db.resumes.find((r) => r.id === req.params.id);
    if (!resume) return res.status(404).json({ error: 'Resume not found' });
    if (resume.userId !== userId) return res.status(403).json({ error: 'Forbidden' });

    if (
      !resume.compilationResult ||
      !resume.compilationResult.isOnePageValid ||
      !resume.compilationResult.pdfBase64 ||
      resume.isPdfStale
    ) {
      return res.status(422).json({
        error:
          'Cannot download final PDF: Resume must be compiled from the current saved source and pass strict 1-page validation.',
      });
    }

    const safeName = `${resume.company}_${resume.role}_v${resume.versionNumber}`
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .replace(/_+/g, '_');
    const pdfBuffer = Buffer.from(resume.compilationResult.pdfBase64, 'base64');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}.pdf"`);
    res.send(pdfBuffer);
  });

  app.get('/api/resumes/:id/download/tex', async (req, res) => {
    const userId = resolveUserId(req);
    const db = await loadDatabase(userId);
    const resume = db.resumes.find((r) => r.id === req.params.id);
    if (!resume) return res.status(404).json({ error: 'Resume not found' });
    if (resume.userId !== userId) return res.status(403).json({ error: 'Forbidden' });

    const safeName = `${resume.company}_${resume.role}_v${resume.versionNumber}`
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .replace(/_+/g, '_');
    res.setHeader('Content-Type', 'application/x-tex; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}.tex"`);
    res.send(resume.savedLatexSource);
  });

  // 16. Run Automated Test Suite (Includes 2-Real-User End-to-End Verification)
  app.post('/api/tests/run', async (_req, res) => {
    try {
      const report = await runAllVerificationTests();
      res.json(report);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Test runner failed' });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const PORT = 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`LaTeXForge server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
