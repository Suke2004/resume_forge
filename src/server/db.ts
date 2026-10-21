import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import {
  CandidateProfile,
  LatexTemplate,
  ProjectItem,
  ResumeVersion,
  SkillItem,
  SkillStageConfig,
} from '../types/resume';
import { filterEligibleResumeSkills } from '../lib/latexEngine';
import { compileAndValidateLatexSource } from '../lib/pdfCompiler';
import {
  createInitialSeedResumeVersion,
  createUser2SeedResumeVersion,
  DEFAULT_SKILL_STAGE_CONFIG,
  INITIAL_CANDIDATE_PROFILE,
  INITIAL_PROJECTS,
  INITIAL_SKILLS,
  INITIAL_TEMPLATE,
  USER2_CANDIDATE_PROFILE,
  USER2_PROJECTS,
  USER2_SKILLS,
} from '../lib/seedData';
import { getSupabaseClient, isSupabaseConfigured } from './supabaseClient';

export interface UserAuthMetadata {
  email: string;
  passwordHash: string;
  salt: string;
  onboardingCompleted: boolean;
  onboardingStep: number;
  createdAt: string;
  lastLoginAt: string;
}

export interface DatabaseSchema {
  userId: string;
  auth?: UserAuthMetadata;
  profile: CandidateProfile;
  projects: ProjectItem[];
  skills: SkillItem[];
  skillStageConfig: SkillStageConfig;
  templates: LatexTemplate[];
  resumes: ResumeVersion[];
}

export interface SessionRecord {
  token: string;
  userId: string;
  email: string;
  createdAt: string;
}

export interface MultiUserDatabaseStore {
  users: Record<string, DatabaseSchema>;
  sessions?: Record<string, SessionRecord>;
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const MULTI_USER_DB_FILE = path.join(DATA_DIR, 'supabase-multiuser-store.json');
const CALIBRATION_DIR = path.resolve(process.cwd(), 'work', 'resume-system');

let memoryStore: MultiUserDatabaseStore | null = null;

function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  const usedSalt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, usedSalt, 64).toString('hex');
  return { hash, salt: usedSalt };
}

function verifyPassword(password: string, expectedHash: string, salt: string): boolean {
  const { hash } = hashPassword(password, salt);
  try {
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(expectedHash, 'hex'));
  } catch {
    return false;
  }
}

/**
 * Writes `work/resume-system/calibration-profile.md` (and per-user calibration markdown)
 * to persist Stage 1 (THE TRANSLATOR) calibration state alongside Supabase persistence.
 */
export function syncCalibrationMarkdownFile(db: DatabaseSchema): void {
  try {
    if (!fs.existsSync(CALIBRATION_DIR)) {
      fs.mkdirSync(CALIBRATION_DIR, { recursive: true });
    }
    const cal = db.profile.calibrationAnswers;
    const eligibleSkills = filterEligibleResumeSkills(db.skills);
    const stage4Skills = db.skills.filter((s) => s.stage === 4);

    const mdContent = `# Resume System Calibration Profile (STAGE 1, THE TRANSLATOR)

- **User ID**: ${db.userId}
- **Candidate**: ${db.profile.fullName} (${db.profile.email})
- **Onboarding Completed**: ${db.auth?.onboardingCompleted ?? true}
- **Last Updated**: ${cal.updatedAt}

## Stage 1 Interview Answers

1. **Exact Target Role & Company Type**:
   ${cal.targetRoleAndCompanyType}

2. **Three Genuine Differentiators**:
   ${cal.threeDifferentiators}

3. **Head-On Considerations (Gaps / Transitions / Visa / Timeline)**:
   ${cal.headOnAddressing}

## Verified Skill Stages Summary

- **${db.skillStageConfig.stage1Label}**: ${eligibleSkills
      .filter((s) => s.stage === 1)
      .map((s) => s.name)
      .join(', ')}
- **${db.skillStageConfig.stage2Label}**: ${eligibleSkills
      .filter((s) => s.stage === 2)
      .map((s) => s.name)
      .join(', ')}
- **${db.skillStageConfig.stage3Label}**: ${eligibleSkills
      .filter((s) => s.stage === 3)
      .map((s) => s.name)
      .join(', ')}
- **${db.skillStageConfig.stage4Label} (STRICTLY EXCLUDED FROM RESUME)**: ${stage4Skills
      .map((s) => s.name)
      .join(', ')}
`;

    fs.writeFileSync(path.join(CALIBRATION_DIR, 'calibration-profile.md'), mdContent, 'utf-8');
    fs.writeFileSync(
      path.join(CALIBRATION_DIR, `calibration-${db.userId}.md`),
      mdContent,
      'utf-8'
    );
  } catch (err) {
    console.warn('Could not write calibration-profile.md:', err);
  }
}

