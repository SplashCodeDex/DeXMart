import type { WASocket, proto } from 'baileys';
import type { ConfigService } from '../services/ConfigService.js';
import type { ChannelConfig } from './tenantConfig.js';

export interface Config {
    channel: {
        name: string;
        prefix: string;
        phoneNumber?: string;
        sessionId: string;
        tenantId: string;
        owners: string[];
        id?: string;
        groupJid?: string;
        groupLink?: string;
        readyAt?: Date;
        uptime?: string;
        dbSize?: string;
    };
    msg: {
        name: string;
        footer: string;
        notFound: string;
        readmore: string;
        wait: string;
        error: string;
        success: string;
        admin: string;
        channelAdmin: string;
        owner: string;
        group: string;
        private: string;
        channel: string;
        premium: string;
        nsfw: string;
        channelGroupMembership?: string;
        groupSewa?: string;
        unavailableAtNight?: string;
        coin?: string;
        restrict?: string;
        banned?: string;
        gamerestrict?: string;
        privatePremiumOnly?: string;
        groupPremiumOnly?: string;
        urlInvalid?: string;
    };
    system: {
        port: number;
        env: string;
        debug: boolean;
    };
}

export interface ActiveChannel extends Partial<WASocket> {
    user: {
        id: string;
        name?: string;
    };
    phoneNumber?: string;
    tenantId: string;
    channelId: string;
    config: import('./tenantConfig.js').ChannelConfig;
    context: GlobalContext;
    ev: NonNullable<WASocket['ev']>;

    sendMessage: (jid: string, content: any, options?: any) => Promise<any>;
    decodeJid: (jid: string) => string;
    cmd: Map<string, Command>;


    // Middleware
    use: (middleware: Middleware) => void;
    executeMiddleware: (ctx: MessageContext, next: () => Promise<void>) => Promise<void>;
    getSocket: () => any;
}

export type Middleware = (ctx: MessageContext, next: () => Promise<void>) => any;

declare module 'baileys' {
    export interface proto {
        IWebMessageInfo: proto.IWebMessageInfo & {
            contentType?: string;
            media?: any;
            body?: string;
            content?: string;
        }
    }
}

export interface GroupFunctions {
    isAdmin: (userJid?: string) => Promise<boolean>;
    matchAdmin: (userJid: string) => Promise<boolean>;
    members: () => Promise<string[]>;
    isActiveChannelAdmin: () => Promise<boolean>;
    isChannelAdmin: () => Promise<boolean>;
    metadata: () => Promise<any>;
    owner: () => Promise<string | null>;
    name: () => Promise<string>;
    open: () => Promise<any>;
    close: () => Promise<any>;
    lock: () => Promise<any>;
    unlock: () => Promise<any>;
    add: (jids: string[]) => Promise<any>;
    kick: (jids: string[]) => Promise<any>;
    promote: (jids: string[]) => Promise<any>;
    demote: (jids: string[]) => Promise<any>;
    inviteCode: () => Promise<string>;
    pendingMembers: () => Promise<any[]>;
    approvePendingMembers: (jids: string[]) => Promise<any>;
    rejectPendingMembers: (jids: string[]) => Promise<any>;
    updateDescription: (desc: string) => Promise<any>;
    updateSubject: (subject: string) => Promise<any>;
    joinApproval: (mode: 'on' | 'off') => Promise<any>;
    membersCanAddMemberMode: (mode: any) => Promise<any>;
    isOwner: (userJid?: string) => Promise<boolean>;
}

export interface MessageContext {
    reply: (content: any, options?: any) => Promise<any>;
    replyReact: (emoji: string) => Promise<any>;
    editMessage?: (key: any, text: string) => Promise<any>;

    isGroup: () => boolean;
    sender: {
        jid: string;
        name: string;
        pushName?: string | null;
        isOwner: boolean;
        isAdmin: boolean;
    };
    author?: {
        id: string;
    };
    pushName?: string | null;
    id: string; // Group ID or Chat ID
    chat?: {
        id: string;
    };
    msg: (proto.IWebMessageInfo & {
        key: proto.IMessageKey;
        message?: proto.IMessage | null;
    }) | (import('./omnichannel.js').CommonMessage & {
        key?: proto.IMessageKey;
        message?: proto.IMessage | null;
    });
    
