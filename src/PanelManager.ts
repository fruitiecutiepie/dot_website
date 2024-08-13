import { ExtensionContext, TextDocument, Uri, WebviewPanel, window } from 'vscode'
import { commands, workspace } from 'vscode'
import * as EventEmitter from 'eventemitter2'

import { BrowserClient } from './BrowserClient'
import { getConfig, getConfigs } from './Config'
import { Panel } from './Panel'
import type { ExtensionConfiguration } from './ExtensionConfiguration'

export class PanelManager extends EventEmitter.EventEmitter2 {
  public panels: Set<Panel>
  public current: Panel | undefined
  public browser: BrowserClient | undefined
  public config: ExtensionConfiguration

  constructor(public readonly ctx: ExtensionContext) {
    super()
    this.panels = new Set()
    this.config = getConfigs(this.ctx)

    this.on('windowOpenRequested', (params) => {
      this.createClient(params.url)
    })
  }

  private async refreshSettings() {
    const prev = this.config

    this.config = {
      ...getConfigs(this.ctx),
      debugPort: prev.debugPort,
    }
  }

  public async createClient(startUrl: string | Uri = this.config.startUrl, webviewPanel?: WebviewPanel, document?: TextDocument) {
    this.refreshSettings()

    if (!this.browser)
      this.browser = new BrowserClient(this.config, this.ctx)

    const panel = new Panel(this.config, this.browser, undefined, webviewPanel, document)

    panel.once('disposed', () => {
      if (this.current === panel) {
        this.current = undefined
        commands.executeCommand('setContext', 'selfprogrammed.browser-active', false)
      }
      this.panels.delete(panel)
      if (this.panels.size === 0) {
        this.browser!.dispose()
        this.browser = undefined
      }

      this.emit('windowDisposed', panel)
    })

    panel.on('windowOpenRequested', (params) => {
      this.emit('windowOpenRequested', params)
    })

    panel.on('focus', () => {
      this.current = panel
      commands.executeCommand('setContext', 'selfprogrammed.browser-active', true)
    })

    panel.on('blur', () => {
      if (this.current === panel && window.activeTextEditor?.document !== this.current.document) {
        this.current = undefined
        commands.executeCommand('setContext', 'selfprogrammed.browser-active', false)
      }
    })

    this.panels.add(panel)

    await panel.launch(startUrl.toString())

    this.emit('windowCreated', panel)

    this.ctx.subscriptions.push({
      dispose: () => panel.dispose(),
    })

    return panel
  }

  public async createFile(filepath: string) {
    if (!filepath)
      return

    const panel = await this.createClient(`file://${filepath}`)
    if (getConfig('selfprogrammed.browser.localFileAutoReload')) {
      panel.disposables.push(
        workspace.createFileSystemWatcher(filepath, true, false, false).onDidChange(() => {
        // TODO: check filename
          panel.reload()
        }),
      )
    }
    return panel
  }

  public disposeByUrl(url: string) {
    this.panels.forEach((b: Panel) => {
      if (b.config.startUrl === url)
        b.dispose()
    })
  }
}
