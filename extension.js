const vscode = require('vscode');
const path = require('path');
const { estimateImpact } = require('./impact-estimator');
const locales = require('./locales');

const CONFIG_KEY = 'impactEstimator.language';

function getUserLanguage() {
	const config = vscode.workspace.getConfiguration();
	const langSetting = config.get('impactEstimator.language', 'auto');

	if (langSetting === 'auto') {
		return vscode.env.language.startsWith('en') ? 'en' : 'id';
	}
	return langSetting;
}

async function setLanguageCommand() {
	const options = [
		{ label: '🇮🇩 Bahasa Indonesia', value: 'id' },
		{ label: '🇬🇧 English', value: 'en' },
		{ label: '🌐 Otomatis (Ikuti VSCode)', value: 'auto' }
	];

	const selected = await vscode.window.showQuickPick(options, {
		placeHolder: 'Pilih bahasa tampilan Impact Estimator'
	});
	if (!selected) return;

	await vscode.workspace.getConfiguration().update(CONFIG_KEY, selected.value, vscode.ConfigurationTarget.Global);
	vscode.window.showInformationMessage(
		`Bahasa Impact Estimator diatur ke ${selected.label}.`,
		'🔁 Muat Ulang VSCode'
	).then((choice) => {
		if (choice === '🔁 Muat Ulang VSCode') {
			vscode.commands.executeCommand('workbench.action.reloadWindow');
		}
	});
}

class ImpactEstimatorViewProvider {
	constructor(context) {
		this._view = null;
		this._context = context;
		this.lang = getUserLanguage();
		this.t = locales[this.lang] || locales.id;
	}

	resolveWebviewView(webviewView) {
		this._view = webviewView;
		webviewView.webview.options = {
			enableScripts: true,
			localResourceRoots: [this._context.extensionUri]
		};

		const initialMessage = `📦 ${this.t.startMessage}`;
		webviewView.webview.html = this._getHtml(initialMessage);
	}

	update(content) {
		if (this._view) {
			this._view.webview.html = this._getHtml(content);
		}
	}

	async revealAndUpdate(content) {
		try {
			await vscode.commands.executeCommand('workbench.view.extension.impactEstimator');
			await new Promise(resolve => setTimeout(resolve, 500));
			this.update(content);
		} catch (error) {
			console.error('Failed to reveal panel:', error);
			vscode.window.showWarningMessage(`${this.t.panelLoadFailed}: ${error.message}`);
		}
	}

	_getHtml(markdownText) {
		let html = markdownText
			.replace(/### (.*)/g, '<h3>$1</h3>')
			.replace(/## (.*)/g, '<h2>$1</h2>')
			.replace(/# (.*)/g, '<h1>$1</h1>')
			.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
			.replace(/`(.*?)`/g, '<code>$1</code>')
			.replace(/- \[(.*?)\]\((.*?)\)/g, '- <a href="$2">$1</a>')
			.replace(/\n/g, '<br>');

		return `
<!DOCTYPE html>
<html>
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<style>
		body {
			font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
			padding: 16px;
			line-height: 1.6;
			color: var(--vscode-foreground);
			background-color: var(--vscode-editor-background);
		}
		h1, h2, h3 {
			color: var(--vscode-titleBar-activeForeground);
			margin-top: 20px;
			margin-bottom: 10px;
		}
		code {
			background-color: var(--vscode-textCodeBlock-background);
			padding: 2px 6px;
			border-radius: 3px;
			font-family: 'Courier New', Courier, monospace;
		}
		a {
			color: var(--vscode-textLink-foreground);
			text-decoration: none;
		}
		a:hover {
			text-decoration: underline;
		}
	</style>
</head>
<body>
	<div>${html}</div>
</body>
</html>`;
	}
}

function activate(context) {
	console.log('Impact Estimator extension is being activated');

  const lang = getUserLanguage();       
  const t = locales[lang] || locales.id;   
  const panelProvider = new ImpactEstimatorViewProvider(context, lang);

	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider('impactEstimatorResults', panelProvider)
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('impactEstimator.setLanguage', setLanguageCommand)
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('impactEstimator.run', async () => {
			console.log('Impact Estimator command executed');

			const editor = vscode.window.activeTextEditor;
			if (!editor) {
				vscode.window.showErrorMessage(t.noFileOpen);
				return;
			}

			const filePath = editor.document.fileName;
			const workspaceFolder = vscode.workspace.getWorkspaceFolder(editor.document.uri);

			if (!workspaceFolder) {
				vscode.window.showErrorMessage(t.noWorkspace);
				return;
			}

			const projectDir = workspaceFolder.uri.fsPath;
			const selectedText = editor.document.getText(editor.selection).trim();

			vscode.window.withProgress({
				location: vscode.ProgressLocation.Notification,
				title: t.analysisInProgress,
				cancellable: false
			}, async (progress) => {
				try {
					progress.report({ increment: 50, message: t.scanningFiles });
					const result = estimateImpact(filePath, selectedText, projectDir, lang);

					progress.report({ increment: 50, message: t.displayingResult });
					await panelProvider.revealAndUpdate(result);

					vscode.window.showInformationMessage(t.analysisDone);
				} catch (error) {
					console.error('Error during analysis:', error);
					const errorMessage = `❌ ${t.analysisError}\n\n${error.message}\n\nStack trace:\n${error.stack}`;
					await panelProvider.revealAndUpdate(errorMessage);
					vscode.window.showErrorMessage(`${t.analysisFailed}: ${error.message}`);
				}
			});
		})
	);

	console.log('Impact Estimator extension activated successfully');
}

function deactivate() {
	console.log('Impact Estimator extension deactivated');
}

module.exports = {
	activate,
	deactivate,
};
