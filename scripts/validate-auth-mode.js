const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded', timeout: 30000 });

    const before = await page.$eval('#authRegisterFields', (el) => getComputedStyle(el).display);
    const titleBefore = await page.$eval('#authTitle', (el) => el.textContent.trim());

    await page.click('button:has-text("Cadastrar")');

    const after = await page.$eval('#authRegisterFields', (el) => getComputedStyle(el).display);
    const titleAfter = await page.$eval('#authTitle', (el) => el.textContent.trim());

    console.log('AUTH_MODE:', JSON.stringify({ before, titleBefore, after, titleAfter }));
  } catch (error) {
    console.log('AUTH_MODE_ERROR:', error.message);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
