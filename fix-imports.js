import fs from 'fs';
import path from 'path';

function walk(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const full = path.join(dir, file);
        if (fs.statSync(full).isDirectory()) walk(full);
        else if (full.endsWith('.ts') || full.endsWith('.js')) {
            let content = fs.readFileSync(full, 'utf8');
            if (content.includes('test/helpers/temp-home.js')) {
                content = content.replace(/test\/helpers\/temp-home\.js/g, 'test-utils/temp-home.js');
                fs.writeFileSync(full, content);
                console.log('Fixed helper path in', full);
            }
        }
    }
}
walk('src');