/**
 * Syncs a user's workspace state to Supabase PostgreSQL when credentials are configured in `.env`.
 */
async function syncUserWorkspaceToSupabase(userDb: DatabaseSchema): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) return;

  try {
    await supabase.from('user_workspaces').upsert(
      {
        user_id: userDb.userId,
        email: userDb.profile.email,
        full_name: userDb.profile.fullName,
        role_headline:
          userDb.resumes[0]?.role ||
          userDb.profile.calibrationAnswers.targetRoleAndCompanyType ||
          'Software Engineer',
        workspace_data: userDb,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    );

    if (userDb.projects.length > 0) {
      await supabase.from('projects').upsert(
        userDb.projects.map((p) => ({
          id: p.id,
          user_id: userDb.userId,
          title: p.title,
          domain: p.domain,
          source_description: p.sourceDescription,
          verified_facts: p.verifiedFacts,
          default_bullets: p.defaultBullets,
          technologies: p.technologies,
          keywords: p.keywords,
          metrics: p.metrics,
          github_url: p.githubUrl || '',
          updated_at: p.updatedAt,
        })),
        { onConflict: 'user_id,id' }
      );
    }

    if (userDb.skills.length > 0) {
      await supabase.from('skills').upsert(
        userDb.skills.map((s) => ({
          id: s.id,
          user_id: userDb.userId,
          name: s.name,
          category: s.category,
          stage: s.stage,
        })),
        { onConflict: 'user_id,id' }
      );
    }
  } catch (err) {
    console.warn(`Supabase sync warning for user ${userDb.userId}:`, err);
  }
}

async function fetchUserWorkspaceFromSupabase(userId: string): Promise<DatabaseSchema | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from('user_workspaces')
      .select('workspace_data')
      .eq('user_id', userId)
      .maybeSingle();

    if (error || !data?.workspace_data) return null;
    return data.workspace_data as DatabaseSchema;
  } catch {
    return null;
  }
}

async function createSeedWorkspaceForUser1(): Promise<DatabaseSchema> {
  const seedVersion = createInitialSeedResumeVersion();
  seedVersion.userId = 'user-owner-1';
  const compiled = await compileAndValidateLatexSource({
    latexSource: seedVersion.savedLatexSource,
    expectedSourceHash: seedVersion.savedSourceHash,
    stage4Skills: INITIAL_SKILLS.filter((s) => s.stage === 4),
  });
  seedVersion.compilationResult = compiled;

  const { hash, salt } = hashPassword('demo1234');
  const now = new Date().toISOString();

  return {
    userId: 'user-owner-1',
    auth: {
      email: INITIAL_CANDIDATE_PROFILE.email.toLowerCase(),
      passwordHash: hash,
      salt,
      onboardingCompleted: true,
      onboardingStep: 4,
      createdAt: now,
      lastLoginAt: now,
    },
    profile: structuredClone(INITIAL_CANDIDATE_PROFILE),
    projects: structuredClone(INITIAL_PROJECTS),
    skills: structuredClone(INITIAL_SKILLS),
    skillStageConfig: structuredClone(DEFAULT_SKILL_STAGE_CONFIG),
    templates: [structuredClone(INITIAL_TEMPLATE)],
    resumes: [seedVersion],
  };
}

