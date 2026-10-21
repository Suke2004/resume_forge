import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Code2,
  Download,
  FileCode,
  GitCompare,
  Play,
  RotateCcw,
  Save,
  ShieldCheck,
} from 'lucide-react';
import { computeSourceHash } from '../lib/latexEngine';
import { ResumeVersion } from '../types/resume';

interface LatexCodeEditorProps {
  resume: ResumeVersion;
  editorSource: string;
  onChangeEditorSource: (next: string) => void;
  onSaveSource: () => Promise<void>;
  onCompileSavedSource: () => Promise<void>;
  onReRenderFromSelection: (forceOverwriteEditor: boolean) => Promise<void>;
  isSaving: boolean;
  isCompiling: boolean;
}

export const LatexCodeEditor: React.FC<LatexCodeEditorProps> = ({
  resume,
  editorSource,
  onChangeEditorSource,
  onSaveSource,
  onCompileSavedSource,
  onReRenderFromSelection,
  isSaving,
  isCompiling,
}) => {
  const [viewMode, setViewMode] = useState<'edit' | 'diff'>('edit');
  const [confirmResetModal, setConfirmResetModal] = useState(false);

  const currentEditorHash = useMemo(() => computeSourceHash(editorSource), [editorSource]);
  const hasUnsavedChanges = currentEditorHash !== resume.savedSourceHash;
  const isModifiedFromAiDraft = editorSource.trim() !== resume.aiGeneratedLatex.trim();
  const isCompiledCurrent =
    !hasUnsavedChanges &&
    Boolean(resume.compiledSourceHash) &&
    resume.compiledSourceHash === resume.savedSourceHash &&
    !resume.isPdfStale;

  const lines = useMemo(() => editorSource.split('\n'), [editorSource]);

  const diffRows = useMemo(() => {
    const aiLines = resume.aiGeneratedLatex.split('\n');
    const userLines = editorSource.split('\n');
    const maxLen = Math.max(aiLines.length, userLines.length);
    const rows: {
      lineNum: number;
      aiText: string;
      userText: string;
      changed: boolean;
    }[] = [];
    for (let i = 0; i < maxLen; i++) {
      const a = aiLines[i] ?? '';
      const u = userLines[i] ?? '';
      rows.push({
        lineNum: i + 1,
        aiText: a,
        userText: u,
        changed: a !== u,
      });
    }
    return rows;
  }, [resume.aiGeneratedLatex, editorSource]);

  const changedLineCount = useMemo(
    () => diffRows.filter((r) => r.changed).length,
    [diffRows]
  );

  return (
    <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden flex flex-col min-w-0 w-full">
      {/* Friendly Header Bar */}
      <div className="px-4 sm:px-5 py-3.5 bg-slate-900 text-slate-100 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <FileCode className="w-4 h-4 text-blue-400 shrink-0" />
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs sm:text-sm font-semibold truncate">
              <span>LaTeX Source Editor (.tex)</span>
              <span className="text-slate-500">·</span>
              <span className="font-mono text-xs text-slate-400 tabular-nums">
                {lines.length} lines
              </span>
            </div>
            <p className="text-[11px] text-slate-400 truncate">
              Your manual edits here are authoritative and will never be overwritten when compiling.
            </p>
          </div>
        </div>

        {/* Plain-English Status Indicators */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {hasUnsavedChanges ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/40 font-medium whitespace-nowrap">
              <AlertTriangle className="w-3.5 h-3.5" />
              Unsaved Changes
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-medium whitespace-nowrap">
              <CheckCircle2 className="w-3.5 h-3.5" />
              All Changes Saved
            </span>
          )}

          {isModifiedFromAiDraft && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-500/20 text-blue-300 border border-blue-500/40 font-medium whitespace-nowrap">
              <ShieldCheck className="w-3.5 h-3.5" />
              Custom Edits Active ({changedLineCount} lines)
            </span>
          )}
        </div>
      </div>

      {/* Action Toolbar */}
      <div className="px-4 py-2.5 bg-slate-800 border-b border-slate-700 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-700">
          <button
            type="button"
            onClick={() => setViewMode('edit')}
            className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
              viewMode === 'edit'
                ? 'bg-blue-600 text-white'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            Edit Code
          </button>
          <button
            type="button"
            onClick={() => setViewMode('diff')}
            className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
              viewMode === 'diff'
                ? 'bg-blue-600 text-white'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <GitCompare className="w-3.5 h-3.5" />
            Compare Edits ({changedLineCount})
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isModifiedFromAiDraft && (
            <button
              type="button"
              onClick={() => setConfirmResetModal(true)}
              className="px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset to Template
            </button>
          )}

          <button
            type="button"
            onClick={onSaveSource}
            disabled={isSaving}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
              hasUnsavedChanges
                ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold'
                : 'bg-slate-700 hover:bg-slate-600 text-white'
            }`}
          >
            <Save className="w-3.5 h-3.5" />
            {isSaving ? 'Saving...' : hasUnsavedChanges ? 'Save Changes' : 'Saved'}
          </button>

          <button
            type="button"
            onClick={onCompileSavedSource}
            disabled={isCompiling || hasUnsavedChanges}
            title={
              hasUnsavedChanges
                ? 'Click "Save Changes" first before compiling'
                : 'Compile your saved LaTeX code into the 1-page PDF'
            }
            className="px-3.5 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-400 text-white rounded-lg transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <Play className="w-3.5 h-3.5" />
            {isCompiling
              ? 'Compiling PDF...'
              : isCompiledCurrent
                ? 'Recompile PDF'
                : 'Compile to PDF'}
          </button>

          <a
            href={`/api/resumes/${resume.id}/download/tex`}
            download
            className="px-2.5 py-1.5 text-xs font-medium bg-slate-700 hover:bg-slate-600 text-slate-100 rounded-lg transition-colors inline-flex items-center gap-1 whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            .tex
          </a>
        </div>
      </div>

      {/* Explicit Confirmation Banner before overwriting manual edits */}
      {confirmResetModal && (
        <div className="px-4 py-3 bg-amber-950 text-amber-100 border-b border-amber-700 flex flex-wrap items-center justify-between gap-3 text-xs">
          <span>
            <strong>Replace custom edits?</strong> Resetting will replace your manual code edits with the generated template draft.
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={async () => {
                setConfirmResetModal(false);
                await onReRenderFromSelection(true);
              }}
              className="px-3 py-1 bg-amber-500 text-slate-950 font-semibold rounded hover:bg-amber-400 whitespace-nowrap"
            >
              Yes, Reset Code
            </button>
            <button
              type="button"
              onClick={() => setConfirmResetModal(false)}
              className="px-3 py-1 bg-slate-800 text-slate-200 rounded hover:bg-slate-700 whitespace-nowrap"
            >
              Keep My Edits
            </button>
          </div>
        </div>
      )}

      {hasUnsavedChanges && (
        <div className="px-4 py-2 bg-amber-50 border-b border-amber-200 text-amber-900 text-xs flex items-center justify-between gap-2">
          <span>
            You have unsaved edits in the code below. Click <strong>Save Changes</strong> before compiling your PDF.
          </span>
        </div>
      )}

      {/* Code Editor / Diff Area with Strict Overflow Containment */}
      {viewMode === 'edit' ? (
        <div className="relative flex bg-[#0F172A] text-slate-100 min-h-[480px] max-h-[640px] overflow-y-auto overflow-x-hidden font-mono text-xs leading-5 w-full min-w-0">
          <div
            aria-hidden="true"
            className="select-none py-4 px-2.5 bg-slate-950 text-slate-500 text-right border-r border-slate-800 tabular-nums shrink-0"
          >
            {lines.map((_, idx) => (
              <div key={idx} className="leading-5">
                {idx + 1}
              </div>
            ))}
          </div>
          <textarea
            value={editorSource}
            onChange={(e) => onChangeEditorSource(e.target.value)}
            spellCheck={false}
            aria-label="Editable LaTeX Source Code"
            className="w-full min-w-0 p-4 bg-transparent text-slate-100 font-mono text-xs leading-5 focus:outline-none resize-none min-h-[480px] overflow-x-auto"
          />
        </div>
      ) : (
        <div className="bg-[#0F172A] text-slate-100 min-h-[480px] max-h-[640px] overflow-auto font-mono text-xs w-full min-w-0">
          <div className="grid grid-cols-2 border-b border-slate-800 bg-slate-950 text-slate-400 text-[11px] font-semibold sticky top-0 z-10">
            <div className="px-3 py-2 border-r border-slate-800 truncate">
              Original Generated Draft
            </div>
            <div className="px-3 py-2 truncate">Your Custom Edited Code</div>
          </div>
          {diffRows.map((row) => (
            <div
              key={row.lineNum}
              className={`grid grid-cols-2 border-b border-slate-900/70 min-w-0 ${
                row.changed ? 'bg-blue-950/40' : ''
              }`}
            >
              <div
                className={`px-2.5 py-0.5 border-r border-slate-800 whitespace-pre-wrap break-all flex gap-2 min-w-0 ${
                  row.changed ? 'text-rose-300 bg-rose-950/30' : 'text-slate-400'
                }`}
              >
                <span className="text-slate-600 select-none w-6 text-right shrink-0 tabular-nums">
                  {row.lineNum}
                </span>
                <span className="min-w-0 break-all">{row.aiText}</span>
              </div>
              <div
                className={`px-2.5 py-0.5 whitespace-pre-wrap break-all flex gap-2 min-w-0 ${
                  row.changed ? 'text-emerald-300 bg-emerald-950/30 font-medium' : 'text-slate-200'
                }`}
              >
                <span className="text-slate-600 select-none w-6 text-right shrink-0 tabular-nums">
                  {row.lineNum}
                </span>
                <span className="min-w-0 break-all">{row.userText}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Subtle Technical Footer */}
      <div className="px-4 py-2 bg-slate-950 text-slate-500 border-t border-slate-800 text-[11px] font-mono flex flex-wrap items-center justify-between gap-2 tabular-nums">
        <span>Saved Snapshot ID: {resume.savedSourceHash.slice(0, 16)}</span>
        <span>
          {isCompiledCurrent ? 'PDF Verified & Up-to-Date' : 'Save & Compile to refresh PDF'}
        </span>
      </div>
    </div>
  );
};
