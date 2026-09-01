// src/components/layout/PageContainer.tsx
import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface PageContainerProps {
    children: ReactNode;
    className?: string;
}

export function PageContainer({ children, className }: PageContainerProps) {
    return (
        <div className={cn('flex-1 flex flex-col space-y-4 p-4 md:p-6 pt-4', className)}>
            {children}
        </div>
    );
}