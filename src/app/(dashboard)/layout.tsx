// src/app/(dashboard)/layout.tsx
'use client';

import { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { useClientStore } from '@/services/api';
import { Fuel } from 'lucide-react';

export default function DashboardLayout({
    children,
}: {
    children: ReactNode;
}) {
    const pathname = usePathname();
    const { selectedClient, isClientLoading } = useClientStore();

    return (
        <div className="flex min-h-screen">
            <Sidebar />
            <div className="flex-1 flex flex-col min-w-0">
                <Header />
                <main className="flex-1 flex flex-col min-w-0 relative">
                    {children}

                    {/* Backdrop blur & loader on client switch */}
                    {isClientLoading && (
                        <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/45 dark:bg-black/50 backdrop-blur-md transition-all duration-300">
                            <div className="bg-white/95 dark:bg-zinc-900/95 border border-zinc-200/90 dark:border-zinc-800 shadow-2xl rounded-2xl p-6 sm:p-8 flex flex-col items-center gap-3.5 max-w-sm mx-4 text-center transform animate-in fade-in zoom-in-95 duration-200 sticky top-1/3">
                                <div className="relative flex items-center justify-center">
                                    <div className="h-14 w-14 rounded-full border-4 border-orange-100 dark:border-orange-950 border-t-[#f26522] animate-spin" />
                                    <div className="absolute h-8 w-8 rounded-full bg-[#f26522]/10 flex items-center justify-center">
                                        <Fuel className="h-4 w-4 text-[#f26522] animate-pulse" />
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
                                        Switching Client
                                    </h3>
                                    <p className="text-xs text-[#f26522] font-extrabold truncate max-w-[220px]">
                                        {selectedClient?.name || 'Selected Client'}
                                    </p>
                                    <p className="text-[11px] text-zinc-500 font-medium pt-0.5">
                                        Loading real-time data & records...
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
}