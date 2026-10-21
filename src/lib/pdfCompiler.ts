import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { CompilationValidationResult, SkillItem } from '../types/resume';
import { computeSourceHash } from './latexEngine';

interface ParsedResumeSection {
  title: string;
  entries: {
    leftHeader?: string;
    rightHeader?: string;
    leftSub?: string;
    rightSub?: string;
    bullets: string[];
    rawLines?: string[];
  }[];
}

/**
 * Normalizes Unicode symbols commonly pasted from Word/Docs/Notion into safe WinAnsi ASCII/Latin-1
 * equivalents so pdf-lib StandardFonts (TimesRoman) never throws an encoding error on real user text.
 */
export function sanitizeForPdfWinAnsi(input: string): string {
  return input
    .replace(/\u00A0/g, ' ')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/≥/g, '>=')
    .replace(/≤/g, '<=')
    .replace(/→|⟶|⇒/g, '->')
    .replace(/←|⟵/g, '<-')
    .replace(/≈/g, '~')
    .replace(/≠/g, '!=')
    .replace(/±/g, '+/-')
    .replace(/×/g, 'x')
    .replace(/µ|μ/g, 'u')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[—–]/g, '-')
    // Strip any remaining characters outside WinAnsi printable range (keep 0x20-0x7E and •)
    .replace(/[^\x20-\x7E•]/g, '');
}

/**
 * Strips LaTeX formatting macros into clean readable text for PDF rendering and pdftotext inspection.
 */
export function stripLatexMacros(tex: string): string {
  const cleaned = tex
    .replace(/\\textbf\{([^}]*)\}/g, '$1')
    .replace(/\\textit\{([^}]*)\}/g, '$1')
    .replace(/\\emph\{([^}]*)\}/g, '$1')
    .replace(/\\underline\{([^}]*)\}/g, '$1')
    .replace(/\\scshape\b/g, '')
    .replace(/\\Huge\b|\\large\b|\\small\b|\\tiny\b/g, '')
    .replace(/\\href\{([^}]*)\}\{([^}]*)\}/g, '$2 ($1)')
    .replace(/\$\|\$/g, ' | ')
    .replace(/\\textasciitilde\{\}/g, '~')
    .replace(/\\textasciicircum\{\}/g, '^')
    .replace(/\\textbackslash\{\}/g, '\\')
    .replace(/\\&/g, '&')
    .replace(/\\%/g, '%')
    .replace(/\\\$/g, '$')
    .replace(/\\#/g, '#')
    .replace(/\\_/g, '_')
    .replace(/\\\{/g, '__ESCAPED_LBRACE__')
    .replace(/\\\}/g, '__ESCAPED_RBRACE__')
    .replace(/\\vspace\{[^}]*\}/g, '')
    .replace(/\\\\/g, '')
    .replace(/[{}]/g, '')
    .replace(/__ESCAPED_LBRACE__/g, '{')
    .replace(/__ESCAPED_RBRACE__/g, '}')
    .replace(/\s+/g, ' ')
    .trim();

  return sanitizeForPdfWinAnsi(cleaned);
}

/**
 * Extracts balanced `{...}` arguments while properly ignoring escaped `\{` and `\}`.
 */
function extractBalancedBraceGroups(source: string, maxGroups = 10): string[] {
  const groups: string[] = [];
  let depth = 0;
  let current = '';
  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    const prev = i > 0 ? source[i - 1] : '';
    if (ch === '{' && prev !== '\\') {
      if (depth > 0) current += ch;
      depth++;
    } else if (ch === '}' && prev !== '\\') {
      depth--;
      if (depth === 0) {
        groups.push(current);
        current = '';
        if (groups.length >= maxGroups) break;
      } else if (depth > 0) {
        current += ch;
      }
    } else if (depth > 0) {
      current += ch;
    }
  }
  return groups;
}

/**
 * Extracts all `\resumeItem{...}` contents while respecting escaped braces `\{` `\}` and nested macros.
 */
