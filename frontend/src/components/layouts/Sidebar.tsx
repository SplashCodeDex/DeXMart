"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  Bot,
  MessageSquare,
  Users,
  Settings,
  CreditCard,
  LogOut,
  Menu,
  ChevronLeft,
  Zap,
  LayoutGrid,
  Layout,
  Send,
  History,
  Activity,
  Clock,
  Monitor,
  ScrollText,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import React from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/features/auth";
import { BOUNCY_SPRING, BOUNCY_BEZIER_STRING } from "@/lib/animations";
import { cn } from "@/lib/utils";
import { useUIStore } from "@/stores/useUIStore";
import { InsightCard } from "./InsightCard";

const NAV_ITEMS = [
  { title: "Overview", href: "/dashboard", icon: LayoutDashboard, type: "messages" as const },
  { title: "Chat", href: "/dashboard/chat", icon: MessageSquare, type: "messages" as const },
  {
    title: "Channels",
    href: "/dashboard/omnichannel",
    icon: LayoutGrid,
    type: "messages" as const,
  },
  {
    title: "Messages",
    href: "/dashboard/messages",
    icon: MessageSquare,
    type: "messages" as const,
  },
  { title: "Templates", href: "/dashboard/templates", icon: Layout, type: "messages" as const },
  { title: "Flows", href: "/dashboard/flows", icon: Zap, type: "messages" as const },
  { title: "Contacts", href: "/dashboard/contacts", icon: Users, type: "contacts" as const },
  { title: "Agents", href: "/dashboard/agents", icon: Bot, type: "agents" as const },
  { title: "Skills Store", href: "/dashboard/skills", icon: Send, type: "agents" as const },
  { title: "Cron Jobs", href: "/dashboard/cron", icon: Clock, type: "agents" as const },
  { title: "Webhooks", href: "/dashboard/webhooks", icon: Zap, type: "settings" as const },
  { title: "Sessions", href: "/dashboard/sessions", icon: History, type: "messages" as const },
  { title: "Usage", href: "/dashboard/usage", icon: Activity, type: "billing" as const },
  { title: "Nodes", href: "/dashboard/nodes", icon: Monitor, type: "agents" as const },
  { title: "Billing", href: "/dashboard/billing", icon: CreditCard, type: "billing" as const },
  { title: "Config", href: "/dashboard/config", icon: Settings, type: "settings" as const },
  { title: "System Logs", href: "/dashboard/logs", icon: ScrollText, type: "settings" as const },
];

