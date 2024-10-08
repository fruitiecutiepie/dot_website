import fs from 'fs';
import path from 'path';
import * as vscode from 'vscode'
import { commands, debug, window } from 'vscode'

import { DebugProvider } from './DebugProvider';
import { PanelManager } from './PanelManager';

// Visible for Testing
export const lint_document = async (
  doc: vscode.TextDocument,
  diagnosticCollection: vscode.DiagnosticCollection
) => {
  const text = doc.getText();
  const lines = text.split('\n');

  if (lines.length === 0) {
    return;
  }

  if (lines.length !== 1) {
    const range = new vscode.Range(1, 0, 1, 0);
    const diagnostic = new vscode.Diagnostic(
      range,
      'File should only contain one line.',
      vscode.DiagnosticSeverity.Error
    );
    diagnosticCollection.set(doc.uri, [diagnostic]);
    return;
  }
  
  const urlRegex = /^(https?:\/\/(www\.)?([a-zA-Z0-9-]+\.[a-zA-Z]{2,})(:[0-9]{1,5})?(\/[^\s]*)?)$/;
  if (!urlRegex.test(lines[0])) {
    const range = new vscode.Range(0, 0, 0, lines[0].length);
    const diagnostic = new vscode.Diagnostic(
      range,
      `Invalid URL: Must start with 'http://' or 'https://' and contain a valid address.`,
      vscode.DiagnosticSeverity.Error
    );
    diagnosticCollection.set(doc.uri, [diagnostic]);
    return;
  }

  diagnosticCollection.clear();
};  

