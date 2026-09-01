// src/hooks/useSidebar.ts
'use client';

import { useEffect } from 'react';
import { create } from 'zustand';

interface SidebarStore {
  isOpen: boolean;
  isMobile: boolean;
  toggle: () => void;
  setOpen: (open: boolean) => void;
  setMobile: (isMobile: boolean) => void;
}

export const useSidebar = create<SidebarStore>((set) => ({
  isOpen: true,
  isMobile: false,
  toggle: () => set((state) => ({ isOpen: !state.isOpen })),
  setOpen: (isOpen) => set({ isOpen }),
  setMobile: (isMobile) => set({ isMobile }),
}));

// Hook to detect mobile viewport
export function useMobileDetection() {
  const setMobile = useSidebar((state) => state.setMobile);
  
  useEffect(() => {
    const checkMobile = () => {
      setMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, [setMobile]);
}