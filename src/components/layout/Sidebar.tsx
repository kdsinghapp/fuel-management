// src/components/layout/Sidebar.tsx
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
    LayoutDashboard,
    Fuel,
    Truck,
    FileText,
    Users,
    Settings,
    LogOut,
    Menu,
    X,
    Droplet,
    ClipboardList,
    FileBarChart,
    UserCog,
    ChevronLeft,
    ChevronRight,
    Sliders,
    RefreshCw,
    Gauge,
    Smartphone,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { authService } from '@/lib/auth';
import { useAuth } from '@/hooks/useAuth';
import { useSidebar } from '@/hooks/useSidebar';

const navigationItems = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Fuel Levels', href: '/fuel-levels', icon: Droplet },
    { name: 'Deliveries', href: '/deliveries', icon: Truck },
    { name: 'Transactions', href: '/fuel-issues', icon: FileText },
    { name: 'Fuel Efficiency', href: '/vehicles', icon: Gauge },
    { name: 'Fuel Efficiency Summary', href: '/fuel-efficiency-summary', icon: FileBarChart },
    { name: 'Fuel Limits', href: '/fuel-limits', icon: Sliders },
    { name: 'Reconciliation', href: '/reconciliation', icon: RefreshCw },
];

const adminItems = [
    { name: 'Users', href: '/admin/users', icon: Users },
    { name: 'Roles', href: '/admin/roles', icon: Smartphone },
];

export function Sidebar() {
    const pathname = usePathname();
    const { user } = useAuth();
    const { isOpen, toggle, setOpen, isMobile } = useSidebar();
    const [isCollapsed, setIsCollapsed] = useState(false);

    useEffect(() => {
        if (isMobile) {
            setOpen(false);
        } else {
            setOpen(true);
        }
    }, [isMobile, setOpen]);

    const handleLogout = async () => {
        await authService.logout();
        window.location.href = '/login';
    };

    const sidebarContent = (
        <div
            className="flex h-full flex-col text-zinc-300 border-r border-zinc-900"
            style={{ background: 'linear-gradient(180deg, #0d0000 0%, #2f1201 48%, #000000 100%)' }}
        >
            <div className={cn("flex h-18 items-center border-b border-[#f26522] transition-all duration-300", isCollapsed ? "flex-col justify-center gap-1 py-1 px-1" : "justify-between px-6")}>
                <Link href="/dashboard" className="flex items-center justify-center shrink-0">
                    <img
                        src={isCollapsed ? "/assests/imagecrop.png" : "/assests/image.png"}
                        alt="Fuel Master Logo"
                        className={cn(
                            "object-contain transition-all duration-300",
                            isCollapsed ? "h-10 w-auto" : "w-[174px] h-[45px]"
                        )}
                    />
                </Link>
                {/* {!isMobile && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setIsCollapsed(!isCollapsed)}
                        className={cn("rounded-lg hover:bg-zinc-800 text-white hover:text-white transition-all duration-300", isCollapsed ? "h-5 w-5 p-0" : "h-8 w-8 p-0")}
                    >
                        {isCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-4 w-4" />}
                    </Button>
                )} */}
                {isMobile && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setOpen(false)}
                        className="h-8 w-8 p-0 rounded-lg text-white hover:bg-zinc-800"
                    >
                        <X className="h-4 w-4" />
                    </Button>
                )}
            </div>

            <nav className="flex-1 overflow-y-auto py-3 px-0 space-y-0">
                {navigationItems.map((item) => {
                    const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`);
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={cn(
                                'flex items-center gap-3 py-[8.8px] pl-4 pr-6 text-[14px] font-bold transition-all duration-200 h-[44px] my-[3.2px] ml-[12.8px] mr-0 rounded-l-2xl rounded-r-none',
                                isActive
                                    ? 'bg-[#f26522] text-white shadow-md'
                                    : 'text-zinc-300 hover:bg-white/5 hover:text-white',
                                isCollapsed && 'justify-center px-2 mx-0 my-1 rounded-none'
                            )}
                        >
                            <item.icon className={cn("h-[18px] w-[18px] shrink-0 transition-transform duration-200", !isActive && "group-hover:scale-110")} />
                            {!isCollapsed && <span className="whitespace-nowrap">{item.name}</span>}
                        </Link>
                    );
                })}

                {user?.role === 'Administrator' && adminItems.map((item) => {
                    const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`);
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={cn(
                                'flex items-center gap-3 py-[8.8px] pl-4 pr-6 text-[14px] font-bold transition-all duration-200 h-[44px] my-[3.2px] ml-[12.8px] mr-0 rounded-l-2xl rounded-r-none',
                                item.name === 'Users' && 'mt-3',
                                isActive
                                    ? 'bg-[#f26522] text-white shadow-md'
                                    : 'text-zinc-300 hover:bg-white/5 hover:text-white',
                                isCollapsed && 'justify-center px-2 mx-0 my-1 rounded-none'
                            )}
                        >
                            <item.icon className="h-[18px] w-[18px] shrink-0" />
                            {!isCollapsed && <span className="whitespace-nowrap">{item.name}</span>}
                        </Link>
                    );
                })}
            </nav>

            <div className="border-t border-zinc-900 p-4 space-y-3 bg-black/20">
                {!isCollapsed && (
                    <div className="flex items-center gap-2.5 px-1 py-1">
                        <div className="h-9 w-9 rounded-full bg-amber-500 text-black flex items-center justify-center font-bold shrink-0 text-sm">
                            {user?.name?.charAt(0) || 'A'}
                        </div>
                        <div className="flex-1 min-w-0 leading-tight">
                            <p className="text-sm font-bold text-white truncate">{user?.name || 'Admin User'}</p>
                            <p className="text-xs text-zinc-500 font-medium truncate mt-0.5">{user?.role || 'Administrator'}</p>
                        </div>
                    </div>
                )}
                <Button
                    variant="ghost"
                    className={cn(
                        'w-full justify-start text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all duration-200',
                        isCollapsed && 'justify-center px-2'
                    )}
                    onClick={handleLogout}
                >
                    <LogOut className="h-4 w-4 shrink-0" />
                    {!isCollapsed && <span className="ml-2 font-medium">Logout</span>}
                </Button>
            </div>
        </div>
    );

    // Mobile drawer
    if (isMobile) {
        return (
            <>
                {isOpen && (
                    <div
                        className="fixed inset-0 z-50 bg-black/50"
                        onClick={() => setOpen(false)}
                    />
                )}
                <div
                    className={cn(
                        'fixed inset-y-0 left-0 z-50 w-64 transform transition-transform duration-300 ease-in-out' +
                        (isOpen ? ' translate-x-0' : ' -translate-x-full')
                    )}
                >
                    {sidebarContent}
                </div>
            </>
        );
    }

    // Desktop sidebar
    return (
        <div
            className={cn(
                'transition-all duration-300 h-screen sticky top-0 shrink-0 border-r bg-transparent border-zinc-900',
                isOpen ? 'hidden md:block' : 'hidden',
                isCollapsed ? 'w-16' : 'w-64'
            )}
        >
            {sidebarContent}
        </div>
    );
}
