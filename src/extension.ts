import fs from 'fs';
import path from 'path';
import { ExtensionContext, TreeItem, Uri, workspace } from 'vscode'
import { commands, debug, window } from 'vscode'

import { DebugProvider } from './DebugProvider'
import { PanelManager } from './PanelManager'

// TODO: Ctrl+F to search, Ctrl+R to reload page, Ctrl+Shift+C to open DevTools
// TODO: google signin, etc.
// TODO: right click to open in new tab, copy, paste, etc.
// TODO: ctrl+- page. ctrl+up/down to scroll, ctrl+z to undo, ctrl+shift+z to redo
// TODO: add ctrl+A to select all
// TODO: maybe move open source document to horizontal split and context menu

export async function activate(ctx: ExtensionContext) {
  const manager = new PanelManager(ctx);
  const debugProvider = new DebugProvider(manager);

  ctx.subscriptions.push(
    debug.registerDebugConfigurationProvider(
      'selfprogrammed.browser',
      debugProvider.getProvider(),
    ),

    workspace.onDidSaveTextDocument(async (doc) => {
      if (doc.uri.fsPath.endsWith('.website')) {
        const buffer = await workspace.fs.readFile(doc.uri);
        const url = buffer.toString().trim().split('\n')[0];
        manager.current?.navigateTo(url);
        manager.current?.setPinnedUrl(url);
      }
    }),

    commands.registerCommand('selfprogrammed.browser.open', async (url?: string | Uri) => {
      try {
        return await manager.createClient(url);
      } catch (e) {
        console.error(e);
      }
    }),

    commands.registerCommand('selfprogrammed.browser.openActiveFile', () => {
      const filename = window.activeTextEditor?.document?.fileName
      if (!filename) {
        return;
      }
      manager.createFile(filename);
    }),

    commands.registerCommand('selfprogrammed.browser.controls.refresh', () => {
      manager.current?.reload();
    }),

    commands.registerCommand('selfprogrammed.browser.controls.external', () => {
      manager.current?.openExternal(true);
    }),

    commands.registerCommand('selfprogrammed.browser.controls.debug', async () => {
      const panel = await manager.current?.createDebugPanel();
      panel?.show();
    }),

    commands.registerCommand('selfprogrammed.browser.controls.openSourceDocument', async (context?: Uri | TreeItem) => {
      // NOTE: VS Code doesn't update resourceExtname context key correctly when a custom tree view 
      // item is right-clicked, so we can't use it in package.json's context menu `when` clause
      const uri = context instanceof TreeItem ? context.resourceUri : context;
      if (uri && uri.fsPath.endsWith('.website')) {
        await window.showTextDocument(uri);
        return;
      }
      await manager.current?.showTextDocument();
    }),

    window.registerCustomEditorProvider('selfprogrammed.browser.editor', {
      async resolveCustomTextEditor(document, webviewPanel, token) {
        const line_count = document.lineCount; 
        if (line_count === 0) {
          return;
        }
  
        let url = document.lineAt(0).text;
        // const last_url = line_count >= 2 && document.lineAt(1).text;
  
        // if (last_url && last_url.startsWith('http')) {
        //   url = last_url;
        // }
  
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
  );

  try {
    // https://code.visualstudio.com/updates/v1_53#_external-uri-opener
    // @ts-expect-error proposed API
    ctx.subscriptions.push(window.registerExternalUriOpener?.(
      'selfprogrammed.browser.opener',
      {
        canOpenExternalUri: () => 2,
        openExternalUri(resolveUri: Uri) {
          manager.createClient(resolveUri)
        },
      },
      {
        schemes: ['http', 'https'],
        label: 'Open URL using Selfprogrammed Browser',
      },
    ))
  } catch { }
  
  ctx.subscriptions.push(
    commands.registerCommand('selfprogrammed.browser.open_walkthrough', async () => {
      await commands.executeCommand(
        'workbench.action.openWalkthrough',
        { category: 'Selfprogrammed.selfprogrammed-browser#walkthrough' },
        false
      );
    }),
    commands.registerCommand('selfprogrammed.browser.walkthrough.step_1', async () => {
      const root_path = workspace.workspaceFolders && workspace.workspaceFolders.length > 0
        ? workspace.workspaceFolders[0].uri.fsPath
        : undefined;
      
      if (!root_path) {
        return;
      }

      const website_path = path.join(root_path, 'example.website');
      if (fs.existsSync(website_path)) {
        return;
      }

      await workspace.fs.writeFile(Uri.file(website_path), new TextEncoder().encode(`https://example.com/`));
    }),

    commands.registerCommand('selfprogrammed.browser.notifications.extension_installed', async () => {
      window.showInformationMessage(`selfprogrammed-browser installed successfully. [Learn more](command:selfprogrammed.browser.notifications.cta.learn_more)`);
      commands.executeCommand('selfprogrammed.browser.open_walkthrough');
    }),
    commands.registerCommand('selfprogrammed.browser.notifications.extension_updated', async () => {
      const cta = `See what's new`;
      const selection = await window.showInformationMessage(`Updated extension selfprogrammed-browser to v${currentVersion}!`, cta);
      if (selection === cta) {
        await commands.executeCommand('selfprogrammed.browser.notifications.cta.see_whats_new');
      }
    }),

    commands.registerCommand('selfprogrammed.browser.notifications.cta.learn_more', async () => {
      await commands.executeCommand('vscode.open', Uri.parse('https://selfprogrammed.com/'));
    }),
    commands.registerCommand('selfprogrammed.browser.notifications.cta.see_whats_new', async () => {
      await commands.executeCommand('vscode.open', Uri.parse('https://github.com/selfprogrammed-community/selfprogrammed-browser/blob/main/CHANGELOG.md'));
    }),
  );

  const hasBeenActivatedBefore = ctx.globalState.get('hasBeenActivatedBefore');
  if (!hasBeenActivatedBefore) {
    await commands.executeCommand('selfprogrammed.browser.notifications.extension_installed');
    await ctx.globalState.update('hasBeenActivatedBefore', true);
	}

	const currentVersion = ctx.extension.packageJSON.version;
	const lastVersion = ctx.globalState.get('lastVersion');
  if (hasBeenActivatedBefore && lastVersion !== currentVersion) {
    await commands.executeCommand('selfprogrammed.browser.notifications.extension_updated');
		await ctx.globalState.update('lastVersion', currentVersion);
  }
}
