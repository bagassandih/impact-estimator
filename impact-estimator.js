const { t } = require('./locales');
const path = require('path');
const fs = require('fs');
const { scanFile, walkDir, getLastGitChange } = require('./utils');

function estimateImpact(targetFile, targetFunction = null, projectDir = process.cwd(), lang = 'id') {
	if (!targetFile) throw new Error(t('fileNotFound', lang) + `: ${targetFile}`);
	if (!fs.existsSync(targetFile)) throw new Error(t('fileNotFound', lang) + `: ${targetFile}`);
	if (!fs.existsSync(projectDir)) throw new Error(t('projectNotFound', lang) + `: ${projectDir}`);

	const TARGET_FILENAME = path.basename(targetFile);
	const FUNCTION_NAME = targetFunction || null;

	const allMatches = new Map();
	let scannedFiles = 0;

	walkDir(projectDir, (filePath) => {
		scannedFiles++;
		if (path.resolve(filePath) === path.resolve(targetFile)) return;

		const fileMatches = scanFile(filePath, [TARGET_FILENAME]);
		const funcMatches = FUNCTION_NAME ? scanFile(filePath, [FUNCTION_NAME]) : [];

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
	});

	let output = `## ${t('impactTitle', lang)}\n`;
	output += `\n✅ **${t('file', lang)}:** \`${path.relative(projectDir, targetFile)}\``;

	const lastChange = getLastGitChange(targetFile, lang);
	if (lastChange.includes('(')) {
		const [author, waktu] = lastChange.split('(');
		output += `\n🕵️ **${t('lastChangedBy', lang)}:** ${author.trim()}`;
		output += `\n🕒 ${t('lastChangedTime', lang)}: ${waktu.trim().replace(/\)$/, '')}`;
	} else {
		output += `\n🕵️ **${t('lastChangedBy', lang)}:** ${lastChange}`;
	}

	output += `\n📊 **${t('scannedFiles', lang)}:** ${scannedFiles} file\n`;

	if (allMatches.size > 0) {
		output += `\n### 🔍 ${t('usageDetail', lang)} (${allMatches.size} file):`;
		for (const [file, matches] of allMatches.entries()) {
			const rel = path.relative(projectDir, file);
			output += `\n- [${rel}](./${rel})`;
			matches.forEach(({ line, content }) => {
				output += `\n   ↳ Line ${line}: \`${content}\``;
			});
		}
	} else {
		output += `\n### 🔍 ${t('notFound', lang)}`;
	}

	if (FUNCTION_NAME) {
		const totalFiles = new Set(
			[...allMatches.entries()]
				.filter(([_, matches]) =>
					matches.some((m) => m.keyword === FUNCTION_NAME)
				)
				.map(([file]) => file)
		);

		output += `\n\n### 🧠 ${t('note', lang)}:`;
		output += `\n${t('functionFound', lang, FUNCTION_NAME, totalFiles.size)}`;

		if (totalFiles.size === 0) {
			output += `\n\n${t('warning', lang, FUNCTION_NAME)}`;
		}
	}

	const riskLevel = allMatches.size;
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
