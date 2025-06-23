// impact-estimator.js

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const targetFile = process.argv[2];
const targetFunction = process.argv[3]; // optional

if (!targetFile) {
  console.error('Usage: node impact-estimator.js <path-to-target-file> [functionName]');
  process.exit(1);
}

const PROJECT_DIR = process.cwd();
const TARGET_FILENAME = path.basename(targetFile);
const FUNCTION_NAME = targetFunction || null;

const EXTENSIONS = ['.js', '.ts', '.php', '.go'];
const EXCLUDED_DIRS = ['node_modules', '.git', 'vendor'];

function scanFile(filePath, keywordList) {
  const content = fs.readFileSync(filePath, 'utf-8');
  return keywordList.some((keyword) => content.includes(keyword));
}

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach((file) => {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      if (!EXCLUDED_DIRS.includes(file)) {
        walkDir(fullPath, callback);
      }
    } else {
      if (EXTENSIONS.includes(path.extname(fullPath))) {
        callback(fullPath);
      }
    }
  });
}

function formatIndoDate(dateString) {
  const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' };
  const date = new Date(dateString);
  return date.toLocaleDateString('id-ID', options);
}

function getLastGitChange(filePath) {
  try {
    const raw = execSync(`git log -1 --pretty=format:"%an|%ad" --date=iso-strict -- ${filePath}`, { encoding: 'utf-8' });
    const [author, date] = raw.split('|');
    return `${author} (${formatIndoDate(date)})`;
  } catch (err) {
    return 'Unknown';
  }
}

const directUsages = [];
const functionUsages = [];

walkDir(PROJECT_DIR, (filePath) => {
  if (scanFile(filePath, [TARGET_FILENAME])) {
    directUsages.push(filePath);
  } else if (FUNCTION_NAME && scanFile(filePath, [FUNCTION_NAME])) {
    functionUsages.push(filePath);
  }
});

console.log(`✅ File: ${targetFile}`);
const lastChange = getLastGitChange(targetFile);
console.log(`🕵️ Terakhir diubah oleh: ${lastChange}\n`);

if (directUsages.length > 0) {
  console.log(`🔁 Dipakai langsung oleh:`);
  directUsages.forEach((f) => {
    console.log(` - ${path.relative(PROJECT_DIR, f)}`);
  });
}

if (functionUsages.length > 0) {
  const indirectUsages = functionUsages.filter((f) => !directUsages.includes(f));
  if (indirectUsages.length > 0) {
    console.log(`📎 Terhubung tidak langsung:`);
    indirectUsages.forEach((f) => {
      // Cari trace siapa memanggil siapa secara sederhana
      const traceSource = directUsages.find(source => {
        const content = fs.readFileSync(source, 'utf-8');
        return content.includes(path.basename(f));
      });
      const via = traceSource ? ` (via ${path.basename(traceSource)})` : '';
      console.log(` - ${path.relative(PROJECT_DIR, f)}${via}`);
    });
  }
}

if (FUNCTION_NAME) {
  const totalUsages = [...new Set([...directUsages, ...functionUsages])];
  console.log(`\n🧠 Catatan: fungsi \`${FUNCTION_NAME}()\` diubah → dipakai di ${totalUsages.length} tempat`);
}
