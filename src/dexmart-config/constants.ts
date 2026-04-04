export const SERVER_CONFIG = {
    PORT: process.env.PORT || 3000,
    ENV: process.env.NODE_ENV || 'development',
    RATE_LIMIT_WINDOW_MS: 15 * 60 * 1000, // 15 minutes
    RATE_LIMIT_MAX: 100,
    LOG_LEVEL: process.env.LOG_LEVEL || 'info',
    LOG_DIR: 'logs'
};