async function createSeedWorkspaceForUser2(): Promise<DatabaseSchema> {
  const seedVersion = createUser2SeedResumeVersion();
  seedVersion.userId = 'user-owner-2';
  const compiled = await compileAndValidateLatexSource({
    latexSource: seedVersion.savedLatexSource,
    expectedSourceHash: seedVersion.savedSourceHash,
    stage4Skills: USER2_SKILLS.filter((s) => s.stage === 4),
  });
  seedVersion.compilationResult = compiled;

  const { hash, salt } = hashPassword('demo1234');
  const now = new Date().toISOString();

  return {
    userId: 'user-owner-2',
    auth: {
      email: USER2_CANDIDATE_PROFILE.email.toLowerCase(),
      passwordHash: hash,
      salt,
      onboardingCompleted: true,
      onboardingStep: 4,
      createdAt: now,
      lastLoginAt: now,
    },
    profile: structuredClone(USER2_CANDIDATE_PROFILE),
    projects: structuredClone(USER2_PROJECTS),
    skills: structuredClone(USER2_SKILLS),
    skillStageConfig: structuredClone(DEFAULT_SKILL_STAGE_CONFIG),
    templates: [structuredClone(INITIAL_TEMPLATE)],
    resumes: [seedVersion],
  };
}

export async function loadMultiUserStore(): Promise<MultiUserDatabaseStore> {
  if (memoryStore) return memoryStore;

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (fs.existsSync(MULTI_USER_DB_FILE)) {
    try {
      const raw = fs.readFileSync(MULTI_USER_DB_FILE, 'utf-8');
      const parsed = JSON.parse(raw) as MultiUserDatabaseStore;
      if (parsed && parsed.users && parsed.users['user-owner-1'] && parsed.users['user-owner-2']) {
        if (!parsed.sessions) parsed.sessions = {};
        // Ensure auth metadata exists on seeded users if upgrading from earlier store
        for (const [uid, udb] of Object.entries(parsed.users)) {
          if (!udb.auth) {
            const { hash, salt } = hashPassword('demo1234');
            udb.auth = {
              email: udb.profile.email.toLowerCase(),
              passwordHash: hash,
              salt,
              onboardingCompleted: true,
              onboardingStep: 4,
              createdAt: new Date().toISOString(),
              lastLoginAt: new Date().toISOString(),
            };
          }
          udb.userId = uid;
        }
        memoryStore = parsed;
        return memoryStore;
      }
    } catch (err) {
      console.warn('Re-initializing multi-user store with seed personas:', err);
    }
  }

  const user1 = await createSeedWorkspaceForUser1();
  const user2 = await createSeedWorkspaceForUser2();

  memoryStore = {
    users: {
      'user-owner-1': user1,
      'user-owner-2': user2,
    },
    sessions: {},
  };

  persistMultiUserStore();
  return memoryStore;
}

function persistMultiUserStore(): void {
  if (!memoryStore) return;
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const tempFile = `${MULTI_USER_DB_FILE}.tmp`;
    fs.writeFileSync(tempFile, JSON.stringify(memoryStore, null, 2), 'utf-8');
    fs.renameSync(tempFile, MULTI_USER_DB_FILE);
  } catch (err) {
    console.error('Failed to persist multi-user database:', err);
  }
}

/**
 * Loads the isolated workspace for a specific `userId`.
 */
export async function loadDatabase(userId = 'user-owner-1'): Promise<DatabaseSchema> {
  const store = await loadMultiUserStore();

  if (isSupabaseConfigured()) {
    const remoteUserDb = await fetchUserWorkspaceFromSupabase(userId);
    if (remoteUserDb) {
      store.users[userId] = remoteUserDb;
      persistMultiUserStore();
      syncCalibrationMarkdownFile(remoteUserDb);
      return remoteUserDb;
    }
  }

  if (!store.users[userId]) {
    if (userId === 'user-owner-2') {
      store.users[userId] = await createSeedWorkspaceForUser2();
    } else {
      const cloned = await createSeedWorkspaceForUser1();
      cloned.userId = userId;
      cloned.resumes.forEach((r) => {
        r.userId = userId;
      });
      store.users[userId] = cloned;
    }
    persistMultiUserStore();
  }

  const userDb = store.users[userId];
  syncCalibrationMarkdownFile(userDb);
  return userDb;
}

