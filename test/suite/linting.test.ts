import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';

// confirm locally vs remotely that
//   1 extension activation timing
//   2 diffs in exts or lang services
//   3 document state, perhaps even wait 5s for things to render
// try doing non headless or more flags
//   try running the tests in a non-headless mode on the pipeline
//   or use additional flags to simulate a more complete GUI environment if possible.

suite('Linting Tests for .website Files', async () => {
  const testFilePath = path.join(__dirname, '..', '..', '..', 'test', 'fixtures', 'sample.website');

  await vscode.languages.onDidChangeDiagnostics(() => {
    console.log('Diagnostics changed');
  });

  test('Linting should report an error for multi-line content', async () => {
    const dotWebsiteExtension = vscode.extensions.getExtension('ftctpi.dot-website');
    if (dotWebsiteExtension && !dotWebsiteExtension.isActive) {
      await dotWebsiteExtension.activate();
      console.log('Activated extension');
    } else {
      throw Error('extension not activated');
    }

    vscode.extensions.all.forEach(ext => {
      console.log(`${ext.id}: ${ext.isActive ? 'Active' : 'Inactive'}`);
    });

    const uri = vscode.Uri.file(testFilePath);
    const document = await vscode.workspace.openTextDocument(uri);
    await vscode.window.showTextDocument(document);
    await vscode.commands.executeCommand('editor.action.formatDocument');

    // Set content with multiple lines
    const edit = new vscode.WorkspaceEdit();
    edit.replace(uri, new vscode.Range(0, 0, document.lineCount, 0), 'https://example.com\nExtra line');
    await vscode.workspace.applyEdit(edit);
    await document.save();

    // Manually trigger linting is required on CI, probably due to headless mode
    // lint_document(document, vscode.languages.createDiagnosticCollection('dot-website'));

    await new Promise(resolve => setTimeout(resolve, 1000));
    const diagnostics = vscode.languages.getDiagnostics(document.uri);
    console.log('diagnostics 1', diagnostics);

    // TODO: Mocking this for now, since 

    assert.strictEqual(diagnostics.length, 1);
    assert.strictEqual(diagnostics[0].message, 'File should only contain one line.');
  });

  test('Linting should report an error for invalid URL', async () => {
    const uri = vscode.Uri.file(testFilePath);
    const document = await vscode.workspace.openTextDocument(uri);
    await vscode.window.showTextDocument(document);
    await vscode.commands.executeCommand('editor.action.formatDocument');

    // Set content with invalid URL
    const edit = new vscode.WorkspaceEdit();
    edit.replace(uri, new vscode.Range(0, 0, document.lineCount, 0), 'invalid-url');
    await vscode.workspace.applyEdit(edit);
    await document.save();

    await new Promise(resolve => setTimeout(resolve, 1000));
    const diagnostics = vscode.languages.getDiagnostics(document.uri);
    console.log('diagnostics 2', diagnostics);
    assert.strictEqual(diagnostics.length, 1);
    assert.strictEqual(diagnostics[0].message, "Invalid URL: Must start with 'http://' or 'https://' and contain a valid address.");
  });

  test('Linting should pass for valid single-line URL', async () => {
    const uri = vscode.Uri.file(testFilePath);
    const document = await vscode.workspace.openTextDocument(uri);
    await vscode.window.showTextDocument(document);
    await vscode.commands.executeCommand('editor.action.formatDocument');

    // Set content with a valid URL
    const edit = new vscode.WorkspaceEdit();
    edit.replace(uri, new vscode.Range(0, 0, document.lineCount, 0), 'https://example.com');
    await vscode.workspace.applyEdit(edit);
    await document.save();

    await new Promise(resolve => setTimeout(resolve, 1000));
    const diagnostics = vscode.languages.getDiagnostics(document.uri);
    console.log('diagnostics 3', diagnostics);
    assert.strictEqual(diagnostics.length, 0);
  });

  console.log('Installed extensions:', vscode.extensions.all.map(ext => {
    console.log(`${ext.id}: ${ext.isActive ? 'Active' : 'Inactive'}`);
  }));
  const extension = vscode.extensions.getExtension('ftctpi.dot-website');
    if (extension && !extension.isActive) {
      await extension.activate();
    }
    

});
