import { EventEmitter } from 'events'
import { platform } from 'os'
import { existsSync } from 'fs'
import { join } from 'path'
import type { Browser } from 'puppeteer'
import puppeteer from 'puppeteer'
import type { ExtensionContext } from 'vscode'
import { window, workspace } from 'vscode'

import type { ExtensionConfiguration } from './ExtensionConfiguration'
import { tryPort } from './Config'
import { BrowserPage } from './BrowserPage'

import config from '../.puppeteerrc.cjs';
import { install_chromium } from '../install_chromium'

export class BrowserClient extends EventEmitter {
  private browser: Browser | undefined

  constructor(private config: ExtensionConfiguration, private ctx: ExtensionContext) {
    super()
  }

  private async launchBrowser() {
    const chromeArgs: Array<string> = [];

    this.config.debugPort = await tryPort(this.config.debugPort)

    chromeArgs.push(`--remote-debugging-port=${this.config.debugPort}`)

    chromeArgs.push('--allow-file-access-from-files')

    chromeArgs.push('--remote-allow-origins=*')

    // chromeArgs.push('--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.127 Safari/537.36')

    if (this.config.proxy && this.config.proxy.length > 0)
      chromeArgs.push(`--proxy-server=${this.config.proxy}`)

    if (this.config.otherArgs && this.config.otherArgs.length > 0)
      chromeArgs.push(this.config.otherArgs)

    let chromePath = this.config.chromeExecutable;
    if (chromePath) {
      console.log('BrowserClient.launchBrowser uses this.config.chromeExecutable', chromePath)
    } else {
      chromePath = await this.getChromiumPath()
    }
    console.log('chromePath', chromePath);

    if (!chromePath) {
      window.showErrorMessage(
        'No Chrome installation found, or no Chrome executable set in the settings',
      )
      return
    }

    if (platform() === 'linux')
      chromeArgs.push('--no-sandbox')

    const extensionSettings = workspace.getConfiguration('dot-website')
    const ignoreHTTPSErrors = extensionSettings.get<boolean>('ignoreHttpsErrors')

    let userDataDir
    if (this.config.storeUserData)
      userDataDir = join(this.ctx.globalStorageUri.fsPath, 'UserData')

    this.browser = await puppeteer.launch({
      ...config,
      headless: 'shell',
      executablePath: chromePath,
      acceptInsecureCerts: ignoreHTTPSErrors,
      args: chromeArgs,
      ignoreDefaultArgs: ['--mute-audio'],
      userDataDir,
    })
    console.log('BrowserClient.launchBrowser browser.version', await this.browser.version())

    // close the initial empty page
    ; (await this.browser.pages()).map(i => i.close())
  }

  public async newPage(): Promise<BrowserPage> {
    if (!this.browser) {
      await this.launchBrowser();
    }

    const page = await this.browser!.newPage();

    const browserPage = new BrowserPage(this.browser!, page);
    await browserPage.launch();
    
    return browserPage;
  }

  public dispose(): Promise<void> {
    return new Promise((resolve) => {
      if (this.browser) {
        this.browser.close()
        this.browser = undefined
      }
      resolve()
    })
  }

  public async getChromiumPath(): Promise<string | undefined> {
    const path = this.ctx.globalState.get('chromiumExecutablePath') as string | undefined;
    if (path && existsSync(path)) {
      return path;
    }

    window.showInformationMessage('Installing Chromium, please wait up to a minute...');
    const [install_path, install_path_err] = await install_chromium();
    if (install_path_err) {
      console.error('getChromiumPath', install_path_err);
      return undefined;
    }
    window.showInformationMessage(`Chromium installed. You can now use Dot Website!`);
    this.ctx.globalState.update('chromiumExecutablePath', install_path);
    return install_path;
  }
}
