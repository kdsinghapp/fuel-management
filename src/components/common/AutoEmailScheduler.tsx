// src/components/common/AutoEmailScheduler.tsx
'use client';

import { useEffect, useRef } from 'react';
import { useScheduleStore } from '@/services/scheduleStore';
import { getPGTTimeString } from '@/lib/pgtTime';

export function AutoEmailScheduler() {
  const fetchSchedules = useScheduleStore((state) => state.fetchSchedules);
  const lastCheckedMinute = useRef<string>('');

  useEffect(() => {
    // Initial fetch of schedules
    fetchSchedules();

    // Scheduler tick every 10 seconds to ensure prompt minute detection
    const interval = setInterval(async () => {
      // Calculate current time in Papua New Guinea Time (PGT, UTC+10)
      const currentMinute = getPGTTimeString();

      // Avoid triggering multiple times in the same minute
      if (lastCheckedMinute.current === currentMinute) {
        return;
      }
      lastCheckedMinute.current = currentMinute;

      try {
        // Trigger cron endpoint with clientTime parameter
        const res = await fetch(`/api/cron/send-scheduled-reports?clientTime=${encodeURIComponent(currentMinute)}`);
        const data = await res.json();
        if (data && data.processedCount > 0) {
          // If any schedule ran, refresh the schedules list to update 'Last run' timestamp
          fetchSchedules();
        }
      } catch (err) {
        console.error('[AutoEmailScheduler] Cron check error:', err);
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [fetchSchedules]);

  return null;
}
