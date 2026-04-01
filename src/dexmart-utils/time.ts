/**
 * Utility to parse duration strings (e.g., '1h', '2d', '30d') into milliseconds.
 * Similar to 'ms' package functionality but simplified for internal use.
 */
export function parseDuration(duration: string): number {
    const unit = duration.slice(-1);
    const value = parseInt(duration.slice(0, -1), 10);

    if (isNaN(value)) return 0;

    switch (unit) {
        case 's': return value * 1000;
        case 'm': return value * 60 * 1000;
        case 'h': return value * 60 * 60 * 1000;
        case 'd': return value * 24 * 60 * 60 * 1000;
        case 'w': return value * 7 * 24 * 60 * 60 * 1000;
        default: return value; // Fallback to raw value if it's already a number string
    }
}
