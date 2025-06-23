const vscode = require('vscode');
const path = require('path');
const { estimateImpact } = require('./impact-estimator');

class ImpactEstimatorViewProvider {
    constructor(context) {
        this._view = null;
        this._context = context;
    }

    resolveWebviewView(webviewView) {
        this._view = webviewView;
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._context.extensionUri]
        };
        webviewView.webview.html = this._getHtml('📦 Klik kanan pada file dan pilih "Impact Estimator: Jalankan di File Ini" untuk memulai analisis.');
    }

    update(content) {
        if (this._view) {
            this._view.webview.html = this._getHtml(content);
        }
    }

    async revealAndUpdate(content) {
        try {
            // Reveal the panel first
            await vscode.commands.executeCommand('workbench.view.extension.impactEstimator');
            
            // Wait a bit for panel to load
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Update content
            this.update(content);
        } catch (error) {
            console.error('Failed to reveal panel:', error);
            vscode.window.showWarningMessage('Gagal memuat panel Impact Estimator: ' + error.message);
        }
    }

    _getHtml(markdownText) {
        // Simple markdown-like rendering
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
        .emoji {
            margin-right: 8px;
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
    
    const panelProvider = new ImpactEstimatorViewProvider(context);
    
    // Register webview provider
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider('impactEstimatorResults', panelProvider)
    );

    // Register command
    const disposable = vscode.commands.registerCommand('impactEstimator.run', async () => {
        console.log('Impact Estimator command executed');
        
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('Tidak ada file yang sedang dibuka.');
            return;
        }

        const filePath = editor.document.fileName;
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(editor.document.uri);
        
        if (!workspaceFolder) {
            vscode.window.showErrorMessage('File harus berada dalam workspace folder.');
            return;
        }

        const projectDir = workspaceFolder.uri.fsPath;
        const selection = editor.selection;
        const selectedText = editor.document.getText(selection).trim();
        
        // Show progress
        vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Menganalisis dampak perubahan...",
            cancellable: false
        }, async (progress) => {
            try {
                progress.report({ increment: 50, message: "Memindai file..." });
                
                const targetFunction = selectedText || null;
                const result = estimateImpact(filePath, targetFunction, projectDir);
                
                progress.report({ increment: 50, message: "Menampilkan hasil..." });
                
                await panelProvider.revealAndUpdate(result);
                
                vscode.window.showInformationMessage('Analisis selesai! Lihat panel Impact Estimator.');
                
            } catch (error) {
                console.error('Error during analysis:', error);
                const errorMessage = `❌ Error saat menjalankan analisis:\n\n${error.message}\n\nStack trace:\n${error.stack}`;
                await panelProvider.revealAndUpdate(errorMessage);
                vscode.window.showErrorMessage('Gagal menjalankan analisis: ' + error.message);
            }
        });
    });

    context.subscriptions.push(disposable);
    
    console.log('Impact Estimator extension activated successfully');
}

function deactivate() {
    console.log('Impact Estimator extension deactivated');
}

module.exports = {
    activate,
    deactivate,
};