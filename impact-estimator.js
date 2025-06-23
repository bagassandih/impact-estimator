const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const EXTENSIONS = ['.js', '.ts', '.php', '.go'];
const EXCLUDED_DIRS = [
	'node_modules',
	'.git',
	'vendor',
	'.vscode',
	'dist',
	'build',
	'coverage',
];

function scanFile(filePath, keywordList) {
	const results = [];
	try {
		const lines = fs.readFileSync(filePath, 'utf-8').split('\n');
		lines.forEach((line, index) => {
			keywordList.forEach((keyword) => {
				if (line.includes(keyword)) {
					results.push({ line: index + 1, content: line.trim(), keyword });
				}
			});
		});
		return results;
	} catch (err) {
		console.warn(`Could not read file: ${filePath}`, err.message);
		return [];
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
			timeZone: 'Asia/Jakarta',
		};
		const date = new Date(dateString);
		return date.toLocaleDateString('id-ID', options).replace(/\./g, ':');
	} catch (err) {
		return 'Format tanggal tidak valid';
	}
}

function isGitRepository(dir) {
	try {
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
		const fileDir = path.dirname(filePath);
		const gitRoot = isGitRepository(fileDir);

		if (!gitRoot) return 'Bukan repository Git';

		const commands = [
			`git log -1 --pretty=format:"%an|%ad" --date=iso-strict -- "${filePath}"`,
			`git log -1 --pretty=format:"%an|%ad" --date=iso -- "${filePath}"`,
			`git log -1 --pretty=format:"%an|%ci" -- "${filePath}"`,
		];

		for (const cmd of commands) {
			try {
				const raw = execSync(cmd, {
					encoding: 'utf-8',
					timeout: 10000,
					cwd: gitRoot,
					stdio: ['ignore', 'pipe', 'pipe'],
				});

				if (!raw.trim()) continue;

				const parts = raw.trim().split('|');
				if (parts.length >= 2) {
					const [author, date] = parts;
					return `${author.trim()} (${formatIndoDate(date.trim())})`;
				}
			} catch (cmdErr) {
				continue;
			}
		}

		try {
			const author = execSync('git config user.name', {
				encoding: 'utf-8',
				cwd: gitRoot,
				timeout: 5000,
			}).trim();

			if (author) return `${author} (info Git umum)`;
		} catch {}

		return 'Belum ada commit untuk file ini';
	} catch (err) {
		if (err.message.includes('not a git repository'))
			return 'Bukan repository Git';
		if (err.message.includes('command not found'))
			return 'Git tidak terinstall';
		if (err.message.includes('timeout')) return 'Git command timeout';
		return `Tidak dapat mengambil info Git: ${err.message}`;
	}
}

function estimateImpact(
	targetFile,
	targetFunction = null,
	projectDir = process.cwd()
) {
	if (!targetFile) throw new Error('Target file is required');
	if (!fs.existsSync(targetFile))
		throw new Error(`File tidak ditemukan: ${targetFile}`);
	if (!fs.existsSync(projectDir))
		throw new Error(`Direktori proyek tidak ditemukan: ${projectDir}`);

	const TARGET_FILENAME = path.basename(targetFile);
	const FUNCTION_NAME = targetFunction || null;

	const allMatches = new Map();
	let scannedFiles = 0;

	walkDir(projectDir, (filePath) => {
		scannedFiles++;
		if (path.resolve(filePath) === path.resolve(targetFile)) return;

		const fileMatches = scanFile(filePath, [TARGET_FILENAME]);
		const funcMatches = FUNCTION_NAME
			? scanFile(filePath, [FUNCTION_NAME])
			: [];

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

	let output = `## 📦 Impact Estimation\n`;
	output += `\n✅ **File:** \`${path.relative(projectDir, targetFile)}\``;

	const lastChange = getLastGitChange(targetFile);
	if (lastChange.includes('(')) {
		const [author, waktu] = lastChange.split('(');
		output += `\n🕵️ **Terakhir diubah oleh:** ${author.trim()}`;
		output += `\n🕒 ${waktu.trim().replace(/\)$/, '')}`;
	} else {
		output += `\n🕵️ **Terakhir diubah oleh:** ${lastChange}`;
	}
	output += `\n📊 **File yang dipindai:** ${scannedFiles} file\n`;

	if (allMatches.size > 0) {
		output += `\n### 🔍 Detail Penggunaan (${allMatches.size} file):`;
		for (const [file, matches] of allMatches.entries()) {
			const rel = path.relative(projectDir, file);
			output += `\n- [${rel}](./${rel})`;
			matches.forEach(({ line, content }) => {
				output += `\n   ↳ Line ${line}: \`${content}\``;
			});
		}
	} else {
		output += `\n### 🔍 Tidak ditemukan pemanggilan`;
	}

	if (FUNCTION_NAME) {
		const totalFiles = new Set(
			[...allMatches.entries()]
				.filter(([_, matches]) =>
					matches.some((m) => m.keyword === FUNCTION_NAME)
				)
				.map(([file]) => file)
		);

		output += `\n\n### 🧠 Catatan:`;
		output += `\nFungsi \`${FUNCTION_NAME}()\` ditemukan di **${totalFiles.size}** file`;

		if (totalFiles.size === 0) {
			output += `\n\n⚠️ **Peringatan:** Fungsi \`${FUNCTION_NAME}\` tidak ditemukan. Kemungkinan:`;
			output += `\n- Nama fungsi tidak persis sama`;
			output += `\n- Fungsi hanya digunakan secara internal`;
			output += `\n- Fungsi belum dipakai di proyek ini`;
		}
	}

	const riskLevel = allMatches.size;
	if (riskLevel === 0) {
		output += `\n\n### ✅ Tingkat Risiko: **RENDAH**`;
		output += `\nFile ini sepertinya aman untuk diubah karena tidak ada dependensi yang terdeteksi.`;
	} else if (riskLevel <= 3) {
		output += `\n\n### ⚠️ Tingkat Risiko: **SEDANG**`;
		output += `\nAda ${riskLevel} file yang terpengaruh. Pastikan untuk menguji perubahan dengan baik.`;
	} else {
		output += `\n\n### 🚨 Tingkat Risiko: **TINGGI**`;
		output += `\nAda ${riskLevel} file yang terpengaruh. Lakukan testing menyeluruh!`;
	}

	return output;
}

// CLI Support
if (require.main === module) {
	const targetFile = process.argv[2];
	const targetFunction = process.argv[3];

	if (!targetFile) {
		console.error(
			'Usage: node impact-estimator.js <path-to-target-file> [functionName]'
		);
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