export function Sidebar(): React.JSX.Element {
  const pathname = usePathname();
  const { signOut } = useAuth();
  const { isSidebarCollapsed, setSidebarCollapsed } = useUIStore();

  function NavContent(isMobile = false): React.JSX.Element {
    return (
      <TooltipProvider delayDuration={0}>
        <ScrollArea showFades={!isMobile} viewportClassName="px-3 pt-4 pb-8">
          <div className="space-y-1">
            <ul className="space-y-1">
              {NAV_ITEMS.map((item) => {
                const isActive =
                  item.href === "/dashboard"
                    ? pathname === "/dashboard"
                    : pathname === item.href || pathname.startsWith(`${item.href}/`);

                return (
                  <li key={item.href} className="relative">
                    <Tooltip {...(!isSidebarCollapsed || isMobile ? { open: false } : {})}>
                      <TooltipTrigger asChild>
                        <Link
                          href={item.href}
                          className={cn(
                            "group relative flex h-11 items-center rounded-2xl px-3 transition-all duration-200 nav-item-liquid",
                            isSidebarCollapsed && !isMobile && "justify-center px-0",
                            isActive
                              ? "bg-primary/10 text-primary ring-1 ring-primary/20"
                              : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                          )}
                        >
                          <div
                            className={cn(
                              "flex items-center",
                              !isSidebarCollapsed || isMobile ? "w-full" : "justify-center",
                            )}
                          >
                            <item.icon
                              className={cn(
                                "h-5 w-5 shrink-0",
                                isActive
                                  ? "text-primary"
                                  : "text-muted-foreground group-hover:text-foreground",
                              )}
                            />
                            <AnimatePresence mode="wait">
                              {!isSidebarCollapsed || isMobile ? (
                                <motion.span
                                  initial={{ opacity: 0, x: -10, width: 0 }}
                                  animate={{ opacity: 1, x: 0, width: "auto" }}
                                  exit={{ opacity: 0, x: -10, width: 0 }}
                                  transition={BOUNCY_SPRING}
                                  className="ml-3 font-medium text-sm whitespace-nowrap overflow-hidden"
                                >
                                  {item.title}
                                </motion.span>
                              ) : null}
                            </AnimatePresence>
                          </div>
                        </Link>
                      </TooltipTrigger>
                      <TooltipContent
                        side="right"
                        sideOffset={20}
                        className="p-3 bg-card border-border shadow-xl rounded-xl min-w-56 text-foreground"
                      >
                        <InsightCard type={item.type} />
                      </TooltipContent>
                    </Tooltip>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="mt-auto px-4 py-4 md:hidden">
            <Button
              variant="ghost"
              className="w-full justify-start text-muted-foreground hover:bg-destructive/10 hover:text-destructive rounded-lg"
              onClick={() => signOut()}
            >
              <LogOut className="mr-2 h-4 w-4" />
              <span>Sign Out</span>
            </Button>
          </div>
        </ScrollArea>
      </TooltipProvider>
    );
  }

  return (
    <>
      {/* Mobile Navigation */}
      <div className="fixed top-4 left-4 z-50 lg:hidden">
        <Sheet>
          <SheetTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="h-10 w-10 border border-border/50 rounded-xl bg-background shadow-md hover:bg-muted"
            >
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent
            side="left"
            className="w-[85vw] max-w-80 p-0 border-r border-border bg-background shadow-2xl text-foreground"
          >
            <SheetHeader className="p-6 pb-4 border-b border-border">
              <SheetTitle className="flex items-center gap-2">
                <Image
                  src="/assets/logos/logo.png"
                  alt=""
                  width={32}
                  height={32}
                  className="h-8 w-8 object-contain"
                />
                <Image
                  src="/assets/logos/Dexmart-no-logo-no-bg.png"
                  alt="DeXMart"
                  width={100}
                  height={24}
                  style={{ width: "auto", height: "auto" }}
                  className="h-6 w-auto object-contain dark:invert"
                />
              </SheetTitle>
            </SheetHeader>
            {NavContent(true)}
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop Sidebar */}
      <motion.aside
        initial={false}
        animate={{
          width: isSidebarCollapsed ? 72 : 256,
        }}
        transition={BOUNCY_SPRING}
        className={cn(
          "fixed left-4 top-4 z-40 hidden h-[calc(100vh-2rem)] lg:block rounded-[1.5rem]",
        )}
        style={{ transitionTimingFunction: BOUNCY_BEZIER_STRING }}
      >
        <div
          className="liquidGlass-wrapper h-full w-full sidebar-liquid rounded-[1.5rem]"
          style={{ transitionTimingFunction: BOUNCY_BEZIER_STRING }}
        >
          <div className="liquidGlass-effect" />
          <div className="liquidGlass-tint" />
          <div className="liquidGlass-shine" />

          <div className="liquidGlass-content flex h-full flex-col">
            <div
              className={cn(
                "flex h-20 items-center justify-between shrink-0 transition-all duration-300 z-10",
                isSidebarCollapsed ? "px-2 justify-center" : "px-6",
              )}
              style={{ transitionTimingFunction: BOUNCY_BEZIER_STRING }}
            >
              <Link href="/dashboard" className="flex items-center overflow-hidden">
                <AnimatePresence mode="wait">
                  {isSidebarCollapsed ? (
                    <motion.div
                      key="collapsed-logo"
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      transition={BOUNCY_SPRING}
                      className="flex h-10 w-10 items-center justify-center p-0.5"
                    >
                      <Image
                        src="/assets/logos/logo.png"
                        alt="DeXMart"
                        width={36}
                        height={36}
                        className="h-full w-full object-contain"
                        priority
                      />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="expanded-logo"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      transition={BOUNCY_SPRING}
                      className="shrink-0 py-1"
                    >
                      <Image
                        src="/assets/logos/Dexmart-no-logo-no-bg.png"
                        alt="DeXMart"
                        width={110}
                        height={28}
                        style={{ width: "auto", height: "auto" }}
                        className="h-7 w-auto object-contain dark:invert"
                        priority
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </Link>

              {!isSidebarCollapsed && (
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "h-10 w-10 rounded-full bg-background/30 backdrop-blur-sm hover:bg-muted text-muted-foreground shadow-md transition-all duration-300",
                  )}
                  onClick={() => setSidebarCollapsed(true)}
                >
                  <ChevronLeft className="h-5 w-5" />
                </Button>
              )}
            </div>

            <div className="flex-1 flex flex-col min-h-0 overflow-hidden z-10">
              {NavContent(false)}
            </div>
          </div>
        </div>
      </motion.aside>
    </>
  );
}
