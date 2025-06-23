const vscode = require('vscode');
const cp = require('child_process');
const path = require('path');

function activate(context) {
  const disposable = vscode.commands.registerCommand('impactEstimator.run', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage("Tidak ada file yang sedang dibuka.");
      return;
    }

    const filePath = editor.document.fileName;

    // Ambil teks yang diblok (nama fungsi)
    const selection = editor.selection;
    const selectedText = editor.document.getText(selection).trim();

    const args = [filePath];
    if (selectedText) args.push(selectedText);

    // Output channel
    const output = vscode.window.createOutputChannel("Impact Estimator");
    output.clear();
    output.show(true);

    // Jalankan proses CLI
    const scriptPath = path.join(__dirname, 'impact-estimator.js');
    const cmd = `node "${scriptPath}" ${args.map(a => `"${a}"`).join(" ")}`;

    cp.exec(cmd, { cwd: path.dirname(filePath) }, (err, stdout, stderr) => {
      if (err) {
        output.appendLine(`❌ Error: ${err.message}`);
        if (stderr) output.appendLine(stderr);
        return;
      }
      output.appendLine(stdout);
    });
  });

  context.subscriptions.push(disposable);
}

function deactivate() {}

module.exports = {
  activate,
  deactivate
};
