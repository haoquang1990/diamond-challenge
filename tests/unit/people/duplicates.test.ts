/**
 * Duplicate contacts (story 026): detection, merge, split, offline merges and the rule that a
 * merge never changes anyone's XP, streak, stage or earned milestones. Fixed data only.
 */
import { expect, it } from 'vitest';
import { derivePeople } from '../../../src/domain/people';
import { findDuplicatePairs, pendingDuplicates, planMerge, planMergeAll, buildMergeEvent, buildSplitEvents, buildNotDuplicateEvent } from '../../../src/domain/duplicates';
import { computeProgress } from '../../../src/domain/progress';
import { computeStageProgress } from '../../../src/domain/stages';
import { PEOPLE_CONFIG } from '../../../src/ui/people-config';
import { buildAchievementRows } from '../../../src/ui/achievements-helpers';
import { ACHIEVEMENTS_CONFIG } from '../../../src/ui/achievements-overlay';
import { evaluateAchievements, buildSilentAcknowledgeEvents, readAcknowledged } from '../../../src/domain/achievements';
import { DEFAULT_STAGES } from '../../../src/ui/screens/diamond-path-screen';
let n = 0;
const mk = (type: string, ts: string, userId: string, payload: Record<string, unknown>) => ({ id: `e${++n}`, type, timestamp: ts, userId, schemaVersion: 1, payload, syncedAt: null }) as never;
const task = (pid: string, taskId: string, xp: number, ts: string, u: string) => mk('activity_logged', ts, u, { personId: pid, taskId, activityType: taskId, xp });
const phone = { country: '+84', number: '912345678' };
const base = () => {
  n = 0;
  return [
    mk('person_added', '2026-11-01T01:00:00.000Z', 'lan', { personId: 'a', name: 'Nguyễn Văn An', phone, amwayCode: '7004053634', note: 'ghi chú Lan' }),
    task('a', 'contact', 5, '2026-11-01T02:00:00.000Z', 'lan'),
    task('a', 'new_customer', 30, '2026-11-02T02:00:00.000Z', 'lan'),
    mk('person_added', '2026-11-03T01:00:00.000Z', 'minh', { personId: 'b', name: 'nguyen van an', phone: { country: '+84', number: '0912345678' }, note: 'ghi chú Minh' }),
    task('b', 'contact', 5, '2026-11-03T02:00:00.000Z', 'minh'),
    task('b', 'new_npp', 50, '2026-11-04T02:00:00.000Z', 'minh'),
    mk('person_added', '2026-11-04T05:00:00.000Z', 'lan', { personId: 'c', name: 'Nguyen Van Ann' }),
    mk('person_added', '2026-11-04T06:00:00.000Z', 'lan', { personId: 'd', name: 'Trần Bình', amwayCode: '1111111' }),
    mk('person_added', '2026-11-04T07:00:00.000Z', 'minh', { personId: 'e', name: 'Tran Binh', amwayCode: '2222222' }),
  ];
};
const now = new Date('2026-11-05T03:00:00.000Z');
const snap = (ev: never[], others: Set<string>) => {
  const p = computeProgress(ev, now, { dailyXpGoal: 30 }, 'Asia/Ho_Chi_Minh', others);
  const st = computeStageProgress(ev, p.totalXp, DEFAULT_STAGES, others);
  const rows = buildAchievementRows(ev, ACHIEVEMENTS_CONFIG, now, 'Asia/Ho_Chi_Minh', { stages: DEFAULT_STAGES, people: PEOPLE_CONFIG, progress: { dailyXpGoal: 30 }, others } as never);
  return { xp: p.totalXp, streak: p.streak, today: p.xpToday, stage: JSON.stringify(st), earned: rows.filter((r) => r.earned).map((r) => r.id) };
};

it('detects certain and possible pairs', () => {
  const ev = base();
  const pairs = findDuplicatePairs(derivePeople(ev, PEOPLE_CONFIG), ev, PEOPLE_CONFIG);
  const byKey = Object.fromEntries(pairs.map((p) => [p.first.personId + p.second.personId, [p.strength, p.reasons.join(',')]]));
  expect(byKey.ab?.[0]).toBe('certain');
  expect(byKey.ac?.[0]).toBe('possible');
  expect(byKey.de?.[0]).toBe('possible');
  // merge all only merges certain without code conflict
  expect(planMergeAll(pairs).map((x) => x.pair.key)).toEqual([pairs.find((p) => p.first.personId === 'a' && p.second.personId === 'b')!.key]);
});

