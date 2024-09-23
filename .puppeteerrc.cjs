const path = require("path");

/**
 * @type {import("puppeteer").Configuration}
 */
module.exports = {
  chrome: {
    skipDownload: true,
    version: '127.0.6533.119',
  },
  skipChromeDownload: true,
  skipChromeHeadlessShellDownload: true,
};