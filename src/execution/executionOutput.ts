/**
 * Formats and processes execution outputs for Python (Pyodide) and JavaScript (QuickJS).
 * Part of Person 3's Code Execution Module.
 */

export interface FormattedExecutionResult {
  output: string;
  error?: string;
  status: 'success' | 'error' | 'timeout' | 'aborted';
  executionTime: number; // in milliseconds
  timestamp: Date;
  truncated: boolean;
}

const MAX_OUTPUT_LENGTH = 100_000; // 100KB output limit to prevent browser freeze

/**
 * Clean up and sanitize execution output string
 */
export function sanitizeOutput(text: string): { content: string; truncated: boolean } {
  if (!text) {
    return { content: '', truncated: false };
  }

  // Normalize line endings
  let cleaned = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  let truncated = false;
  if (cleaned.length > MAX_OUTPUT_LENGTH) {
    cleaned = cleaned.slice(0, MAX_OUTPUT_LENGTH) + '\n\n[... Output truncated: exceeded 100KB limit ...]';
    truncated = true;
  }

  return { content: cleaned, truncated };
}

/**
 * Format raw stdout and stderr into a structured execution report
 */
export function formatExecutionResult(params: {
  stdout: string;
  stderr?: string;
  executionTime: number;
  timeoutOccurred?: boolean;
}): FormattedExecutionResult {
  const { stdout, stderr, executionTime, timeoutOccurred } = params;

  const sanitizedStdout = sanitizeOutput(stdout);
  const sanitizedStderr = stderr ? sanitizeOutput(stderr) : null;

  let status: FormattedExecutionResult['status'] = 'success';
  if (timeoutOccurred) {
    status = 'timeout';
  } else if (sanitizedStderr && sanitizedStderr.content.trim().length > 0) {
    status = 'error';
  }

  return {
    output: sanitizedStdout.content,
    error: sanitizedStderr?.content || undefined,
    status,
    executionTime: Math.max(0, executionTime),
    timestamp: new Date(),
    truncated: sanitizedStdout.truncated || Boolean(sanitizedStderr?.truncated),
  };
}

/**
 * Extract clean error message and line number from Python / JS tracebacks
 */
export function parseErrorMessage(error: string): { summary: string; line?: number } {
  if (!error) return { summary: 'Unknown execution error' };

  // Python Traceback line regex: File "<exec>", line 4, in ...
  const pyLineMatch = error.match(/line (\d+)/i);
  const line = pyLineMatch ? parseInt(pyLineMatch[1], 10) : undefined;

  // Last line of Python traceback is typically the exception type and message: e.g. "ZeroDivisionError: division by zero"
  const lines = error.trim().split('\n');
  const lastLine = lines[lines.length - 1];

  return {
    summary: lastLine || error,
    line,
  };
}
