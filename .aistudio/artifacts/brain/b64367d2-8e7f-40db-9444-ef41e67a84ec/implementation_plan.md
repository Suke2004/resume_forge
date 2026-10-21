# AI-Powered One-Page LaTeX Resume Builder

An end-to-end, full-stack LaTeX resume builder and tailoring platform that analyzes target job descriptions with Google Gemini, recommends and tailors verified projects without ever overriding manual selections, enforces strict four-stage filtering, provides a full browser-based LaTeX code editor with version control, and compiles validated one-page PDF resumes.

## User Review & Critical Decisions

> [!IMPORTANT]
> Below is the summary of your confirmed configuration choices from our calibration step and how they govern the system architecture:

- **Confirmed Decision 1 — Initial Template & Seed Catalogue**: Pre-seed the database with **Jake's Resume LaTeX template** (`\resumeProjectHeading`, `\resumeSubheading`, `\resumeItemListStart`, `\resumeItem`) along with editable sample software, hardware, and hybrid projects (including Customer Churn Prediction & Retention Analytics, Mineshield: Smart Mining Safety System, and additional verified engineering projects), education, experience, achievements, and skills.
- **Confirmed Decision 2 — Persistence & Deployment Readiness**: Use a **built-in server-side SQLite/JSON durable database layer** (`data/resume-db.json` with atomic transactional writes and audit logs) so the full application works out-of-the-box in the preview environment, while generating complete **Prisma (`schema.prisma`), Neon PostgreSQL migrations, seed scripts, and Dockerized TeX Live worker artifacts** (`worker/Dockerfile`, `worker/server.ts`, `.env.example`, `README.md`) for production deployment.
- **Confirmed Decision 3 — Live Preview PDF Compiler & 1-Page Validator**: Include a **built-in server-assisted high-precision LaTeX-to-PDF compiler and one-page validator** (`pdfinfo`/`pdftotext` equivalents + exact page-overflow calculation and downloadable binary `.pdf` generation) directly in the preview environment, alongside support for forwarding jobs to an external Dockerized TeX Live `WORKER_URL` when configured.
- **Confirmed Decision 4 — Four-Stage Framework (`STAGE 1, THE TRANSLATOR`, `STAGE 2, THE X-RAY`, `STAGE 3, THE SURGEON`, `STAGE 4, THE EXAMINER`)**:
  - **Skill Stages 1–3 vs. Stage 4 Restriction**: Default the four configurable skill stages to **`STAGE 1, THE TRANSLATOR`** (Core Positioning & Primary Stack), **`STAGE 2, THE X-RAY`** (ATS-Normalized Keywords & Frameworks), **`STAGE 3, THE SURGEON`** (Impact & Tooling Competencies), and **`STAGE 4, THE EXAMINER`** (Interview-Only / Excluded Stage). Enforce strict exclusion of Stage 4 skills across database queries, API validation, Gemini prompt preparation, LaTeX rendering, and automated test suites, while allowing custom stage label editing in the Skills Manager.
  - **Integrated Resume-System Workflow**: Also incorporate the stateful 4-stage analytical capabilities from your specification—Stage 1 candidate calibration profile (`work/resume-system/calibration-profile.md`), Stage 2 ATS 6-platform X-Ray scoring (`Workday`, `Taleo`, `iCIMS`, `Greenhouse`, `Lever`, `SuccessFactors` + `5 KEYWORDS I AM INVISIBLE WITHOUT` + `3 RED FLAGS IN UNDER 10 SECONDS`), Stage 3 Google XYZ bullet rewriting (`BEFORE:` / `AFTER:` without inventing metrics), and Stage 4 Examiner interview prep—alongside the core 6 Gemini operations.

---

## 1. Overview & Core Concept

- **What It Does**: Transforms a candidate's verified project catalogue, staged skills, and trusted LaTeX template into a tailored, strictly validated one-page PDF resume for any target company, role, and job description (JD).
- **Target Audience / Persona**: Software, hardware, and hybrid engineers who rely on clean LaTeX typography and want AI assistance for JD analysis, ATS alignment, and Google XYZ bullet tailoring—without sacrificing manual control over project selection or raw `.tex` source edits.
- **Key Value**: Guarantees that manual project choices (`selected`, `manuallyLocked`) and manual `.tex` code edits remain 100% authoritative, never fabricates metrics or skills, strictly strips Stage 4 skills from all outputs, and refuses to publish multi-page overflow PDFs without explicit user review.

