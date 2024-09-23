import * as path from 'path'
import type { Disposable, TextDocument, WebviewPanel } from 'vscode'
import { Position, Selection, Uri, ViewColumn, WorkspaceEdit, commands, env, window, workspace } from 'vscode'
import { EventEmitter2 } from 'eventemitter2'

import type { BrowserClient } from './BrowserClient'
import type { BrowserPage } from './BrowserPage'
import type { ExtensionConfiguration } from './ExtensionConfiguration'
import { ContentProvider } from './ContentProvider'
import { res_async } from './res'

export class Panel extends EventEmitter2 {
  private static readonly viewType = 'dot-website'
  private _panel: WebviewPanel | null
  public disposables: Disposable[] = []
  public url = ''
  public title = ''
  public pinnedUrl = ''
  private state = {}
  private contentProvider: ContentProvider
  public browserPage: BrowserPage | null
  private browser: BrowserClient
  public config: ExtensionConfiguration
  public parentPanel: Panel | undefined
  public debugPanel: Panel | undefined
  public document: TextDocument | undefined
  public disposed = false

  constructor(config: ExtensionConfiguration, browser: BrowserClient, parentPanel?: Panel, panel?: WebviewPanel, document?: TextDocument) {
    super()
    this.config = config
    this._panel = panel || null
    this.browserPage = null
    this.browser = browser
    this.parentPanel = parentPanel
    this.document = document
    this.contentProvider = new ContentProvider(this.config)

    if (parentPanel) {
      parentPanel.once('disposed', () => this.dispose())
    }

    if (document) {
      this.pinnedUrl = document.lineAt(0).text
    }
  }

  get isDebugPage() {
    return !!this.parentPanel
  }

  private async postMessage(method: string, data: any) {
    if (this._panel) {
      const [ok, err] = await res_async(() => this._panel!.webview.postMessage({ method, result: data }))
      if (err) {
        console.error('Panel.postMessage', err);
        return;
      }
      return;
    }
  }

  public async launch(startUrl: string) {
    try {
      this.browserPage = await this.browser.newPage()
      if (this.browserPage) {
        this.browserPage.removeAllHighlights = this.browserPage.removeAllHighlights.bind(this.browserPage)
        this.browserPage.updateHighlights = this.browserPage.updateHighlights.bind(this.browserPage)
        this.browserPage.scrollToHighlightedMatch = this.browserPage.scrollToHighlightedMatch.bind(this.browserPage)

        this.browserPage.on('extension.findSearchBarQuery', async (data: any) => {
          this.postMessage('extension.findSearchBarQuery', data)
        })
        this.browserPage.on('extension.openFindSearchBar', async (data: any) => {
          this.postMessage('extension.openFindSearchBar', data)
        })
        this.browserPage.on('extension.contextMenu', async (data: any) => {
          this.postMessage('extension.contextMenu', data)
        })
        this.browserPage.on('extension.selectAll', async (data: any) => {
          this.postMessage('extension.selectAll', data)
        })
        this.browserPage.on('extension.selection', async (data: any) => {
          this.postMessage('extension.selection', data)
        })
        this.browserPage.on('extension.click', async (data: any) => {
          this.postMessage('extension.click', data)
        })

        this.browserPage.else(async (data: any) => {
          if (this._panel) {
            const [ok, err] = await res_async(() => this._panel!.webview.postMessage(data))
            if (err) {
              console.error('Panel.postMessage', err);
            }
          }
        })
      }
    }
    catch (err: any) {
      window.showErrorMessage(err.message)
    }

    if (!this._panel) {
      this._panel = window.createWebviewPanel(
        Panel.viewType,
        'Dot Website',
        this.isDebugPage ? ViewColumn.Three : ViewColumn.Active,
        {
          enableScripts: true,
          retainContextWhenHidden: true,
          localResourceRoots: [
            Uri.file(path.join(this.config.extensionPath, 'dist/client')),
          ],
        },
      )
    } else {
      this._panel.webview.options = {
        enableScripts: true,
        localResourceRoots: [
          Uri.file(path.join(this.config.extensionPath, 'dist/client')),
        ],
      }
    }
    this._panel.webview.html = this.contentProvider.getContent(this._panel.webview)
    this._panel.onDidDispose(() => this.dispose(), null, this.disposables)
    this._panel.onDidChangeViewState(() => {
      if (this._panel) {
        this.emit(this._panel.active ? 'focus' : 'blur'), null, this.disposables
      }
    })
    this._panel.webview.onDidReceiveMessage(
      async (msg) => {
        if (msg.type === 'extension.updateTitle') {
          this.title = msg.params.title
          if (this._panel) {
            this._panel.title = this.isDebugPage ? `DevTools - ${this.parentPanel?.title}` : msg.params.title
            try {
              this._panel.iconPath = Uri.parse(`https://favicon.yandex.net/favicon/${new URL(this.browserPage?.page.url() || '').hostname}`)
            }
            catch (err) {}
            return
          }
        }
        // if (msg.type === 'extension.updateLastUrlSourceDocument') {
        //   const url = msg.params.url
        //   if (this.document) {
        //     const doc = await workspace.openTextDocument(this.document.uri);
        //     const line_count = doc.lineCount;

        //     const edit = new WorkspaceEdit();
        //     if (line_count == 1) {
        //       edit.insert(doc.uri, doc.lineAt(line_count - 1).range.end, '\n' + url);
        //     } else {
        //       edit.replace(doc.uri, doc.lineAt(1).range, url);
        //     }

        //     const success = await workspace.applyEdit(edit);
        //     if (success) {
        //       await doc.save();
        //     }
        //   }
        // }
        if (msg.type === 'extension.windowOpenRequested') {
          this.emit('windowOpenRequested', { url: msg.params.url })
          this.url = msg.params.url
        }
        if (msg.type === 'extension.openFile')
          this.handleOpenFileRequest(msg.params)

        if (msg.type === 'extension.windowDialogRequested') {
          const { message, type } = msg.params
          if (type == 'alert') {
            window.showInformationMessage(message)
            if (this.browserPage) {
              this.browserPage.send('Page.handleJavaScriptDialog', {
                accept: true,
              })
            }
          }
          else if (type === 'prompt') {
            window
              .showInputBox({ placeHolder: message })
              .then((result) => {
                if (this.browserPage) {
                  this.browserPage.send('Page.handleJavaScriptDialog', {
                    accept: true,
                    promptText: result,
                  })
                }
              })
          }
          else if (type === 'confirm') {
            window.showQuickPick(['Ok', 'Cancel']).then((result) => {
              if (this.browserPage) {
                this.browserPage.send('Page.handleJavaScriptDialog', {
                  accept: result === 'Ok',
                })
              }
            })
          }
        }

        if (msg.type === 'extension.appStateChanged') {
          this.state = msg.params.state
          this.emit('stateChanged')
        }

        if (msg.type === 'extension.scrollToFindSearchBarQueryMatch') {
        }

        if (this.browserPage) {
          try {
            // not sure about this one but this throws later with unhandled
            // 'extension.appStateChanged' message
            if (msg.type !== 'extension.appStateChanged')
              this.browserPage.send(msg.type, msg.params, msg.callbackId)

            this.emit(msg.type, msg.params)
          }
          catch (err: any) {
            window.showErrorMessage(err)
          }
        }
      },
      null,
      this.disposables,
    )

    if (startUrl) {
      this.config.startUrl = startUrl
      this.url = this.url || startUrl
    }

    if (this.document) {
      this.postMessage('extension.pinnedUrl', {
        pinnedUrl: this.pinnedUrl,
      })
    }

    this.postMessage('extension.appConfiguration', {
      ...this.config,
      isDebug: this.isDebugPage,
    })

    this.emit('focus')
  }

