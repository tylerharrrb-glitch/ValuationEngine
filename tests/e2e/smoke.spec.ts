/**
 * Smoke test (spec Parts 9 and 10): load MOPCO, run a valuation, open an audit panel,
 * export Excel and PDF; record every network request and assert no company data leaves the browser.
 */
import { test, expect, type Request } from '@playwright/test';
import { mkdirSync, writeFileSync, statSync } from 'node:fs';

const OUT = process.env.WOLF_E2E_OUT ?? 'test-results/e2e';

test('MOPCO end to end without leaking company data', async ({ page, baseURL }) => {
  const origin = new URL(baseURL ?? 'http://127.0.0.1:4173').origin + '/';
  mkdirSync(OUT, { recursive: true });
  const requests: { url: string; method: string; body: string }[] = [];
  page.on('request', (r: Request) => requests.push({ url: r.url(), method: r.method(), body: r.postData() ?? '' }));
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));

  await page.goto('/');
  await page.getByTestId('load-mopco').click();
  await expect(page.getByTestId('tab-valuation')).toBeEnabled({ timeout: 90_000 });
  await page.getByTestId('tab-valuation').click();
  const blended = page.getByTestId('blended-value');
  await expect(blended).toBeVisible();
  const blendedText = await blended.innerText();
  const dcfText = await page.getByTestId('dcf-per-share').innerText();
  await page.screenshot({ path: `${OUT}/valuation.png`, fullPage: true });

  await page.getByTestId('dcf-per-share').click();
  const panel = page.getByTestId('audit-panel');
  await expect(panel).toBeVisible();
  await expect(panel).toContainText('Equity value');
  await expect(panel).toContainText('Diluted shares');
  await page.screenshot({ path: `${OUT}/audit.png` });
  await panel.getByRole('button', { name: 'Close audit panel' }).click();

  const [xl] = await Promise.all([page.waitForEvent('download'), page.getByTestId('export-excel').click()]);
  const xlPath = `${OUT}/${xl.suggestedFilename()}`;
  await xl.saveAs(xlPath);
  const [pdf] = await Promise.all([page.waitForEvent('download'), page.getByTestId('export-pdf').click()]);
  const pdfPath = `${OUT}/${pdf.suggestedFilename()}`;
  await pdf.saveAs(pdfPath);
  expect(statSync(xlPath).size).toBeGreaterThan(50_000);
  expect(statSync(pdfPath).size).toBeGreaterThan(20_000);

  for (const id of ['assumptions', 'analysis', 'relative', 'historical', 'rates', 'methodology', 'sources', 'saved', 'about']) {
    await page.getByTestId(`tab-${id}`).click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${OUT}/tab-${id}.png`, fullPage: true });
  }

  const leaks = requests.filter((r) => /26844075576|MFPC/i.test(r.url + ' ' + r.body));
  writeFileSync(`${OUT}/network.json`, JSON.stringify({ blendedText, dcfText, requests, leaks, errors, xlPath, pdfPath }, null, 2));
  expect(errors, 'no uncaught page errors').toEqual([]);
  expect(leaks, 'no request contains fixture values').toEqual([]);
  const external = requests.filter((r) => !r.url.startsWith(origin) && !r.url.startsWith('data:') && !r.url.startsWith('blob:'));
  expect(external, 'no request leaves the application origin').toEqual([]);
});
