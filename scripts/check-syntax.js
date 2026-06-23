const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function collectJavaScript(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    return entry.isDirectory() ? collectJavaScript(fullPath) : (entry.name.endsWith('.js') ? [fullPath] : []);
  });
}

const files = [
  ...collectJavaScript(path.join(process.cwd(), 'src')),
  ...collectJavaScript(path.join(process.cwd(), 'scripts')),
];
for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], { stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status || 1);
}
console.log(`Syntax check passed for ${files.length} JavaScript files.`);