  public navigateTo(url: string) {
    this.postMessage('extension.navigateTo', {
      url,
    })
    this.url = url
  }

  public async createDebugPanel() {
    if (this.isDebugPage)
      return
    if (this.debugPanel)
      return this.debugPanel

    const panel = new Panel(this.config, this.browser, this)
    this.debugPanel = panel
    panel.on('focus', () => {
      commands.executeCommand('setContext', 'dot-website-debug-active', true)
    })
    panel.on('blur', () => {
      commands.executeCommand('setContext', 'dot-website-debug-active', false)
    })
    panel.once('disposed', () => {
      commands.executeCommand('setContext', 'dot-website-debug-active', false)
      this.debugPanel = undefined
    })
    const domain = `${this.config.debugHost}:${this.config.debugPort}`
    if (this.browserPage) {
      await panel.launch(`http://${domain}/devtools/inspector.html?ws=${domain}/devtools/page/${this.browserPage.id}&experiments=true`)
    }
    return panel
  }

  public async showTextDocument() {
    if (this.document) {
      const doc = await workspace.openTextDocument(this.document.uri)
      await window.showTextDocument(doc, { preview: false, viewColumn: ViewColumn.Two })
    }
  }

  public reload() {
    this.browserPage?.send('Page.reload')
  }

  public goBackward() {
    this.browserPage?.send('Page.goBackward')
  }

  public goForward() {
    this.browserPage?.send('Page.goForward')
  }

  public getState() {
    return this.state
  }

  public openExternal(close = true) {
    if (this.url) {
      env.openExternal(Uri.parse(this.url))
      if (close)
        this.dispose()
    }
  }

  public setViewport(viewport: any) {
    this.postMessage('extension.viewport', viewport)
  }

  public setPinnedUrl(url: string) {
    this.postMessage('extension.pinnedUrl', {
      pinnedUrl: url,
    })
  }

  public show() {
    if (this._panel)
      this._panel.reveal()
  }

  public dispose() {
    this.disposed = true
    if (this._panel)
      this._panel.dispose()

    if (this.browserPage) {
      this.browserPage.dispose()
      this.browserPage = null
    }
    while (this.disposables.length) {
      const x = this.disposables.pop()
      if (x)
        x.dispose()
    }
    this.emit('disposed')
    this.removeAllListeners()
  }

  private handleOpenFileRequest(params: any) {
    const lineNumber = params.lineNumber
    const columnNumber = params.columnNumber | params.charNumber | 0

    const workspacePath = `${workspace.rootPath || ''}/`
    const relativePath = params.fileName.replace(workspacePath, '')

    workspace.findFiles(relativePath, '', 1).then((file) => {
      if (!file || !file.length)
        return

      const firstFile = file[0]

      // Open document
      workspace.openTextDocument(firstFile).then(
        (document: TextDocument) => {
          // Show the document
          window.showTextDocument(document, ViewColumn.One).then(
            (document) => {
              if (lineNumber) {
                // Adjust line position from 1 to zero-based.
                const pos = new Position(-1 + lineNumber, columnNumber)
                document.selection = new Selection(pos, pos)
              }
            },
            (reason) => {
              window.showErrorMessage(`Failed to show file. ${reason}`)
            },
          )
        },
        (err) => {
          window.showErrorMessage(`Failed to open file. ${err}`)
        },
      )
    })
  }
}
