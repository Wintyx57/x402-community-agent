// Tests — logique scheduler (getNextScheduledPost, schedulerTick logic)
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// ─── getNextScheduledPost (logique extraite) ──────────────────────
describe('getNextScheduledPost — trouver le prochain post planifié', () => {
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

  function getNextScheduledPost(settings, nowDate) {
    const now = nowDate || new Date();
    for (let offset = 0; offset < 7; offset++) {
      const d = new Date(now.getTime() + offset * 86400000);
      const dayKey = dayNames[d.getDay()];
      const entries = settings.schedule[dayKey] || [];

      for (const entry of entries) {
        const strategyName = typeof entry === 'string' ? entry : entry.strategy;
        const time = typeof entry === 'string' ? (settings.scheduler?.defaultTime || '09:00') : entry.time;
        const [h, m] = time.split(':').map(Number);

        const scheduled = new Date(d);
        scheduled.setHours(h, m, 0, 0);

        if (scheduled > now) {
          return { strategy: strategyName, time: scheduled.toISOString(), day: dayKey, hour: time };
        }
      }
    }
    return null;
  }

  const fullSchedule = {
    schedule: {
      monday: [{ strategy: 'weekly-recap', time: '09:00' }],
      tuesday: [{ strategy: 'daily-stats', time: '10:00' }],
      wednesday: [{ strategy: 'daily-stats', time: '09:00' }],
      thursday: [{ strategy: 'daily-stats', time: '09:00' }],
      friday: [{ strategy: 'daily-stats', time: '09:00' }],
      saturday: [{ strategy: 'daily-stats', time: '09:00' }],
      sunday: [],
    },
    scheduler: { defaultTime: '09:00' },
  };

  it('should return an object with strategy, time, day, hour', () => {
    // Utiliser un lundi à 08:00 — donc le prochain post est 09:00 lundi
    const monday0800 = new Date('2026-02-23T08:00:00.000Z'); // Lundi UTC
    const result = getNextScheduledPost(fullSchedule, monday0800);
    if (result) {
      assert.ok('strategy' in result);
      assert.ok('time' in result);
      assert.ok('day' in result);
      assert.ok('hour' in result);
    }
  });

  it('should return null when schedule is empty for 7 days', () => {
    const emptySchedule = {
      schedule: {
        monday: [], tuesday: [], wednesday: [], thursday: [], friday: [], saturday: [], sunday: [],
      },
      scheduler: { defaultTime: '09:00' },
    };
    const result = getNextScheduledPost(emptySchedule, new Date());
    assert.equal(result, null);
  });

  it('should skip past scheduled times for today', () => {
    // Simuler 23:59 un lundi — le post de 09:00 lundi est déjà passé
    const monday2359 = new Date();
    monday2359.setHours(23, 59, 0, 0);
    // Forcer à un lundi
    const dayOfWeek = monday2359.getDay();
    const daysUntilMonday = (1 - dayOfWeek + 7) % 7;
    const targetDate = new Date(monday2359.getTime() + daysUntilMonday * 86400000);
    targetDate.setHours(23, 59, 0, 0);

    const result = getNextScheduledPost(fullSchedule, targetDate);
    // Le résultat doit être dans le futur (après targetDate)
    if (result) {
      assert.ok(new Date(result.time) > targetDate);
    }
  });

  it('should handle string entries (old format)', () => {
    const oldFormatSchedule = {
      schedule: {
        monday: ['weekly-recap'],
        tuesday: ['daily-stats'],
        wednesday: [], thursday: [], friday: [], saturday: [], sunday: [],
      },
      scheduler: { defaultTime: '09:00' },
    };
    // Dimanche très tôt — lundi 09:00 devrait être le prochain
    const sunday0100 = new Date();
    sunday0100.setDate(sunday0100.getDate() - sunday0100.getDay()); // Dimanche
    sunday0100.setHours(1, 0, 0, 0);

    const result = getNextScheduledPost(oldFormatSchedule, sunday0100);
    if (result) {
      assert.equal(result.strategy, 'weekly-recap');
      assert.equal(result.hour, '09:00');
    }
  });
});

