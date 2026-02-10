const fs = require('fs');
const report = JSON.parse(fs.readFileSync('lint_report.json', 'utf8'));

const anyWarnings = [];
report.forEach(file => {
    file.messages.forEach(msg => {
        if (msg.ruleId === '@typescript-eslint/no-explicit-any') {
            anyWarnings.push({
                file: file.filePath,
                line: msg.line,
                message: msg.message
            });
        }
    });
});

const summary = {};
anyWarnings.forEach(w => {
    summary[w.file] = (summary[w.file] || 0) + 1;
});

console.log('Summary of @typescript-eslint/no-explicit-any warnings:');
Object.entries(summary).sort((a, b) => b[1] - a[1]).forEach(([file, count]) => {
    console.log(`${count.toString().padStart(3)} warnings in ${file}`);
});
console.log(`Total: ${anyWarnings.length} warnings.`);
