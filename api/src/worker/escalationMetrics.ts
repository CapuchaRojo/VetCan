export type EscalationCounters = {
  attempted: number;
  delivered: number;
  failed: number;
  skippedBreaker: number;
  skippedBackoff: number;
  skippedNonePending: number;
};

export const escalationMetrics: { counters: EscalationCounters } = {
  counters: {
    attempted: 0,
    delivered: 0,
    failed: 0,
    skippedBreaker: 0,
    skippedBackoff: 0,
    skippedNonePending: 0,
  },
};
