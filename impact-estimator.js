const { t } = require('./locales');
const path = require('path');
const fs = require('fs');
const { scanFile, walkDir, getLastGitChange } = require('./utils');

// Fungsi untuk mendeteksi konteks method call
function detectMethodContext(content, functionName) {
    const lines = content.split('\n');
    const matches = [];
    
    lines.forEach((line, index) => {
        const lineNumber = index + 1;
        const trimmedLine = line.trim();
        
        // Pattern untuk mendeteksi method call dengan konteks objek
        // Contoh: $employeeRepo->getEmployee(), employeeService.getEmployee(), etc.
        const methodCallPatterns = [
            new RegExp(`\\$\\w+->\\s*${functionName}\\s*\\(`, 'g'), // PHP: $object->method()
            new RegExp(`\\w+\\.\\s*${functionName}\\s*\\(`, 'g'),    // JS: object.method()
            new RegExp(`\\w+::\\s*${functionName}\\s*\\(`, 'g'),     // PHP: Class::method()
            new RegExp(`\\w+\\s*->\\s*${functionName}\\s*\\(`, 'g'), // PHP: $this->method()
        ];
        
        methodCallPatterns.forEach(pattern => {
            const methodMatches = trimmedLine.match(pattern);
            if (methodMatches) {
                methodMatches.forEach(match => {
                    matches.push({
                        line: lineNumber,
                        content: trimmedLine,
                        keyword: functionName,
                        context: match.replace(`${functionName}(`, '').trim(), // Ekstrak konteks objek
                        matchType: 'method_call'
                    });
                });
            }
        });
        
        // Pattern untuk standalone function call (tanpa objek)
        const standaloneFunctionPattern = new RegExp(`(?<!\\w|\\$|->|\\.|::)${functionName}\\s*\\(`, 'g');
        const standaloneMatches = trimmedLine.match(standaloneFunctionPattern);
        if (standaloneMatches) {
            standaloneMatches.forEach(match => {
                matches.push({
                    line: lineNumber,
                    content: trimmedLine,
                    keyword: functionName,
                    context: 'standalone',
                    matchType: 'function_call'
                });
            });
        }
    });
    
    return matches;
}

// Fungsi untuk mendeteksi deklarasi class/repository
function detectClassContext(content, fileName) {
    const lines = content.split('\n');
    const contexts = [];
    
    lines.forEach((line, index) => {
        const trimmedLine = line.trim();
        
        // Pattern untuk mendeteksi class declaration
        const classPatterns = [
            /class\s+(\w+)/i,           // PHP/Java: class ClassName
            /interface\s+(\w+)/i,       // Interface
            /trait\s+(\w+)/i,          // PHP trait
            /const\s+(\w+)\s*=/i,      // Constant
        ];
        
        classPatterns.forEach(pattern => {
            const match = trimmedLine.match(pattern);
            if (match) {
                contexts.push({
                    type: 'class',
                    name: match[1],
                    line: index + 1,
                    file: fileName
                });
            }
        });
    });
    
    return contexts;
}