it('XP, streak, stage and earned milestones are the same before, after merge and after split, for both members', () => {
  const raw = base();
  const ackFor = (u: string, o: Set<string>) => buildSilentAcknowledgeEvents(evaluateAchievements(raw, ACHIEVEMENTS_CONFIG, now, 'Asia/Ho_Chi_Minh', { stages: DEFAULT_STAGES, people: PEOPLE_CONFIG, progress: { dailyXpGoal: 30 }, others: o } as never), readAcknowledged(raw, DEFAULT_STAGES).ids).map((e) => mk(e.type, '2026-11-04T23:00:00.000Z', u, e.payload as never));
  const ev = [...raw, ...ackFor('lan', new Set(['minh']))];
  const before = { lan: snap(ev, new Set(['minh'])), minh: snap(ev, new Set(['lan'])) };
  const people = derivePeople(ev, PEOPLE_CONFIG);
  const plan = planMerge(people.find((p) => p.personId === 'a')!, people.find((p) => p.personId === 'b')!);
  if (!plan.ok) throw new Error('plan');
  const r = buildMergeEvent(plan);
  if (!r.ok) throw new Error('merge');
  const m = mk(r.event.type, '2026-11-05T01:00:00.000Z', 'lan', r.event.payload as never);
  const merged = [...ev, m];
  const after = { lan: snap(merged, new Set(['minh'])), minh: snap(merged, new Set(['lan'])) };
  expect(after).toEqual(before);
  const mp = derivePeople(merged, PEOPLE_CONFIG);
  const a = mp.find((p) => p.personId === 'a')!;
  expect(a.label).toBe('NPP');
  expect([...(a.doneTaskIds ?? [])].sort()).toEqual(['contact', 'new_customer', 'new_npp']);
  expect(a.note).toBe('ghi chú Lan\n\nghi chú Minh');
  expect(a.amwayCode).toBe('7004053634');
  expect(mp.some((p) => p.personId === 'b')).toBe(false);
  expect(pendingDuplicates(mp, merged, PEOPLE_CONFIG)).toBeLessThan(pendingDuplicates(people, ev, PEOPLE_CONFIG));
  const split = buildSplitEvents((m as { id: string }).id, 'a', 'b').map((e) => mk(e.type, '2026-11-05T02:00:00.000Z', 'minh', e.payload as never));
  const back = [...merged, ...split];
  expect({ lan: snap(back, new Set(['minh'])), minh: snap(back, new Set(['lan'])) }).toEqual(before);
  const bp = derivePeople(back, PEOPLE_CONFIG);
  const orig = derivePeople(ev, PEOPLE_CONFIG);
  for (const id of ['a', 'b']) {
    const x = bp.find((p) => p.personId === id)!; const y = orig.find((p) => p.personId === id)!;
    expect([x.label, [...(x.doneTaskIds??[])].sort(), x.note, x.amwayCode]).toEqual([y.label, [...(y.doneTaskIds??[])].sort(), y.note, y.amwayCode]);
  }
  expect(findDuplicatePairs(bp, back, PEOPLE_CONFIG).some((p) => p.key === findDuplicatePairs(orig, ev, PEOPLE_CONFIG).find((q) => q.first.personId === 'a' && q.second.personId === 'b')!.key)).toBe(false);
});

it('code conflict requires a choice; same merge twice = once; later not-duplicate wins', () => {
  const ev = base();
  const people = derivePeople(ev, PEOPLE_CONFIG);
  const plan = planMerge(people.find((p) => p.personId === 'd')!, people.find((p) => p.personId === 'e')!);
  if (!plan.ok) throw new Error();
  expect(buildMergeEvent(plan)).toEqual({ ok: false, reason: 'code_choice_required' });
  const r = buildMergeEvent(plan, '2222222'); if (!r.ok) throw new Error();
  const m1 = mk('person_merged', '2026-11-05T01:00:00.000Z', 'lan', r.event.payload as never);
  const m2 = mk('person_merged', '2026-11-05T01:01:00.000Z', 'minh', r.event.payload as never);
  const once = derivePeople([...ev, m1], PEOPLE_CONFIG);
  const twice = derivePeople([...ev, m1, m2], PEOPLE_CONFIG);
  expect(JSON.stringify(twice)).toBe(JSON.stringify(once));
  expect(once.find((p) => p.personId === 'd')!.amwayCode).toBe('2222222');
  const nd = mk('person_not_duplicate', '2026-11-05T01:05:00.000Z', 'minh', buildNotDuplicateEvent('d', 'e').payload as never);
  const later = derivePeople([...ev, m1, nd], PEOPLE_CONFIG);
  expect(later.some((p) => p.personId === 'e')).toBe(true);
  const ndEarly = mk('person_not_duplicate', '2026-11-05T00:05:00.000Z', 'minh', buildNotDuplicateEvent('d', 'e').payload as never);
  const mergeLater = derivePeople([...ev, ndEarly, m1], PEOPLE_CONFIG);
  expect(mergeLater.some((p) => p.personId === 'e')).toBe(false);
  // linked to two accounts: refused
  const l = derivePeople([...ev, mk('person_updated', '2026-11-05T00:00:00.000Z', 'lan', { personId: 'd', linkedUserId: 'u1' }), mk('person_updated', '2026-11-05T00:00:00.000Z', 'lan', { personId: 'e', linkedUserId: 'u2' })], PEOPLE_CONFIG);
  expect(planMerge(l.find((p) => p.personId === 'd')!, l.find((p) => p.personId === 'e')!)).toEqual({ ok: false, reason: 'linked_conflict' });
});
