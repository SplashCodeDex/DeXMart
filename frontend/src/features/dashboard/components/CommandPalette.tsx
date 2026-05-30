"use client";

import * as React from "react";
import { Search, Command as CommandIcon, Terminal, Settings, Shield, User } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useOmnichannelStore } from "@/stores/useOmnichannelStore";
import { cn } from "@/lib/utils";

interface Command {
  name: string;
  description: string;
  category?: string;
}

export function CommandPalette() {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const { commands, fetchCommands } = useOmnichannelStore();

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  React.useEffect(() => {
    if (open) {
      fetchCommands();
    }
  }, [open, fetchCommands]);

  const filteredCommands = React.useMemo(() => {
    if (!query) return commands;
    const lowerQuery = query.toLowerCase();
    return (commands as Command[]).filter(
      (cmd) =>
        cmd.name.toLowerCase().includes(lowerQuery) ||
        cmd.description.toLowerCase().includes(lowerQuery)
    );
  }, [commands, query]);

  const handleSelect = (command: Command) => {
    console.log("Selected command:", command);
    setOpen(false);
    // Execute command logic would go here
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="overflow-hidden p-0 shadow-2xl">
        <DialogTitle className="sr-only">Command Palette</DialogTitle>
        <div className="flex items-center border-b px-3">
          <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
          <Input
            placeholder="Type a command or search..."
            className="flex h-12 w-full rounded-md bg-transparent py-3 text-sm outline-none border-none ring-0 focus-visible:ring-0"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <kbd className="pointer-events-none hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
            <span className="text-xs">ESC</span>
          </kbd>
        </div>
        <ScrollArea className="max-h-[300px] overflow-y-auto p-2">
          {filteredCommands.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              No commands found.
            </div>
          ) : (
            <div className="space-y-1">
              {filteredCommands.map((cmd) => (
                <button
                  key={cmd.name}
                  className="flex w-full items-center gap-2 rounded-sm px-2 py-3 text-sm transition-colors hover:bg-accent hover:text-accent-foreground text-left"
                  onClick={() => handleSelect(cmd)}
                >
                  <Terminal className="h-4 w-4 opacity-70" />
                  <div className="flex flex-col">
                    <span className="font-medium">{cmd.name}</span>
                    <span className="text-xs text-muted-foreground line-clamp-1">
                      {cmd.description}
                    </span>
                  </div>
                  {cmd.category && (
                    <span className="ml-auto text-[10px] uppercase tracking-wider opacity-50">
                      {cmd.category}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
        <div className="flex items-center justify-between border-t bg-muted/50 px-3 py-2 text-[10px] text-muted-foreground">
          <div className="flex gap-2">
            <span>↑↓ Navigate</span>
            <span>↵ Enter</span>
          </div>
          <span>DeXMart Conductor</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
