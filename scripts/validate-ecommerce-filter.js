const { chromium } = require('playwright');

(async () => {
  const email = process.env.TEST_EMAIL || 'feliperibeiro_@outlook.com';
  const password = process.env.TEST_PASSWORD || '@Ecommerce';

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  page.on('console', (msg) => {
    console.log('BROWSER_LOG:', msg.type(), msg.text());
  });

  try {
    await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.fill('#authIdentifier', email);
    await page.fill('#authPassword', password);
    await page.click('button:has-text("Entrar")');

    await page.waitForFunction(() => !document.getElementById('authOverlay').classList.contains('active'), null, { timeout: 10000 });
    await page.waitForTimeout(2000);

    const result = await page.evaluate(() => {
      const sel = document.getElementById('filterEcommerces');
      const opts = sel
        ? Array.from(sel.options).map((o) => ({
            value: o.value,
            text: o.text,
            selected: o.selected,
          }))
        : [];

      return {
        exists: !!sel,
        count: opts.length,
        options: opts,
      };
    });

    console.log('RESULT:', JSON.stringify(result));
  } catch (error) {
    console.error('TEST_ERROR:', error.message);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
