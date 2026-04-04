import * as formatter from '../utils/formatters.js';

export const generateInstruction = (modes: string[], types: string[] | string): string => {
    const modeStr = modes.map(m => formatter.ucwords(m)).join('/');
    const typeStr = Array.isArray(types) ? types.map(t => formatter.ucwords(t)).join('/') : formatter.ucwords(types);
    return `${modeStr} ${typeStr}`;
};

export const generateCmdExample = (used: { prefix: string | string[]; command: string }, args: string): string => {
    const prefix = Array.isArray(used.prefix) ? used.prefix[0] : used.prefix;
    return `${prefix}${used.command} ${args}`;
};

export const generateNotes = (notes: string[]): string => {
    return notes.map(n => `Note: ${n}`).join('\n');
};

export const generatesFlagInfo = (flags: Record<string, string>): string => {
    return Object.entries(flags).map(([k, v]) => `--${k}: ${v}`).join('\n');
};

export const formatSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export const formatSizePerSecond = (bytes: number): string => {
    return `${formatSize(bytes)}/s`;
};

export const { ucwords, convertMsToDuration } = formatter;

export default {
    generateInstruction,
    generateCmdExample,
    generateNotes,
    generatesFlagInfo,
    formatSize,
    formatSizePerSecond,
    ucwords,
    convertMsToDuration
};
