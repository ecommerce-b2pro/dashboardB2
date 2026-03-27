const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.fill('#authIdentifier', 'feliperibeiro_@outlook.com');
    await page.fill('#authPassword', '@Ecommerce');
    await page.click('button:has-text("Entrar")');

    await page.waitForFunction(() => !document.getElementById('authOverlay').classList.contains('active'), null, { timeout: 10000 });
    await page.waitForTimeout(500);

    const badge = await page.$eval('#userBadge', (el) => el.textContent.trim());
    console.log('BADGE:', badge);
  } catch (error) {
    console.log('BADGE_TEST_ERROR:', error.message);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
