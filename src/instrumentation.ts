// src/instrumentation.ts
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startServerSideCronRunner } = await import('@/lib/serverCronRunner');
    startServerSideCronRunner();
  }
}