// Fungsi utama yang diperbaiki
function estimateImpact(targetFile, targetFunction = null, projectDir = process.cwd(), lang = 'id') {
    if (!targetFile) throw new Error(t('fileNotFound', lang) + `: ${targetFile}`);
    if (!fs.existsSync(targetFile)) throw new Error(t('fileNotFound', lang) + `: ${targetFile}`);
    if (!fs.existsSync(projectDir)) throw new Error(t('projectNotFound', lang) + `: ${projectDir}`);

    const TARGET_FILENAME = path.basename(targetFile);
    const FUNCTION_NAME = targetFunction || null;
    const allMatches = new Map();
    const contextualMatches = new Map();
    let scannedFiles = 0;

    // Deteksi konteks dari file target
    let targetContext = null;
    if (FUNCTION_NAME && fs.existsSync(targetFile)) {
        const targetContent = fs.readFileSync(targetFile, 'utf8');
        const targetClasses = detectClassContext(targetContent, TARGET_FILENAME);
        if (targetClasses.length > 0) {
            targetContext = targetClasses[0].name; // Ambil class pertama sebagai konteks
        }
    }

    walkDir(projectDir, (filePath) => {
        scannedFiles++;
        if (path.resolve(filePath) === path.resolve(targetFile)) return;

        try {
            const content = fs.readFileSync(filePath, 'utf8');
            
            // Scan untuk nama file
            const fileMatches = scanFile(filePath, [TARGET_FILENAME]);
            
            // Scan untuk function dengan konteks yang lebih akurat
            let funcMatches = [];
            if (FUNCTION_NAME) {
                funcMatches = detectMethodContext(content, FUNCTION_NAME);
                
                // Filter berdasarkan konteks jika ada
                if (targetContext) {
                    const contextualFuncMatches = funcMatches.filter(match => {
                        // Cek apakah context match dengan target context
                        return match.context && match.context.toLowerCase().includes(targetContext.toLowerCase());
                    });
                    
                    // Simpan matches dengan konteks
                    if (contextualFuncMatches.length > 0) {
                        contextualMatches.set(filePath, contextualFuncMatches);
                    }
                }
            }

            const all = [...fileMatches, ...funcMatches];
            if (all.length > 0) {
                if (!allMatches.has(filePath)) {
                    allMatches.set(filePath, []);
                }
                const existing = allMatches.get(filePath);
                const existingLines = new Set(existing.map((m) => m.line));
                all.forEach((m) => {
                    if (!existingLines.has(m.line)) {
                        existing.push(m);
                    }
                });
            }
        } catch (error) {
            // Skip file yang tidak bisa dibaca
            console.warn(`Warning: Could not read file ${filePath}`);
        }
    });

    let output = `## ${t('impactTitle', lang)}\n`;
    output += `\n✅ **${t('file', lang)}:** \`${path.relative(projectDir, targetFile)}\``;
    
    if (targetContext) {
        output += `\n🏷️ **Detected Context:** \`${targetContext}\``;
    }

    const lastChange = getLastGitChange(targetFile, lang);
    if (lastChange.includes('(')) {
        const [author, waktu] = lastChange.split('(');
        output += `\n🕵️ **${t('lastChangedBy', lang)}:** ${author.trim()}`;
        output += `\n🕒 ${t('lastChangedTime', lang)}: ${waktu.trim().replace(/\)$/, '')}`;
    } else {
        output += `\n🕵️ **${t('lastChangedBy', lang)}:** ${lastChange}`;
    }

    output += `\n📊 **${t('scannedFiles', lang)}:** ${scannedFiles} file\n`;

    // Tampilkan hasil dengan konteks
    if (contextualMatches.size > 0) {
        output += `\n### 🎯 ${t('contextualMatches', lang) || 'Contextual Matches'} (${contextualMatches.size} file):`;
        for (const [file, matches] of contextualMatches.entries()) {
            const rel = path.relative(projectDir, file);
            output += `\n- [${rel}](./${rel}) **(High Confidence)**`;
            matches.forEach(({ line, content, context, matchType }) => {
                output += `\n  ↳ Line ${line} [${matchType}]: \`${content}\``;
                if (context !== 'standalone') {
                    output += `\n    └── Context: \`${context}\``;
                }
            });
        }
    }

    if (allMatches.size > 0) {
        output += `\n### 🔍 ${t('allMatches', lang) || 'All Matches'} (${allMatches.size} file):`;
        for (const [file, matches] of allMatches.entries()) {
            const rel = path.relative(projectDir, file);
            const isContextual = contextualMatches.has(file);
            output += `\n- [${rel}](./${rel})${isContextual ? ' **(Contextual)**' : ''}`;
            matches.forEach(({ line, content, context, matchType }) => {
                output += `\n  ↳ Line ${line}${matchType ? ` [${matchType}]` : ''}: \`${content}\``;
                if (context && context !== 'standalone') {
                    output += `\n    └── Context: \`${context}\``;
                }
            });
        }
    } else {
        output += `\n### 🔍 ${t('notFound', lang)}`;
    }

    if (FUNCTION_NAME) {
        const totalFiles = contextualMatches.size > 0 ? contextualMatches.size : 
                          new Set([...allMatches.entries()]
                              .filter(([_, matches]) =>
                                  matches.some((m) => m.keyword === FUNCTION_NAME)
                              )
                              .map(([file]) => file)).size;

        output += `\n\n### 🧠 ${t('note', lang)}:`;
        output += `\n${t('functionFound', lang, FUNCTION_NAME, totalFiles)}`;
        
        if (contextualMatches.size > 0) {
            output += `\n✅ Found ${contextualMatches.size} high-confidence contextual matches`;
        }
        
        if (totalFiles === 0) {
            output += `\n\n${t('warning', lang, FUNCTION_NAME)}`;
        }
    }

    // Risk assessment berdasarkan contextual matches
    const riskLevel = contextualMatches.size > 0 ? contextualMatches.size : allMatches.size;
    if (riskLevel === 0) {
        output += `\n\n### ${t('riskLevelLow', lang)}`;
        output += `\n${t('riskLowMessage', lang)}`;
    } else if (riskLevel <= 3) {
        output += `\n\n### ${t('riskLevelMedium', lang)}`;
        output += `\n${t('riskMediumMessage', lang, riskLevel)}`;
    } else {
        output += `\n\n### ${t('riskLevelHigh', lang)}`;
        output += `\n${t('riskHighMessage', lang, riskLevel)}`;
    }

    return output;
}

// CLI Support
if (require.main === module) {
    const targetFile = process.argv[2];
    const targetFunction = process.argv[3];
    const lang = process.argv[4] || 'id';

    if (!targetFile) {
        console.error('Usage: node impact-estimator.js <path-to-target-file> [functionName] [lang]');
        process.exit(1);
    }

    try {
        const result = estimateImpact(targetFile, targetFunction, process.cwd(), lang);
        console.log(result);
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

module.exports = { estimateImpact };