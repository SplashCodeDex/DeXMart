/**
 * Centralized Logger for Frontend
 *
 * Provides a standardized way to log messages with different levels.
 * Automatically forwards 'error' level logs to the backend for centralized monitoring.
 */

type LogLevel = "info" | "warn" | "error" | "debug";

class Logger {
  private isDevelopment = process.env.NODE_ENV === "development";

  info(message: string, ...args: unknown[]): void {
    this.log("info", message, ...args);
  }

  warn(message: string, ...args: unknown[]): void {
    this.log("warn", message, ...args);
  }

  error(message: string, ...args: unknown[]): void {
    this.log("error", message, ...args);
    this.sendToBackend("error", message, ...args);
  }

  debug(message: string, ...args: unknown[]): void {
    if (this.isDevelopment) {
      this.log("debug", message, ...args);
    }
  }

  private log(level: LogLevel, message: string, ...args: unknown[]): void {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}]`;

    switch (level) {
      case "info":
        console.warn(prefix, message, ...args);
        break;
      case "warn":
        console.warn(prefix, message, ...args);
        break;
      case "error":
        console.error(prefix, message, ...args);
        break;
      case "debug":
        console.warn(prefix, message, ...args);
        break;
    }
  }

  private async sendToBackend(level: LogLevel, message: string, ...args: unknown[]): Promise<void> {
    // Prevent sending in development unless explicitly configured to test it
    if (this.isDevelopment && process.env.NEXT_PUBLIC_TEST_LOGGER !== "true") {
      return;
    }

    try {
      // Safely stringify args, handling Error objects specifically
      const parsedArgs = args.map((arg) => {
        if (arg instanceof Error) {
          return { message: arg.message, stack: arg.stack, name: arg.name };
        }
        return arg;
      });

      await fetch("/api/logs/client", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          level,
          message,
          context: parsedArgs,
          url: typeof window !== "undefined" ? window.location.href : "server-side",
          userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "server-side",
        }),
        // Keep-alive allows the fetch to complete even if the user navigates away
        keepalive: true,
      });
    } catch (e) {
      // Fire and forget; if it fails to log, silently fail to not disrupt UX
      console.error("Failed to send error log to backend:", e);
    }
  }
}

export const logger = new Logger();
