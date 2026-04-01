/**
 * OpenClaw Import Utility — Direct Source Resolution
 *
 * Imports OpenClaw modules directly from their TypeScript source files
 * via relative paths. This avoids:
 *   1. The barrel index.ts (which has unwanted side effects + pulls CJS transitive deps)
 *   2. The need to build openclaw/dist/ for development
 *   3. tsx's exports map resolution issues with the "types" condition
 *
 * This follows the same proven pattern used by openClawGateway.ts,
 * which successfully imports 15+ OpenClaw source modules this way.
 */

import logger from './logger.js';

// ── Resolve base path ────────────────────────────────────────────
// backend/src/utils/ → ../../../openclaw/src/
const OC_SRC = '../../../openclaw/src';

// ── Module Cache ─────────────────────────────────────────────────
const _cache: Record<string, any> = {};

async function loadSource(subpath: string): Promise<any> {
  if (_cache[subpath]) return _cache[subpath];
  const importPath = `${OC_SRC}/${subpath}`;
  try {
    const mod = await import(/* @vite-ignore */ importPath);
    _cache[subpath] = mod;
    return mod;
  } catch (e) {
    logger.error(`[openclawImports] Failed to load openclaw source module: ${subpath}`, e);
    throw e;
  }
}

// ── Public API ───────────────────────────────────────────────────

export async function getTelegramSend() {
  return await loadSource('telegram/send.js');
}

export async function getSignalSend() {
  return await loadSource('signal/send.js');
}

export async function getSlackSend() {
  return await loadSource('slack/send.js');
}

export async function getIMessageSend() {
  return await loadSource('imessage/send.js');
}

export async function getDiscordSend() {
  return await loadSource('discord/send.js');
}

export async function getWorkspaceSkills() {
  return await loadSource('agents/skills/workspace.js');
}

export async function getWebOutbound() {
  return await loadSource('web/outbound.js');
}

export async function getWebActiveListener() {
  return await loadSource('web/active-listener.js');
}

export async function getFacebookWebhook() {
  return await loadSource('facebook/webhook.js');
}

// ── Granular imports (replaces getOpenClawRoot barrel) ───────────
// These replace the old getOpenClawRoot() which loaded ALL of index.ts
// (with unwanted side effects). Each function is now imported from
// its actual source module directly.

export async function getCreateOpenClawTools() {
  const mod = await loadSource('agents/openclaw-tools.js');
  return mod.createOpenClawTools;
}

export async function getStartGatewayServer() {
  const mod = await loadSource('gateway/server.js');
  return mod.startGatewayServer;
}

export async function getHandleWhatsAppAction() {
  const mod = await loadSource('agents/tools/whatsapp-actions.js');
  return mod.handleWhatsAppAction;
}

export async function getHandleTelegramAction() {
  const mod = await loadSource('agents/tools/telegram-actions.js');
  return mod.handleTelegramAction;
}
