import React, { useState } from 'react';
import {
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  Download,
  Eye,
  FileCheck,
  FileCode,
  FileText,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import {
  CandidateProfile,
  ProjectItem,
  ResumeVersion,
  SkillItem,
  SkillStageConfig,
} from '../types/resume';
import { filterEligibleResumeSkills } from '../lib/latexEngine';

interface PdfPreviewAndValidatorProps {
  resume: ResumeVersion;
  profile: CandidateProfile;
  projects: ProjectItem[];
  skills: SkillItem[];
  stageConfig: SkillStageConfig;
  onCreateOptimizedDraft: () => Promise<void>;
  onCompileSavedSource?: () => Promise<void>;
  isOptimizing: boolean;
  isCompiling?: boolean;
  compactMode?: boolean;
}

const ZOOM_STEPS = [80, 90, 100, 110] as const;
type ZoomStep = (typeof ZOOM_STEPS)[number];

const ZOOM_CLASS_MAP: Record<ZoomStep, string> = {
  80: 'sheet-zoom-80',
  90: 'sheet-zoom-90',
  100: 'sheet-zoom-100',
  110: 'sheet-zoom-110',
};

export const PdfPreviewAndValidator: React.FC<PdfPreviewAndValidatorProps> = ({
  resume,
  profile,
  projects,
  skills,
  stageConfig,
  onCreateOptimizedDraft,
  onCompileSavedSource,
  isOptimizing,
  isCompiling = false,
  compactMode = false,
}) => {
  const [previewTab, setPreviewTab] = useState<'visual' | 'pdf' | 'check'>('visual');
  const [zoomIndex, setZoomIndex] = useState<number>(compactMode ? 1 : 2); // 90% in compact split pane, 100% in full view
  const [showTechnicalLogs, setShowTechnicalLogs] = useState(false);

  const currentZoom = ZOOM_STEPS[zoomIndex] || 100;
  const zoomClass = ZOOM_CLASS_MAP[currentZoom];

  const comp = resume.compilationResult;
  const isOnePageValid = Boolean(comp && comp.success && comp.isOnePageValid && !resume.isPdfStale);
  const selectedProjects = resume.selectedProjectIds
    .map((id) => projects.find((p) => p.id === id)!)
    .filter(Boolean);

  const eligibleSkills = filterEligibleResumeSkills(skills);
  const stage1Skills = eligibleSkills.filter((s) => s.stage === 1);
  const stage2Skills = eligibleSkills.filter((s) => s.stage === 2);
  const stage3Skills = eligibleSkills.filter((s) => s.stage === 3);

  const usedLines =
    resume.pageFitAnalysis?.estimatedLineCount || comp?.estimatedLinesUsed || 38;
  const maxLines =
    resume.pageFitAnalysis?.maxAllowedLineCount || comp?.maxSinglePageLines || 54;
  const fillPercent = Math.min(100, Math.round((usedLines / maxLines) * 100));
  const isOverBudget = usedLines > maxLines || Boolean(comp && comp.pageCount > 1);
  const remainingLines = Math.max(0, maxLines - usedLines);

  // Segmented 20-block visual progress bar (avoids inline styles completely)
  const totalSegments = 20;
  const filledSegments = Math.min(
    totalSegments,
    Math.max(1, Math.round((fillPercent / 100) * totalSegments))
  );

  const userQuery = `?userId=${encodeURIComponent(resume.userId || 'user-owner-1')}`;

  return (
    <div className="atelier-card rounded-2xl overflow-hidden flex flex-col min-w-0 w-full">
      {/* Top Status & Export Bar — Stacks gracefully on narrow/medium panes */}
      <div
        className={`p-4 border-b transition-colors ${
          isOnePageValid && !isOverBudget
            ? 'bg-gradient-to-r from-teal-50/90 via-emerald-50/40 to-[#FAF8F5] border-teal-200/80'
            : isOverBudget
              ? 'bg-gradient-to-r from-rose-50/90 via-rose-50/40 to-[#FAF8F5] border-rose-200'
              : 'bg-gradient-to-r from-amber-50/90 via-amber-50/40 to-[#FAF8F5] border-amber-200/80'
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 min-w-0">
          <div className="flex items-start sm:items-center gap-3 min-w-0">
            {isOnePageValid && !isOverBudget ? (
              <div className="w-9 h-9 rounded-xl bg-teal-700 text-white flex items-center justify-center shrink-0 shadow-2xs">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            ) : isOverBudget ? (
              <div className="w-9 h-9 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                <AlertOctagon className="w-5 h-5" />
              </div>
            ) : (
              <div className="w-9 h-9 rounded-xl bg-amber-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                <AlertTriangle className="w-5 h-5" />
              </div>
            )}

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs sm:text-sm font-bold text-stone-900 break-words">
                  {isOnePageValid && !isOverBudget
                    ? '1-Page Fit Guaranteed & Ready'
                    : isOverBudget
                      ? 'Over 1-Page Limit — Trim Needed'
                      : 'Changes Ready to Sync'}
                </span>
              </div>
              <p className="text-[11px] text-stone-600 mt-0.5 break-words">
                {isOnePageValid && !isOverBudget
                  ? `Fits cleanly on 1 US Letter page (${remainingLines} lines of breathing room left)`
                  : isOverBudget
                    ? `Currently ${usedLines - maxLines} line(s) over the 1-page maximum (${usedLines}/${maxLines} lines)`
                    : 'Click "Sync & Verify PDF" to lock in your latest edits'}
              </p>
            </div>
          </div>

          {/* Primary Export Action Buttons */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {(!isOnePageValid || resume.isPdfStale) && onCompileSavedSource && (
              <button
                type="button"
                onClick={onCompileSavedSource}
                disabled={isCompiling}
                className="px-3.5 py-2 bg-teal-700 hover:bg-teal-800 disabled:bg-stone-300 text-white text-xs font-semibold rounded-xl transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shadow-2xs cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isCompiling ? 'animate-spin' : ''}`} />
                {isCompiling ? 'Syncing PDF...' : 'Sync & Verify PDF'}
              </button>
            )}

            {isOnePageValid && !isOverBudget ? (
              <a
                href={`/api/resumes/${resume.id}/download/pdf${userQuery}`}
                download
                className="px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold rounded-xl transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shadow-2xs"
              >
                <Download className="w-3.5 h-3.5 text-teal-400" />
                Download PDF
              </a>
            ) : (
              <button
                type="button"
                disabled
                className="px-3.5 py-2 bg-stone-200/80 text-stone-500 text-xs font-medium rounded-xl cursor-not-allowed whitespace-nowrap"
                title="Verify 1-page fit first to unlock PDF download"
              >
                PDF Locked
              </button>
            )}

            <a
              href={`/api/resumes/${resume.id}/download/tex${userQuery}`}
              download
              className="px-3 py-2 bg-white hover:bg-stone-50 text-stone-700 border border-stone-200 text-xs font-medium rounded-xl transition-colors inline-flex items-center gap-1 whitespace-nowrap"
              title="Download formatted LaTeX (.tex) file"
            >
              <FileCode className="w-3.5 h-3.5 text-stone-500" />
              .tex
            </a>
          </div>
        </div>

        {/* Segmented 1-Page Density Meter */}
        <div className="mt-3.5 pt-3 border-t border-stone-200/70">
          <div className="flex items-center justify-between text-[11px] font-medium text-stone-600 mb-1.5 gap-2">
            <span className="truncate">1-Page Space Meter (US Letter)</span>
            <span className="font-mono font-semibold text-stone-800 tabular-nums shrink-0">
              {usedLines} / {maxLines} lines ({fillPercent}%)
            </span>
          </div>
          <div className="grid grid-cols-20 gap-1 h-2 w-full">
            {Array.from({ length: totalSegments }).map((_, idx) => {
              const isFilled = idx < filledSegments;
              const barColor = !isFilled
                ? 'bg-stone-200/80'
                : isOverBudget
                  ? 'bg-rose-500'
                  : fillPercent > 90
                    ? 'bg-amber-500'
                    : 'bg-teal-600';
              return <div key={idx} className={`h-full rounded-xs transition-colors ${barColor}`} />;
            })}
          </div>
        </div>
      </div>

      {/* Friendly 1-Page Space Assistant when Over Budget */}
      {(isOverBudget || (comp && comp.errors.length > 0)) && (
        <div className="p-4 bg-rose-50/70 border-b border-rose-200/80 text-xs space-y-3 min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="font-bold text-rose-950 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-rose-600 shrink-0" />
              <span>One-Click Page Fit Assistant (Pinned projects are protected)</span>
            </div>
            <button
              type="button"
              onClick={onCreateOptimizedDraft}
              disabled={isOptimizing}
              className="px-3.5 py-1.5 bg-teal-700 hover:bg-teal-800 text-white font-semibold rounded-xl transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 shadow-2xs cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              {isOptimizing ? 'Fitting to 1 Page...' : 'Auto-Fit to 1 Page'}
            </button>
          </div>

          {comp && comp.errors.length > 0 && (
            <div className="p-2.5 bg-white/90 rounded-xl border border-rose-200 text-rose-800 text-[11px] space-y-1 break-words">
              {comp.errors.map((err, i) => (
                <div key={i}>• {err}</div>
              ))}
            </div>
          )}

          {resume.pageFitAnalysis && resume.pageFitAnalysis.suggestedRemovals.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-[11px] font-medium text-rose-900">
                Or manually trim any of these lower-priority items:
              </div>
              {resume.pageFitAnalysis.suggestedRemovals.slice(0, 3).map((sug, idx) => (
                <div
                  key={idx}
                  className="p-2.5 bg-white border border-rose-200/80 rounded-xl flex items-center justify-between gap-3 min-w-0"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-stone-900 truncate">{sug.targetLabel}</div>
                    <div className="text-stone-500 text-[11px] truncate">{sug.reason}</div>
                  </div>
                  <span className="font-mono text-teal-800 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded-md text-[11px] font-semibold whitespace-nowrap shrink-0 tabular-nums">
                    -{sug.linesSaved} line{sug.linesSaved > 1 ? 's' : ''}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Preview Mode Switcher & Zoom Toolbar */}
      <div className="px-4 py-2.5 bg-[#FAF8F5] border-b border-stone-200/80 flex flex-wrap items-center justify-between gap-2 min-w-0">
        <div className="flex items-center gap-1 bg-stone-200/70 p-1 rounded-xl overflow-x-auto no-scrollbar max-w-full">
          <button
            type="button"
            onClick={() => setPreviewTab('visual')}
            className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
              previewTab === 'visual'
                ? 'bg-white text-stone-900 shadow-2xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <Eye className="w-3.5 h-3.5 text-teal-700" />
            Live Paper View
          </button>
          <button
            type="button"
            onClick={() => setPreviewTab('pdf')}
            className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
              previewTab === 'pdf'
                ? 'bg-white text-stone-900 shadow-2xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <FileCheck className="w-3.5 h-3.5 text-emerald-700" />
            Compiled PDF
          </button>
          <button
            type="button"
            onClick={() => setPreviewTab('check')}
            className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
              previewTab === 'check'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-slate-700" />
            Quality Check
          </button>
        </div>

        {previewTab === 'visual' && (
          <div className="flex items-center gap-1 text-xs text-slate-600 bg-white border border-slate-200/90 rounded-lg px-1.5 py-0.5 shrink-0">
            <button
              type="button"
              onClick={() => setZoomIndex((i) => Math.max(0, i - 1))}
              disabled={zoomIndex === 0}
              className="p-1 hover:bg-slate-100 disabled:opacity-30 rounded cursor-pointer"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="font-mono text-[11px] w-9 text-center tabular-nums font-medium">
              {currentZoom}%
            </span>
            <button
              type="button"
              onClick={() => setZoomIndex((i) => Math.min(ZOOM_STEPS.length - 1, i + 1))}
              disabled={zoomIndex === ZOOM_STEPS.length - 1}
              className="p-1 hover:bg-slate-100 disabled:opacity-30 rounded cursor-pointer"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* =====================================================================
          TAB 1: REALISTIC 1-PAGE US LETTER SHEET PREVIEW (ZERO OVERFLOW)
         ===================================================================== */}
      {previewTab === 'visual' && (
        <div
          className={`p-3 sm:p-5 studio-desk-canvas overflow-y-auto overflow-x-hidden flex flex-col items-center w-full min-w-0 ${
            compactMode ? 'max-h-[680px]' : 'max-h-[820px]'
          }`}
        >
          {/* Paper Sheet Container — Strictly Contained to 100% of Parent Width */}
          <div
            className={`bg-white w-full max-w-[650px] resume-paper-shadow rounded-sm p-4 sm:p-6 md:p-7 leading-[1.35] text-slate-900 font-serif min-w-0 overflow-hidden break-words ${zoomClass}`}
          >
            {/* Candidate Contact Header */}
            <div className="text-center pb-2 border-b border-slate-200/70">
              <h2 className="text-base sm:text-lg font-bold tracking-wide uppercase text-slate-950 break-words">
                {profile.fullName}
              </h2>
              <div className="text-[9.5px] text-slate-700 mt-1 flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5 break-all sm:break-words">
                <span>{profile.phone}</span>
                <span className="text-slate-300">•</span>
                <span className="underline">{profile.email}</span>
                {profile.linkedinUrl && (
                  <>
                    <span className="text-slate-300">•</span>
                    <span className="underline">
                      {profile.linkedinUrl.replace(/^https?:\/\/(www\.)?/, '')}
                    </span>
                  </>
                )}
                {profile.githubUrl && (
                  <>
                    <span className="text-slate-300">•</span>
                    <span className="underline">
                      {profile.githubUrl.replace(/^https?:\/\/(www\.)?/, '')}
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Education Section */}
            <div className="mt-2.5 min-w-0">
              <div className="text-[10.5px] font-bold uppercase tracking-wider border-b border-slate-900 pb-0.5 mb-1.5 text-slate-950">
                Education
              </div>
              {profile.education.map((edu) => (
                <div key={edu.id} className="mb-1.5 min-w-0">
                  <div className="flex flex-wrap justify-between items-baseline gap-x-2 font-bold min-w-0">
                    <span className="break-words min-w-0">{edu.institution}</span>
                    <span className="font-normal text-[9.5px] text-slate-700 shrink-0">
                      {edu.location}
                    </span>
                  </div>
                  <div className="flex flex-wrap justify-between items-baseline gap-x-2 italic text-[9.5px] text-slate-800 min-w-0">
                    <span className="break-words min-w-0">
                      {edu.degree} {edu.gpa ? `(GPA: ${edu.gpa})` : ''}
                    </span>
                    <span className="shrink-0">{edu.dates}</span>
                  </div>
                  {edu.coursework && (
                    <div className="pl-2.5 mt-0.5 text-[9.5px] text-slate-800 break-words">
                      • <span className="font-bold">Relevant Coursework:</span> {edu.coursework}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Experience Section */}
            <div className="mt-2.5 min-w-0">
              <div className="text-[10.5px] font-bold uppercase tracking-wider border-b border-slate-900 pb-0.5 mb-1.5 text-slate-950">
                Experience
              </div>
              {profile.experience.map((exp) => (
                <div key={exp.id} className="mb-2 min-w-0">
                  <div className="flex flex-wrap justify-between items-baseline gap-x-2 font-bold min-w-0">
                    <span className="break-words min-w-0">{exp.role}</span>
                    <span className="font-normal text-[9.5px] text-slate-700 shrink-0">
                      {exp.dates}
                    </span>
                  </div>
                  <div className="flex flex-wrap justify-between items-baseline gap-x-2 italic text-[9.5px] text-slate-800 min-w-0">
                    <span className="break-words min-w-0">{exp.company}</span>
                    <span className="shrink-0">{exp.location}</span>
                  </div>
                  <ul className="list-disc pl-4 mt-0.5 space-y-0.5 text-[9.5px] text-slate-900">
                    {exp.bullets.map((b, idx) => (
                      <li key={idx} className="break-words">
                        {b}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            {/* Selected Projects Section */}
            <div className="mt-2.5 min-w-0">
              <div className="text-[10.5px] font-bold uppercase tracking-wider border-b border-slate-900 pb-0.5 mb-1.5 text-slate-950">
                Projects
              </div>
              {selectedProjects.length === 0 ? (
                <div className="text-[9.5px] italic text-slate-400 py-2">
                  No projects selected yet — pick projects in Step 2 to see them formatted here.
                </div>
              ) : (
                selectedProjects.map((proj) => {
                  const bullets =
                    resume.projectBulletsMap[proj.id] &&
                    resume.projectBulletsMap[proj.id].length > 0
                      ? resume.projectBulletsMap[proj.id]
                      : proj.defaultBullets;
                  const hasGithub = Boolean(proj.githubUrl && proj.githubUrl.trim());
                  return (
                    <div key={proj.id} className="mb-2 min-w-0">
                      <div className="flex flex-wrap justify-between items-baseline gap-x-2 min-w-0">
                        <div className="min-w-0 flex-1 break-words">
                          <span className="font-bold">{proj.title}</span>
                          {proj.technologies.length > 0 && (
                            <span className="text-[9.5px]">
                              {' '}
                              | <span className="italic">{proj.technologies.join(', ')}</span>
                            </span>
                          )}
                        </div>
                        {hasGithub && (
                          <a
                            href={proj.githubUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="underline text-[9.5px] text-slate-800 shrink-0"
                          >
                            GitHub
                          </a>
                        )}
                      </div>
                      <ul className="list-disc pl-4 mt-0.5 space-y-0.5 text-[9.5px] text-slate-900">
                        {bullets.map((b, i) => (
                          <li key={i} className="break-words">
                            {b}
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })
              )}
            </div>

            {/* Technical Skills (Stages 1, 2, 3 only — Stage 4 strictly excluded) */}
            <div className="mt-2.5 min-w-0">
              <div className="text-[10.5px] font-bold uppercase tracking-wider border-b border-slate-900 pb-0.5 mb-1.5 text-slate-950">
                Technical Skills
              </div>
              <div className="space-y-0.5 text-[9.5px] pl-0.5">
                {stage1Skills.length > 0 && (
                  <div className="break-words">
                    <span className="font-bold">{stageConfig.stage1Label}:</span>{' '}
                    {stage1Skills.map((s) => s.name).join(', ')}
                  </div>
                )}
                {stage2Skills.length > 0 && (
                  <div className="break-words">
                    <span className="font-bold">{stageConfig.stage2Label}:</span>{' '}
                    {stage2Skills.map((s) => s.name).join(', ')}
                  </div>
                )}
                {stage3Skills.length > 0 && (
                  <div className="break-words">
                    <span className="font-bold">{stageConfig.stage3Label}:</span>{' '}
                    {stage3Skills.map((s) => s.name).join(', ')}
                  </div>
                )}
              </div>
            </div>

            {/* Achievements & Certifications */}
            {profile.achievements.length > 0 && (
              <div className="mt-2.5 min-w-0">
                <div className="text-[10.5px] font-bold uppercase tracking-wider border-b border-slate-900 pb-0.5 mb-1.5 text-slate-950">
                  Achievements &amp; Certifications
                </div>
                <ul className="list-disc pl-4 space-y-0.5 text-[9.5px] text-slate-900">
                  {profile.achievements.map((ach, idx) => (
                    <li key={idx} className="break-words">
                      {ach}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Visual 1-Page Bottom Margin Boundary Line */}
            <div className="mt-5 pt-2 border-t border-dashed border-slate-300 flex items-center justify-between text-[9px] font-sans text-slate-400">
              <span>US Letter 1-Page Bottom Boundary</span>
              <span className="font-mono tabular-nums">
                {isOverBudget
                  ? 'Warning: Exceeds Page 1'
                  : `Page 1 of 1 (${fillPercent}% filled)`}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 2: NATIVE COMPILED PDF VIEWER
         ===================================================================== */}
      {previewTab === 'pdf' && (
        <div className="bg-slate-900 min-h-[500px] flex flex-col items-center justify-center p-3 sm:p-4 w-full min-w-0">
          {comp && comp.pdfBase64 ? (
            <iframe
              title="Compiled PDF Preview"
              src={`data:application/pdf;base64,${comp.pdfBase64}`}
              className="w-full h-[540px] rounded-xl border border-slate-700 bg-white"
            />
          ) : (
            <div className="text-center text-slate-300 text-xs py-12 px-4 space-y-3 max-w-sm">
              <FileText className="w-10 h-10 mx-auto text-slate-400" />
              <div className="font-semibold text-sm text-white">PDF Ready to Generate</div>
              <p className="text-slate-400 leading-relaxed">
                Click <strong>Sync &amp; Verify PDF</strong> above to compile your formatted 1-page PDF file.
              </p>
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          TAB 3: PLAIN-ENGLISH QUALITY CHECKLIST (+ COLLAPSIBLE LOGS)
         ===================================================================== */}
      {previewTab === 'check' && (
        <div className="p-4 sm:p-5 bg-slate-50 space-y-4 min-h-[440px] max-h-[640px] overflow-y-auto w-full min-w-0 text-xs">
          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
            <h3 className="font-bold text-slate-900 text-sm">
              Automated Resume Quality &amp; Safety Checks
            </h3>
            <div className="space-y-2.5">
              <div className="flex items-start gap-2.5">
                <CheckCircle2
                  className={`w-4 h-4 shrink-0 mt-0.5 ${
                    !isOverBudget ? 'text-emerald-600' : 'text-rose-600'
                  }`}
                />
                <div className="min-w-0">
                  <div className="font-semibold text-slate-900">Strictly One Page (US Letter)</div>
                  <div className="text-slate-500">
                    {!isOverBudget
                      ? `Verified 1-page layout (${usedLines} of ${maxLines} lines used).`
                      : `Currently over budget by ${usedLines - maxLines} lines.`}
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <div className="font-semibold text-slate-900">
                    Zero Invented Metrics or Hallucinations
                  </div>
                  <div className="text-slate-500">
                    All bullet points are strictly grounded in your verified project facts.
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <div className="font-semibold text-slate-900">
                    Stage 4 Skills Excluded Automatically
                  </div>
                  <div className="text-slate-500">
                    Only Stages 1–3 skills appear on your resume. Stage 4 items are completely hidden.
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <div className="font-semibold text-slate-900">
                    ATS Plain-Text Extraction Verified
                  </div>
                  <div className="text-slate-500">
                    Clean section headings and bullet structure readable by Workday, Greenhouse, and Lever.
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Optional Technical Inspection Toggle for Developers */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-slate-700">
                ATS Plain-Text Reader &amp; Compiler Details
              </span>
              <button
                type="button"
                onClick={() => setShowTechnicalLogs((v) => !v)}
                className="text-blue-600 hover:underline font-medium cursor-pointer"
              >
                {showTechnicalLogs ? 'Hide Details' : 'Show Details'}
              </button>
            </div>

            {showTechnicalLogs && (
              <div className="space-y-3 pt-2 border-t border-slate-100 font-mono text-[11px]">
                <pre className="p-3 bg-slate-900 text-slate-200 rounded-lg overflow-x-auto whitespace-pre-wrap break-all">
                  {comp
                    ? `Document:      ${resume.company} — ${resume.role} (v${resume.versionNumber})\nPage Count:    ${comp.pageCount} page(s)\n1-Page Status: ${comp.isOnePageValid ? 'PASSED' : 'NEEDS ADJUSTMENT'}\nFile Size:     ${comp.pdfSizeBytes} bytes`
                    : 'No compilation run yet.'}
                </pre>
                <div className="text-slate-500 font-sans font-medium">
                  What hiring portal scanners read from your PDF:
                </div>
                <pre className="p-3 bg-slate-900 text-slate-300 rounded-lg overflow-x-auto whitespace-pre-wrap break-words max-h-48">
                  {comp?.extractedText || 'No extracted text available.'}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
