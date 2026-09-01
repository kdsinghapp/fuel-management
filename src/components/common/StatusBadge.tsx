// src/components/common/StatusBadge.tsx
import { cn } from '@/lib/utils';
import { getStatusColor } from '@/lib/utils';
import { Status } from '@/types/common';

interface StatusBadgeProps {
    status: string;
    className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
    return (
        <span className={cn(
            'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold shadow-xs border transition-colors duration-200 backdrop-blur-xs',
            getStatusColor(status),
            className
        )}>
            <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
            {status}
        </span>
    );
}