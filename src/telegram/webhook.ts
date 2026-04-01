import { createServer } from "node:http";
import { webhookCallback } from "grammy";
import type { OpenClawConfig } from "../config/config.js";
import { isDiagnosticsEnabled } from "../infra/diagnostic-events.js";
import { formatErrorMessage } from "../infra/errors.js";
import { readJsonBodyWithLimit } from "../infra/http-body.js";
import {
  logWebhookError,
  logWebhookProcessed,
  logWebhookReceived,
  startDiagnosticHeartbeat,
  stopDiagnosticHeartbeat,
} from "../logging/diagnostic.js";
import type { RuntimeEnv } from "../runtime.js";
import { defaultRuntime } from "../runtime.js";
import { resolveTelegramAllowedUpdates } from "./allowed-updates.js";
import { withTelegramApiErrorLogging } from "./api-logging.js";
import { createTelegramBot } from "./bot.js";

const TELEGRAM_WEBHOOK_MAX_BODY_BYTES = 1024 * 1024;
const TELEGRAM_WEBHOOK_BODY_TIMEOUT_MS = 30_000;
const TELEGRAM_WEBHOOK_CALLBACK_TIMEOUT_MS = 10_000;

async function listenHttpServer(params: {
  server: ReturnType<typeof createServer>;
  port: number;
  host: string;
}) {
  await new Promise<void>((resolve, reject) => {
    const onError = (err: Error) => {
      params.server.off("error", onError);
      reject(err);
    };
    params.server.once("error", onError);
    params.server.listen(params.port, params.host, () => {
      params.server.off("error", onError);
      resolve();
    });
  });
}

function resolveWebhookPublicUrl(params: {
  configuredPublicUrl?: string;
  server: ReturnType<typeof createServer>;
  path: string;
  host: string;
  port: number;
}) {
  if (params.configuredPublicUrl) {
    return params.configuredPublicUrl;
  }
  const address = params.server.address();
  if (address && typeof address !== "string") {
    const resolvedHost =
      params.host === "0.0.0.0" || address.address === "0.0.0.0" || address.address === "::"
        ? "localhost"
        : address.address;
    return `http://${resolvedHost}:${address.port}${params.path}`;
  }
  const fallbackHost = params.host === "0.0.0.0" ? "localhost" : params.host;
  return `http://${fallbackHost}:${params.port}${params.path}`;
}

async function initializeTelegramWebhookBot(params: {
  bot: ReturnType<typeof createTelegramBot>;
  runtime: RuntimeEnv;
  abortSignal?: AbortSignal;
}) {
  const initSignal = params.abortSignal as Parameters<(typeof params.bot)["init"]>[0];
  await withTelegramApiErrorLogging({
    operation: "getMe",
    runtime: params.runtime,
    fn: () => params.bot.init(initSignal),
  });
}

export async function startTelegramWebhook(opts: {
  token: string;
  accountId?: string;
  config?: OpenClawConfig;
  path?: string;
  port?: number;
  host?: string;
  secret?: string;
  runtime?: RuntimeEnv;
  fetch?: typeof fetch;
  abortSignal?: AbortSignal;
  healthPath?: string;
  publicUrl?: string;
}) {
  const path = opts.path ?? "/telegram-webhook";
  const healthPath = opts.healthPath ?? "/healthz";
  const port = opts.port ?? 8787;
  const host = opts.host ?? "127.0.0.1";
  const secret = typeof opts.secret === "string" ? opts.secret.trim() : "";
  if (!secret) {
    throw new Error(
      "Telegram webhook mode requires a non-empty secret token. " +
        "Set channels.telegram.webhookSecret in your config.",
    );
  }
  const runtime = opts.runtime ?? defaultRuntime;
  const diagnosticsEnabled = isDiagnosticsEnabled(opts.config);
  const bot = createTelegramBot({
    token: opts.token,
    runtime,
    proxyFetch: opts.fetch,
    config: opts.config,
    accountId: opts.accountId,
  });

  // OC-26206: Register handler and setup server first.
  const handler = webhookCallback(bot, "callback", {
    secretToken: secret,
    onTimeout: "return",
    timeoutMilliseconds: TELEGRAM_WEBHOOK_CALLBACK_TIMEOUT_MS,
  });

  if (diagnosticsEnabled) {
    startDiagnosticHeartbeat(opts.config);
  }

  const server = createServer((req, res) => {
    // ... (rest of server logic)
  });

  await listenHttpServer({
    server,
    port,
    host,
  });

  // Initialize bot AFTER the local server is listening to handle potential updates immediately.
  await initializeTelegramWebhookBot({
    bot,
    runtime,
    abortSignal: opts.abortSignal,
  });

  const boundAddress = server.address();
  const boundPort = boundAddress && typeof boundAddress !== "string" ? boundAddress.port : port;

  const publicUrl = resolveWebhookPublicUrl({
    configuredPublicUrl: opts.publicUrl,
    server,
    path,
    host,
    port,
  });

  try {
    await withTelegramApiErrorLogging({
      operation: "setWebhook",
      runtime,
      fn: () =>
        bot.api.setWebhook(publicUrl, {
          secret_token: secret,
          allowed_updates: resolveTelegramAllowedUpdates(),
        }),
    });
  } catch (err) {
    server.close();
    void bot.stop();
    if (diagnosticsEnabled) {
      stopDiagnosticHeartbeat();
    }
    throw err;
  }

  runtime.log?.(`webhook local listener on http://${host}:${boundPort}${path}`);
  runtime.log?.(`webhook advertised to telegram on ${publicUrl}`);

  let shutDown = false;
  const shutdown = () => {
    if (shutDown) {
      return;
    }
    shutDown = true;
    void withTelegramApiErrorLogging({
      operation: "deleteWebhook",
      runtime,
      fn: () => bot.api.deleteWebhook({ drop_pending_updates: false }),
    }).catch(() => {
      // withTelegramApiErrorLogging has already emitted the failure.
    });
    server.close();
    void bot.stop();
    if (diagnosticsEnabled) {
      stopDiagnosticHeartbeat();
    }
  };
  if (opts.abortSignal) {
    opts.abortSignal.addEventListener("abort", shutdown, { once: true });
  }

  return { server, bot, stop: shutdown };
}
