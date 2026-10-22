/**
 * Logger formatado para o Phone Finder.
 */
export const logger = {
  info: (tag: string, message: string, ...args: unknown[]) => {
    console.log(`[${new Date().toLocaleTimeString()}] [INFO] [${tag}] ${message}`, ...args);
  },
  warn: (tag: string, message: string, ...args: unknown[]) => {
    console.warn(`[${new Date().toLocaleTimeString()}] [WARN] [${tag}] ${message}`, ...args);
  },
  error: (tag: string, message: string, ...args: unknown[]) => {
    console.error(`[${new Date().toLocaleTimeString()}] [ERROR] [${tag}] ${message}`, ...args);
  },
};
