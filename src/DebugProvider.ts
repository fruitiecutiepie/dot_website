import type { CancellationToken, DebugAdapterTracker, DebugConfiguration, DebugConfigurationProvider, DebugSession, ProviderResult, WorkspaceFolder } from 'vscode'
import { debug, window } from 'vscode'
import type { PanelManager } from './PanelManager'
import { getUnderlyingDebugType } from './UnderlyingDebugAdapter'

export class DebugProvider {
  private readonly underlyingDebugType = getUnderlyingDebugType()

  constructor(private manager: PanelManager) {
    debug.onDidTerminateDebugSession((e: DebugSession) => {
      if (e.name === 'Selfprogrammed Browser: Launch' && e.configuration.urlFilter) {
        // TODO: Improve this with some unique ID per browser window instead of url, to avoid closing multiple instances
        this.manager.disposeByUrl(e.configuration.urlFilter)
      }
    })

    debug.registerDebugAdapterTrackerFactory(
      this.underlyingDebugType,
      {
        createDebugAdapterTracker(session: DebugSession): ProviderResult<DebugAdapterTracker> {
          const config = session.configuration
          if (!config._selfprogrammed || !config._selfprogrammedLaunch)
            return undefined

          return manager.createClient(config._selfprogrammedLaunch).then(() => undefined)
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
            type: 'selfprogrammed.browser',
            name: 'Selfprogrammed Browser: Attach',
            request: 'attach',
          },
          {
            type: 'selfprogrammed.browser',
            request: 'launch',
            name: 'Selfprogrammed Browser: Launch',
            url: 'http://localhost:3000',
          },
        ])
      },
      resolveDebugConfiguration(
        folder: WorkspaceFolder | undefined,
        config: DebugConfiguration,
        token?: CancellationToken,
      ): ProviderResult<DebugConfiguration> {
        if (!config || config.type !== 'selfprogrammed.browser')
          return null

        config.type = debugType
        config._selfprogrammed = true

        if (config.request === 'launch') {
          config.name = 'Selfprogrammed Browser: Launch'
          config.port = manager.config.debugPort
          config.request = 'attach'
          config.urlFilter = config.url
          config._selfprogrammedLaunch = config.url

          if (config.port === null) {
            window.showErrorMessage(
              'Could not launch Selfprogrammed Browser window',
            )
          }
          else {
            return config
          }
        }
        else if (config.request === 'attach') {
          config.name = 'Selfprogrammed Browser: Attach'
          config.port = manager.config.debugPort

          if (config.port === null) {
            window.showErrorMessage(
              'No Selfprogrammed Browser window was found. Open a Selfprogrammed Browser window or use the "launch" request type.',
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
