/**
 * Feed per cow per day, per cow per month, and all cows per day / month:
 * the Feed view of the Monthly Report.
 */
const { createFakeApi } = require('./fakeApi');
const { start, tab, overflow } = require('./harness');

const TODAY = new Date(Date.now() + 2 * 3600e3).toISOString().slice(0, 10);
const MONTH = TODAY.slice(0, 7);
const SHOTS = process.env.SHOTS; // optional folder for screenshots

(async () => {
  const api = createFakeApi({ today: () => TODAY });
  const amani = api.cow('GB001', 'Amani');
  const bella = api.cow('GB002', 'Bella');
  const feed = (cow, d, feed_type, quantity_kg, cost_per_unit) =>
    api.db.feeding.push({
      _id: api.id(), cattle_id: cow._id, date_recorded: `${MONTH}-${d}`, feed_type, quantity_kg, cost_per_unit,
      total_cost: cost_per_unit != null ? quantity_kg * cost_per_unit : undefined,
    });
  feed(amani, '01', 'Hay', 10, 500);
  feed(amani, '01', 'Silage', 5, 200); // same day adds up: 15 kg, 6,000 FBu
  feed(amani, '02', 'Hay', 8); // no price
  feed(bella, '01', 'Hay', 4, 500);

  const { page, check, finish, url } = await start({ api, port: 4182 });
  const text = () => page.evaluate(() => document.body.innerText);

  await page.goto(url);
  await page.getByText('Total', { exact: true }).first().waitFor({ timeout: 20000 });

  // Feed entered through the form shows up too (today, Bella, 6 kg × 100).
  await tab(page, 'Feeding');
  await page.getByLabel('Add feeding record').click();
  await page.getByText('GB002', { exact: true }).last().click();
  await page.getByPlaceholder('e.g. 10').fill('6');
  await page.getByPlaceholder('e.g. 500').fill('100');
  await page.getByText(/^Save/).last().click();
  await page.waitForTimeout(800);
  check('Feed saved from the form', api.db.feeding.length === 5);

  await tab(page, 'Monthly');
  await page.waitForTimeout(800);
  check('Monthly report opens on Milk', await page.getByText(/No milk records/).last().isVisible().catch(() => false));
  await page.getByRole('button', { name: 'Feed' }).click();
  await page.waitForTimeout(800);

  const expectKg = 10 + 5 + 8 + 4 + 6; // 33
  const expectFbu = 5000 + 1000 + 0 + 2000 + 600; // 8,600
  let t = await text();
  check('Header: herd total for the month in kg and FBu', t.includes(`${expectKg.toFixed(1)} kg`) && t.includes('8,600 FBu'), t.split('\n').slice(0, 4).join(' / '));
  check('Both cows have a row', t.includes('Amani') && t.includes('Bella'));
  check('Amani, day 1 = 15 kg (hay + silage)', t.includes('15.0'));
  check('Amani, month = 23 kg', t.includes('23.0'));
  check('All cows, day 1 = 19 kg', t.includes('19.0'));
  check('All cows, whole month = 33 kg', t.includes('33.0'));
  check('By-cow month summary: Amani 23 kg / 6,000 FBu', await page.getByText('By cow', { exact: false }).last().isVisible() && t.includes('23.0 kg') && t.includes('6,000 FBu'));
  check('By-cow month summary: Bella 10 kg / 2,600 FBu', t.includes('10.0 kg') && t.includes('2,600 FBu'));
  check('Feed-type breakdown shown', t.includes('By feed type') && t.includes('Silage'));
  const wide = await overflow(page);
  // The day table scrolls sideways on purpose; only the page itself must fit.
  check('Page itself fits the phone width', !(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)), wide.slice(0, 2).join(' | '));
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/feed-kg.png` });

  await page.getByRole('button', { name: 'FBu' }).click();
  await page.waitForTimeout(400);
  t = await text();
  check('FBu: Amani day 1 = 6k', /\b6k\b/.test(t));
  check('FBu: herd month = 8.6k', t.includes('8.6k'));
  check('FBu: unpriced feed shows 0 and is explained', /\b0\b/.test(t) && t.includes('without a price counts as 0'));
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/feed-fbu.png` });

  await page.getByLabel('Previous month').click();
  await page.waitForTimeout(800);
  check('Previous month: empty feed sheet, no error', await page.getByText(/No feeding records/).last().isVisible().catch(() => false));
  await page.getByLabel('Next month').click();
  await page.waitForTimeout(800);
  check('Back to this month', (await text()).includes('33.0'));

  await page.getByRole('button', { name: 'Milk' }).click();
  await page.waitForTimeout(800);
  check('Milk sheet still works', await page.getByText(/No milk records/).last().isVisible().catch(() => false));

  process.exit((await finish()) ? 0 : 1);
})().catch((e) => {
  console.error(e.message.split('\n')[0]);
  process.exit(2);
});
