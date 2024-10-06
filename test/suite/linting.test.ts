import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';

suite('Linting Tests for .website Files', () => {
  const testFilePath = path.join(__dirname, '..', '..', '..', 'test', 'fixtures', 'sample.website');

  test('Linting should report an error for multi-line content', async () => {
    const uri = vscode.Uri.file(testFilePath);
    const document = await vscode.workspace.openTextDocument(uri);
    await vscode.window.showTextDocument(document);

    // Set content with multiple lines
    const edit = new vscode.WorkspaceEdit();
    edit.replace(uri, new vscode.Range(0, 0, document.lineCount, 0), 'https://example.com\nExtra line');
    await vscode.workspace.applyEdit(edit);
    await document.save();

    const diagnostics = vscode.languages.getDiagnostics(document.uri);
    assert.strictEqual(diagnostics.length, 1);
    assert.strictEqual(diagnostics[0].message, 'File should only contain one line.');
  });

  test('Linting should report an error for invalid URL', async () => {
    const uri = vscode.Uri.file(testFilePath);
    const document = await vscode.workspace.openTextDocument(uri);
    await vscode.window.showTextDocument(document);

    // Set content with invalid URL
    const edit = new vscode.WorkspaceEdit();
    edit.replace(uri, new vscode.Range(0, 0, document.lineCount, 0), 'invalid-url');
    await vscode.workspace.applyEdit(edit);
    await document.save();

    const diagnostics = vscode.languages.getDiagnostics(document.uri);
    assert.strictEqual(diagnostics.length, 1);
    assert.strictEqual(diagnostics[0].message, "Invalid URL: Must start with 'http://' or 'https://' and contain a valid address.");
  });

  test('Linting should pass for valid single-line URL', async () => {
    const uri = vscode.Uri.file(testFilePath);
    const document = await vscode.workspace.openTextDocument(uri);
    await vscode.window.showTextDocument(document);

    // Set content with a valid URL
    const edit = new vscode.WorkspaceEdit();
    edit.replace(uri, new vscode.Range(0, 0, document.lineCount, 0), 'https://example.com');
    await vscode.workspace.applyEdit(edit);
    await document.save();

    const diagnostics = vscode.languages.getDiagnostics(document.uri);
    assert.strictEqual(diagnostics.length, 0);
  });
});
