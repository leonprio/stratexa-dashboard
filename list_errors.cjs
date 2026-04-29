const { execSync } = require('child_process');
try {
    const output = execSync('npx eslint App.tsx --quiet', { encoding: 'utf8' });
    console.log(output);
} catch (e) {
    console.log(e.stdout);
}
