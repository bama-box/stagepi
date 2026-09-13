/**
 * Utility functions for handling ANSI escape sequences in log outputs.
 */

const ANSI_COLOR_MAP: Record<number, string> = {
  30: '#4b5563', // black / dark grey
  31: '#ef4444', // red
  32: '#10b981', // green
  33: '#f59e0b', // yellow / amber
  34: '#3b82f6', // blue
  35: '#a855f7', // magenta
  36: '#06b6d4', // cyan
  37: '#f3f4f6', // white
  90: '#9ca3af', // bright black / gray
  91: '#f87171', // bright red
  92: '#34d399', // bright green
  93: '#fbbf24', // bright yellow
  94: '#60a5fa', // bright blue
  95: '#c084fc', // bright magenta
  96: '#22d3ee', // bright cyan
  97: '#ffffff', // bright white
};

/**
 * Strips all ANSI escape codes from a string, returning clean plain text.
 */
export function stripAnsi(text: string): string {
  if (!text) return '';
  return text.replace(/\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g, '');
}

/**
 * Converts ANSI color and formatting escape sequences to sanitized HTML spans.
 */
export function ansiToHtml(raw: string): string {
  if (!raw) return '';

  // Escape basic HTML entities to prevent injection
  const escaped = raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Match ANSI SGR codes: \x1B[...m
  const sgrRegex = /\x1B\[([0-9;]*)m/g;
  let result = '';
  let lastIndex = 0;
  let currentColor: string | null = null;
  let isBold = false;
  let openSpan = false;

  let match: RegExpExecArray | null;
  while ((match = sgrRegex.exec(escaped)) !== null) {
    result += escaped.slice(lastIndex, match.index);
    lastIndex = sgrRegex.lastIndex;

    const codeStr = match[1];
    const codes = codeStr ? codeStr.split(';').map(Number) : [0];

    for (const code of codes) {
      if (code === 0) {
        // Reset formatting
        if (openSpan) {
          result += '</span>';
          openSpan = false;
        }
        currentColor = null;
        isBold = false;
      } else if (code === 1) {
        isBold = true;
      } else if (code === 22) {
        // Normal intensity
        isBold = false;
      } else if (code >= 30 && code <= 37) {
        currentColor = ANSI_COLOR_MAP[code];
      } else if (code >= 90 && code <= 97) {
        currentColor = ANSI_COLOR_MAP[code];
      } else if (code === 39) {
        // Default text color
        currentColor = null;
      }
    }

    if (openSpan) {
      result += '</span>';
      openSpan = false;
    }

    if (currentColor || isBold) {
      const styles: string[] = [];
      if (currentColor) styles.push(`color: ${currentColor}`);
      if (isBold) styles.push('font-weight: 600');
      result += `<span style="${styles.join('; ')}">`;
      openSpan = true;
    }
  }

  result += escaped.slice(lastIndex);
  if (openSpan) {
    result += '</span>';
  }

  // Strip any remaining non-SGR ANSI sequences
  return result.replace(/\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g, '');
}
