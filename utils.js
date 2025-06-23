const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const EXTENSIONS = ['.js', '.ts', '.php', '.go'];
const EXCLUDED_DIRS = ['node_modules', '.git', 'vendor', '.vscode', 'dist', 'build', 'coverage'];

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
	} catch (err) {
		console.warn(`Could not read file: ${filePath}`, err.message);
	}
	return results;
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

function formatDate(dateString, lang = 'id') {
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
		return date.toLocaleDateString(lang === 'en' ? 'en-US' : 'id-ID', options).replace(/\./g, ':');
	} catch {
		return lang === 'en' ? 'Invalid date format' : 'Format tanggal tidak valid';
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
	} catch {}
	return null;
}

function getLastGitChange(filePath, lang = 'id') {
	const locales = require('./locales')[lang] || require('./locales').id;

	try {
		const fileDir = path.dirname(filePath);
		const gitRoot = isGitRepository(fileDir);
		if (!gitRoot) return locales.notGitRepo;

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

				const [author, date] = raw.trim().split('|');
				return `${author.trim()} (${formatDate(date.trim(), lang)})`;
			} catch {}
		}

		try {
			const author = execSync('git config user.name', {
				encoding: 'utf-8',
				cwd: gitRoot,
				timeout: 5000,
			}).trim();

			if (author) return `${author} (info Git umum)`;
		} catch {}

		return locales.noGitCommit;
	} catch (err) {
		if (err.message.includes('not a git repository')) return locales.notGitRepo;
		if (err.message.includes('command not found')) return locales.gitNotInstalled;
		if (err.message.includes('timeout')) return locales.timeout;
		return `${locales.unknownGitError}: ${err.message}`;
	}
}

module.exports = {
	scanFile,
	walkDir,
	formatDate,
	getLastGitChange,
};
