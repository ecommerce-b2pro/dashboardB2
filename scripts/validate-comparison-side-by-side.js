const { chromium } = require('playwright');

(async () => {
  const email = process.env.TEST_EMAIL || 'feliperibeiro_@outlook.com';
  const password = process.env.TEST_PASSWORD || '@Ecommerce';

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.fill('#authIdentifier', email);
    await page.fill('#authPassword', password);
    await page.click('button:has-text("Entrar")');
    await page.waitForFunction(() => !document.getElementById('authOverlay').classList.contains('active'), null, { timeout: 10000 });

    await page.waitForTimeout(1500);

    const options = await page.$$eval('#comp1Ecommerce option', opts => opts.map(o => o.value));
    if (!options.length) {
      console.log('RESULT:', JSON.stringify({ ok: false, reason: 'Sem e-commerces no comparativo' }));
      await browser.close();
      return;
    }

    const e1 = options[0];
    const e2 = options.length > 1 ? options[1] : options[0];

    await page.selectOption('#comp1Ecommerce', e1);
    await page.selectOption('#comp2Ecommerce', e2);
    await page.fill('#comp1Month', '2026-01');
    await page.fill('#comp2Month', '2026-02');

    await page.click('button:has-text("Gerar Comparativo")');
    await page.waitForTimeout(500);

    const result = await page.evaluate(() => {
      const visible = getComputedStyle(document.getElementById('comparisonTableContainer')).display !== 'none';
      const th1 = document.getElementById('th1')?.textContent || '';
      const th3 = document.getElementById('th3')?.textContent || '';
      const rows = Array.from(document.querySelectorAll('#comparisonTableBody tr')).map(tr =>
        Array.from(tr.querySelectorAll('td')).map(td => td.textContent.trim())
      );
      return {
        visible,
        th1,
        th3,
        rowCount: rows.length,
        firstRow: rows[0] || null,
        lastRow: rows[rows.length - 1] || null
      };
    });

    console.log('RESULT:', JSON.stringify({ ok: true, e1, e2, ...result }));
  } catch (error) {
    console.log('RESULT:', JSON.stringify({ ok: false, error: error.message }));
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
