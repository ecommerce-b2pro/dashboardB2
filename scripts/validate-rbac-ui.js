const sqlite3 = require('sqlite3').verbose();
const { chromium } = require('playwright');

const EMAIL = process.env.TEST_EMAIL || 'feliperibeiro_@outlook.com';
const PASSWORD = process.env.TEST_PASSWORD || '@Ecommerce';

function run(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve(this);
    });
  });
}

function get(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

async function login(page) {
  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.fill('#authIdentifier', EMAIL);
  await page.fill('#authPassword', PASSWORD);
  await page.click('button:has-text("Entrar")');
  await page.waitForFunction(() => !document.getElementById('authOverlay').classList.contains('active'), null, { timeout: 10000 });
  await page.waitForTimeout(800);
}

(async () => {
  const db = new sqlite3.Database('./data/dashboard.db');
  const browser = await chromium.launch({ headless: true });
  const pageViewer = await browser.newPage();
  const pageAdmin = await browser.newPage();
  let originalUser = null;

  try {
    originalUser = await get(db, 'SELECT role, status FROM users WHERE email = ?', [EMAIL]);
    await run(db, 'UPDATE users SET role = ?, status = ? WHERE email = ?', ['viewer', 'active', EMAIL]);
    await login(pageViewer);

    const viewerCheck = await pageViewer.evaluate(() => {
      const navSales = getComputedStyle(document.getElementById('navSalesItem')).display !== 'none';
      const navAdmin = getComputedStyle(document.getElementById('navAdminItem')).display !== 'none';
      const navDashboard = !!Array.from(document.querySelectorAll('.nav-link')).find((el) => el.textContent.includes('Dashboard') && getComputedStyle(el.closest('.nav-item')).display !== 'none');
      const salesVisible = document.getElementById('sales').classList.contains('active');
      return { navSales, navAdmin, navDashboard, salesVisible };
    });

    console.log('VIEWER_UI:', JSON.stringify(viewerCheck));

    await run(db, 'UPDATE users SET role = ?, status = ? WHERE email = ?', ['admin', 'active', EMAIL]);
    await login(pageAdmin);

    const adminCheck = await pageAdmin.evaluate(() => {
      const navAdmin = getComputedStyle(document.getElementById('navAdminItem')).display !== 'none';
      const navSales = getComputedStyle(document.getElementById('navSalesItem')).display !== 'none';
      const navDashboard = !!Array.from(document.querySelectorAll('.nav-link')).find((el) => el.textContent.includes('Dashboard') && getComputedStyle(el.closest('.nav-item')).display !== 'none');
      const usersRows = document.querySelectorAll('#adminUsersTableBody tr').length;
      return { navAdmin, navSales, navDashboard, usersRows };
    });

    console.log('ADMIN_UI:', JSON.stringify(adminCheck));
  } catch (error) {
    console.log('RBAC_UI_TEST_ERROR:', error.message);
    process.exitCode = 1;
  } finally {
    if (originalUser) {
      await run(db, 'UPDATE users SET role = ?, status = ? WHERE email = ?', [originalUser.role, originalUser.status, EMAIL]).catch(() => {});
    }
    db.close();
    await browser.close();
  }
})();
