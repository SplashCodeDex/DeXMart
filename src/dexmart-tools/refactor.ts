import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

function walk(dir: string, callback: (filePath: string) => void) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
            walk(filePath, callback);
        } else if (filePath.endsWith('.ts')) {
            callback(filePath);
        }
    }
}

logger.info(`Starting refined refactor in ${rootDir}...`);

walk(rootDir, (filePath) => {
    // IMPORTANT: Skip this script and the dist/refactor.js
    if (filePath.includes('refactor.ts') || filePath.includes('refactor.js')) return;

    let content = fs.readFileSync(filePath, 'utf-8');
    let modified = false;

    // 1. Fix ESM imports: from './module' to './module.js'
    const esmRegex = /from\s+['"](\.\.?\/[^'"]+)(?<!\.js|\.json|\.css|\.png|\.jpg|\.jpeg|\.svg|\.webp|\.mp4|\.mp3|\.wav|\.ogg)['"]/g;

    if (esmRegex.test(content)) {
        content = content.replace(esmRegex, (match, relPath) => {
            const quote = match.slice(-1);
            return `from ${quote}${relPath}.js${quote}`;
        });
        modified = true;
    }

    // 2. Command Refactor: Inject MessageContext type
    if (filePath.includes('src' + path.sep + 'commands')) {
        const handlerRegex = /(code|execute):\s*async\s*(?:\(([^)]*)\)|([^)\s=>]+))\s*=>\s*{/g;
        if (handlerRegex.test(content)) {
            content = content.replace(handlerRegex, (match, prop, argsInParens, argNoParens) => {
                const args = argsInParens || argNoParens || 'ctx';
                if (!args.includes(':')) {
                    return `${prop}: async (ctx: MessageContext) => {`;
                }
                return match;
            });
            modified = true;

            if (!content.includes('import { MessageContext }')) {
                const depth = filePath.replace(rootDir, '').split(path.sep).length - 2;
                const prefix = depth > 0 ? '../'.repeat(depth) : './';
                content = `import { MessageContext } from '${prefix}types/index.js';\n` + content;
            }
        }
    }

    // 3. Service Renames: bot services -> channelService
    if (content.includes('multiBotService') || content.includes('multiTenantBotService')) {
        content = content.replace(/multiBotService|multiTenantBotService/g, 'channelService');
        modified = true;
    }

    // 4. Catch Block Typing: catch (error) -> catch (error: any)
    const catchRegex = /catch\s*\((error|err)\)\s*{/g;
    if (catchRegex.test(content)) {
        content = content.replace(catchRegex, 'catch ($1: any) {');
        modified = true;
    }

    if (modified) {
        fs.writeFileSync(filePath, content);
        logger.info(`✅ Refactored: ${filePath.replace(rootDir, '')}`);
    }
});

logger.info('Refactor complete.');