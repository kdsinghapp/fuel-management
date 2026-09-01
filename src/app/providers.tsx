// src/app/providers.tsx
'use client';

import { ReactNode } from 'react';
import { useMobileDetection } from '@/hooks/useSidebar';

export function Providers({ children }: { children: ReactNode }) {
    useMobileDetection();
    return <>{children}</>;
}