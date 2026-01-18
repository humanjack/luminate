/**
 * Debug logging utility for workflow, store, and API operations.
 * Only enabled in development mode.
 */

const isDev = process.env.NODE_ENV === "development";

type LogLevel = "log" | "info" | "warn" | "error";
type LogPrefix = "workflow" | "store" | "api" | "llm" | "navigation";

// Color codes for different prefixes (terminal/browser console)
const prefixColors: Record<LogPrefix, string> = {
  workflow: "#22c55e", // green
  store: "#3b82f6", // blue
  api: "#f59e0b", // amber
  llm: "#a855f7", // purple
  navigation: "#06b6d4", // cyan
};

const prefixEmoji: Record<LogPrefix, string> = {
  workflow: "[WORKFLOW]",
  store: "[STORE]",
  api: "[API]",
  llm: "[LLM]",
  navigation: "[NAV]",
};

function createLogger(level: LogLevel) {
  return (prefix: LogPrefix, message: string, ...args: unknown[]) => {
    if (!isDev) return;

    const color = prefixColors[prefix];
    const emoji = prefixEmoji[prefix];
    const timestamp = new Date().toISOString().split("T")[1].split(".")[0];

    // Check if we're in browser or Node
    if (typeof window !== "undefined") {
      // Browser - use styled console
      console[level](
        `%c${emoji} %c${timestamp} %c${message}`,
        `color: ${color}; font-weight: bold;`,
        `color: gray;`,
        `color: inherit;`,
        ...args
      );
    } else {
      // Node.js - simple output
      console[level](`${emoji} ${timestamp} ${message}`, ...args);
    }
  };
}

export const debug = {
  log: createLogger("log"),
  info: createLogger("info"),
  warn: createLogger("warn"),
  error: createLogger("error"),

  /** Log workflow step transitions */
  step: (from: number | string, to: number | string, action: string) => {
    debug.log("workflow", `Step transition: ${from} -> ${to} (${action})`);
  },

  /** Log store operations */
  storeAction: (storeName: string, action: string, data?: unknown) => {
    debug.log("store", `${storeName}.${action}`, data !== undefined ? data : "");
  },

  /** Log API calls */
  apiCall: (method: string, endpoint: string, status?: number) => {
    if (status !== undefined) {
      debug.log("api", `${method} ${endpoint} -> ${status}`);
    } else {
      debug.log("api", `${method} ${endpoint}`);
    }
  },

  /** Log LLM operations */
  llmEvent: (event: "start" | "streaming" | "complete" | "error", details?: string) => {
    debug.log("llm", `LLM ${event}${details ? `: ${details}` : ""}`);
  },

  /** Log navigation events */
  nav: (action: string, path?: string) => {
    debug.log("navigation", `${action}${path ? ` -> ${path}` : ""}`);
  },

  /** Group related logs */
  group: (label: string, fn: () => void) => {
    if (!isDev) return fn();
    console.group(label);
    try {
      fn();
    } finally {
      console.groupEnd();
    }
  },

  /** Async group for async operations */
  groupAsync: async (label: string, fn: () => Promise<void>) => {
    if (!isDev) return fn();
    console.group(label);
    try {
      await fn();
    } finally {
      console.groupEnd();
    }
  },
};
