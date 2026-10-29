import assert from 'node:assert/strict';
import test from 'node:test';
import React, { act } from 'react';
import TestRenderer from 'react-test-renderer';
import { useLocalToday } from './useLocalToday.ts';

test('today advances at local midnight and catches up after sleep, with cleanup', async () => {
  const RealDate = Date;
  let now = new RealDate(2026, 9, 28, 23, 59, 59).getTime();
  const saved = { window: globalThis.window, document: globalThis.document, Date, setTimeout, clearTimeout };
  const timers = new Map<number, { callback: () => void; delay: number }>();
  let id = 0;
  const windowEvents = new EventTarget();
  const documentEvents = new EventTarget();
  Object.assign(globalThis, {
    IS_REACT_ACT_ENVIRONMENT: true,
    window: windowEvents,
    document: documentEvents,
    Date: class extends RealDate { constructor(...args: any[]) { super(...(args.length ? args : [now]) as [number]); } },
    setTimeout: (callback: () => void, delay: number) => { timers.set(++id, { callback, delay }); return id; },
    clearTimeout: (key: number) => timers.delete(key),
  });
  let today: Date;
  function Probe() { today = useLocalToday(); return null; }
  let renderer: ReturnType<typeof TestRenderer.create>;
  try {
    await act(async () => { renderer = TestRenderer.create(React.createElement(Probe)); });
    assert.equal(today!.getDate(), 28);
    assert.equal([...timers.values()][0].delay, 1000);
    now += 1000;
    await act(async () => { [...timers.values()][0].callback(); });
    assert.equal(today!.getDate(), 29);
    now += 3 * 86400000;
    await act(async () => { windowEvents.dispatchEvent(new Event('focus')); });
    assert.equal(today!.getDate(), 1);
    now += 86400000;
    await act(async () => { documentEvents.dispatchEvent(new Event('visibilitychange')); });
    assert.equal(today!.getDate(), 2);
    await act(async () => { renderer!.unmount(); });
    assert.equal(timers.size, 0);
  } finally {
    Object.assign(globalThis, saved);
  }
});
