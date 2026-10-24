/**
 * Utility functions for smart file and folder conflict resolution.
 */

/**
 * Normalizes a workspace path:
 * - Trims whitespace
 * - Strips leading and trailing slashes
 * - Collapses consecutive slashes
 * - Prevents directory traversal ('..')
 */
export function normalizeWorkspacePath(rawPath: string): string {
  if (!rawPath) return '';
  const trimmed = rawPath.trim();
  // Reject directory traversal attempts
  if (trimmed.includes('..')) {
    throw new Error('Path cannot contain ".." directory traversal segments.');
  }
  // Replace backslashes with forward slashes and collapse duplicate slashes
  return trimmed
    .replace(/\\/g, '/')
    .replace(/\/+/g, '/')
    .replace(/^\/+/, '')
    .replace(/\/+$/, '');
}

/**
 * Splits a normalized path into parent directory path and base file/folder name.
 */
export function extractParentAndName(fullPath: string): { parentPath: string; fileName: string } {
  const normalized = normalizeWorkspacePath(fullPath);
  const lastSlashIndex = normalized.lastIndexOf('/');
  if (lastSlashIndex === -1) {
    return { parentPath: '', fileName: normalized };
  }
  return {
    parentPath: normalized.substring(0, lastSlashIndex),
    fileName: normalized.substring(lastSlashIndex + 1),
  };
}

/**
 * Generates an alternative non-conflicting filename following conventions:
 * - `main.py` -> `main-1.py`
 * - `utils.ts` -> `utils-1.ts`
 * - `README.md` -> `README-1.md`
 * - `components` -> `components-1`
 * - `main-1.py` -> `main-2.py` (does not generate `main-1-1.py`)
 *
 * @param fileName The original filename or folder name
 * @param existingNames Iterable of names already taken in the same parent directory
 */
export function generateAlternativeName(
  fileName: string,
  existingNames: Iterable<string> | Set<string> | string[]
): string {
  const existingSet = new Set(
    Array.from(existingNames).map((n) => n.trim().toLowerCase())
  );

  let baseName = fileName;
  let extension = '';

  const dotIndex = fileName.lastIndexOf('.');
  // If dot is not at start (hidden file like .gitignore) and exists
  if (dotIndex > 0) {
    baseName = fileName.substring(0, dotIndex);
    extension = fileName.substring(dotIndex); // e.g. '.py'
  }

  // Check if baseName already ends with `-<number>`
  const suffixMatch = baseName.match(/^(.*?)-(\d+)$/);
  let counter = 1;
  let cleanBase = baseName;

  if (suffixMatch) {
    cleanBase = suffixMatch[1];
    counter = parseInt(suffixMatch[2], 10) + 1;
  }

  // Loop until an unused name in the parent directory is found
  while (counter < 1000) {
    const candidate = `${cleanBase}-${counter}${extension}`;
    if (!existingSet.has(candidate.toLowerCase())) {
      return candidate;
    }
    counter++;
  }

  return `${cleanBase}-${Date.now()}${extension}`;
}
