import { createServer } from 'http'
import type { ExtensionContext } from 'vscode'
import { workspace } from 'vscode'
import type { ExtensionConfiguration } from './ExtensionConfiguration'

export function getConfig<T>(key: string, v?: T): T {
  return workspace.getConfiguration().get(key, v) || v as T
}

export function isDarkTheme() {
  const theme = getConfig('workbench.colorTheme', '').toLowerCase()

  // must be dark
  if (theme.match(/dark|black/i) != null)
    return true

  // must be light
  if (theme.match(/light/i) != null)
    return false

  // IDK, maybe dark
  return true
}

function isPortFree(port: number) {
  return new Promise((resolve) => {
    const server = createServer()
      .listen(port, () => {
        server.close()
        resolve(true)
      })
      .on('error', () => {
        resolve(false)
      })
  })
}
export function timeout(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export async function tryPort(start = 4000): Promise<number> {
  if (await isPortFree(start))
    return start
  return tryPort(start + 1)
}

export function getConfigs(ctx: ExtensionContext): ExtensionConfiguration {
  return {
    extensionPath: ctx.extensionPath,
    columnNumber: 2,
    isDebug: false,
    quality: getConfig('dot-website.quality', 100),
    everyNthFrame: getConfig('dot-website.everyNthFrame', 1),
    format: getConfig('dot-website.format', 'png'),
    isVerboseMode: getConfig('dot-website.verbose', false),
    chromeExecutable: getConfig('dot-website.chromeExecutable'),
    startUrl: getConfig('dot-website.startUrl', 'https://google.com'),
    debugHost: getConfig('dot-website.debugHost', 'localhost'),
    debugPort: getConfig('dot-website.debugPort', 9222),
    storeUserData: getConfig('dot-website.storeUserData', true),
    proxy: getConfig('dot-website.proxy', ''),
    otherArgs: getConfig('dot-website.otherArgs', ''),
  }
}
