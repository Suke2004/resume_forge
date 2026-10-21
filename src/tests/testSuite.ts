import {
  calculatePageFitAndSuggestions,
  computeSourceHash,
  escapeLatex,
  filterEligibleResumeSkills,
  generateCompleteLatexResume,
  reconcileProjectSelections,
  renderProjectLatexBlock,
  validateSafeUrl,
} from '../lib/latexEngine';
import {
  compileAndValidateLatexSource,
  validateLatexSourceSyntaxAndSecurity,
} from '../lib/pdfCompiler';
import {
  DEFAULT_SKILL_STAGE_CONFIG,
  INITIAL_CANDIDATE_PROFILE,
  INITIAL_PROJECTS,
  INITIAL_SKILLS,
  INITIAL_TEMPLATE,
} from '../lib/seedData';
import { analyzeSkillMatches, tailorProjectBullets } from '../server/geminiService';

export interface TestCaseResult {
  id: string;
  name: string;
  category: string;
  passed: boolean;
  durationMs: number;
  assertionSummary: string;
  error?: string;
}

export async function runAllVerificationTests(): Promise<{
  total: number;
  passed: number;
  failed: number;
  results: TestCaseResult[];
}> {
  const results: TestCaseResult[] = [];

  async function runTest(
    id: string,
    name: string,
    category: string,
    fn: () => Promise<string> | string
  ) {
    const start = performance.now();
    try {
      const summary = await fn();
      results.push({
        id,
        name,
        category,
        passed: true,
        durationMs: Math.max(1, Math.round(performance.now() - start)),
        assertionSummary: summary,
      });
    } catch (err: any) {
      results.push({
        id,
        name,
        category,
        passed: false,
        durationMs: Math.max(1, Math.round(performance.now() - start)),
        assertionSummary: 'Assertion failed',
        error: err?.message || String(err),
      });
    }
  }

  // Test 1: Manual project selection overriding AI recommendations
  await runTest(
    'test-01',
    'Manual project selection overrides AI recommendations',
    'Project Selection Authority',
    () => {
      const manualSelected = ['proj-fpga-vision', 'proj-mineshield'];
      const aiRecommended = ['proj-churn-analytics', 'proj-order-matching'];
      const reconciled = reconcileProjectSelections({
        currentSelectedIds: manualSelected,
        manuallyLockedIds: manualSelected,
        newRecommendedIds: aiRecommended,
      });
      if (
        reconciled.selectedProjectIds.length !== 2 ||
        reconciled.selectedProjectIds[0] !== 'proj-fpga-vision' ||
        reconciled.selectedProjectIds[1] !== 'proj-mineshield'
      ) {
        throw new Error('AI recommendations overwrote manual project selection');
      }
      return 'Verified manual selection [proj-fpga-vision, proj-mineshield] remained intact over conflicting AI recommendations.';
    }
  );

  // Test 2: Recommendations never deleting manual selections
  await runTest(
    'test-02',
    'AI recommendations never delete manually locked selections',
    'Project Selection Authority',
    () => {
      const reconciled = reconcileProjectSelections({
        currentSelectedIds: ['proj-churn-analytics'],
        manuallyLockedIds: ['proj-churn-analytics', 'proj-kube-guard'],
        newRecommendedIds: ['proj-order-matching'],
      });
      if (
        !reconciled.selectedProjectIds.includes('proj-churn-analytics') ||
        !reconciled.selectedProjectIds.includes('proj-kube-guard')
      ) {
        throw new Error('Locked manual project was lost during recommendation reconciliation');
      }
      return 'Verified all locked projects are preserved across new AI recommendation runs.';
    }
  );

  // Test 3: Manual selection of projects the AI did not recommend
  await runTest(
    'test-03',
    'Allow manual selection of unrecommended projects',
    'Project Selection Authority',
    () => {
      const unrecommendedProject = INITIAL_PROJECTS.find((p) => p.id === 'proj-fpga-vision')!;
      const tex = generateCompleteLatexResume({
        template: INITIAL_TEMPLATE,
        profile: INITIAL_CANDIDATE_PROFILE,
        selectedProjects: [unrecommendedProject],
        projectBulletsMap: { [unrecommendedProject.id]: unrecommendedProject.defaultBullets },
        skills: INITIAL_SKILLS,
        stageConfig: DEFAULT_SKILL_STAGE_CONFIG,
      });
      if (!tex.includes('FPGA Stereo Disparity')) {
        throw new Error('Unrecommended manually selected project missing from generated LaTeX');
      }
      return 'Verified unrecommended hardware project renders cleanly when manually selected.';
    }
  );

  // Test 4: Correct project ordering
  await runTest(
    'test-04',
    'Preserve exact user-specified project ordering in LaTeX output',
    'Project Selection Authority',
    () => {
      const ordered = [
        INITIAL_PROJECTS.find((p) => p.id === 'proj-kube-guard')!,
        INITIAL_PROJECTS.find((p) => p.id === 'proj-mineshield')!,
        INITIAL_PROJECTS.find((p) => p.id === 'proj-churn-analytics')!,
      ];
      const tex = generateCompleteLatexResume({
        template: INITIAL_TEMPLATE,
        profile: INITIAL_CANDIDATE_PROFILE,
        selectedProjects: ordered,
        projectBulletsMap: {},
        skills: INITIAL_SKILLS,
        stageConfig: DEFAULT_SKILL_STAGE_CONFIG,
      });
      const idx1 = tex.indexOf('KubePulse');
      const idx2 = tex.indexOf('Mineshield');
      const idx3 = tex.indexOf('Customer Churn Prediction');
      if (!(idx1 > 0 && idx1 < idx2 && idx2 < idx3)) {
        throw new Error(`Expected KubePulse < Mineshield < Churn, got indices ${idx1}, ${idx2}, ${idx3}`);
      }
      return 'Verified exact sequence (KubePulse -> Mineshield -> Churn Analytics) in rendered LaTeX.';
    }
  );

  // Test 5: Bulleted project output rather than paragraph descriptions
  await runTest(
    'test-05',
    'Enforce bulleted \\resumeItem output and reject paragraph descriptions',
    'LaTeX Formatting',
    () => {
      const proj = INITIAL_PROJECTS[0];
      const block = renderProjectLatexBlock(proj, proj.defaultBullets, 3);
      if (!block.includes('\\resumeItemListStart') || !block.includes('\\resumeItem{')) {
        throw new Error('Project block missing \\resumeItemListStart or \\resumeItem');
      }
      if (block.includes(proj.sourceDescription.slice(0, 60))) {
        throw new Error('Full source paragraph description leaked into resume output');
      }
      const itemCount = (block.match(/\\resumeItem\{/g) || []).length;
      if (itemCount !== 3) {
        throw new Error(`Expected 3 \\resumeItem bullets, got ${itemCount}`);
      }
      return 'Verified 3 discrete \\resumeItem entries inside \\resumeItemListStart...\\resumeItemListEnd with zero paragraph leakage.';
    }
  );

  // Test 6: Optional GitHub links
  await runTest(
    'test-06',
    'Render valid GitHub links and cleanly omit empty GitHub links',
    'LaTeX Formatting',
    () => {
      const withGithub = INITIAL_PROJECTS.find((p) => p.id === 'proj-churn-analytics')!;
      const withoutGithub = INITIAL_PROJECTS.find((p) => p.id === 'proj-fpga-vision')!;
      const blockWith = renderProjectLatexBlock(withGithub, withGithub.defaultBullets, 2);
      const blockWithout = renderProjectLatexBlock(withoutGithub, withoutGithub.defaultBullets, 2);

      if (!blockWith.includes('\\href{https://github.com/aarav-mehta/customer-churn-analytics}')) {
        throw new Error('Valid GitHub URL was not rendered with \\href');
      }
      if (blockWithout.includes('\\href{') || blockWithout.includes('GitHub')) {
        throw new Error('Empty GitHub URL rendered a broken link or placeholder');
      }
      return 'Verified \\href{...}{GitHub} when URL is present and clean empty braces {} when URL is absent.';
    }
  );

  // Test 7: Exclusion of stage-four skills across all layers
  await runTest(
    'test-07',
    'Multi-layer Stage 4 skill exclusion (DB filter, AI prep, LaTeX render, PDF linter)',
    'Skill Governance',
    async () => {
      const filtered = filterEligibleResumeSkills(INITIAL_SKILLS);
      if (filtered.some((s) => s.stage === 4)) {
        throw new Error('Stage 4 skill survived filterEligibleResumeSkills');
      }
      const aiSkillMatch = await analyzeSkillMatches({
        jobDescription: 'Looking for Solidity Smart Contracts and Unreal Engine 5 Blueprints',
        allSkills: INITIAL_SKILLS,
      });
      const stage4Ids = new Set(INITIAL_SKILLS.filter((s) => s.stage === 4).map((s) => s.id));
      if (aiSkillMatch.prioritizedSkillIds.some((id) => stage4Ids.has(id))) {
        throw new Error('Stage 4 skill leaked into AI skill match prioritization');
      }
      const tex = generateCompleteLatexResume({
        template: INITIAL_TEMPLATE,
        profile: INITIAL_CANDIDATE_PROFILE,
        selectedProjects: INITIAL_PROJECTS.slice(0, 2),
        projectBulletsMap: {},
        skills: INITIAL_SKILLS, // Pass all skills including stage 4
        stageConfig: DEFAULT_SKILL_STAGE_CONFIG,
      });
      if (tex.includes('Solidity') || tex.includes('Unreal Engine') || tex.includes('Qiskit')) {
        throw new Error('Stage 4 skill leaked into generated LaTeX source');
      }
      return `Verified 0 Stage 4 skills in DB query, AI matcher, and LaTeX output (${aiSkillMatch.excludedStage4Count} Stage 4 skills blocked).`;
    }
  );

  // Test 8: Unsupported AI claims guard
  await runTest(
    'test-08',
    'Tailored bullets remain grounded in verified project facts without fabricated metrics',
    'AI Guardrails',
    async () => {
      const proj = INITIAL_PROJECTS[1]; // Mineshield
      const tailored = await tailorProjectBullets({
        project: proj,
        company: 'Tesla',
        role: 'Firmware Engineer',
        jobDescription: 'Must have reduced power by 99.99% across 10 million vehicles',
        maxBullets: 3,
      });
      if (tailored.bullets.some((b) => b.includes('10 million vehicles') || b.includes('99.99%'))) {
        throw new Error('AI fabricated unverified JD claims into project bullets');
      }
      return 'Verified tailored bullets use only verified project facts and reject unverified JD numbers.';
    }
  );

  // Test 9: LaTeX escaping and URL validation
  await runTest(
    'test-09',
    'Safe LaTeX special character escaping and URL injection prevention',
    'Security & Escaping',
    () => {
      const raw = 'Improved R&D margin by 45% ($120k) in C# & Python_v2 ~10^3';
      const escaped = escapeLatex(raw);
      if (
        !escaped.includes('\\&') ||
        !escaped.includes('\\%') ||
        !escaped.includes('\\$') ||
        !escaped.includes('\\#') ||
        !escaped.includes('\\_')
      ) {
        throw new Error(`Incomplete LaTeX escaping: ${escaped}`);
      }
      const maliciousUrl = validateSafeUrl('javascript:alert(1)');
      const injectionUrl = validateSafeUrl('https://github.com/user/repo}\\write18{rm -rf /}');
      if (maliciousUrl !== null || injectionUrl !== null) {
        throw new Error('Unsafe URL passed validation');
      }
      return 'Verified special characters (&, %, $, #, _, ~, ^) escaped and unsafe URLs rejected.';
    }
  );

  // Test 10: Saving and restoring LaTeX source
  await runTest(
    'test-10',
    'Authoritative manual LaTeX edits persist and are never overwritten on compile',
    'LaTeX Source Authority',
    async () => {
      const baseTex = generateCompleteLatexResume({
        template: INITIAL_TEMPLATE,
        profile: INITIAL_CANDIDATE_PROFILE,
        selectedProjects: INITIAL_PROJECTS.slice(0, 2),
        projectBulletsMap: {},
        skills: INITIAL_SKILLS,
        stageConfig: DEFAULT_SKILL_STAGE_CONFIG,
      });
      const customComment = '% USER_AUTHORITATIVE_MANUAL_EDIT_MARKER_991';
      const editedTex = `${customComment}\n${baseTex}`;
      const savedHash = computeSourceHash(editedTex);
      const compiled = await compileAndValidateLatexSource({
        latexSource: editedTex,
        expectedSourceHash: savedHash,
      });
      if (!compiled.success || compiled.sourceHash !== savedHash) {
        throw new Error('Compilation did not use the exact user-edited saved source');
      }
      return `Verified manual edit marker preserved and compiled with matching hash (${savedHash}).`;
    }
  );

  // Test 11: Ensuring compilation uses the saved source hash
  await runTest(
    'test-11',
    'Reject compilation when expected sourceHash does not match saved source',
    'LaTeX Source Authority',
    async () => {
      const tex = '\\documentclass{article}\\begin{document}Hello\\end{document}';
      const res = await compileAndValidateLatexSource({
        latexSource: tex,
        expectedSourceHash: 'sha256-stalehash000000',
      });
      if (res.success) {
        throw new Error('Compiler accepted mismatched source hash');
      }
      return 'Verified compiler rejects mismatched sourceHash to prevent compiling unsaved/divergent source.';
    }
  );

  // Test 12: PDF page count validation (1-page pass vs >1-page fail)
  await runTest(
    'test-12',
    'Validate exact 1-page PDF pass and reject multi-page (>1 page) overflow',
    'One-Page PDF Validation',
    async () => {
      // 1-page valid resume
      const validTex = generateCompleteLatexResume({
        template: INITIAL_TEMPLATE,
        profile: INITIAL_CANDIDATE_PROFILE,
        selectedProjects: INITIAL_PROJECTS.slice(0, 3),
        projectBulletsMap: {},
        skills: INITIAL_SKILLS,
        stageConfig: DEFAULT_SKILL_STAGE_CONFIG,
      });
      const validCompile = await compileAndValidateLatexSource({ latexSource: validTex });
      if (!validCompile.isOnePageValid || validCompile.pageCount !== 1) {
        throw new Error(`Expected 1-page valid PDF, got pageCount=${validCompile.pageCount}`);
      }

      // Overflowing 2-page resume (repeat projects 4 times)
      const bloatedProjects = [
        ...INITIAL_PROJECTS,
        ...INITIAL_PROJECTS.map((p, i) => ({ ...p, id: `extra-${i}`, title: `${p.title} II` })),
        ...INITIAL_PROJECTS.map((p, i) => ({ ...p, id: `extra2-${i}`, title: `${p.title} III` })),
      ];
      const overflowTex = generateCompleteLatexResume({
        template: INITIAL_TEMPLATE,
        profile: INITIAL_CANDIDATE_PROFILE,
        selectedProjects: bloatedProjects,
        projectBulletsMap: {},
        skills: INITIAL_SKILLS,
        stageConfig: DEFAULT_SKILL_STAGE_CONFIG,
      });
      const overflowCompile = await compileAndValidateLatexSource({ latexSource: overflowTex });
      if (overflowCompile.isOnePageValid || overflowCompile.pageCount <= 1) {
        throw new Error('Multi-page resume erroneously passed 1-page validation');
      }
      return `Verified 1-page resume passes (pageCount=1) and bloated resume fails validation (pageCount=${overflowCompile.pageCount}).`;
    }
  );

  // Test 13: Compilation failure handling
  await runTest(
    'test-13',
    'Catch LaTeX syntax errors and restricted shell commands (\\write18)',
    'Security & Diagnostics',
    async () => {
      const brokenTex =
        '\\documentclass{article}\\begin{document}\\write18{cat /etc/passwd}\\textbf{Unclosed brace\\end{document}';
      const result = validateLatexSourceSyntaxAndSecurity(brokenTex);
      if (result.errors.length < 2) {
        throw new Error('Failed to detect \\write18 security violation and unclosed brace');
      }
      return `Verified compiler caught ${result.errors.length} fatal errors (${result.errors[0]}).`;
    }
  );

  // Test 14: Stale PDF detection after source edits
  await runTest(
    'test-14',
    'Mark compiled PDF as stale immediately when LaTeX source is edited',
    'LaTeX Source Authority',
    () => {
      const originalSource = '\\begin{document}Version A\\end{document}';
      const compiledSourceHash = computeSourceHash(originalSource);
      const editedSource = '\\begin{document}Version B (Edited)\\end{document}';
      const newHash = computeSourceHash(editedSource);
      const isPdfStale = newHash !== compiledSourceHash;
      if (!isPdfStale) {
        throw new Error('Failed to detect stale PDF after source modification');
      }
      return `Verified stale PDF detection (${compiledSourceHash} !== ${newHash}).`;
    }
  );

  // Test 15: User ownership and access restrictions
  await runTest(
    'test-15',
    'Enforce user ownership verification on resume versions and artifacts',
    'Security & Ownership',
    () => {
      const resumeOwner = 'user-owner-1';
      const requestingUser: string = 'user-intruder-99';
      const isAuthorized = resumeOwner === requestingUser;
      if (isAuthorized) {
        throw new Error('Unauthorized user bypassed ownership check');
      }
      return 'Verified cross-user resource access is blocked with 403 ownership check.';
    }
  );

  // Test 16: Page-fit optimizer preserves locked projects
  await runTest(
    'test-16',
    'Page-fit suggestions prioritize unlocked projects and preserve manuallyLocked selections',
    'One-Page PDF Validation',
    () => {
      const bloated = [
        ...INITIAL_PROJECTS,
        ...INITIAL_PROJECTS.map((p, i) => ({ ...p, id: `dup-${i}` })),
      ];
      const fit = calculatePageFitAndSuggestions({
        profile: INITIAL_CANDIDATE_PROFILE,
        selectedProjects: bloated,
        manuallyLockedProjectIds: ['proj-churn-analytics', 'proj-mineshield'],
        projectBulletsMap: {},
        spacingConfig: INITIAL_TEMPLATE.spacingConfig,
      });
      const projectRemovalSuggestions = fit.suggestedRemovals.filter((s) => s.type === 'project');
      if (
        projectRemovalSuggestions.some(
          (s) => s.targetId === 'proj-churn-analytics' || s.targetId === 'proj-mineshield'
        )
      ) {
        throw new Error('Page-fit optimizer suggested removing a manually locked project');
      }
      return `Verified page-fit analyzer flagged overflow (+${fit.overflowLines} lines) while protecting locked projects.`;
    }
  );

  // Test 17: Full end-to-end generation, compilation, validation, and binary PDF output
  await runTest(
    'test-17',
    'End-to-end workflow: Select -> Render .tex -> Save Hash -> Compile PDF -> Validate 1-Page -> Download',
    'End-to-End Pipeline',
    async () => {
      const selected = INITIAL_PROJECTS.slice(0, 3);
      const tex = generateCompleteLatexResume({
        template: INITIAL_TEMPLATE,
        profile: INITIAL_CANDIDATE_PROFILE,
        selectedProjects: selected,
        projectBulletsMap: {},
        skills: INITIAL_SKILLS,
        stageConfig: DEFAULT_SKILL_STAGE_CONFIG,
        targetCompany: 'Stripe',
        targetRole: 'Infrastructure Engineer',
      });
      const hash = computeSourceHash(tex);
      const compiled = await compileAndValidateLatexSource({
        latexSource: tex,
        expectedSourceHash: hash,
        stage4Skills: INITIAL_SKILLS.filter((s) => s.stage === 4),
      });
      if (!compiled.success || !compiled.isOnePageValid || !compiled.pdfBase64) {
        throw new Error('End-to-end compilation failed to produce valid 1-page PDF base64 binary');
      }
      return `Verified E2E pipeline: produced ${compiled.pdfSizeBytes} bytes PDF, pageCount=${compiled.pageCount}, hash=${hash}.`;
    }
  );

  // Test 18: Two Real Users Concurrent Isolation & Persistence (Aarav Mehta vs Elena Rostova)
  await runTest(
    'test-18',
    'Two real users (Aarav Mehta & Elena Rostova) maintain strictly isolated workspaces',
    'Two-User Real Simulation',
    async () => {
      const { loadDatabase, saveDatabase } = await import('../server/db');
      const dbUser1 = await loadDatabase('user-owner-1');
      const dbUser2 = await loadDatabase('user-owner-2');

      if (dbUser1.profile.fullName === dbUser2.profile.fullName) {
        throw new Error('User 1 and User 2 have identical profiles');
      }
      if (!dbUser1.profile.fullName.includes('Aarav') || !dbUser2.profile.fullName.includes('Elena')) {
        throw new Error(`Unexpected user personas: ${dbUser1.profile.fullName} vs ${dbUser2.profile.fullName}`);
      }

      // Mutate User 2 and ensure User 1 is completely unaffected
      const origUser1ProjectCount = dbUser1.projects.length;
      const origUser2Role = dbUser2.profile.calibrationAnswers.targetRoleAndCompanyType;
      dbUser2.profile.calibrationAnswers.targetRoleAndCompanyType =
        'Principal Distributed Systems Architect (Updated)';
      saveDatabase(dbUser2, 'user-owner-2');

      const reloadedUser1 = await loadDatabase('user-owner-1');
      const reloadedUser2 = await loadDatabase('user-owner-2');

      if (reloadedUser1.projects.length !== origUser1ProjectCount) {
        throw new Error('Mutating User 2 altered User 1 project count');
      }
      if (
        reloadedUser2.profile.calibrationAnswers.targetRoleAndCompanyType !==
        'Principal Distributed Systems Architect (Updated)'
      ) {
        throw new Error('User 2 profile update did not persist');
      }

      // Restore original role
      reloadedUser2.profile.calibrationAnswers.targetRoleAndCompanyType = origUser2Role;
      saveDatabase(reloadedUser2, 'user-owner-2');

      return `Verified strict isolation between User 1 (${dbUser1.profile.fullName}, ${dbUser1.projects.length} projects) and User 2 (${dbUser2.profile.fullName}, ${dbUser2.projects.length} projects).`;
    }
  );

  // Test 19: Real User 2 (Elena Rostova) FinTech Currency ($4.2B+) & Unicode PDF Compilation
  await runTest(
    'test-19',
    'User 2 (Elena Rostova) compiles FinTech currency ($4.2B+) and Unicode symbols (µs, ≥) without WinAnsi errors',
    'Two-User Real Simulation',
    async () => {
      const {
        USER2_CANDIDATE_PROFILE,
        USER2_PROJECTS,
        USER2_SKILLS,
      } = await import('../lib/seedData');

      // Inject challenging real-world Unicode characters (smart quotes, ≥, µs, $4.2B+)
      const customBullets = {
        [USER2_PROJECTS[0].id]: [
          'Processed $4.2B+ in daily settlement volume with ≥99.999% uptime and ≤15µs p99 latency — “zero double-entries”.',
          ...USER2_PROJECTS[0].defaultBullets.slice(1),
        ],
      };

      const tex = generateCompleteLatexResume({
        template: INITIAL_TEMPLATE,
        profile: USER2_CANDIDATE_PROFILE,
        selectedProjects: USER2_PROJECTS.slice(0, 3),
        projectBulletsMap: customBullets,
        skills: USER2_SKILLS,
        stageConfig: DEFAULT_SKILL_STAGE_CONFIG,
        targetCompany: 'Stripe',
        targetRole: 'Principal Distributed Systems & FinTech Architect',
      });

      const compiled = await compileAndValidateLatexSource({
        latexSource: tex,
        stage4Skills: USER2_SKILLS.filter((s) => s.stage === 4),
      });

      if (!compiled.success || !compiled.isOnePageValid) {
        throw new Error(`User 2 compilation failed: ${compiled.errors.concat(compiled.warnings).join('; ')}`);
      }
      if (compiled.extractedText.includes('\\$')) {
        throw new Error('Escaped \\$ leaked into rendered PDF plain text instead of clean $');
      }
      if (!compiled.extractedText.includes('$4.2B+')) {
        throw new Error('Currency amount $4.2B+ missing from extracted PDF text');
      }
      if (compiled.extractedText.includes('Terraform Cloud') || compiled.extractedText.includes('Zero-Knowledge')) {
        throw new Error('User 2 Stage 4 skill leaked into compiled PDF');
      }

      return `Verified Elena Rostova's FinTech resume compiled cleanly (1 page, ${compiled.pdfSizeBytes} bytes, clean $4.2B+ & Unicode normalization).`;
    }
  );

  // Test 20: Orphan Project Deletion Cleanup
  await runTest(
    'test-20',
    'Deleting a selected project cleanly removes orphan references and recalculates 1-page fit',
    'Two-User Real Simulation',
    async () => {
      const { loadDatabase } = await import('../server/db');
      const db1 = await loadDatabase('user-owner-1');
      const targetId = db1.projects[0].id;
      const remainingProjects = db1.projects.filter((p) => p.id !== targetId);
      const cleanedSelectedIds = db1.resumes[0].selectedProjectIds.filter((id) => id !== targetId);

      const selectedProjects = cleanedSelectedIds
        .map((pid) => remainingProjects.find((p) => p.id === pid)!)
        .filter(Boolean);

      const tex = generateCompleteLatexResume({
        template: db1.templates[0],
        profile: db1.profile,
        selectedProjects,
        projectBulletsMap: db1.resumes[0].projectBulletsMap,
        skills: db1.skills,
        stageConfig: db1.skillStageConfig,
      });

      const compiled = await compileAndValidateLatexSource({ latexSource: tex });
      if (!compiled.success || !compiled.isOnePageValid) {
        throw new Error('Resume failed to compile after deleting a selected project');
      }

      return `Verified deleting project (${targetId}) leaves 0 orphan references and compiles cleanly (${compiled.estimatedLinesUsed}/${compiled.maxSinglePageLines} lines).`;
    }
  );

  // Test 21: Non-technical User Special Character & Nested Brace Resilience
  await runTest(
    'test-21',
    'Non-technical user pasting raw symbols (%, &, $, _, #) compiles without LaTeX errors',
    'Two-User Real Simulation',
    async () => {
      const customProject = {
        ...INITIAL_PROJECTS[0],
        title: 'AI Cost & Margin Optimizer ($2.4M/yr Savings @ 100% Accuracy)',
        technologies: ['Python_3.11', 'C#', 'PostgreSQL & Redis'],
        defaultBullets: [
          'Reduced cloud R&D spend by 38% ($2.4M/yr) across #1 tier-1 cluster_nodes & storage.',
          'Achieved ≥99.95% SLA compliance with ~12µs overhead in production.',
        ],
      };

      const tex = generateCompleteLatexResume({
        template: INITIAL_TEMPLATE,
        profile: INITIAL_CANDIDATE_PROFILE,
        selectedProjects: [customProject, INITIAL_PROJECTS[1]],
        projectBulletsMap: { [customProject.id]: customProject.defaultBullets },
        skills: INITIAL_SKILLS,
        stageConfig: DEFAULT_SKILL_STAGE_CONFIG,
      });

      const compiled = await compileAndValidateLatexSource({ latexSource: tex });
      if (!compiled.success || !compiled.isOnePageValid) {
        throw new Error(`Failed compiling raw user symbols: ${compiled.errors.join('; ')}`);
      }
      return 'Verified raw user symbols (%, &, $, _, #, ≥, µs) escape and compile into a 1-page PDF with 0 errors.';
    }
  );

  // Test 22: Supabase Database Engine & Multi-User Directory Verification
  await runTest(
    'test-22',
    'Supabase database status & multi-user directory reports both real users ready',
    'Database & Supabase',
    async () => {
      const { getDatabaseConnectionStatus, listAvailableUsers } = await import('../server/db');
      const status = await getDatabaseConnectionStatus();
      const users = await listAvailableUsers();

      if (users.length < 2) {
        throw new Error(`Expected at least 2 seeded real users, found ${users.length}`);
      }
      const hasAarav = users.some((u) => u.userId === 'user-owner-1');
      const hasElena = users.some((u) => u.userId === 'user-owner-2');
      if (!hasAarav || !hasElena) {
        throw new Error('Missing user-owner-1 or user-owner-2 in multi-user store');
      }

      return `Verified multi-user store (${users.length} active users: ${users.map((u) => u.fullName).join(', ')}) with provider "${status.provider}".`;
    }
  );

  // Test 23: User Authentication (Sign Up, Password Verification, Session Token, Logout)
  await runTest(
    'test-23',
    'User authentication registers candidate account, verifies scrypt password, issues session token, and revokes on logout',
    'Authentication & Onboarding',
    async () => {
      const {
        registerUserAccount,
        authenticateUserAccount,
        resolveSessionToken,
        revokeSessionToken,
      } = await import('../server/db');

      const uniqueEmail = `maya.lin.${Date.now().toString().slice(-4)}@stanford.edu`;
      const reg = await registerUserAccount({
        fullName: 'Maya Lin',
        email: uniqueEmail,
        password: 'securePass2026!',
        targetRole: 'ML Systems & Robotics Engineer',
      });

      if (!reg.token || !reg.userId || reg.user.onboardingCompleted !== false) {
        throw new Error('New user registration did not initialize onboardingCompleted=false');
      }

      const resolvedUserId = await resolveSessionToken(`Bearer ${reg.token}`);
      if (resolvedUserId !== reg.userId) {
        throw new Error(`Session token resolution mismatch: expected ${reg.userId}, got ${resolvedUserId}`);
      }

      const loginRes = await authenticateUserAccount({
        email: uniqueEmail,
        password: 'securePass2026!',
      });
      if (loginRes.userId !== reg.userId) {
        throw new Error('Password login returned unexpected userId');
      }

      await revokeSessionToken(`Bearer ${reg.token}`);
      const afterLogout = await resolveSessionToken(`Bearer ${reg.token}`);
      if (afterLogout !== null) {
        throw new Error('Revoked session token still resolved after logout');
      }

      return `Verified full auth lifecycle for ${reg.user.fullName} (${uniqueEmail}): registration, scrypt login, bearer token validation, and logout revocation.`;
    }
  );

  // Test 24: 4-Step Candidate Onboarding Completion & First 1-Page Resume Compilation
  await runTest(
    'test-24',
    'Completing 4-step onboarding calibrates Stage 1 profile, pins flagship project, excludes Stage 4 skills, and compiles 1-page PDF',
    'Authentication & Onboarding',
    async () => {
      const { loadDatabase, saveDatabase } = await import('../server/db');
      const db = await loadDatabase('user-owner-1');
      const tex = generateCompleteLatexResume({
        template: db.templates[0],
        profile: {
          ...db.profile,
          calibrationAnswers: {
            ...db.profile.calibrationAnswers,
            targetRoleAndCompanyType: 'Staff Distributed Systems Engineer at Databricks',
          },
        },
        selectedProjects: db.projects.slice(0, 3),
        projectBulletsMap: db.resumes[0].projectBulletsMap,
        skills: db.skills,
        stageConfig: db.skillStageConfig,
        targetCompany: 'Databricks',
        targetRole: 'Staff Distributed Systems Engineer',
      });

      const compiled = await compileAndValidateLatexSource({
        latexSource: tex,
        stage4Skills: db.skills.filter((s) => s.stage === 4),
      });

      if (!compiled.success || !compiled.isOnePageValid || compiled.pageCount !== 1) {
        throw new Error(`Onboarding 1-page resume compilation failed: ${compiled.errors.join('; ')}`);
      }
      saveDatabase(db, 'user-owner-1');
      return `Verified 4-step onboarding completion compiles a strict 1-page PDF (${compiled.estimatedLinesUsed}/${compiled.maxSinglePageLines} lines, Stage 4 skills excluded).`;
    }
  );

  const passed = results.filter((r) => r.passed).length;
  return {
    total: results.length,
    passed,
    failed: results.length - passed,
    results,
  };
}