export async function activate(ctx: vscode.ExtensionContext) {
  const manager = new PanelManager(ctx);
  const debugProvider = new DebugProvider(manager);
  const diagnosticCollection = vscode.languages.createDiagnosticCollection('dot-website');
  
  let zoomLevel = 1.0; // Default zoom level

  
  ctx.subscriptions.push(
    diagnosticCollection,

    debug.registerDebugConfigurationProvider(
      'dot-website',
      debugProvider.getProvider(),
    ),

    vscode.workspace.onDidSaveTextDocument(async (doc) => {
      if (doc.uri.fsPath.endsWith('.website')) {
        const buffer = await vscode.workspace.fs.readFile(doc.uri);
        const url = buffer.toString().trim().split('\n')[0];
        manager.current?.navigateTo(url);
        manager.current?.setPinnedUrl(url);
      }
    }),
    vscode.workspace.onDidOpenTextDocument(async (doc) => {
      if (doc.languageId !== 'dot-website') {
        return;
      }
      lint_document(doc, diagnosticCollection);
    }),
    vscode.workspace.onDidChangeTextDocument(async (e) => {
      if (e.document.languageId !== 'dot-website') {
        return;
      }
      lint_document(e.document, diagnosticCollection);
    }),

    commands.registerCommand('dot-website.open', async (url?: string | vscode.Uri) => {
      try {
        return await manager.createClient(url);
      } catch (e) {
        console.error(e);
      }
    }),
    commands.registerCommand('dot-website.controls.runDocument', async () => {
      const document = window.activeTextEditor?.document;
      if (!document) {
        return;
      }
      const line_count = document.lineCount; 
      if (line_count !== 1) {
        return;
      }

      let url = document.lineAt(0).text;
      try {
        await manager.createClient(url, undefined, document);
      } catch (e) {
        console.error(e);
      }
    }),
    commands.registerCommand('dot-website.openActiveFile', () => {
      const filename = window.activeTextEditor?.document?.fileName;
      if (!filename) {
        return;
      }
      manager.createFile(filename);
    }),

    commands.registerCommand('dot-website.controls.refresh', () => {
      manager.current?.reload();
    }),
    commands.registerCommand('dot-website.controls.external', () => {
      manager.current?.openExternal(true);
    }),
    commands.registerCommand('dot-website.controls.debug', async () => {
      const panel = await manager.current?.createDebugPanel();
      panel?.show();
    }),
    commands.registerCommand('dot-website.controls.openSourceDocument', async (context?: vscode.Uri | vscode.TreeItem) => {
      const uri = context instanceof vscode.TreeItem ? context.resourceUri : context;
      if (uri && uri.fsPath.endsWith('.website')) {
        await window.showTextDocument(uri);
        return;
      }
      await manager.current?.showTextDocument();
    }),

    window.registerCustomEditorProvider('dot-website.editor', {
      async resolveCustomTextEditor(document, webviewPanel, token) {
        const line_count = document.lineCount; 
        if (line_count !== 1) {
          return;
        }
  
        let url = document.lineAt(0).text;
        try {
          await manager.createClient(url, webviewPanel, document);
        } catch (e) {
          console.error(e);
        }
      }
    }, {
      webviewOptions: {
        retainContextWhenHidden: true,
      }
    }),

    // Register Zoom In command
    commands.registerCommand('dot-website.controls.zoomIn', () => {
      zoomLevel += 0.1; // Increment zoom level
      manager.current?.postMessage({ command: 'zoom', zoom: zoomLevel });
    }),

    // Register Zoom Out command
    commands.registerCommand('dot-website.controls.zoomOut', () => {
      zoomLevel -= 0.1; // Decrease zoom level
      if (zoomLevel < 0.1) zoomLevel = 0.1; // Prevent too much zoom out
      manager.current?.postMessage({ command: 'zoom', zoom: zoomLevel });
    }),
  );

  try {
    // https://code.visualstudio.com/updates/v1_53#_external-uri-opener
    // @ts-expect-error proposed API
    ctx.subscriptions.push(window.registerExternalUriOpener?.(
      'dot-website.opener',
      {
        canOpenExternalUri: () => 2,
        openExternalUri(resolveUri: vscode.Uri) {
          manager.createClient(resolveUri);
        },
      },
      {
        schemes: ['http', 'https'],
        label: 'Open URL using Dot Website',
      },
    ));
  } catch { }
  

  ctx.subscriptions.push(
    commands.registerCommand('dot-website.open_walkthrough', async () => {
      await commands.executeCommand(
        'workbench.action.openWalkthrough',
        { category: 'ftctpi.dot-website#walkthrough' },
        false
      );
    }),

    commands.registerCommand('dot-website.walkthrough.step_1', async () => {
      const root_path = vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0
        ? vscode.workspace.workspaceFolders[0].uri.fsPath
        : undefined;
      
      if (!root_path) {
        window.showInformationMessage('Please open a vscode.workspace folder to use this command.');
        return;
      }

      const website_path = path.join(root_path, 'example.website');
      if (fs.existsSync(website_path)) {
        return;
      }

      await vscode.workspace.fs.writeFile(vscode.Uri.file(website_path), new TextEncoder().encode(`https://example.com/`));
      await commands.executeCommand('workbench.view.explorer');
      await vscode.window.showTextDocument(vscode.Uri.file(website_path));
    }),

    commands.registerCommand('dot-website.notifications.extension_installed', async () => {
      window.showInformationMessage(`dot-website installed successfully. [Learn more](command:dot-website.notifications.cta.learn_more)`);
      commands.executeCommand('dot-website.open_walkthrough');
    }),
    
    commands.registerCommand('dot-website.notifications.extension_updated', async () => {
      const cta = `See what's new`;
      const selection = await window.showInformationMessage(`Updated extension dot-website to v${currentVersion}!`, cta);
      if (selection === cta) {
        await commands.executeCommand('dot-website.notifications.cta.see_whats_new');
      }
    }),

    commands.registerCommand('dot-website.notifications.cta.learn_more', async () => {
      await commands.executeCommand('vscode.open', vscode.Uri.parse('https://dot-website.com/'));
    }),
    commands.registerCommand('dot-website.notifications.cta.see_whats_new', async () => {
      await commands.executeCommand('vscode.open', vscode.Uri.parse('https://github.com/dot-website-community/dot-website/blob/main/CHANGELOG.md'));
    }),
  );

  const hasBeenActivatedBefore = ctx.globalState.get('hasBeenActivatedBefore');
  if (!hasBeenActivatedBefore) {
    await commands.executeCommand('dot-website.notifications.extension_installed');
    await ctx.globalState.update('hasBeenActivatedBefore', true);
  }

  const currentVersion = ctx.extension.packageJSON.version;
  const lastVersion = ctx.globalState.get('lastVersion');
  if (hasBeenActivatedBefore && lastVersion !== currentVersion) {
    await commands.executeCommand('dot-website.notifications.extension_updated');
    await ctx.globalState.update('lastVersion', currentVersion);
  }
}

export function deactivate() {}
