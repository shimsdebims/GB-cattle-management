/**
 * Active ↔ Inactive cows, as the farmer asked: add a young cow as inactive with
 * his own reason, keep her off the milk sheet but on feeding, make her active
 * later, and the reverse — online and offline.
 */
const { createFakeApi } = require('./fakeApi');
const { start, tab, overflow } = require('./harness');

const TODAY = new Date(Date.now() + 2 * 3600e3).toISOString().slice(0, 10);

(async () => {
  const api = createFakeApi({ today: () => TODAY });
  const amani = api.cow('GB001', 'Amani');
  const sold = api.cow('GB009', 'Vendue', { current_status: 'Sold' });
  const { page, check, finish, setOnline, url } = await start({ api, port: 4181 });
  const herdCow = (name) => api.db.cattle.find((c) => c.name === name);
  const backToHerd = async () => {
    await page.getByLabel(/back/i).first().click();
    await page.waitForTimeout(400);
  };
  const openCow = async (name) => {
    await page.getByText(name, { exact: true }).last().click();
    await page.getByText(/Make (in)?active/).last().waitFor({ timeout: 8000 }).catch(() => {});
  };
  const milkSheetNames = async () => {
    await tab(page, 'Milk');
    await page.getByText("Record today's milk", { exact: true }).last().click();
    await page.waitForTimeout(1200);
    const labels = await page.evaluate(() =>
      [...document.querySelectorAll('[aria-label$="total litres"], [aria-label$="morning litres"]')].map((e) => e.getAttribute('aria-label'))
    );
    await page.getByLabel(/back/i).first().click();
    await page.waitForTimeout(400);
    return labels.join(' ');
  };

  await page.goto(url);
  await page.getByText('Total', { exact: true }).first().waitFor({ timeout: 20000 });

  // 1. Add a young cow as Inactive, with his reason.
  await tab(page, 'Cattle');
  await page.getByLabel('Add cattle').click();
  await page.getByPlaceholder('e.g. GB0001').fill('GB002');
  await page.getByPlaceholder('e.g. Daisy').fill('Neza');
  await page.getByText('Inactive', { exact: true }).last().click();
  await page.getByLabel('Reason for inactive').fill('Trop jeune');
  check('Add form: nothing wider than the screen', (await overflow(page)).length === 0, (await overflow(page)).join(' | '));
  await page.getByText('Add Cattle', { exact: true }).last().click();
  await page.waitForTimeout(1000);
  const neza = herdCow('Neza');
  check('New cow saved as Inactive with his reason', neza && neza.current_status === 'Inactive' && neza.inactive_reason === 'Trop jeune', JSON.stringify(neza && { s: neza.current_status, r: neza.inactive_reason }));
  check('Herd list shows her reason', await page.getByText('Trop jeune').last().isVisible().catch(() => false));

  // 2. Off the milk sheet, still on feeding.
  let sheet = await milkSheetNames();
  check('Inactive cow is NOT on the milk sheet', sheet.includes('GB001') && !sheet.includes('GB002'), sheet);
  await tab(page, 'Feeding');
  await page.getByLabel('Add feeding record').click();
  await page.waitForTimeout(600);
  check('Inactive cow IS on the feeding form', await page.getByText('GB002', { exact: true }).last().isVisible().catch(() => false));
  check('Sold cow is not on the feeding form', (await page.getByText('GB009', { exact: true }).count()) === 0);
  await page.getByText('Cancel', { exact: true }).last().click();

  // 3. Dashboard counts the working herd with inactive separately.
  await tab(page, 'Dashboard');
  await page.waitForTimeout(800);
  check('Dashboard shows an Inactive count', await page.getByText('Inactive', { exact: true }).last().isVisible().catch(() => false));

  // 4. She calves: make her active again.
  await tab(page, 'Cattle');
  await openCow('Neza');
  check('Cow card says why she is inactive', await page.getByText(/Inactive · Trop jeune/).last().isVisible().catch(() => false));
  await page.getByText('Make active again', { exact: true }).last().click();
  await page.waitForTimeout(1000);
  check('"Make active again" (after confirming) makes her Active', herdCow('Neza').current_status === 'Active' && !herdCow('Neza').inactive_reason);
  check('History kept: Inactive then Active', herdCow('Neza').status_history.map((h) => h.status).join('>') === 'Inactive>Active');
  await backToHerd();
  sheet = await milkSheetNames();
  check('Now she IS on the milk sheet', sheet.includes('GB002'), sheet);

  // 5. The opposite: an active cow goes dry.
  await tab(page, 'Cattle');
  await openCow('Amani');
  await page.getByText('Make inactive', { exact: true }).last().click();
  await page.getByLabel('Reason for inactive').last().fill('Tarie');
  await page.getByText('Make inactive', { exact: true }).last().click();
  await page.waitForTimeout(1000);
  check('"Make inactive" with a reason', herdCow('Amani').current_status === 'Inactive' && herdCow('Amani').inactive_reason === 'Tarie');
  check('Cow card shows the status history', await page.getByText('Status history').last().isVisible().catch(() => false));
  await backToHerd();

  // 6. Offline: the change is kept on the phone and sent on reconnect.
  await setOnline(false);
  await page.waitForTimeout(800);
  await openCow('Amani');
  await page.getByText('Make active again', { exact: true }).last().click();
  await page.waitForTimeout(1000);
  check('Offline: Amani still Inactive on the server (change waits on the phone)', herdCow('Amani').current_status === 'Inactive');
  check('Offline: the card already shows her as active', await page.getByText('Make inactive', { exact: true }).last().isVisible().catch(() => false));
  await setOnline(true);
  await page.waitForTimeout(8000);
  check('Back online: the change reached the server', herdCow('Amani').current_status === 'Active');
  await backToHerd();

  // 7. A sold cow has no status switch (undo the sale instead).
  await tab(page, 'Cattle');
  await page.getByText('Archive', { exact: true }).last().click();
  await openCow('Vendue');
  check('Sold cow: no Make inactive / active button', (await page.getByText(/^Make (in)?active/).count()) === 0);
  check('Sold cow untouched', sold.current_status === 'Sold');

  process.exit((await finish()) ? 0 : 1);
})().catch((e) => {
  console.error(e.message.split('\n')[0]);
  process.exit(2);
});
