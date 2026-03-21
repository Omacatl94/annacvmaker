// server/services/doc-parser.js
// Extract text from office documents (DOCX, ODT) without external AI calls.

import { readFileSync } from 'fs';
import { extname } from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

/**
 * Extract text from a DOCX file using mammoth.
 */
async function extractDocx(absPath) {
  const mammoth = await import('mammoth');
  const result = await mammoth.default.extractRawText({ path: absPath });
  return result.value;
}

/**
 * Extract text from an ODT file.
 * ODT is a ZIP archive containing content.xml with the document text.
 */
async function extractOdt(absPath) {
  const { Readable } = await import('stream');
  const { createReadStream } = await import('fs');
  const { createUnzip } = await import('zlib');
  const { pipeline } = await import('stream/promises');

  // ODT is a ZIP — we need to find content.xml inside it
  // Use a simple approach: read the ZIP, find content.xml, strip XML tags
  const AdmZip = (await import('adm-zip')).default;
  const zip = new AdmZip(absPath);
  const contentEntry = zip.getEntry('content.xml');
  if (!contentEntry) {
    throw new Error('Invalid ODT file: content.xml not found');
  }
  const xml = contentEntry.getData().toString('utf8');
  // Strip XML tags, normalize whitespace, preserve paragraph breaks
  return xml
    .replace(/<text:p[^>]*>/g, '\n')
    .replace(/<text:tab[^/]*\/>/g, '\t')
    .replace(/<text:s[^/]*\/>/g, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Check if a file is an office document that should be parsed locally.
 */
export function isOfficeDocument(filePath) {
  const ext = extname(filePath).toLowerCase();
  return ['.docx', '.odt', '.doc'].includes(ext);
}

/**
 * Extract text from an office document.
 * @param {string} absPath - absolute path to the file
 * @returns {string} extracted text
 */
export async function extractDocumentText(absPath) {
  const ext = extname(absPath).toLowerCase();

  switch (ext) {
    case '.docx':
      return extractDocx(absPath);
    case '.odt':
      return extractOdt(absPath);
    case '.doc':
      // Old binary .doc format — mammoth can sometimes handle these too
      try {
        return await extractDocx(absPath);
      } catch {
        throw new Error(
          'Il formato .doc (Word 97-2003) non è supportato. Salva il file come .docx o .pdf e riprova.'
        );
      }
    default:
      throw new Error(`Formato non supportato: ${ext}`);
  }
}
