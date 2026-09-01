
'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight, Home } from 'lucide-react';
import { cn } from '@/lib/utils';

const routeNames: Record<string, string> = {
    'dashboard': 'Dashboard',
    'fuel-levels': 'Fuel Levels',
    'deliveries': 'Deliveries',
    'fuel-issues': 'Fuel Issues',
    'vehicles': 'Vehicles',
    'reconciliation': 'Reconciliation',
    'reports': 'Reports',
    'admin': 'Administration',
    'users': 'Users',
    'roles': 'Roles',
};

export function Breadcrumbs() {
    const pathname = usePathname();
    const segments = pathname?.split('/').filter(Boolean) || [];

    return (
        <nav className="flex items-center space-x-1.5 text-xs sm:text-sm font-medium text-slate-300">
            <Link
                href="/dashboard"
                className="flex items-center hover:text-primary transition-colors duration-200"
            >
                <Home className="h-4 w-4 text-slate-400 hover:text-primary" />
            </Link>
            {segments.map((segment, index) => {
                const href = '/' + segments.slice(0, index + 1).join('/');
                const isLast = index === segments.length - 1;
                const name = routeNames[segment] || segment.charAt(0).toUpperCase() + segment.slice(1);

                return (
                    <div key={href} className="flex items-center">
                        <ChevronRight className="h-3.5 w-3.5 mx-1 text-slate-500" />
                        {isLast ? (
                            <span className="text-white font-semibold">{name}</span>
                        ) : (
                            <Link href={href} className="hover:text-primary transition-colors duration-200">
                                {name}
                            </Link>
                        )}
                    </div>
                );
            })}
        </nav>
    );
}