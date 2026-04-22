import React, { useEffect, useState } from "react";
import { useRpcCall } from "@/lib/gateway/gateway-hooks";
import { ModelSelector } from "@/components/shared/ModelSelector";
import { Settings, MessageSquare, ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface SessionHeaderProps {
  currentSessionKey: string;
  onSessionChange: (key: string) => void;
}

export function SessionHeader({ currentSessionKey, onSessionChange }: SessionHeaderProps) {
  const [sessions, setSessions] = useState<any[]>([]);
  const [isSessionPickerOpen, setIsSessionPickerOpen] = useState(false);
  const [isModelSelectorOpen, setIsModelSelectorOpen] = useState(false);
  
  const callSessionsList = useRpcCall("sessions.list");
  const callSessionsPatch = useRpcCall("sessions.patch");

  useEffect(() => {
    callSessionsList({ limit: 20 }).then((res) => {
      setSessions(res.sessions || []);
    });
  }, [callSessionsList, currentSessionKey]);

  const handleModelSelect = async (model: any) => {
    try {
      await callSessionsPatch({
        key: currentSessionKey,
        model: model.id,
      });
      setIsModelSelectorOpen(false);
    } catch (err) {
      console.error("Failed to update session model", err);
    }
  };

  const activeSession = sessions.find(s => s.key === currentSessionKey) || { label: currentSessionKey };

  return (
    <div className="flex items-center justify-between px-6 py-4 border-b border-border/50 bg-card/20 backdrop-blur-md">
      <div className="flex items-center gap-4">
        <div className="relative">
          <button
            onClick={() => setIsSessionPickerOpen(!isSessionPickerOpen)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-accent transition-colors text-sm font-medium"
          >
            <MessageSquare className="h-4 w-4 text-primary" />
            <span className="truncate max-w-[150px]">{activeSession.label || currentSessionKey}</span>
            <ChevronDown className={cn("h-3 w-3 transition-transform", isSessionPickerOpen && "rotate-180")} />
          </button>
          
          {isSessionPickerOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setIsSessionPickerOpen(false)} />
              <div className="absolute left-0 mt-2 w-64 p-1 rounded-xl border border-border bg-popover shadow-xl z-20 animate-in fade-in zoom-in-95 duration-100">
                <div className="p-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                  Recent Sessions
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {sessions.map((s) => (
                    <button
                      key={s.key}
                      onClick={() => {
                        onSessionChange(s.key);
                        setIsSessionPickerOpen(false);
                      }}
                      className={cn(
                        "w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors hover:bg-accent",
                        s.key === currentSessionKey && "bg-accent text-accent-foreground font-medium"
                      )}
                    >
                      <span className="truncate">{s.label || s.key}</span>
                      {s.key === currentSessionKey && <Check className="h-3 w-3" />}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative">
          <button
            onClick={() => setIsModelSelectorOpen(!isModelSelectorOpen)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border/50 hover:bg-accent transition-colors text-xs font-medium"
          >
            <Settings className="h-3.5 w-3.5 text-muted-foreground" />
            <span>Model Overrides</span>
          </button>

          {isModelSelectorOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setIsModelSelectorOpen(false)} />
              <div className="absolute right-0 mt-2 w-80 p-4 rounded-xl border border-border bg-popover shadow-xl z-20 animate-in fade-in zoom-in-95 duration-100">
                <div className="mb-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Select Model Override
                </div>
                <ModelSelector 
                  onSelect={handleModelSelect}
                  value={activeSession.model}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
