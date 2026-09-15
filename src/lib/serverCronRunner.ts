// src/lib/serverCronRunner.ts
import { executeScheduledReportsCron } from '@/services/cronService';

const GLOBAL_CRON_KEY = '__fuel_master_server_cron_timer__';

export function startServerSideCronRunner() {
  if (typeof window !== 'undefined') {
    return; // Only run in Node.js server environment
  }

  // Prevent multiple intervals during hot reload in development
  if ((globalThis as any)[GLOBAL_CRON_KEY]) {
    return;
  }

  console.log('[ServerCronRunner] 🚀 Initializing 24/7 background scheduled reports runner...');

  // Set interval to check every 30 seconds
  const timer = setInterval(async () => {
    try {
      await executeScheduledReportsCron();
    } catch (err) {
      console.error('[ServerCronRunner] Error during cron execution tick:', err);
    }
  }, 30000);

  (globalThis as any)[GLOBAL_CRON_KEY] = timer;

  // Run immediate initial check 5 seconds after server start
  setTimeout(async () => {
    try {
      console.log('[ServerCronRunner] Running initial check...');
      await executeScheduledReportsCron();
    } catch (err) {
      console.error('[ServerCronRunner] Initial check error:', err);
    }
  }, 5000);
}