/**
 * Saves a specific user's isolated workspace to disk and asynchronously syncs to Supabase if configured.
 */
export function saveDatabase(db: DatabaseSchema, userId?: string): void {
  const targetUserId = userId || db.userId || 'user-owner-1';
  db.userId = targetUserId;

  if (!memoryStore) {
    memoryStore = { users: { [targetUserId]: db }, sessions: {} };
  } else {
    memoryStore.users[targetUserId] = db;
  }

  persistMultiUserStore();
  syncCalibrationMarkdownFile(db);

  if (isSupabaseConfigured()) {
    void syncUserWorkspaceToSupabase(db);
  }
}

export interface UserSummaryRecord {
  userId: string;
  fullName: string;
  email: string;
  headline: string;
  targetRole: string;
  projectCount: number;
  resumeCount: number;
  onboardingCompleted: boolean;
}

export function formatUserSummary(u: DatabaseSchema): UserSummaryRecord {
  const role =
    u.resumes[0]?.role ||
    u.profile.calibrationAnswers.targetRoleAndCompanyType.split(' at ')[0] ||
    'Software Engineer';
  return {
    userId: u.userId,
    fullName: u.profile.fullName,
    email: u.profile.email,
    headline: role,
    targetRole: role,
    projectCount: u.projects.length,
    resumeCount: u.resumes.length,
    onboardingCompleted: u.auth ? u.auth.onboardingCompleted : true,
  };
}

/**
 * Lists all registered user profiles for the multi-user switcher.
 */
export async function listAvailableUsers(): Promise<UserSummaryRecord[]> {
  const store = await loadMultiUserStore();
  return Object.values(store.users).map(formatUserSummary);
}

/**
 * Issues a session token for a given userId.
 */
export async function createSessionToken(userId: string): Promise<SessionRecord> {
  const store = await loadMultiUserStore();
  if (!store.sessions) store.sessions = {};
  const userDb = await loadDatabase(userId);
  const token = `lf_sess_${crypto.randomBytes(24).toString('hex')}`;
  const record: SessionRecord = {
    token,
    userId,
    email: userDb.profile.email,
    createdAt: new Date().toISOString(),
  };
  store.sessions[token] = record;
  if (userDb.auth) {
    userDb.auth.lastLoginAt = record.createdAt;
  }
  persistMultiUserStore();
  return record;
}

export async function resolveSessionToken(token?: string | null): Promise<string | null> {
  if (!token) return null;
  const clean = token.replace(/^Bearer\s+/i, '').trim();
  if (!clean) return null;
  const store = await loadMultiUserStore();
  return store.sessions?.[clean]?.userId || null;
}

export async function revokeSessionToken(token?: string | null): Promise<void> {
  if (!token) return;
  const clean = token.replace(/^Bearer\s+/i, '').trim();
  const store = await loadMultiUserStore();
  if (store.sessions && store.sessions[clean]) {
    delete store.sessions[clean];
    persistMultiUserStore();
  }
}

/**
 * Registers a brand-new user account with hashed password & `onboardingCompleted: false`.
 */
