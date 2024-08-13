import type { CancellationToken, DebugAdapterTracker, DebugConfiguration, DebugConfigurationProvider, DebugSession, ProviderResult, WorkspaceFolder } from 'vscode'
import { debug, window } from 'vscode'
import type { PanelManager } from './PanelManager'
import { getUnderlyingDebugType } from './UnderlyingDebugAdapter'

export class DebugProvider {
  private readonly underlyingDebugType = getUnderlyingDebugType()

  constructor(private manager: PanelManager) {
    debug.onDidTerminateDebugSession((e: DebugSession) => {
      if (e.name === 'Dot Website: Launch' && e.configuration.urlFilter) {
        // TODO: Improve this with some unique ID per browser window instead of url, to avoid closing multiple instances
        this.manager.disposeByUrl(e.configuration.urlFilter)
      }
    })

    debug.registerDebugAdapterTrackerFactory(
      this.underlyingDebugType,
      {
        createDebugAdapterTracker(session: DebugSession): ProviderResult<DebugAdapterTracker> {
          const config = session.configuration
          if (!config._dotWebsite || !config._dotWebsiteLaunch)
            return undefined

          return manager.createClient(config._dotWebsiteLaunch).then(() => undefined)
        },
      },
    )
  }

  getProvider(): DebugConfigurationProvider {
    const manager = this.manager
    const debugType = this.underlyingDebugType

    return {
      provideDebugConfigurations(
        folder: WorkspaceFolder | undefined,
        token?: CancellationToken,
      ): ProviderResult<DebugConfiguration[]> {
        return Promise.resolve([
          {
            type: 'dot-website',
            name: 'Dot Website: Attach',
            request: 'attach',
          },
          {
            type: 'dot-website',
            request: 'launch',
            name: 'Dot Website: Launch',
            url: 'http://localhost:3000',
          },
        ])
      },
      resolveDebugConfiguration(
        folder: WorkspaceFolder | undefined,
        config: DebugConfiguration,
        token?: CancellationToken,
      ): ProviderResult<DebugConfiguration> {
        if (!config || config.type !== 'dot-website')
          return null

        config.type = debugType
        config._dotWebsite = true

        if (config.request === 'launch') {
          config.name = 'Dot Website: Launch'
          config.port = manager.config.debugPort
          config.request = 'attach'
          config.urlFilter = config.url
          config._dotWebsiteLaunch = config.url

          if (config.port === null) {
            window.showErrorMessage(
              'Could not launch Dot Website window',
            )
          }
          else {
            return config
          }
        }
        else if (config.request === 'attach') {
          config.name = 'Dot Website: Attach'
          config.port = manager.config.debugPort

          if (config.port === null) {
            window.showErrorMessage(
              'No Dot Website window was found. Open a Dot Website window or use the "launch" request type.',
            )
          }
          else {
            return config
          }
        }
        else {
          window.showErrorMessage(
            'No supported launch config was found.',
          )
        }
      },
    }
  }
}