---

## 2. User Experience & Visual Design

### Key User Flows

1. **Dashboard & Version History**:
   - View all tailored resume versions with target company, role, durable job status (`QUEUED → ANALYZING → DRAFT_READY → RENDERING → COMPILING → VALIDATING → COMPLETED` / `FAILED`), page-count badge, and direct `.pdf` and `.tex` download actions.
   - Start a new tailored resume or reopen any historical snapshot without overwriting prior versions.
2. **Resume Generation Workspace (5-Step Guided Pipeline)**:
   - **Step 1 — Target Role, JD & Calibration (`STAGE 1, THE TRANSLATOR` & `STAGE 2, THE X-RAY`)**: Enter Company Name, Job Role, JD text, and toggle role mode (`Software` / `Hardware` / `Hybrid` / `All`). Run AI Job Analysis to view extracted requirements, 6-platform ATS match scores (Workday, Taleo, iCIMS, Greenhouse, Lever, SuccessFactors), 5 critical keywords, 3 recruiter red flags, and verified skill matches.
   - **Step 2 — Dual-List Project Selection (AI Recommendations vs. Manual Catalogue)**:
     - *Left Panel — AI-Recommended Projects*: Ranked recommendations from the verified database with evidence-based rationale, matching keywords, and a 1-click **"Add to Selected"** button.
     - *Right Panel — Searchable Full Project Catalogue & Confirmed Selection*: Filter by domain (`Software`, `Hardware`, `Hybrid`), search keywords, manually select/deselect any project (including unrecommended ones), lock selections (`manuallyLocked`), and reorder via drag-and-drop or priority controls. Changing the JD, company, or role mode never wipes manual selections.
   - **Step 3 — Bullet Tailoring & Skill Stage Review (`STAGE 3, THE SURGEON`)**:
     - Review concise, achievement-oriented bullet points (`\item`) per selected project using the Google XYZ structure (`BEFORE:` vs `AFTER:`), edit bullets inline, configure max bullets per project, and verify that only Stages 1, 2, and 3 skills are active while Stage 4 is visibly blocked from output.
   - **Step 4 — Authoritative LaTeX Code Editor**:
     - Inspect the complete generated `.tex` source inside a syntax-highlighted code editor with line numbers, diff view (comparing AI-generated draft vs. user-edited source), unsaved-changes warning banner, and version restore. Saving commits a cryptographic SHA-256 `sourceHash` snapshot to the database.
   - **Step 5 — Exact Source Compilation & One-Page PDF Validation**:
     - Trigger compilation on the exact saved `sourceHash`. View compiler logs, `pdfinfo` page count, `pdftotext` extracted text inspection, glyph/reference checks, and interactive 1-page PDF preview.
     - If the resume exceeds 1 page, display an explicit **One-Page Validation Failure** alert with specific space-fit recommendations (`suggestPageFitImprovements()`) and an optional **"Generate Optimized Draft Version"** button that creates a separate draft without touching the user's locked projects or saved `.tex` source.
3. **Project Catalogue Manager**:
   - Full CRUD for projects: title, domain (`software` | `hardware` | `hybrid`), full reference description (for AI context only, never dumped as a paragraph), verified facts/metrics, default resume bullets, technologies, keywords, and optional GitHub URL (gracefully omitted in LaTeX if empty).
4. **Skills & Calibration Manager**:
   - Manage verified skills across the 4 stages (`STAGE 1, THE TRANSLATOR`, `STAGE 2, THE X-RAY`, `STAGE 3, THE SURGEON`, `STAGE 4, THE EXAMINER`), rename stage labels if desired, and test the multi-layer Stage 4 exclusion guard.
5. **Template Manager & Test Runner**:
   - Edit the trusted LaTeX template preamble, section ordering, and safe spacing parameters (`\vspace`, itemsep) with version history and 1-click restore.
   - Built-in verification suite screen to run and inspect all 17 required automated tests directly from the UI as well as via CLI (`npm test`).

### Visual Identity & Theme

