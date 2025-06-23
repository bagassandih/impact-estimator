// impact-estimator.js
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const EXTENSIONS = ['.js', '.ts', '.php', '.go'];
const EXCLUDED_DIRS = ['node_modules', '.git', 'vendor', '.vscode', 'dist', 'build', 'coverage'];

function scanFile(filePath, keywordList) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return keywordList.some((keyword) => content.includes(keyword));
  } catch (err) {
    console.warn(`Could not read file: ${filePath}`, err.message);
    return false;
  }
}

function walkDir(dir, callback) {
  if (!fs.existsSync(dir)) return;
  
  let stat;
  try {
    stat = fs.statSync(dir);
  } catch (err) {
    console.warn(`Could not stat directory: ${dir}`, err.message);
    return;
  }
  
  if (!stat.isDirectory()) return;

  let files;
  try {
    files = fs.readdirSync(dir);
  } catch (err) {
    console.warn(`Could not read directory: ${dir}`, err.message);
    return;
  }

  for (const file of files) {
    const fullPath = path.join(dir, file);
    try {
      const fileStat = fs.statSync(fullPath);
      if (fileStat.isDirectory()) {
        if (!EXCLUDED_DIRS.includes(file) && !file.startsWith('.')) {
          walkDir(fullPath, callback);
        }
      } else {
        if (EXTENSIONS.includes(path.extname(fullPath))) {
          callback(fullPath);
        }
      }
    } catch (err) {
      console.warn(`Could not access: ${fullPath}`, err.message);
    }
  }
}

function formatIndoDate(dateString) {
  try {
    const options = { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit', 
      timeZone: 'Asia/Jakarta' 
    };
    const date = new Date(dateString);
    return date.toLocaleDateString('id-ID', options).replace(/\./g, ':');
  } catch (err) {
    return 'Format tanggal tidak valid';
  }
}

function isGitRepository(dir) {
  try {
    // Check if we're in a git repository by looking for .git directory
    let currentDir = dir;
    while (currentDir !== path.dirname(currentDir)) {
      if (fs.existsSync(path.join(currentDir, '.git'))) {
        return currentDir;
      }
      currentDir = path.dirname(currentDir);
    }
    return null;
  } catch (err) {
    return null;
  }
}

function getLastGitChange(filePath) {
  try {
    // Get the directory of the file
    const fileDir = path.dirname(filePath);
    const gitRoot = isGitRepository(fileDir);
    
    if (!gitRoot) {
      return 'Bukan repository Git';
    }
    
    console.log(`Checking git info for file: ${filePath}`);
    console.log(`Git root found at: ${gitRoot}`);
    
    // Try multiple git commands to get the information
    const commands = [
      `git log -1 --pretty=format:"%an|%ad" --date=iso-strict -- "${filePath}"`,
      `git log -1 --pretty=format:"%an|%ad" --date=iso -- "${filePath}"`,
      `git log -1 --pretty=format:"%an|%ci" -- "${filePath}"`
    ];
    
    for (const cmd of commands) {
      try {
        console.log(`Trying command: ${cmd}`);
        const raw = execSync(cmd, { 
          encoding: 'utf-8',
          timeout: 10000, // 10 second timeout
          cwd: gitRoot, // Execute from git root
          stdio: ['ignore', 'pipe', 'pipe'] // Ignore stdin, capture stdout and stderr
        });
        
        console.log(`Git command result: ${raw}`);
        
        if (!raw.trim()) {
          console.log('No git history found for this file');
          continue;
        }
        
        const parts = raw.trim().split('|');
        if (parts.length >= 2) {
          const [author, date] = parts;
          console.log(`Found author: ${author}, date: ${date}`);
          return `${author.trim()} (${formatIndoDate(date.trim())})`;
        }
      } catch (cmdErr) {
        console.warn(`Command failed: ${cmd}`, cmdErr.message);
        continue;
      }
    }
    
    // If no specific file history, try to get general git info
    try {
      const authorCmd = `git config user.name`;
      const author = execSync(authorCmd, { 
        encoding: 'utf-8', 
        cwd: gitRoot,
        timeout: 5000 
      }).trim();
      
      if (author) {
        return `${author} (info Git umum)`;
      }
    } catch (generalErr) {
      console.warn('Could not get general git info:', generalErr.message);
    }
    
    return 'Belum ada commit untuk file ini';
    
  } catch (err) {
    console.error('Git error:', err.message);
    
    if (err.message.includes('not a git repository')) {
      return 'Bukan repository Git';
    }
    if (err.message.includes('git not found') || err.message.includes('command not found')) {
      return 'Git tidak terinstall';
    }
    if (err.message.includes('timeout')) {
      return 'Git command timeout';
    }
    
    return `Tidak dapat mengambil info Git: ${err.message}`;
  }
}

