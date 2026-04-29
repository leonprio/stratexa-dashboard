const { execSync } = require('child_process');
const fs = require('fs');
try {
    const output = execSync('npx eslint App.tsx --quiet', { encoding: 'utf8' });
    fs.writeFileSync('app_errors.txt', output);
} catch (e) {
    fs.writeFileSync('app_errors.txt', e.stdout);
}
