import fs from 'fs';
import path from 'path';

function walk(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const full = path.join(dir, file);
        if (fs.statSync(full).isDirectory()) walk(full);
        else if (full.endsWith('.ts') || full.endsWith('.js')) {
            let content = fs.readFileSync(full, 'utf8');
            let modified = false;

            // Fix .ts extension imports
            if (/(from|import)\s+['"][^'"]+\.ts['"]/g.test(content)) {
                content = content.replace(/(from|import)\s+(['"][^'"]+)\.ts(['"])/g, '$1 $2.js$3');
                modified = true;
            }
            
            if (modified) {
                fs.writeFileSync(full, content);
                console.log('Processed', full);
            }
        }
    }
}
walk('src');
