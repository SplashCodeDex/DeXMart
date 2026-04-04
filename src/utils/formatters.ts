/**
 * DeXMart Formatters Utility
 */

export const quote = (text: string): string => `> ${text}`;

export const bold = (text: string): string => `*${text}*`;

export const italic = (text: string): string => `_${text}_`;

export const monospace = (text: string): string => '```' + `\n${text}\n` + '```';

export const inlineCode = (text: string): string => '`' + text + '`';

/**
 * Convert milliseconds to human-readable duration
 */
export function convertMsToDuration(ms: number, units: string[] = []): string {
    if (!ms || ms <= 0) return '0 hari';

    const timeUnits: Record<string, number> = {
        tahun: 31557600000,
        bulan: 2629800000,
        minggu: 604800000,
        hari: 86400000,
        jam: 3600000,
        menit: 60000,
        detik: 1000,
        milidetik: 1,
    };

    let remainingMs = ms;

    if (units.length > 0) {
        const result: string[] = [];
        for (const unit of units) {
            if (timeUnits[unit]) {
                const value = Math.floor(remainingMs / timeUnits[unit]);
                if (value > 0) result.push(`${value} ${unit}`);
                remainingMs %= timeUnits[unit];
            }
        }
        return result.join(' ') || `0 ${units[0]}`;
    }

    const result: string[] = [];
    for (const [unit, duration] of Object.entries(timeUnits)) {
        const value = Math.floor(remainingMs / duration);
        if (value > 0) {
            result.push(`${value} ${unit}`);
            remainingMs %= duration;
        }
    }
    return result.join(' ') || '0 detik';
}

/**
 * Convert text to title case
 */
export function ucwords(text: string | null | undefined): string {
    if (!text) return '';
    return text.toLowerCase().replace(/\b\w/g, t => t.toUpperCase());
}

export default {
    quote,
    bold,
    italic,
    monospace,
    inlineCode,
    convertMsToDuration,
    ucwords,
};