- **Aesthetic Direction**: Precision Engineering Studio & Editorial Document Workbench—clean, high-contrast utilitarian SaaS layout designed for dense side-by-side code and document inspection.
- **Color Palette & Mood (60-30-10 Discipline)**:
  - **60% Dominant Neutral Canvas**: Crisp warm alabaster/slate light surface (`#F8FAFC`) and deep obsidian code editor surface (`#0F172A`).
  - **30% Structural Surfaces**: Pure white panels (`#FFFFFF`) with `1px solid #E2E8F0` hairline dividers and muted slate typography (`#475569`).
  - **10% Accent Budget**: Deep Cobalt (`#2563EB`) for primary actions and active workspace states; semantic status indicators paired with explicit text labels: Emerald (`#16A34A`) for `1 Page Validated`, Amber (`#D97706`) for `Unsaved Edits / Stale PDF`, and Crimson (`#DC2626`) for `Page Overflow (>1 Page) / Compile Error`.
- **Typography & Hierarchy (2+1 Font Rule)**:
  - *Display & Navigation*: `Plus Jakarta Sans` (SemiBold 600 / Bold 700, tight tracking).
  - *Body & UI Controls*: `DM Sans` (Regular 400 / Medium 500) for clear legibility across dense project lists and JD analysis.
  - *Code, LaTeX Source & Tabular Metrics*: `JetBrains Mono` (`tabular-nums`) for the `.tex` code editor, SHA-256 source hashes, ATS match scores, and page/line counters.
- **Component Styling & Layout**:
  - Strict 3-zone Top Bar Contract: Brand wordmark (`LaTeXForge`) on the left, 5 single-line navigation links (`Dashboard`, `Workspace`, `Projects`, `Skills & Stages`, `Templates`) in the center, and 1 primary CTA (`New Resume`) on the right.
  - Zero-pill discipline for static metadata (technologies, domains, timestamps rendered as clean inline text separated by `·`).

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Strict Separation of Manual Project State vs. AI Recommendations**
  - *Chosen Approach*: Store project selections as an explicit state map (`recommended`, `selected`, `manuallyLocked`, `displayOrder`, `customBullets`) inside each resume version. When `recommendProjects()` runs, it updates only the `recommendations` array and never mutates `selectedProjectIds` or `manuallyLockedIds`.
  - *Why*: Guarantees the user's manual selections survive JD edits, role-mode toggles, and repeated AI analyses.
- **Decision 2: Authoritative Saved Source Hashing (`sourceHash`) for PDF Compilation**
  - *Chosen Approach*: Every save of the LaTeX editor computes a SHA-256 `sourceHash` and increments the version revision. The compilation job requires `savedSourceHash === currentEditorHash`. Editing the `.tex` code immediately marks any previously compiled PDF as `STALE` until saved and recompiled.
  - *Why*: Prevents the classic bug where compiling overwrites manual `.tex` tweaks with freshly rendered template output.
- **Decision 3: Multi-Layer Stage 4 Skill Exclusion**
  - *Chosen Approach*: Enforce `stage !== 4` at five independent boundaries: (1) Database/Repository `getEligibleSkillsForResume()`, (2) Express API Zod schema validation, (3) Gemini prompt context builder, (4) LaTeX template renderer (`renderSkillsSection()`), and (5) Post-render LaTeX/PDF text assertion in the validator.
  - *Why*: Ensures Stage 4 skills can never leak into a resume even if requested in a job description.

---

## 4. Technical Architecture & Data Strategy