    // Platform-Agnostic Safe Accessors
    getContentType: () => string;
    getBody: () => string;
    getMedia: () => any;
    getPlatform: () => import('./omnichannel.js').Platform;
    getSenderJid: () => string;
    getQuoted: () => any;
    isFromMe: () => boolean;
    quoted?: {
        content: string;
        contentType: string;
        senderJid: string;
        media: any;
        key: any;
        msg?: any;
    };
    message?: any;
    body: string;
    args: string[];
    command: string;
    prefix: string;
    commandDef?: Command;
    channel: ActiveChannel;
    getId: (jid: string) => string;
    getMentioned?: () => Promise<string[]>;
    simulateTyping: (text?: string | number) => Promise<void>;
    sendPresenceUpdate: (presence: 'composing' | 'recording' | 'paused' | 'unavailable', jid?: string) => Promise<void>;
    used: {
        command: string;
        prefix: string;
        args: string[];
        text: string;
    };
    cooldown: any;
    core?: any;
    bot?: any;
    botNumber?: string;

    // Tenant & Permissions
    tenant: import('./tenantConfig.js').TenantSettings;
    isOwner: boolean;
    isAdmin: boolean;

    // Group Functions
    group: (jid?: string) => GroupFunctions;

    // Misc
    download: () => Promise<Buffer>;
    replied?: boolean;
    responseSent?: boolean;
    aiContext?: any;
    intelligentMode?: boolean;
    processingTimestamp?: number;
    workerVersion?: string;
    usage?: any;
    sendMessage: (jid: string, content: any, options?: any) => Promise<any>;
}

export interface CommandPermissions {
    admin?: boolean;
    isActiveChannelAdmin?: boolean;
    owner?: boolean;
    group?: boolean;
    private?: boolean;
    premium?: boolean;
    coin?: number;
}

export interface Command {
    name: string;
    aliases?: string[];
    category: string;
    description?: string;
    usage?: string;
    cooldown?: number;
    permissions?: CommandPermissions;
    code?: (ctx: MessageContext) => Promise<void> | void;
    execute?: (ctx: MessageContext) => Promise<void> | void;
    run?: (ctx: MessageContext) => Promise<void> | void;
    // System props
    filePath?: string;
    loadedAt?: number;
    isEnabled?: boolean;
}


export interface Logger {
    error: (message: unknown, meta?: unknown) => void;
    warn: (message: unknown, meta?: unknown) => void;
    info: (message: unknown, meta?: unknown) => void;
    debug: (message: unknown, meta?: unknown) => void;
    trace: (message: unknown, meta?: unknown) => void;
    http: (message: unknown, meta?: unknown) => void;
    security: (message: string, userId?: string | null, details?: unknown) => void;
    performance: (operation: string, duration: number, metadata?: unknown) => void;
    command: (command: string, userId: string, success?: boolean, executionTime?: number | null, error?: unknown) => void;
    userActivity: (userId: string, action: string, details?: unknown) => void;
    groupActivity: (groupId: string, action: string, userId: string, details?: unknown) => void;
    apiRequest: (method: string, url: string, statusCode: number, responseTime: number, userId?: string | null) => void;
    withContext: (context: Record<string, unknown>) => Logger;
    child: (meta?: unknown) => Logger;
    [key: string]: any;
}

export interface GlobalContext {
    database: import('../services/database.js').DatabaseService;
    databaseService: import('../services/database.js').DatabaseService;
    config: ConfigService;
    tools: typeof import('../tools/exports.js').default;
    formatter: typeof import('../utils/formatters.js');
    logger: Logger;
    commandSystem: import('../services/commandSystem.js').CommandSystem;
    unifiedAI: import('../services/geminiAI.js').GeminiAI;
    groupService: import('../services/groupService.js').GroupService;
    channelService: import('../services/ChannelService.js').ChannelService;
    agentService: import('../services/AgentService.js').AgentService;
    ingressService: import('../services/IngressService.js').IngressService;
    userService: import('../services/userService.js').UserService;
    tenantConfigService: import('../services/tenantConfigService.js').TenantConfigService;
    channel?: ActiveChannel;
    state?: any;
    [key: string]: any;
}


export * from './firestore.js';
export * from './contracts.js';
export type { Result } from './contracts.js';
