"use client";

import { javascript } from "@codemirror/lang-javascript";
import { json } from "@codemirror/lang-json";
import { markdown } from "@codemirror/lang-markdown";
import { oneDark } from "@codemirror/theme-one-dark";
import CodeMirror from "@uiw/react-codemirror";
import { Save, RefreshCw, XCircle } from "lucide-react";
import React, { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface AgentFileEditorProps {
  filename: string;
  initialContent: string;
  onSave: (content: string) => Promise<void>;
  onClose: () => void;
  onDirtyChange?: (isDirty: boolean) => void;
  className?: string;
}

export function AgentFileEditor({
  filename,
  initialContent,
  onSave,
  onClose,
  onDirtyChange,
  className,
}: AgentFileEditorProps) {
  const [content, setContent] = useState(initialContent);
  const [isSaving, setIsSending] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    setContent(initialContent);
    setIsDirty(false);
    onDirtyChange?.(false);
  }, [initialContent, filename, onDirtyChange]);

  const lang = useMemo(() => {
    if (filename.endsWith(".js") || filename.endsWith(".ts") || filename.endsWith(".tsx")) {
      return [javascript({ jsx: true, typescript: true })];
    }
    if (filename.endsWith(".json")) {
      return [json()];
    }
    if (filename.endsWith(".md")) {
      return [markdown()];
    }
    return [];
  }, [filename]);

  const handleSave = async () => {
    setIsSending(true);
    try {
      await onSave(content);
      setIsDirty(false);
      onDirtyChange?.(false);
    } catch (error) {
      console.error("Save failed:", error);
    } finally {
      setIsSending(false);
    }
  };

  const handleChange = (value: string) => {
    setContent(value);
    const dirty = value !== initialContent;
    setIsDirty(dirty);
    onDirtyChange?.(dirty);
  };

  return (
    <div
      className={cn("flex flex-col h-full bg-card border rounded-xl overflow-hidden", className)}
    >
      <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/20">
        <div className="flex items-center space-x-2 overflow-hidden">
          <span className="text-xs font-mono truncate max-w-[200px]">{filename}</span>
          {isDirty && (
            <span
              className="h-1.5 w-1.5 rounded-full bg-orange-500 animate-pulse shrink-0"
              title="Unsaved changes"
            />
          )}
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-[10px] uppercase font-bold"
            onClick={onClose}
          >
            Close
          </Button>
          <Button
            size="sm"
            className="h-8 text-[10px] uppercase font-bold"
            disabled={!isDirty || isSaving}
            onClick={handleSave}
          >
            {isSaving ? (
              <RefreshCw className="mr-2 h-3 w-3 animate-spin" />
            ) : (
              <Save className="mr-2 h-3 w-3" />
            )}
            Save
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto bg-[#282c34]">
        <CodeMirror
          value={content}
          height="100%"
          theme={oneDark}
          extensions={lang}
          onChange={handleChange}
          basicSetup={{
            lineNumbers: true,
            foldGutter: true,
            dropCursor: true,
            allowMultipleSelections: true,
            indentOnInput: true,
            bracketMatching: true,
            autocompletion: true,
            rectangularSelection: true,
            crosshairCursor: true,
            highlightActiveLine: true,
            highlightSelectionMatches: true,
            closeBrackets: true,
          }}
          className="text-sm h-full"
        />
      </div>
    </div>
  );
}
