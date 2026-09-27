import { useEffect, useRef, useState } from 'react';
import {
  applyDeliveryEnvelope,
  emptyDeliveryCursor,
  setDeliveryOutputSuppressed,
  type DeliveryCursor,
  type DeliveryEnvelope,
} from '../utils/agentRuntimeDelivery.ts';

// Main rejects non-increasing request IDs per renderer; a time seed survives reloads.
let deliveryRequestSequence = Date.now();
const nextDeliveryRequestId = () => ++deliveryRequestSequence;
// Delivery is an optional projection: an unavailable or older main process degrades to no live text.
const settle = <T,>(promise: Promise<T> | undefined): Promise<T | undefined> => promise ? promise.catch(() => undefined) : Promise.resolve(undefined);

/**
 * The supervisor's single subscription to the bounded main-process projection for one
 * binding. It stays alive while supervision is hidden so control/attention state keeps
 * flowing; hiding only drops model text. Neither hiding nor unsubscribing cancels or
 * closes the runtime session.
 */
export function useAgentRuntimeDelivery(bindingId: string | undefined, visible: boolean) {
  const [cursor, setCursor] = useState<DeliveryCursor>(() => emptyDeliveryCursor());
  const subscriptionRef = useRef<string | null>(null);
  const cursorRef = useRef<DeliveryCursor>(cursor);
  const installRef = useRef<((envelope: DeliveryEnvelope) => void) | null>(null);
  const visibleRef = useRef(visible);
  visibleRef.current = visible;

  const commit = (next: DeliveryCursor) => {
    if (next === cursorRef.current) return;
    cursorRef.current = next;
    setCursor(next);
  };

  useEffect(() => {
    const sessions = window.electron?.agentRuntime?.sessions;
    if (!bindingId || !sessions?.subscribeDelivery || !sessions.onDelivery) {
      commit(emptyDeliveryCursor());
      return;
    }
    let disposed = false;
    let snapshotInFlight = false;
    commit(emptyDeliveryCursor(bindingId, null, !visibleRef.current));
    // Envelopes racing the subscribe response: keep only the newest per lane.
    const buffered = new Map<string, DeliveryEnvelope>();

    const install = (envelope: DeliveryEnvelope) => {
      const result = applyDeliveryEnvelope(cursorRef.current, envelope);
      commit(result.cursor);
      const subscriptionId = cursorRef.current.subscriptionId;
      if (result.acknowledge !== null && subscriptionId) {
        void settle(sessions.ackDelivery?.({ subscriptionId, version: result.acknowledge }));
      }
      if (result.needsSnapshot) requestSnapshot();
    };
    // Recovery is one bounded snapshot read per binding, never a replay of history.
    const requestSnapshot = () => {
      const subscriptionId = cursorRef.current.subscriptionId;
      if (snapshotInFlight || !subscriptionId || !sessions.getDeliverySnapshot) return;
      snapshotInFlight = true;
      void settle(sessions.getDeliverySnapshot({ subscriptionId, requestId: nextDeliveryRequestId() }))
        .then(result => { if (!disposed && result?.ok && result.snapshot) install(result.snapshot); })
        .finally(() => { snapshotInFlight = false; });
    };

    installRef.current = install;
    const unsubscribeListener = sessions.onDelivery((envelope) => {
      if (disposed || envelope?.bindingId !== bindingId) return;
      if (!cursorRef.current.subscriptionId) {
        buffered.set(envelope.kind === 'output' ? 'output' : 'control', envelope);
        return;
      }
      install(envelope);
    });

    void settle(sessions.subscribeDelivery({ bindingId, visible: visibleRef.current, requestId: nextDeliveryRequestId() })).then(result => {
      if (!result?.ok) return;
      if (disposed) {
        void settle(sessions.unsubscribeDelivery?.({ subscriptionId: result.subscriptionId }));
        return;
      }
      subscriptionRef.current = result.subscriptionId;
      commit(emptyDeliveryCursor(bindingId, result.subscriptionId, !visibleRef.current));
      if (result.snapshot) install(result.snapshot);
      for (const envelope of buffered.values()) install(envelope);
      buffered.clear();
    });

    return () => {
      disposed = true;
      installRef.current = null;
      unsubscribeListener();
      const subscriptionId = subscriptionRef.current;
      subscriptionRef.current = null;
      if (subscriptionId) void settle(sessions.unsubscribeDelivery?.({ subscriptionId }));
      commit(emptyDeliveryCursor());
    };
  }, [bindingId]);

  useEffect(() => {
    // Suppress locally first so hidden supervision stops retaining text even before main replies.
    commit(setDeliveryOutputSuppressed(cursorRef.current, !visible));
    const subscriptionId = subscriptionRef.current;
    const sessions = window.electron?.agentRuntime?.sessions;
    if (!subscriptionId || !sessions?.setDeliveryVisibility) return;
    void settle(sessions.setDeliveryVisibility({ subscriptionId, visible, requestId: nextDeliveryRequestId() })).then(result => {
      // Reopen installs exactly one current snapshot, then bursts resume.
      if (result?.ok && 'snapshot' in result && result.snapshot && subscriptionRef.current === subscriptionId) installRef.current?.(result.snapshot);
    });
  }, [visible]);

  // Derived at render so hidden supervision never returns text, even before the suppression effect commits.
  return { bindingId: cursor.bindingId, control: cursor.control, output: visible ? cursor.output : null };
}
