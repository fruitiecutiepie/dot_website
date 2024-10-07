import { expect } from 'chai';
import { BrowserPage } from './BrowserPage';
import puppeteer, { Browser, Page } from 'puppeteer-core';

// Mocks for Puppeteer Page and Browser
let browser: Browser;
let page: Page;
let browserPage: BrowserPage;

beforeEach(async () => {
  browser = await puppeteer.launch();
  page = await browser.newPage();
  browserPage = new BrowserPage(browser, page);

  // Mock `document.body.style.zoom`
  await page.evaluate(() => {
    window.zoomLevel = 1;
    Object.defineProperty(document.body.style, 'zoom', {
      value: '1',
      writable: true,
    });
  });
});

afterEach(async () => {
  await browser.close();
});

describe('Zoom Functionality', () => {
  it('should zoom in when Ctrl + + is pressed', async () => {
    // Simulate Ctrl + +
    await page.keyboard.down('Control');
    await page.keyboard.press('=');
    await page.keyboard.up('Control');

    const zoomLevel = await page.evaluate(() => document.body.style.zoom);
    expect(zoomLevel).to.equal('1.1');
  });

  it('should zoom out when Ctrl + - is pressed', async () => {
    // Simulate Ctrl + -
    await page.keyboard.down('Control');
    await page.keyboard.press('-');
    await page.keyboard.up('Control');

    const zoomLevel = await page.evaluate(() => document.body.style.zoom);
    expect(zoomLevel).to.equal('0.9');
  });

  it('should reset zoom when Ctrl + 0 is pressed', async () => {
    // Set zoom level to something different
    await page.evaluate(() => {
      document.body.style.zoom = '1.5';
    });

    // Simulate Ctrl + 0
    await page.keyboard.down('Control');
    await page.keyboard.press('0');
    await page.keyboard.up('Control');

    const zoomLevel = await page.evaluate(() => document.body.style.zoom);
    expect(zoomLevel).to.equal('1');
  });
});