export async function registerUserAccount(params: {
  fullName: string;
  email: string;
  password: string;
  targetRole?: string;
}): Promise<{
  token: string;
  userId: string;
  user: UserSummaryRecord;
  users: UserSummaryRecord[];
}> {
  const store = await loadMultiUserStore();
  const normalizedEmail = params.email.trim().toLowerCase();
  if (!normalizedEmail || !normalizedEmail.includes('@')) {
    throw new Error('Please provide a valid email address.');
  }
  if (!params.password || params.password.length < 4) {
    throw new Error('Password must be at least 4 characters long.');
  }

  // Check if email already registered
  const existing = Object.values(store.users).find(
    (u) => u.profile.email.toLowerCase() === normalizedEmail
  );
  if (existing) {
    throw new Error('An account with this email already exists. Please sign in instead.');
  }

  // Optional Supabase Auth registration if configured
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      await supabase.auth.signUp({
        email: normalizedEmail,
        password: params.password,
        options: {
          data: { full_name: params.fullName.trim() },
        },
      });
    } catch {
      // Continue with workspace creation even if Supabase Auth email confirmation is pending
    }
  }

  const slug = params.fullName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  const newUserId = `user-${slug || 'candidate'}-${Date.now().toString().slice(-4)}`;

  const cloned = await createSeedWorkspaceForUser1();
  const now = new Date().toISOString();
  const { hash, salt } = hashPassword(params.password);

  cloned.userId = newUserId;
  cloned.auth = {
    email: normalizedEmail,
    passwordHash: hash,
    salt,
    onboardingCompleted: false,
    onboardingStep: 1,
    createdAt: now,
    lastLoginAt: now,
  };
  cloned.profile.fullName = params.fullName.trim();
  cloned.profile.email = normalizedEmail;
  cloned.profile.calibrationAnswers = {
    targetRoleAndCompanyType:
      params.targetRole?.trim() || 'Software & Systems Engineer at High-Growth Tech Companies',
    threeDifferentiators:
      '1) End-to-end ownership from system design to production deployment; 2) Strong quantitative metrics focus; 3) Cross-functional collaboration.',
    headOnAddressing: 'Available immediately for full-time roles.',
    updatedAt: now,
  };
  cloned.resumes.forEach((r) => {
    r.userId = newUserId;
    if (params.targetRole?.trim()) {
      r.role = params.targetRole.trim();
    }
  });

  store.users[newUserId] = cloned;
  persistMultiUserStore();
  syncCalibrationMarkdownFile(cloned);

  if (isSupabaseConfigured()) {
    void syncUserWorkspaceToSupabase(cloned);
  }

  const session = await createSessionToken(newUserId);
  const users = await listAvailableUsers();

  return {
    token: session.token,
    userId: newUserId,
    user: formatUserSummary(cloned),
    users,
  };
}

/**
 * Authenticates an existing user with email and password.
 */
export async function authenticateUserAccount(params: {
  email: string;
  password: string;
}): Promise<{
  token: string;
  userId: string;
  user: UserSummaryRecord;
  users: UserSummaryRecord[];
}> {
  const store = await loadMultiUserStore();
  const normalizedEmail = params.email.trim().toLowerCase();

  const matchedUser = Object.values(store.users).find(
    (u) => u.profile.email.toLowerCase() === normalizedEmail
  );

  if (!matchedUser) {
    throw new Error('No account found with that email address. Try creating a new account or using a 1-click demo profile.');
  }

  if (matchedUser.auth && matchedUser.auth.passwordHash && matchedUser.auth.salt) {
    const valid = verifyPassword(
      params.password,
      matchedUser.auth.passwordHash,
      matchedUser.auth.salt
    );
    // Allow 'demo1234' on seeded accounts or verified password
    const isSeededDemo =
      (matchedUser.userId === 'user-owner-1' || matchedUser.userId === 'user-owner-2') &&
      params.password === 'demo1234';
    if (!valid && !isSeededDemo) {
      throw new Error('Invalid password. (Tip: Demo accounts use password "demo1234")');
    }
  }

  const session = await createSessionToken(matchedUser.userId);
  const users = await listAvailableUsers();

  return {
    token: session.token,
    userId: matchedUser.userId,
    user: formatUserSummary(matchedUser),
    users,
  };
}

/**
 * Service-layer query that strictly filters out Stage 4 skills for the given user.
 */
export async function getVerifiedResumeEligibleSkills(
  userId = 'user-owner-1'
): Promise<SkillItem[]> {
  const db = await loadDatabase(userId);
  return filterEligibleResumeSkills(db.skills);
}

/**
 * Returns the current Supabase / multi-user persistence status.
 */
export async function getDatabaseConnectionStatus() {
  const store = await loadMultiUserStore();
  return {
    provider: isSupabaseConfigured()
      ? 'Supabase PostgreSQL (Cloud Synced)'
      : 'Supabase-Ready Multi-User Store (Add .env keys to sync)',
    supabaseConfigured: isSupabaseConfigured(),
    activeUsers: Object.keys(store.users),
  };
}