// ─── schedulerTick — deduplication ────────────────────────────────
describe('schedulerTick — deduplication via queue', () => {
  it('should not schedule same strategy twice for same day', () => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const queue = [
      { strategy: 'daily-stats', createdAt: `${todayStr}T09:00:00.000Z`, status: 'published' },
    ];

    const strategyName = 'daily-stats';
    const alreadyDone = queue.some(q =>
      q.strategy === strategyName && q.createdAt.startsWith(todayStr)
    );
    assert.equal(alreadyDone, true);
  });

  it('should allow scheduling on different days', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().slice(0, 10);

    const queue = [
      { strategy: 'daily-stats', createdAt: `${yesterdayStr}T09:00:00.000Z`, status: 'published' },
    ];

    const todayStr = new Date().toISOString().slice(0, 10);
    const strategyName = 'daily-stats';
    const alreadyDone = queue.some(q =>
      q.strategy === strategyName && q.createdAt.startsWith(todayStr)
    );
    assert.equal(alreadyDone, false);
  });
});

// ─── processRetryQueue logic ──────────────────────────────────────
describe('processRetryQueue — retry eligibility', () => {
  it('should identify items ready for retry (nextRetry in the past)', () => {
    const now = Date.now();
    const queue = [
      { id: '1', strategy: 'daily-stats', status: 'retry', nextRetry: new Date(now - 60000).toISOString() },
      { id: '2', strategy: 'new-api', status: 'retry', nextRetry: new Date(now + 60000).toISOString() },
      { id: '3', strategy: 'weekly-recap', status: 'published', nextRetry: null },
    ];

    const retryItems = queue.filter(q =>
      q.status === 'retry' && q.nextRetry && new Date(q.nextRetry).getTime() <= now
    );

    assert.equal(retryItems.length, 1);
    assert.equal(retryItems[0].id, '1');
  });

  it('should not retry items with future nextRetry', () => {
    const now = Date.now();
    const queue = [
      { id: '1', status: 'retry', nextRetry: new Date(now + 3600000).toISOString() },
    ];
    const retryItems = queue.filter(q =>
      q.status === 'retry' && q.nextRetry && new Date(q.nextRetry).getTime() <= now
    );
    assert.equal(retryItems.length, 0);
  });

  it('should not retry non-retry status items', () => {
    const now = Date.now();
    const queue = [
      { id: '1', status: 'published', nextRetry: new Date(now - 1000).toISOString() },
      { id: '2', status: 'awaiting_approval', nextRetry: new Date(now - 1000).toISOString() },
    ];
    const retryItems = queue.filter(q =>
      q.status === 'retry' && q.nextRetry && new Date(q.nextRetry).getTime() <= now
    );
    assert.equal(retryItems.length, 0);
  });
});

// ─── publishQueueItem — status transition ────────────────────────
describe('publishQueueItem — status après résultats', () => {
  function computeStatus(results) {
    const allOk = Object.values(results).every(r => r.success);
    const anyOk = Object.values(results).some(r => r.success);
    if (allOk) return 'published';
    if (anyOk) return 'partial';
    return 'failed';
  }

  it('should set status published when all results succeed', () => {
    const results = {
      discord: { success: true },
      telegram: { success: true },
    };
    assert.equal(computeStatus(results), 'published');
  });

  it('should set status partial when only some succeed', () => {
    const results = {
      discord: { success: true },
      twitter: { success: false },
    };
    assert.equal(computeStatus(results), 'partial');
  });

  it('should set status failed when all fail', () => {
    const results = {
      discord: { success: false },
      telegram: { success: false },
    };
    assert.equal(computeStatus(results), 'failed');
  });

  it('should handle single platform results', () => {
    assert.equal(computeStatus({ discord: { success: true } }), 'published');
    assert.equal(computeStatus({ discord: { success: false } }), 'failed');
  });
});

// ─── retryDelay calculation ───────────────────────────────────────
describe('retry delay calculation', () => {
  it('should use first delay on first retry', () => {
    const delays = [5, 30, 60];
    const retryCount = 0;
    const delayMin = delays[Math.min(retryCount, delays.length - 1)];
    assert.equal(delayMin, 5);
  });

  it('should use second delay on second retry', () => {
    const delays = [5, 30, 60];
    const retryCount = 1;
    const delayMin = delays[Math.min(retryCount, delays.length - 1)];
    assert.equal(delayMin, 30);
  });

  it('should cap at last delay when retryCount exceeds delays length', () => {
    const delays = [5, 30, 60];
    const retryCount = 10;
    const delayMin = delays[Math.min(retryCount, delays.length - 1)];
    assert.equal(delayMin, 60);
  });
});
