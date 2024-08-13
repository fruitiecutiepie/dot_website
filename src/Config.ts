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
    quality: getConfig('selfprogrammed.browser.quality', 100),
    everyNthFrame: getConfig('selfprogrammed.browser.everyNthFrame', 1),
    format: getConfig('selfprogrammed.browser.format', 'png'),
    isVerboseMode: getConfig('selfprogrammed.browser.verbose', false),
    chromeExecutable: getConfig('selfprogrammed.browser.chromeExecutable'),
    startUrl: getConfig('selfprogrammed.browser.startUrl', 'https://google.com'),
    debugHost: getConfig('selfprogrammed.browser.debugHost', 'localhost'),
    debugPort: getConfig('selfprogrammed.browser.debugPort', 9222),
    storeUserData: getConfig('selfprogrammed.browser.storeUserData', true),
    proxy: getConfig('selfprogrammed.browser.proxy', ''),
    otherArgs: getConfig('selfprogrammed.browser.otherArgs', ''),
  }
}
