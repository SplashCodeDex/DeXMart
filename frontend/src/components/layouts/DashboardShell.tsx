"use client";

import { useEffect, useRef } from "react";
import React from "react";
import { cn } from "@/lib/utils";
import { useAuthorityStore } from "@/stores/useAuthorityStore";
import { useUIStore } from "@/stores/useUIStore";
import { ConnectionStatus } from "../shared/ConnectionStatus";
import { ScrollArea } from "../ui/scroll-area";
import { ScrollToTop } from "../ui/ScrollToTop";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";

export function DashboardShell({ children }: { children: React.ReactNode }): React.JSX.Element {
  const { isSidebarCollapsed } = useUIStore();
  const { fetchCapabilities } = useAuthorityStore();
  const hasFetched = useRef(false);

  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;
    fetchCapabilities();
  }, [fetchCapabilities]);

  return (
    <div className="flex h-screen bg-mesh-premium text-foreground overflow-hidden relative">
      {/* Premium Mesh Background handles the ambient tints (top-left, top-mid, top-right, bottom-right) */}

      <Sidebar />
      <main
        id="main-content"
        className={cn(
          "flex flex-1 flex-col w-full h-full transition-all duration-300 ease-in-out",
          "lg:ml-[256px] lg:w-[calc(100%-256px)]",
          isSidebarCollapsed && "lg:ml-[72px] lg:w-[calc(100%-72px)]",
        )}
      >
        <ConnectionStatus />
        <Header />
        <ScrollArea viewportClassName="p-6 md:p-8">
          <div className="mx-auto max-w-7xl animate-fade-in space-y-6 pb-24">{children}</div>
        </ScrollArea>
        <ScrollToTop />
      </main>
    </div>
  );
}
