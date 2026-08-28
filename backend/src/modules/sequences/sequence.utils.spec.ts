import { evaluateStepCondition, computeNextRunAt } from './sequence.utils';

describe('sequence.utils', () => {
  it('schedules into working hours on a weekday', () => {
    const from = new Date('2026-08-21T20:00:00.000Z'); // Friday evening UTC
    const next = computeNextRunAt({
      from,
      delayDays: 0,
      timezone: 'UTC',
      businessHoursStart: 9,
      businessHoursEnd: 17,
      workingDays: '1,2,3,4,5',
    });
    expect(next.getUTCHours()).toBeGreaterThanOrEqual(9);
    expect(next.getTime()).toBeGreaterThanOrEqual(from.getTime());
  });

  it('evaluates opened / score / status conditions', () => {
    expect(
      evaluateStepCondition({
        condition: 'opened',
        lead: { status: 'new', leadScore: 10 },
        signal: { opened: true },
      }),
    ).toBe(true);

    expect(
      evaluateStepCondition({
        condition: 'lead_score_gte',
        conditionValue: '25',
        lead: { status: 'new', leadScore: 30 },
      }),
    ).toBe(true);

    expect(
      evaluateStepCondition({
        condition: 'status_equals',
        conditionValue: 'qualified',
        lead: { status: 'new', leadScore: 0 },
      }),
    ).toBe(false);
  });
});