function estimateImpact(targetFile, targetFunction = null, projectDir = process.cwd()) {
  // Validate inputs
  if (!targetFile) {
    throw new Error('Target file is required');
  }
  
  if (!fs.existsSync(targetFile)) {
    throw new Error(`Target file does not exist: ${targetFile}`);
  }
  
  if (!fs.existsSync(projectDir)) {
    throw new Error(`Project directory does not exist: ${projectDir}`);
  }

  const TARGET_FILENAME = path.basename(targetFile);
  const FUNCTION_NAME = targetFunction || null;

  const directUsages = [];
  const functionUsages = [];
  let scannedFiles = 0;

  console.log(`Scanning project directory: ${projectDir}`);
  console.log(`Looking for usages of file: ${TARGET_FILENAME}`);
  if (FUNCTION_NAME) {
    console.log(`Looking for usages of function: ${FUNCTION_NAME}`);
  }

  walkDir(projectDir, (filePath) => {
    scannedFiles++;
    
    // Skip the target file itself
    if (path.resolve(filePath) === path.resolve(targetFile)) {
      return;
    }
    
    try {
      if (scanFile(filePath, [TARGET_FILENAME])) {
        directUsages.push(filePath);
      }
      
      if (FUNCTION_NAME && scanFile(filePath, [FUNCTION_NAME])) {
        functionUsages.push(filePath);
      }
    } catch (err) {
      console.warn(`Error scanning file ${filePath}:`, err.message);
    }
  });

  console.log(`Scanned ${scannedFiles} files`);
  console.log(`Found ${directUsages.length} direct usages`);
  console.log(`Found ${functionUsages.length} function usages`);

  let output = `## 📦 Impact Estimation\n`;
  output += `\n✅ **File:** \`${path.relative(projectDir, targetFile)}\``;
  
  const lastChange = getLastGitChange(targetFile);
  output += `\n🕵️ **Terakhir diubah oleh:** ${lastChange}`;
  output += `\n📊 **File yang dipindai:** ${scannedFiles} file\n`;

  if (directUsages.length > 0) {
    output += `\n### 🔁 Dipakai langsung oleh (${directUsages.length} file):`;
    directUsages.forEach((f) => {
      const rel = path.relative(projectDir, f);
      output += `\n- [${rel}](./${rel})`;
    });
  } else {
    output += `\n### 🔁 Dipakai langsung oleh:\n- *Tidak ada file yang menggunakan file ini secara langsung*`;
  }

  const indirectUsages = functionUsages.filter((f) => !directUsages.includes(f));
  if (indirectUsages.length > 0) {
    output += `\n\n### 📎 Terhubung tidak langsung (${indirectUsages.length} file):`;
    indirectUsages.forEach((f) => {
      const rel = path.relative(projectDir, f);
      const traceSource = directUsages.find(source => {
        try {
          const content = fs.readFileSync(source, 'utf-8');
          return content.includes(path.basename(f));
        } catch (err) {
          return false;
        }
      });
      const via = traceSource ? ` (via ${path.basename(traceSource)})` : '';
      output += `\n- [${rel}](./${rel})${via}`;
    });
  }

  if (FUNCTION_NAME) {
    const totalUsages = [...new Set([...directUsages, ...functionUsages])];
    output += `\n\n### 🧠 Catatan:`;
    output += `\nFungsi \`${FUNCTION_NAME}()\` ditemukan di **${totalUsages.length}** tempat`;
    
    if (totalUsages.length === 0) {
      output += `\n\n⚠️ **Peringatan:** Fungsi \`${FUNCTION_NAME}\` tidak ditemukan di file manapun. Mungkin:`;
      output += `\n- Nama fungsi salah atau tidak persis sama`;
      output += `\n- Fungsi hanya digunakan secara internal`;
      output += `\n- Fungsi belum digunakan di proyek ini`;
    }
  }

  const riskLevel = directUsages.length + indirectUsages.length;
  if (riskLevel === 0) {
    output += `\n\n### ✅ Tingkat Risiko: **RENDAH**`;
    output += `\nFile ini sepertinya aman untuk diubah karena tidak ada dependensi yang terdeteksi.`;
  } else if (riskLevel <= 3) {
    output += `\n\n### ⚠️ Tingkat Risiko: **SEDANG**`;
    output += `\nAda ${riskLevel} file yang terpengaruh. Pastikan untuk menguji perubahan dengan baik.`;
  } else {
    output += `\n\n### 🚨 Tingkat Risiko: **TINGGI**`;
    output += `\nAda ${riskLevel} file yang terpengaruh. Sangat disarankan untuk melakukan testing menyeluruh!`;
  }

  return output;
}

// CLI Support
if (require.main === module) {
  const targetFile = process.argv[2];
  const targetFunction = process.argv[3];

  if (!targetFile) {
    console.error('Usage: node impact-estimator.js <path-to-target-file> [functionName]');
    process.exit(1);
  }

  try {
    const result = estimateImpact(targetFile, targetFunction);
    console.log(result);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

module.exports = { estimateImpact };