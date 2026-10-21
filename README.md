# LaTeXForge — AI-Powered One-Page LaTeX Resume Builder

Production-ready full-stack AI LaTeX resume builder that generates, edits, compiles, and validates strictly **one-page PDF resumes** from your trusted Jake's Resume LaTeX template, verified project catalogue, and four-stage skill taxonomy.

---

## Core Architecture & Capabilities

1. **Authoritative Manual Project Selection vs. AI Recommendations**:
   - **List A (AI-Recommended Projects)**: Ranks projects from your verified catalogue against the target Job Description (JD) with evidence-based rationales and matching keywords.
   - **List B (Manually Selected Projects & Searchable Catalogue)**: Allows selecting, deselecting, locking (`manuallyLocked`), and reordering any project (including unrecommended ones) with a `Software / Hardware / Hybrid` domain filter. Changing the JD, company, role, or domain mode **never** deletes or overwrites manual selections.
2. **Concise Bulleted LaTeX Output (`\resumeItem`)**:
   - Full project descriptions are stored strictly as AI reference context and never inserted as paragraphs.
   - Every selected project renders with `\resumeProjectHeading` followed by `\resumeItemListStart` / `\resumeItem{...}` / `\resumeItemListEnd`.
   - Optional GitHub URLs are validated and rendered via `\href{...}{\underline{GitHub}}`, or cleanly omitted when empty.
3. **Multi-Layer Four-Stage Skill Governance (`STAGE 1` – `STAGE 4`)**:
   - Supports four configurable stages:
     - `STAGE 1, THE TRANSLATOR` (Included)
     - `STAGE 2, THE X-RAY` (Included)
     - `STAGE 3, THE SURGEON` (Included)
     - `STAGE 4, THE EXAMINER` (**Strictly Excluded from all generated resumes**)
   - Stage 4 exclusion is enforced across database queries, API validation, Gemini prompt preparation, LaTeX rendering, PDF validation, and automated tests.
4. **Authoritative Browser LaTeX Editor & SHA-256 Hash Locking**:
   - Inspect and edit the complete `.tex` source in the browser with line numbers and a side-by-side Diff view (`AI Template Draft` vs. `User-Edited Source`).
   - Saving commits a SHA-256 `savedSourceHash` to the database. Compiling verifies `expectedSourceHash === savedSourceHash` so manual `.tex` edits are never overwritten by fresh AI generations.
5. **One-Page PDF Compilation & Validation**:
   - Compiles the exact saved `.tex` source into a binary PDF and validates `pageCount === 1`.
   - If a resume overflows onto 2+ pages, final PDF download is locked, actionable space-fit suggestions are shown, and an explicit **"Create Separate 1-Page Optimized Draft Version"** action creates a new version while protecting `manuallyLocked` projects.

---

## Local Development

```bash
# 1. Install dependencies
npm install

# 2. Configure environment variables
cp .env.example .env

# 3. Run the 17 automated verification tests
npm test

# 4. Start the full-stack development server on port 3000
npm run dev
```

---

## Deployment Instructions

### 1. Database (Neon PostgreSQL + Prisma)
1. Provision a Neon PostgreSQL database and copy `DATABASE_URL` and `DIRECT_URL` into your environment variables.
2. Run Prisma schema push/migrations:
   ```bash
   npx prisma db push --schema=prisma/schema.prisma
   ```

### 2. Dedicated Dockerized LaTeX Worker (`worker/Dockerfile`)
Deploy the isolated TeX Live worker container to Cloud Run, Fly.io, Render, or Railway:
```bash
docker build -f worker/Dockerfile -t latexforge-worker .
docker run -p 8080:8080 -e WORKER_API_SECRET="your-secret" latexforge-worker
```
Set `WORKER_URL` and `WORKER_API_SECRET` in your web application environment.

### 3. Production Security Checklist
- [x] `GEMINI_API_KEY` and `WORKER_API_SECRET` kept strictly server-side (zero `NEXT_PUBLIC_` or `VITE_` exposure).
- [x] LaTeX compiler runs as non-root `texworker` user with `-no-shell-escape`, `-halt-on-error`, and `openout_any=p`.
- [x] Special LaTeX characters (`&`, `%`, `$`, `#`, `_`, `{`, `}`, `~`, `^`, `\`) escaped and URLs validated against command injection.
- [x] Stage 4 skills blocked across all 5 architectural boundaries.