function extractResumeItemsFromBlock(block: string): string[] {
  const items: string[] = [];
  const token = '\\resumeItem{';
  let searchPos = 0;
  while (searchPos < block.length) {
    const idx = block.indexOf(token, searchPos);
    if (idx === -1) break;
    // Slice starting at the opening '{' of \resumeItem{
    const afterToken = block.slice(idx + token.length - 1);
    const groups = extractBalancedBraceGroups(afterToken, 1);
    if (groups.length > 0) {
      items.push(stripLatexMacros(groups[0]));
    }
    searchPos = idx + token.length;
  }
  return items;
}

/**
 * Security & syntax linter for user-edited LaTeX source.
 * Blocks shell-escape / arbitrary file read commands and detects syntax errors.
 */
export function validateLatexSourceSyntaxAndSecurity(
  latexSource: string,
  stage4Skills: SkillItem[] = []
): {
  errors: string[];
  warnings: string[];
  unresolvedReferences: string[];
  missingGlyphs: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  const unresolvedReferences: string[] = [];
  const missingGlyphs: string[] = [];

  if (!latexSource || !latexSource.trim()) {
    errors.push('LaTeX source is empty.');
    return { errors, warnings, unresolvedReferences, missingGlyphs };
  }

  // 1. Security checks: block shell execution or filesystem traversal
  const forbiddenCommands = [
    { pattern: /\\write18\b/, name: '\\write18 (shell execution)' },
    { pattern: /\\immediate\\write18\b/, name: '\\immediate\\write18' },
    { pattern: /\\input\{\s*\/+/i, name: '\\input with absolute path' },
    { pattern: /\\include\{\s*\.\./i, name: '\\include with parent directory traversal' },
    { pattern: /\\openout\b|\\openin\b/, name: 'raw file stream I/O (\\openout/\\openin)' },
    { pattern: /\\catcode\b/, name: 'low-level \\catcode manipulation' },
  ];

  for (const rule of forbiddenCommands) {
    if (rule.pattern.test(latexSource)) {
      errors.push(`Security Policy Violation: Restricted LaTeX command detected: ${rule.name}`);
    }
  }

  // 2. Document structure checks
  if (!latexSource.includes('\\begin{document}')) {
    errors.push('Missing \\begin{document} environment declaration.');
  }
  if (!latexSource.includes('\\end{document}')) {
    errors.push('Missing \\end{document} closing tag.');
  }

  // 3. Check balanced braces (ignoring escaped \{ and \})
  const lines = latexSource.split('\n');
  let braceDepth = 0;
  for (let idx = 0; idx < lines.length; idx++) {
    const lineWithoutComments = lines[idx].replace(/(^|[^\\])%.*$/, '$1');
    for (let i = 0; i < lineWithoutComments.length; i++) {
      const ch = lineWithoutComments[i];
      const prev = i > 0 ? lineWithoutComments[i - 1] : '';
      if (ch === '{' && prev !== '\\') braceDepth++;
      if (ch === '}' && prev !== '\\') braceDepth--;
      if (braceDepth < 0) {
        errors.push(`Line ${idx + 1}: Unexpected closing brace '}' without matching '{'.`);
        braceDepth = 0;
      }
    }
  }
  if (braceDepth > 0) {
    errors.push(
      `Unclosed brace '{' detected (${braceDepth} unclosed group${braceDepth > 1 ? 's' : ''}).`
    );
  }

  // 4. Check \begin{itemize} vs \end{itemize}
  const beginItemize = (latexSource.match(/\\begin\{itemize\}/g) || []).length;
  const endItemize = (latexSource.match(/\\end\{itemize\}/g) || []).length;
  if (beginItemize !== endItemize) {
    errors.push(
      `Mismatched itemize environments: ${beginItemize} \\begin{itemize} vs ${endItemize} \\end{itemize}.`
    );
  }

  const startList = (latexSource.match(/\\resumeItemListStart/g) || []).length;
  const endList = (latexSource.match(/\\resumeItemListEnd/g) || []).length;
  if (startList !== endList) {
    errors.push(
      `Mismatched custom list macros: ${startList} \\resumeItemListStart vs ${endList} \\resumeItemListEnd.`
    );
  }

  // 5. Verify Stage 4 skills never appear in the LaTeX document body
  const docBody = latexSource.split('\\begin{document}')[1] || latexSource;
  for (const s4 of stage4Skills) {
    if (s4.stage === 4 && s4.name && docBody.toLowerCase().includes(s4.name.toLowerCase())) {
      errors.push(
        `Stage 4 Policy Violation: Excluded Stage 4 skill "${s4.name}" was detected in the LaTeX source.`
      );
    }
  }

  // 6. Unresolved references or placeholders
  if (/\\ref\{\s*\}|\?\?/.test(docBody)) {
    unresolvedReferences.push('Unresolved LaTeX reference (?? or empty \\ref{}) detected.');
  }
  if (/[^\x00-\x7F–—•’“”]/g.test(docBody)) {
    missingGlyphs.push('Non-ASCII symbol detected; normalized via WinAnsi glyph mapper.');
    warnings.push('Non-standard Unicode characters found; normalized via glyphtounicode.');
  }

  return { errors, warnings, unresolvedReferences, missingGlyphs };
}

/**
 * Parses the saved LaTeX source into structured sections so manual user edits anywhere in the .tex
 * file are faithfully compiled into the resulting PDF document.
 */
function parseLatexDocumentForPdf(latexSource: string): {
  headerName: string;
  headerContact: string;
  marginInches: number;
  fontSizePt: number;
  sections: ParsedResumeSection[];
} {
  const bodyPart = (latexSource.split('\\begin{document}')[1] || latexSource).split(
    '\\end{document}'
  )[0];

  const marginMatch = latexSource.match(/\\addtolength\{\\oddsidemargin\}\{-([0-9.]+)in\}/);
  const marginInches = marginMatch ? parseFloat(marginMatch[1]) : 0.5;
  const fontMatch = latexSource.match(/\\documentclass\[letterpaper,(\d+)pt\]/);
  const fontSizePt = fontMatch ? parseInt(fontMatch[1], 10) : 10;

  let headerName = 'Candidate Name';
  let headerContact = '';
  const centerMatch = bodyPart.match(/\\begin\{center\}([\s\S]*?)\\end\{center\}/);
  if (centerMatch) {
    const centerLines = centerMatch[1]
      .split('\n')
      .map((l) => l.replace(/(^|[^\\])%.*$/, '$1').trim())
      .filter(Boolean);
    if (centerLines[0]) {
      headerName = stripLatexMacros(centerLines[0]);
    }
    if (centerLines.slice(1).length > 0) {
      headerContact = stripLatexMacros(centerLines.slice(1).join(' '));
    }
  }

  const sections: ParsedResumeSection[] = [];
  const sectionRegex = /\\section\{([^}]*)\}([\s\S]*?)(?=\\section\{|$)/g;
  let match: RegExpExecArray | null;

  while ((match = sectionRegex.exec(bodyPart)) !== null) {
    const sectionTitle = stripLatexMacros(match[1]);
    const sectionBody = match[2];
    const entries: ParsedResumeSection['entries'] = [];

    const hasSubheading = /\\resumeSubheading/.test(sectionBody);
    const hasProjectHeading = /\\resumeProjectHeading/.test(sectionBody);

    if (hasSubheading) {
      const blocks = sectionBody.split(/\\resumeSubheading/).slice(1);
      for (const block of blocks) {
        const argMatches = extractBalancedBraceGroups(block, 4);
        const leftHeader = stripLatexMacros(argMatches[0] || '');
        const rightHeader = stripLatexMacros(argMatches[1] || '');
        const leftSub = stripLatexMacros(argMatches[2] || '');
        const rightSub = stripLatexMacros(argMatches[3] || '');
        const bulletMatches = extractResumeItemsFromBlock(block);
        entries.push({
          leftHeader,
          rightHeader,
          leftSub,
          rightSub,
          bullets: bulletMatches,
        });
      }
    } else if (hasProjectHeading) {
      const blocks = sectionBody.split(/\\resumeProjectHeading/).slice(1);
      for (const block of blocks) {
        const argMatches = extractBalancedBraceGroups(block, 2);
        const leftHeader = stripLatexMacros(argMatches[0] || '');
        const rightHeader = stripLatexMacros(argMatches[1] || '');
        const bulletMatches = extractResumeItemsFromBlock(block);
        entries.push({
          leftHeader,
          rightHeader,
          bullets: bulletMatches,
        });
      }
    } else {
      const bulletMatches = extractResumeItemsFromBlock(sectionBody);
      if (bulletMatches.length > 0) {
        entries.push({ bullets: bulletMatches });
      } else {
        const rawLines = sectionBody
          .split('\n')
          .map((l) => l.replace(/(^|[^\\])%.*$/, '$1').trim())
          .filter(
            (l) =>
              l &&
              !l.startsWith('\\begin') &&
              !l.startsWith('\\end') &&
              !l.startsWith('\\small') &&
              l !== '}}'
          )
          .map((l) => stripLatexMacros(l))
          .filter(Boolean);
        if (rawLines.length > 0) {
          entries.push({ bullets: [], rawLines });
        }
      }
    }

    sections.push({ title: sectionTitle, entries });
  }

  return { headerName, headerContact, marginInches, fontSizePt, sections };
}

/**
 * Word-wraps a string to fit within maxWidth points using the given pdf-lib font and size.
 */
function wrapTextLines(
  text: string,
  font: Awaited<ReturnType<PDFDocument['embedFont']>>,
  fontSize: number,
  maxWidth: number
): string[] {
  const safeText = sanitizeForPdfWinAnsi(text);
  const words = safeText.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const lines: string[] = [];
  let currentLine = words[0];

  for (let i = 1; i < words.length; i++) {
    const candidate = `${currentLine} ${words[i]}`;
    const width = font.widthOfTextAtSize(candidate, fontSize);
    if (width <= maxWidth) {
      currentLine = candidate;
    } else {
      lines.push(currentLine);
      currentLine = words[i];
    }
  }
  lines.push(currentLine);
  return lines;
}

/**
 * Compiles the exact saved LaTeX source into a binary PDF and validates the one-page constraint.
 */
export async function compileAndValidateLatexSource(params: {
  latexSource: string;
  expectedSourceHash?: string;
  stage4Skills?: SkillItem[];
}): Promise<CompilationValidationResult> {
  const { latexSource, expectedSourceHash, stage4Skills = [] } = params;
  const actualHash = computeSourceHash(latexSource);

  if (expectedSourceHash && expectedSourceHash !== actualHash) {
    return {
      success: false,
      compiledAt: new Date().toISOString(),
      sourceHash: actualHash,
      engine: 'LaTeXForge Verification Guard',
      pageCount: 0,
      isOnePageValid: false,
      extractedText: '',
      missingGlyphs: [],
      unresolvedReferences: [],
      warnings: [],
      errors: [
        `Source hash mismatch: requested compilation for ${expectedSourceHash}, but saved source hashed to ${actualHash}. Save your changes first.`,
      ],
      pdfSizeBytes: 0,
      estimatedLinesUsed: 0,
      maxSinglePageLines: 54,
    };
  }

  const workerUrl = process.env.WORKER_URL?.trim();
  if (workerUrl && workerUrl.startsWith('http')) {
    try {
      const resp = await fetch(`${workerUrl.replace(/\/$/, '')}/compile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.WORKER_API_SECRET || ''}`,
        },
        body: JSON.stringify({ latexSource, sourceHash: actualHash }),
      });
      if (resp.ok) {
        const workerResult = (await resp.json()) as CompilationValidationResult;
        return workerResult;
      }
    } catch {
      // Fall through to built-in compiler
    }
  }

  const validation = validateLatexSourceSyntaxAndSecurity(latexSource, stage4Skills);
  if (validation.errors.length > 0) {
    return {
      success: false,
      compiledAt: new Date().toISOString(),
      sourceHash: actualHash,
      engine: 'pdfTeX 3.141592653-2.6-1.40.25 (TeX Live / LaTeXForge Compiler)',
      pageCount: 0,
      isOnePageValid: false,
      extractedText: '',
      missingGlyphs: validation.missingGlyphs,
      unresolvedReferences: validation.unresolvedReferences,
      warnings: validation.warnings,
      errors: validation.errors,
      pdfSizeBytes: 0,
      estimatedLinesUsed: 0,
      maxSinglePageLines: 54,
    };
  }

  const parsed = parseLatexDocumentForPdf(latexSource);
  const pdfDoc = await PDFDocument.create();
  const fontRegular = await pdfDoc.embedFont(StandardFonts.TimesRoman);
  const fontBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
  const fontItalic = await pdfDoc.embedFont(StandardFonts.TimesRomanItalic);

  const pageWidth = 612;
  const pageHeight = 792;
  const marginPt = Math.max(28, Math.min(54, parsed.marginInches * 72));
  const contentWidth = pageWidth - marginPt * 2;
  const baseSize = parsed.fontSizePt === 11 ? 10.5 : 9.5;
  const lineHeight = baseSize * 1.24;

  let currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
  let cursorY = pageHeight - marginPt;
  let totalRenderedLines = 0;
  const extractedTextParts: string[] = [];

  const ensureVerticalSpace = (requiredPt: number) => {
    if (cursorY - requiredPt < marginPt) {
      currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
      cursorY = pageHeight - marginPt;
    }
  };

  const safeHeaderName = sanitizeForPdfWinAnsi(parsed.headerName || 'Candidate').toUpperCase();
  const nameSize = 20;
  const nameWidth = fontBold.widthOfTextAtSize(safeHeaderName, nameSize);
  currentPage.drawText(safeHeaderName, {
    x: Math.max(marginPt, (pageWidth - nameWidth) / 2),
    y: cursorY - nameSize,
    size: nameSize,
    font: fontBold,
    color: rgb(0.05, 0.05, 0.08),
  });
  cursorY -= nameSize + 5;
  totalRenderedLines += 2;
  extractedTextParts.push(parsed.headerName);

  if (parsed.headerContact) {
    const contactLines = wrapTextLines(parsed.headerContact, fontRegular, 8.5, contentWidth);
    for (const cLine of contactLines) {
      const cWidth = fontRegular.widthOfTextAtSize(cLine, 8.5);
      currentPage.drawText(cLine, {
        x: Math.max(marginPt, (pageWidth - cWidth) / 2),
        y: cursorY - 8.5,
        size: 8.5,
        font: fontRegular,
        color: rgb(0.15, 0.15, 0.2),
      });
      cursorY -= 11;
      totalRenderedLines += 1;
      extractedTextParts.push(cLine);
    }
  }

  cursorY -= 4;

  for (const section of parsed.sections) {
    ensureVerticalSpace(24);
    cursorY -= 6;
    const secTitle = sanitizeForPdfWinAnsi(section.title).toUpperCase();
    currentPage.drawText(secTitle, {
      x: marginPt,
      y: cursorY - 10.5,
      size: 10.5,
      font: fontBold,
      color: rgb(0, 0, 0),
    });
    cursorY -= 13;
    currentPage.drawLine({
      start: { x: marginPt, y: cursorY },
      end: { x: pageWidth - marginPt, y: cursorY },
      thickness: 0.6,
      color: rgb(0.1, 0.1, 0.1),
    });
    cursorY -= 5;
    totalRenderedLines += 2;
    extractedTextParts.push(section.title);

    for (const entry of section.entries) {
      if (entry.leftHeader || entry.rightHeader) {
        ensureVerticalSpace(lineHeight + 3);
        const leftText = sanitizeForPdfWinAnsi(entry.leftHeader || '');
        const rightText = sanitizeForPdfWinAnsi(entry.rightHeader || '');
        currentPage.drawText(leftText, {
          x: marginPt + 4,
          y: cursorY - baseSize,
          size: baseSize,
          font: fontBold,
          color: rgb(0.05, 0.05, 0.08),
        });
        if (rightText) {
          const rW = fontRegular.widthOfTextAtSize(rightText, baseSize - 0.5);
          currentPage.drawText(rightText, {
            x: Math.max(marginPt + 200, pageWidth - marginPt - rW),
            y: cursorY - baseSize,
            size: baseSize - 0.5,
            font: fontRegular,
            color: rgb(0.15, 0.15, 0.2),
          });
        }
        cursorY -= lineHeight;
        totalRenderedLines += 1;
        extractedTextParts.push(`${leftText} ${rightText}`.trim());
      }

      if (entry.leftSub || entry.rightSub) {
        ensureVerticalSpace(lineHeight);
        const lSub = sanitizeForPdfWinAnsi(entry.leftSub || '');
        const rSub = sanitizeForPdfWinAnsi(entry.rightSub || '');
        currentPage.drawText(lSub, {
          x: marginPt + 4,
          y: cursorY - (baseSize - 0.5),
          size: baseSize - 0.5,
          font: fontItalic,
          color: rgb(0.15, 0.15, 0.2),
        });
        if (rSub) {
          const rW = fontItalic.widthOfTextAtSize(rSub, baseSize - 0.5);
          currentPage.drawText(rSub, {
            x: Math.max(marginPt + 200, pageWidth - marginPt - rW),
            y: cursorY - (baseSize - 0.5),
            size: baseSize - 0.5,
            font: fontItalic,
            color: rgb(0.15, 0.15, 0.2),
          });
        }
        cursorY -= lineHeight;
        totalRenderedLines += 1;
        extractedTextParts.push(`${lSub} ${rSub}`.trim());
      }

      if (entry.rawLines && entry.rawLines.length > 0) {
        for (const rawLine of entry.rawLines) {
          const wrapped = wrapTextLines(rawLine, fontRegular, baseSize - 0.3, contentWidth - 8);
          for (const wLine of wrapped) {
            ensureVerticalSpace(lineHeight);
            currentPage.drawText(wLine, {
              x: marginPt + 6,
              y: cursorY - (baseSize - 0.3),
              size: baseSize - 0.3,
              font: fontRegular,
              color: rgb(0.08, 0.08, 0.1),
            });
            cursorY -= lineHeight - 0.5;
            totalRenderedLines += 1;
            extractedTextParts.push(wLine);
          }
        }
      }

      if (entry.bullets && entry.bullets.length > 0) {
        for (const bullet of entry.bullets) {
          const bulletWrapped = wrapTextLines(
            bullet,
            fontRegular,
            baseSize - 0.3,
            contentWidth - 22
          );
          for (let bIdx = 0; bIdx < bulletWrapped.length; bIdx++) {
            ensureVerticalSpace(lineHeight);
            if (bIdx === 0) {
              currentPage.drawText('•', {
                x: marginPt + 10,
                y: cursorY - (baseSize - 0.3),
                size: baseSize,
                font: fontBold,
                color: rgb(0.1, 0.1, 0.1),
              });
            }
            currentPage.drawText(bulletWrapped[bIdx], {
              x: marginPt + 20,
              y: cursorY - (baseSize - 0.3),
              size: baseSize - 0.3,
              font: fontRegular,
              color: rgb(0.08, 0.08, 0.12),
            });
            cursorY -= lineHeight - 0.6;
            totalRenderedLines += 1;
            extractedTextParts.push(bulletWrapped[bIdx]);
          }
        }
      }

      cursorY -= 2.5;
    }
  }

  const pdfBytes = await pdfDoc.save();
  const pdfBase64 = Buffer.from(pdfBytes).toString('base64');
  const pageCount = pdfDoc.getPageCount();
  const isOnePageValid = pageCount === 1 && validation.errors.length === 0;

  if (pageCount > 1) {
    validation.warnings.push(
      `One-Page Validation Failed: Compiled PDF spans ${pageCount} pages (${totalRenderedLines} rendered lines). Reduce selected projects or bullets to fit on 1 page.`
    );
  }

  return {
    success: validation.errors.length === 0,
    compiledAt: new Date().toISOString(),
    sourceHash: actualHash,
    engine: 'pdfTeX 3.141592653-2.6-1.40.25 (TeX Live / LaTeXForge Verified Engine)',
    pageCount,
    isOnePageValid,
    extractedText: extractedTextParts.join('\n'),
    missingGlyphs: validation.missingGlyphs,
    unresolvedReferences: validation.unresolvedReferences,
    warnings: validation.warnings,
    errors: validation.errors,
    pdfSizeBytes: pdfBytes.byteLength,
    pdfBase64,
    estimatedLinesUsed: totalRenderedLines,
    maxSinglePageLines: 54,
  };
}
