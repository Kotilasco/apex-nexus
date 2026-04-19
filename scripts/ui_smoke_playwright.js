const fs = require('fs');
const path = require('path');
const { chromium } = require(path.join(__dirname, '..', 'frontend', 'web', 'node_modules', 'playwright'));

const BASE_URL = process.env.UI_BASE_URL || 'http://localhost:3000';
const USERNAME = process.env.UI_USERNAME || 'admin';
const PASSWORD = process.env.UI_PASSWORD || 'Admin@2024!';

function stamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

async function clickNav(page, name) {
  await page.getByRole('link', { name, exact: true }).click();
}

async function expectHeading(page, text) {
  await page.getByRole('heading', { name: text, exact: true }).waitFor({ timeout: 30000 });
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1080 } });
  const page = await context.newPage();
  const results = [];
  let hasFailures = false;

  const testFileName = `ui-smoke-${stamp()}.txt`;
  const testFilePath = path.join(process.cwd(), testFileName);
  fs.writeFileSync(testFilePath, `Apex Nexus UI smoke upload ${new Date().toISOString()}\n`, 'utf8');

  try {
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
    await page.getByPlaceholder('Enter username').fill(USERNAME);
    await page.getByPlaceholder('Enter password').fill(PASSWORD);
    await page.getByRole('button', { name: 'Sign In' }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 30000 });
    await page.getByText('TOTAL DOCUMENTS').waitFor({ timeout: 30000 });
    results.push('PASS login -> dashboard');

    const runStep = async (name, fn) => {
      try {
        await fn();
        results.push(`PASS ${name}`);
      } catch (error) {
        hasFailures = true;
        results.push(`FAIL ${name}: ${error.message}`);
      }
    };

    await runStep('documents upload', async () => {
      await clickNav(page, 'Documents');
      await page.waitForURL(/\/documents/, { timeout: 30000 });
      await page.getByRole('button', { name: /New Folder/i }).waitFor({ timeout: 30000 });
      await page.getByRole('button', { name: /Upload/i }).first().click();
      await page.getByRole('heading', { name: 'Upload Document', exact: true }).waitFor({ timeout: 15000 });
      await page.locator('input[type="file"]').setInputFiles(testFilePath);
      await page.locator('label:has-text("Title") + input').fill(testFileName.replace('.txt', ''));
      await page.locator('label:has-text("Description") + textarea').fill('UI smoke test upload');
      await page.locator('label:has-text("Tags") + input').fill('ui-smoke,playwright');
      await page.locator('button').filter({ hasText: /^Upload$/ }).last().click();
      await page.getByText(testFileName.replace('.txt', ''), { exact: false }).waitFor({ timeout: 30000 });
    });

    await runStep('search keyword', async () => {
      await clickNav(page, 'Search');
      await expectHeading(page, 'Search');
      const searchTarget = testFileName.replace('.txt', '');
      let searchMatched = false;
      for (let attempt = 0; attempt < 6; attempt += 1) {
        await page.getByPlaceholder(/Search/i).fill(searchTarget);
        await page.getByRole('button', { name: /^Search$/ }).click();
        try {
          await page.getByText(searchTarget, { exact: false }).waitFor({ timeout: 10000 });
          searchMatched = true;
          break;
        } catch (_error) {
          await page.waitForTimeout(5000);
        }
      }
      if (!searchMatched) {
        throw new Error(`Search did not surface uploaded document: ${searchTarget}`);
      }
    });

    await runStep('cases create', async () => {
      await clickNav(page, 'Cases');
      await expectHeading(page, 'Adaptive Case Management');
      await page.getByRole('button', { name: 'New Case' }).click();
      await page.getByRole('heading', { name: 'New Case', exact: true }).waitFor({ timeout: 15000 });
      const caseTitle = `UI Smoke Case ${Date.now()}`;
      const caseModal = page.locator('div.fixed.inset-0').filter({ hasText: 'New Case' }).last();
      await caseModal.getByPlaceholder('Case title').fill(caseTitle);
      await caseModal.getByPlaceholder('Description').fill('Created by Playwright smoke test');
      await caseModal.locator('button').filter({ hasText: /^Create$/ }).click({ force: true });
      await page.getByRole('heading', { name: 'New Case', exact: true }).waitFor({ state: 'hidden', timeout: 30000 });
      await page.getByText(caseTitle, { exact: false }).waitFor({ timeout: 30000 });
    });

    if (await page.getByRole('heading', { name: 'New Case', exact: true }).isVisible().catch(() => false)) {
      const caseModal = page.locator('div.fixed.inset-0').filter({ hasText: 'New Case' }).last();
      if (await caseModal.locator('button').filter({ hasText: /^Cancel$/ }).isVisible().catch(() => false)) {
        await caseModal.locator('button').filter({ hasText: /^Cancel$/ }).click({ force: true });
      } else if (await caseModal.locator('button').nth(0).isVisible().catch(() => false)) {
        await caseModal.locator('button').nth(0).click({ force: true });
      }
    }

    await runStep('agents page and action', async () => {
      await clickNav(page, 'Agents');
      await expectHeading(page, 'Agents');
      await page.getByText('Multi-Agent Team').waitFor({ timeout: 15000 });
      await page.getByRole('button', { name: 'Run Auditor' }).click();
      await page.getByRole('button', { name: /Run Auditor|Running…/, exact: false }).waitFor({ timeout: 15000 });
    });

    await runStep('sustainability refresh', async () => {
      await clickNav(page, 'Sustainability');
      await expectHeading(page, 'Carbon-Aware Storage');
      await page.getByRole('button', { name: 'Refresh' }).click();
      await page.getByText('Bytes Stored', { exact: true }).waitFor({ timeout: 20000 });
    });

    await runStep('sap navigation', async () => {
      await clickNav(page, 'SAP Integration');
      await expectHeading(page, 'SAP Integration');
      await page.getByRole('button', { name: 'Procure-to-Pay' }).click();
      await page.getByText('Open Purchase Orders in SAP').waitFor({ timeout: 15000 });
      await page.getByRole('button', { name: 'Asset / Meter-to-Cash' }).click();
      await page.getByText('SAP Equipment Records').waitFor({ timeout: 15000 });
    });

    console.log(JSON.stringify({ success: !hasFailures, results }, null, 2));
    if (hasFailures) {
      process.exitCode = 1;
    }
  } catch (error) {
    const screenshotPath = path.join(process.cwd(), `ui-smoke-failure-${stamp()}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => {});
    console.error(JSON.stringify({
      success: false,
      error: error.message,
      results,
      screenshotPath,
      url: page.url(),
    }, null, 2));
    process.exitCode = 1;
  } finally {
    await browser.close();
    fs.unlinkSync(testFilePath);
  }
}

run();