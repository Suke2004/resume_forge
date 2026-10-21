import express from 'express';
import { execFile } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);
const app = express();
app.use(express.json({ limit: '5mb' }));

const WORKER_API_SECRET = process.env.WORKER_API_SECRET || '';

/**
 * Dedicated Dockerized TeX Live Worker Endpoint
 * Compiles exact saved LaTeX source in an isolated temporary directory with -no-shell-escape,
 * inspects page count via `pdfinfo`, extracts reading-order text via `pdftotext`,
 * and enforces the strict 1-page resume invariant.
 */
app.post('/compile', async (req, res) => {
  const authHeader = req.headers.authorization || '';
  if (WORKER_API_SECRET && authHeader !== `Bearer ${WORKER_API_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized worker request' });
  }

  const { latexSource, sourceHash } = req.body;
  if (!latexSource || typeof latexSource !== 'string') {
    return res.status(400).json({ error: 'latexSource string is required' });
  }

  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'latexforge-job-'));
  const texFile = path.join(tmpDir, 'resume.tex');
  const pdfFile = path.join(tmpDir, 'resume.pdf');

  try {
    await fs.writeFile(texFile, latexSource, 'utf-8');

    // Run pdflatex with strict security flags: -no-shell-escape, -halt-on-error
    const { stdout: compileLog } = await execFileAsync(
      'pdflatex',
      [
        '-interaction=nonstopmode',
        '-halt-on-error',
        '-no-shell-escape',
        `-output-directory=${tmpDir}`,
        texFile,
      ],
      { timeout: 15000, env: { ...process.env, openout_any: 'p', openin_any: 'p' } }
    );

    // Inspect PDF metadata using pdfinfo
    const { stdout: pdfInfoOut } = await execFileAsync('pdfinfo', [pdfFile], { timeout: 5000 });
    const pageMatch = pdfInfoOut.match(/Pages:\s+(\d+)/);
    const pageCount = pageMatch ? parseInt(pageMatch[1], 10) : 0;

    // Extract text using pdftotext
    const { stdout: extractedText } = await execFileAsync('pdftotext', [pdfFile, '-'], {
      timeout: 5000,
    });

    const pdfBytes = await fs.readFile(pdfFile);
    const unresolvedReferences = /LaTeX Warning: Reference .* undefined/.test(compileLog)
      ? ['Undefined reference detected in compilation log']
      : [];
    const missingGlyphs = /Missing character: There is no/.test(compileLog)
      ? ['Missing glyph warning in font output']
      : [];

    return res.json({
      success: true,
      compiledAt: new Date().toISOString(),
      sourceHash,
      engine: 'pdfTeX (Docker TeX Live Sandbox)',
      pageCount,
      isOnePageValid: pageCount === 1 && unresolvedReferences.length === 0,
      extractedText,
      missingGlyphs,
      unresolvedReferences,
      warnings: pageCount > 1 ? [`Compiled PDF has ${pageCount} pages (must be 1 page).`] : [],
      errors: [],
      pdfSizeBytes: pdfBytes.byteLength,
      pdfBase64: pdfBytes.toString('base64'),
      estimatedLinesUsed: extractedText.split('\n').filter(Boolean).length,
      maxSinglePageLines: 54,
    });
  } catch (err: any) {
    return res.json({
      success: false,
      compiledAt: new Date().toISOString(),
      sourceHash,
      engine: 'pdfTeX (Docker TeX Live Sandbox)',
      pageCount: 0,
      isOnePageValid: false,
      extractedText: '',
      missingGlyphs: [],
      unresolvedReferences: [],
      warnings: [],
      errors: [err?.stderr || err?.stdout || err?.message || 'pdflatex compilation failed'],
      pdfSizeBytes: 0,
      estimatedLinesUsed: 0,
      maxSinglePageLines: 54,
    });
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`LaTeXForge Docker compilation worker listening on :${PORT}`);
});
