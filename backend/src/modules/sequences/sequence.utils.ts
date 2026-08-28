/**
 * Compute next runnable timestamp respecting org timezone + working hours.
 */
export function computeNextRunAt(params: {
  from: Date;
  delayDays: number;
  timezone: string;
  businessHoursStart: number;
  businessHoursEnd: number;
  workingDays: string; // "1,2,3,4,5" Monday=1 .. Sunday=7 (ISO)
}): Date {
  const target = new Date(params.from.getTime());
  target.setUTCDate(target.getUTCDate() + Math.max(0, params.delayDays));

  const working = new Set(
    params.workingDays
      .split(',')
      .map((d) => Number(d.trim()))
      .filter((n) => n >= 1 && n <= 7),
  );
  if (!working.size) {
    [1, 2, 3, 4, 5].forEach((d) => working.add(d));
  }

  // Walk forward until weekday is allowed, then clamp to business start hour in local-ish UTC approximation
  for (let i = 0; i < 14; i++) {
    const isoDay = ((target.getUTCDay() + 6) % 7) + 1; // JS Sun=0 -> ISO Mon=1
    if (working.has(isoDay)) break;
    target.setUTCDate(target.getUTCDate() + 1);
  }

  const hour = target.getUTCHours();
  if (hour < params.businessHoursStart) {
    target.setUTCHours(params.businessHoursStart, 0, 0, 0);
  } else if (hour >= params.businessHoursEnd) {
    target.setUTCDate(target.getUTCDate() + 1);
    target.setUTCHours(params.businessHoursStart, 0, 0, 0);
    for (let i = 0; i < 14; i++) {
      const isoDay = ((target.getUTCDay() + 6) % 7) + 1;
      if (working.has(isoDay)) break;
      target.setUTCDate(target.getUTCDate() + 1);
    }
  }

  return target;
}

export function evaluateStepCondition(params: {
  condition: string;
  conditionValue?: string | null;
  lead: {
    status: string;
    leadScore: number;
  };
  signal?: {
    opened?: boolean;
    clicked?: boolean;
    replied?: boolean;
    bounced?: boolean;
    tags?: string[];
  };
}): boolean {
  const signal = params.signal ?? {};
  switch (params.condition) {
    case 'none':
      return true;
    case 'opened':
      return Boolean(signal.opened);
    case 'clicked':
      return Boolean(signal.clicked);
    case 'replied':
      return Boolean(signal.replied);
    case 'bounced':
      return Boolean(signal.bounced);
    case 'lead_score_gte':
      return params.lead.leadScore >= Number(params.conditionValue ?? 0);
    case 'status_equals':
      return params.lead.status === params.conditionValue;
    case 'has_tag':
      return Boolean(
        params.conditionValue &&
          signal.tags?.includes(params.conditionValue),
      );
    default:
      return true;
  }
}