### Architecture & Component Diagram

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                        React Frontend (1440px Workbench)                         │
│  ┌──────────────┐  ┌──────────────────────────┐  ┌────────────────────────────┐  │
│  │  Dashboard   │  │   Tailoring Workspace    │  │  Catalogues & Templates    │  │
│  │  & Versions  │  │  • JD & ATS X-Ray        │  │  • Project CRUD & Facts    │  │
│  │  • Statuses  │  │  • AI vs Manual Projects │  │  • 4-Stage Skill Manager   │  │
│  │  • Downloads │  │  • XYZ Bullet Surgeon    │  │  • Trusted LaTeX Template  │  │
│  └──────┬───────┘  │  • LaTeX Code & Diff     │  │  • Verification Test Suite │  │
│         │          │  • 1-Page PDF Validator  │  └─────────────┬──────────────┘  │
│         └──────────┴────────────┬─────────────┴────────────────┘                 │
└─────────────────────────────────┼────────────────────────────────────────────────┘
                                  │ REST API (/api/*)
┌─────────────────────────────────▼────────────────────────────────────────────────┐
│                        Express Server & Job Orchestrator                         │
│  ┌────────────────────────┐  ┌────────────────────────┐  ┌────────────────────┐  │
│  │  Gemini AI Service     │  │  LaTeX Engine &        │  │  Persistence &     │  │
│  │  (@google/genai)       │  │  Compilation Worker    │  │  Audit Layer       │  │
│  │  • analyzeJobDesc      │  │  • Safe LaTeX Escaper  │  │  • Projects /      │  │
│  │  • recommendProjects   │  │  • Template Injector   │  │    Skills (Stg 1-4)│  │
│  │  • tailorProjectBullets│  │  • SHA-256 Hash Guard  │  │  • Templates &     │  │
│  │  • analyzeSkillMatches │  │  • PDF Compiler &      │  │    Versions        │  │
│  │  • explainRecommend.   │  │    1-Page Validator    │  │  • Calibration MD  │  │
│  │  • suggestPageFitImpr. │  │  • Docker TeX Worker   │  │  • Audit Trail     │  │
│  └────────────────────────┘  └────────────────────────┘  └────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────────────┘
```

### Data Model & State

- **Project**: `id`, `title`, `sourceDescription` (AI reference only), `verifiedFacts[]`, `defaultBullets[]`, `domain` (`software` | `hardware` | `hybrid`), `technologies[]`, `keywords[]`, `githubUrl` (optional), `priority`, `metrics[]`, `createdAt`, `updatedAt`.
- **Skill & StageConfig**: `id`, `name`, `category`, `stage` (`1 | 2 | 3 | 4`), `verified` (boolean). Stage labels configured globally with Stage 4 hard-blocked from resume generation.
- **LatexTemplate**: `id`, `name`, `version`, `latexSource`, `sectionConfig`, `spacingConfig` (`marginInches`, `itemSepPt`, `sectionSpacePt`, `maxBulletsPerProject`), `createdAt`, `history[]`.
- **ResumeVersion**: `id`, `versionNumber`, `company`, `role`, `jobDescription`, `roleMode`, `jobStatus` (`QUEUED` | `ANALYZING` | `DRAFT_READY` | `RENDERING` | `COMPILING` | `VALIDATING` | `COMPLETED` | `FAILED`), `selectedProjectIds[]`, `manuallyLockedProjectIds[]`, `aiRecommendedProjects[]`, `projectBulletsMap`, `selectedSkillIds[]` (validated stages 1–3 only), `aiGeneratedLatex`, `savedLatexSource`, `savedSourceHash`, `compiledSourceHash`, `compilationResult` (`pageCount`, `isOnePageValid`, `extractedText`, `warnings[]`, `errors[]`, `pdfBase64`, `compiledAt`), `auditLog[]`.

### Interactive Component & State Mapping

- **JD & Role Mode Change**: Updating Company, Role, JD, or switching the `Software / Hardware / Hybrid` filter triggers project catalogue filtering and enables `analyzeJobDescription()` + `recommendProjects()`, while preserving `selectedProjectIds` and `manuallyLockedProjectIds` untouched.
- **Project Selection & Ordering Controls**: Clicking "Add to Selected" on an AI recommendation appends the project to `selectedProjectIds`. Toggling selection or lock state in the catalogue sets `manuallyLocked = true` so subsequent AI passes never remove or reorder it. Up/down and drag-reorder handlers update project sequence and immediately recalculate the estimated 1-page line budget.
- **LaTeX Source Editor & Diff Mode**: Editing text in the code editor updates `editorLatexSource`. When `editorLatexSource !== savedLatexSource`, the UI displays an `Unsaved Changes` state. If a PDF was previously compiled from an older hash, its badge transitions to `Stale PDF — Recompile Required`. Clicking **Save Source** persists `savedLatexSource` and updates `savedSourceHash`. Clicking **Compile PDF** compiles `savedLatexSource`, runs one-page validation, and enables `.pdf` and `.tex` downloads only when `pageCount === 1`.
