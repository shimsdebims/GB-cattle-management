/**
 * In-memory stand-in for the GB Cattle API, for browser walkthroughs of the
 * web export. Mirrors the server's rules that the app depends on: envelopes,
 * client_id replay, milk split → total, one milk record per cow per day
 * (409 MILK_DAY_EXISTS / MILK_CHANGED with the server record), status changes
 * (Active ↔ Inactive ↔ Quarantined only; Sold/Deceased via their own flows).
 *
 * Keep it in step with backend-mongo/routes when those rules change.
 */
function createFakeApi({ today }) {
  let n = 1;
  const id = () => String(n++).padStart(24, '0');
  let clock = Date.parse('2026-09-01T00:00:00Z');
  const now = () => new Date((clock += 1000)).toISOString();
  const db = { cattle: [], milk: [], feeding: [], expenses: [], revenue: [] };
  const calls = [];

  const cow = (tag, name, extra = {}) => {
    const t = now();
    const status = extra.current_status || 'Active';
    const c = {
      _id: id(), tag_number: tag, name, breed: 'Holstein', gender: 'Female',
      date_of_birth: '2020-01-15T00:00:00.000Z', health_status: 'Healthy',
      current_status: status, status_history: [{ status, changed_at: t }],
      created_at: t, updated_at: t, ...extra,
    };
    db.cattle.push(c);
    return c;
  };

  const page = (items) => ({ total: items.length, page: 1, limit: 200, pages: 1, has_next: false, has_previous: false });
  const ok = (data, status = 200, extra = {}) => ({ status, body: { success: true, data, ...extra } });
  const err = (status, message, extra = {}) => ({ status, body: { success: false, error: 'x', message, ...extra } });
  const ref = (cid) => {
    const c = db.cattle.find((x) => x._id === cid);
    return c ? { _id: c._id, tag_number: c.tag_number, name: c.name } : cid;
  };
  const pop = (r) => ({ ...r, cattle_id: ref(r.cattle_id) });
  const day = (d) => String(d).slice(0, 10);
  const archived = (c) => ['Sold', 'Deceased'].includes(c.current_status);

  function milkTotal(b, existing = {}) {
    const m = 'morning_liters' in b ? b.morning_liters : existing.morning_liters;
    const e = 'evening_liters' in b ? b.evening_liters : existing.evening_liters;
    if (m == null && e == null) return 'quantity_liters' in b ? b.quantity_liters : existing.quantity_liters;
    return Math.round(((m || 0) + (e || 0)) * 100) / 100;
  }

  function handle(method, path, q, body = {}) {
    calls.push({ method, path, body });
    let m;

    if (path === '/health') return { status: 200, body: { status: 'healthy' } };
    if (path === '/auth/me') return ok({ user: null, auth_required: false });
    if (path === '/settings') return ok({ milk_price_per_liter: 1700, currency: 'BIF' });

    if (path === '/analytics/dashboard') {
      const herd = db.cattle.filter((c) => !archived(c));
      return ok({
        cattle: {
          total_cattle: herd.length,
          active_cattle: herd.filter((c) => c.current_status === 'Active').length,
          inactive_cattle: herd.filter((c) => c.current_status === 'Inactive').length,
          healthy_cattle: 0,
          pregnant_cattle: 0,
        },
        milk_production: { total_liters: 0, average_quality: 0, production_records: 0, average_daily_liters: 0, recording_days: 0 },
        financial: { milk_revenue: 0, other_revenue: 0, total_revenue: 0, total_expenses: 0, net_profit: 0, milk_price_per_liter: 1700, currency: 'BIF' },
        feeding: { total_feed_cost: 0, total_feed_quantity: 0 },
        period_days: 30,
      });
    }

    // ── cattle ──
    if (path === '/cattle' && method === 'GET') return ok(db.cattle, 200, { pagination: page(db.cattle) });
    if (path === '/cattle' && method === 'POST') {
      if (body.client_id) {
        const prev = db.cattle.find((c) => c.client_id === body.client_id);
        if (prev) return ok(prev);
      }
      const status = body.current_status || 'Active';
      const reason = status === 'Inactive' ? body.inactive_reason || undefined : undefined;
      const t = now();
      const c = { _id: id(), ...body, current_status: status, inactive_reason: reason, status_history: [{ status, reason, changed_at: t }], created_at: t, updated_at: t };
      db.cattle.unshift(c);
      return ok(c, 201);
    }
    if ((m = path.match(/^\/cattle\/(\w+)\/summary$/))) {
      const c = db.cattle.find((x) => x._id === m[1]);
      if (!c) return err(404, 'Cattle not found');
      const milk = db.milk.filter((r) => r.cattle_id === c._id);
      return ok({
        cattle: c,
        summary: {
          milk_production: { total_liters_30_days: 0, average_daily_liters: 0, average_quality: 0, record_count: milk.length },
          feeding: { total_cost_7_days: 0, total_quantity_kg_7_days: 0, record_count: 0 },
        },
        lifetime: { total_liters: 0, milk_income: 0, milk_record_count: milk.length, first_milk_date: null, last_milk_date: null, feed_cost: 0, sale_income: c.sale_price || 0, net: 0, currency: 'BIF' },
        sale_revenue: [],
        recent_milk_records: milk.map(pop),
        recent_feeding_records: [],
      });
    }
    if ((m = path.match(/^\/cattle\/(\w+)\/sell$/))) {
      const c = db.cattle.find((x) => x._id === m[1]);
      Object.assign(c, { current_status: 'Sold', sale_price: body.sale_price, sale_date: body.sale_date });
      return ok({ cattle: c, revenue: {} });
    }
    if ((m = path.match(/^\/cattle\/(\w+)$/)) && method === 'PUT') {
      const c = db.cattle.find((x) => x._id === m[1]);
      if (!c) return err(404, 'Cattle not found');
      // eslint-disable-next-line no-unused-vars
      const { status_history, inactive_reason, current_status, client_id, ...fields } = body;
      if (current_status !== undefined && current_status !== c.current_status) {
        if (archived(c) || !['Active', 'Inactive', 'Quarantined'].includes(current_status)) {
          return err(409, 'Status change not allowed', { code: 'STATUS_CHANGE_NOT_ALLOWED' });
        }
        c.current_status = current_status;
        c.status_history = [...(c.status_history || []), {
          status: current_status,
          reason: current_status === 'Inactive' ? inactive_reason || undefined : undefined,
          changed_at: now(),
        }];
      }
      if (c.current_status === 'Inactive') {
        if (inactive_reason !== undefined) c.inactive_reason = inactive_reason || undefined;
      } else {
        delete c.inactive_reason;
      }
      Object.assign(c, fields, { updated_at: now() });
      return ok(c);
    }

    // ── milk ──
    if (path === '/milk' && method === 'GET') {
      let items = db.milk;
      if (q.get('date_from')) items = items.filter((r) => day(r.date_recorded) >= q.get('date_from'));
      if (q.get('date_to')) items = items.filter((r) => day(r.date_recorded) <= q.get('date_to'));
      return ok(items.map(pop), 200, { pagination: page(items) });
    }
    if (path === '/milk' && method === 'POST') {
      if (body.client_id) {
        const prev = db.milk.find((r) => r.client_id === body.client_id);
        if (prev) return ok(pop(prev));
      }
      const clash = db.milk.find((r) => r.cattle_id === body.cattle_id && day(r.date_recorded) === day(body.date_recorded));
      if (clash) return err(409, 'A record already exists for this animal on this date', { code: 'MILK_DAY_EXISTS', data: pop(clash) });
      if (day(body.date_recorded) > today()) return err(400, 'Validation failed', { errors: [{ field: 'date_recorded', message: 'date_recorded cannot be in the future' }] });
      const t = now();
      const rec = {
        _id: id(), cattle_id: body.cattle_id, date_recorded: `${day(body.date_recorded)}T00:00:00.000Z`,
        morning_liters: body.morning_liters ?? undefined, evening_liters: body.evening_liters ?? undefined,
        quantity_liters: milkTotal(body), client_id: body.client_id, price_per_liter: 1700, created_at: t, updated_at: t,
      };
      db.milk.unshift(rec);
      return ok(pop(rec), 201);
    }
    if ((m = path.match(/^\/milk\/(\w+)$/)) && method === 'PUT') {
      const rec = db.milk.find((r) => r._id === m[1]);
      if (!rec) return err(404, 'Milk production record not found');
      if (body.expected_updated_at && body.expected_updated_at !== rec.updated_at) {
        return err(409, 'Changed on another device', { code: 'MILK_CHANGED', data: pop(rec) });
      }
      // eslint-disable-next-line no-unused-vars
      const { expected_updated_at, client_id, ...upd } = body;
      if (['morning_liters', 'evening_liters', 'quantity_liters'].some((k) => k in upd)) upd.quantity_liters = milkTotal(upd, rec);
      Object.assign(rec, upd, { updated_at: now() });
      return ok(pop(rec));
    }
    if ((m = path.match(/^\/milk\/(\w+)$/)) && method === 'DELETE') {
      db.milk = db.milk.filter((r) => r._id !== m[1]);
      return ok({ _id: m[1] });
    }
    if (path === '/milk/monthly-grid') {
      return ok({ month: q.get('month'), days_in_month: 30, cows: [], daily_totals: Array(30).fill(null), grand_total: 0 });
    }

    if (path === '/feeding/monthly-grid') {
      // Mirrors routes/feeding.js monthly-grid.
      const month = q.get('month');
      const [y, mo] = month.split('-').map(Number);
      const dim = new Date(Date.UTC(y, mo, 0)).getUTCDate();
      const r1 = (n) => Math.round(n * 10) / 10;
      const recs = db.feeding.filter((f) => day(f.date_recorded).startsWith(month));
      const byCow = new Map();
      const dKg = Array(dim).fill(null), dCost = Array(dim).fill(null), types = new Map();
      for (const f of recs) {
        const i = Number(day(f.date_recorded).slice(8, 10)) - 1;
        const cost = f.cost_per_unit != null ? f.quantity_kg * f.cost_per_unit : 0;
        if (!byCow.has(f.cattle_id)) byCow.set(f.cattle_id, { kg: Array(dim).fill(null), cost: Array(dim).fill(null) });
        const c = byCow.get(f.cattle_id);
        c.kg[i] = (c.kg[i] || 0) + f.quantity_kg;
        c.cost[i] = (c.cost[i] || 0) + cost;
        dKg[i] = (dKg[i] || 0) + f.quantity_kg;
        dCost[i] = (dCost[i] || 0) + cost;
        const t = types.get(f.feed_type) || { feed_type: f.feed_type, total_kg: 0, total_cost: 0 };
        t.total_kg += f.quantity_kg; t.total_cost += cost; types.set(f.feed_type, t);
      }
      const sum = (a) => a.reduce((x, v) => x + (v || 0), 0);
      const cows = [...byCow.entries()].map(([cid, c]) => {
        const cow = db.cattle.find((x) => x._id === cid) || {};
        const fed = c.kg.filter((v) => v !== null).length;
        return {
          cattle_id: cid, name: cow.name || 'Unknown', tag: cow.tag_number || '—',
          daily_kg: c.kg.map((v) => (v === null ? null : r1(v))),
          daily_cost: c.cost.map((v) => (v === null ? null : Math.round(v))),
          total_kg: r1(sum(c.kg)), total_cost: Math.round(sum(c.cost)), fed_days: fed,
          average_kg: fed ? r1(sum(c.kg) / fed) : 0,
        };
      }).sort((a, b) => b.total_kg - a.total_kg);
      return ok({
        month, days_in_month: dim, cows,
        daily_totals_kg: dKg.map((v) => (v === null ? null : r1(v))),
        daily_totals_cost: dCost.map((v) => (v === null ? null : Math.round(v))),
        grand_total_kg: r1(sum(dKg)), grand_total_cost: Math.round(sum(dCost)),
        fed_days: dKg.filter((v) => v !== null).length,
        by_feed_type: [...types.values()].sort((a, b) => b.total_kg - a.total_kg)
          .map((t) => ({ ...t, total_kg: r1(t.total_kg), total_cost: Math.round(t.total_cost) })),
      });
    }
    // ── feeding / finance ──
    const lists = { '/feeding': 'feeding', '/financial/expenses': 'expenses', '/financial/revenue': 'revenue' };
    if (lists[path] && method === 'GET') return ok(db[lists[path]], 200, { pagination: page(db[lists[path]]) });
    if (lists[path] && method === 'POST') {
      const rec = { _id: id(), ...body, created_at: now(), updated_at: now() };
      db[lists[path]].unshift(rec);
      return ok(rec, 201);
    }
    if (path === '/financial/summary') {
      return ok({ summary: { total_revenue: 0, total_expenses: 0, net_profit: 0, revenue_count: 0, expense_count: 0 }, expense_by_category: [], revenue_by_source: [] });
    }
    if (path === '/analytics/monthly-income') {
      return ok({ month: q.get('month'), milk_price_per_liter: 1700, currency: 'BIF', cows: [], total_liters: 0, total_income: 0, average_per_head: 0 });
    }

    return err(404, `fake API: no route ${method} ${path}`);
  }

  return { db, calls, cow, handle, id, now };
}

module.exports = { createFakeApi };
