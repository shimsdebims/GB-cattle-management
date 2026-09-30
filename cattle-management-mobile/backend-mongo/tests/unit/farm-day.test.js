const { farmToday, calendarDay } = require('../../utils/dates');
const { validateMilkProduction } = require('../../middleware/validation');

const milk = (date) => ({
  cattle_id: '507f1f77bcf86cd799439011',
  date_recorded: date,
  quantity_liters: 10,
});

describe('the farm day (Bujumbura, UTC+2)', () => {
  test('is already tomorrow from 22:00 UTC', () => {
    expect(farmToday(new Date('2026-10-01T21:59:00Z'))).toBe('2026-10-01');
    expect(farmToday(new Date('2026-10-01T22:00:00Z'))).toBe('2026-10-02');
  });

  test('crosses month and year ends', () => {
    expect(farmToday(new Date('2026-12-31T22:30:00Z'))).toBe('2027-01-01');
  });

  test('calendarDay keeps the written date', () => {
    expect(calendarDay('2026-10-02')).toBe('2026-10-02');
    expect(calendarDay('2026-10-02T23:59:00Z')).toBe('2026-10-02');
    expect(calendarDay('not a date')).toBeNull();
  });
});

describe('"future" is judged by the farm day, not the server clock', () => {
  afterEach(() => jest.useRealTimers());

  test('milk dated the farm\'s today is accepted at 00:30 in Bujumbura', () => {
    // 22:30 UTC on 1 Oct = 00:30 on 2 Oct at the farm; the server's date is still 1 Oct.
    jest.useFakeTimers({ now: new Date('2026-10-01T22:30:00Z') });
    expect(validateMilkProduction(milk('2026-10-02')).valid).toBe(true);
  });

  test('the farm\'s tomorrow is still rejected', () => {
    jest.useFakeTimers({ now: new Date('2026-10-01T22:30:00Z') });
    const { valid, errors } = validateMilkProduction(milk('2026-10-03'));
    expect(valid).toBe(false);
    expect(errors[0].field).toBe('date_recorded');
  });

  test('before 22:00 UTC the next calendar day is still the future', () => {
    jest.useFakeTimers({ now: new Date('2026-10-01T21:00:00Z') });
    expect(validateMilkProduction(milk('2026-10-02')).valid).toBe(false);
  });
});

describe('milk validation', () => {
  test('a morning or evening amount can stand in for the total', () => {
    const { quantity_liters, ...rest } = milk('2026-07-01'); // eslint-disable-line no-unused-vars
    expect(validateMilkProduction({ ...rest, evening_liters: 5 }).valid).toBe(true);
    expect(validateMilkProduction(rest).valid).toBe(false);
  });

  test('the split may not sum above the daily limit', () => {
    const { valid, errors } = validateMilkProduction({
      ...milk('2026-07-01'),
      morning_liters: 60,
      evening_liters: 60,
    });
    expect(valid).toBe(false);
    expect(errors.some((e) => /morning \+ evening/.test(e.message))).toBe(true);
  });
});
