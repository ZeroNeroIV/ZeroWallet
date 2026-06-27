// Typed logging utility — single replacement for scattered console.log/console.error
// Supports level-based filtering: use .info/.warn/.error for semantic clarity
// In production, lower verbosity levels can be suppressed

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const currentLevel: LogLevel = __DEV__ ? 'debug' : 'warn';

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

function shouldLog(level: LogLevel): boolean {
  return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[currentLevel];
}

function formatMessage(prefix: string, message: string, data?: unknown): string {
  const ts = new Date().toISOString().split('T')[1]?.slice(0, 8) ?? '';
  const dataStr = data !== undefined ? ` ${JSON.stringify(data)}` : '';
  return `${ts} ${prefix} ${message}${dataStr}`;
}

export const logger = {
  debug(prefix: string, message: string, data?: unknown): void {
    if (shouldLog('debug')) {
      console.debug(formatMessage(prefix, message, data));
    }
  },

  info(prefix: string, message: string, data?: unknown): void {
    if (shouldLog('info')) {
      console.log(formatMessage(prefix, message, data));
    }
  },

  warn(prefix: string, message: string, data?: unknown): void {
    if (shouldLog('warn')) {
      console.warn(formatMessage(prefix, message, data));
    }
  },

  error(prefix: string, message: string, error?: unknown): void {
    if (shouldLog('error')) {
      console.error(formatMessage(prefix, message, error));
      if (error instanceof Error && error.stack) {
        console.error(`${prefix} Stack:`, error.stack);
      }
    }
  },
};
