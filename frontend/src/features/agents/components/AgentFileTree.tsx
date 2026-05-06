"use client";

import { File, Folder, ChevronRight, ChevronDown, Plus, Trash2 } from "lucide-react";
import React, { useState, useMemo } from "react";
import { cn } from "@/lib/utils";

export interface FileEntry {
  name: string;
  isDirectory: boolean;
  size?: number;
  updatedAt?: number;
}

interface AgentFileTreeProps {
  files: FileEntry[];
  selectedFile: string | null;
  onSelect: (path: string) => void;
  className?: string;
}

export function AgentFileTree({ files, selectedFile, onSelect, className }: AgentFileTreeProps) {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set([""]));

  const tree = useMemo(() => {
    const root: any = { name: "", children: {}, isDirectory: true, path: "" };

    files.forEach((file) => {
      const parts = file.name.split("/");
      let current = root;
      let currentPath = "";

      parts.forEach((part, index) => {
        currentPath = currentPath ? `${currentPath}/${part}` : part;
        const isLast = index === parts.length - 1;

        if (!current.children[part]) {
          current.children[part] = {
            name: part,
            path: currentPath,
            isDirectory: !isLast || file.isDirectory,
            children: {},
          };
        }
        current = current.children[part];
      });
    });

    return root;
  }, [files]);

  const toggleFolder = (path: string) => {
    const next = new Set(expandedFolders);
    if (next.has(path)) {
      next.delete(path);
    } else {
      next.add(path);
    }
    setExpandedFolders(next);
  };

  const renderNode = (node: any, depth: number = 0): React.ReactNode => {
    const isExpanded = expandedFolders.has(node.path);
    const isSelected = selectedFile === node.path;
    const hasChildren = Object.keys(node.children).length > 0;

    if (node.path === "" && depth === 0) {
      return Object.values(node.children)
        .sort((a: any, b: any) => {
          if (a.isDirectory === b.isDirectory) return a.name.localeCompare(b.name);
          return a.isDirectory ? -1 : 1;
        })
        .map((child) => renderNode(child, depth));
    }

    return (
      <div key={node.path} className="select-none">
        <div
          className={cn(
            "flex items-center py-1 px-2 rounded-md cursor-pointer transition-colors text-xs font-medium",
            isSelected ? "bg-primary/20 text-primary" : "hover:bg-muted/50 text-muted-foreground",
          )}
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
          onClick={() => {
            if (node.isDirectory) {
              toggleFolder(node.path);
            } else {
              onSelect(node.path);
            }
          }}
        >
          <div className="mr-1.5 h-4 w-4 flex items-center justify-center">
            {node.isDirectory ? (
              isExpanded ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )
            ) : null}
          </div>
          <div className="mr-2">
            {node.isDirectory ? (
              <Folder className={cn("h-4 w-4", isExpanded ? "text-primary" : "text-primary/60")} />
            ) : (
              <File className="h-4 w-4 text-muted-foreground/60" />
            )}
          </div>
          <span className="truncate">{node.name}</span>
        </div>

        {node.isDirectory && isExpanded && (
          <div className="mt-0.5">
            {Object.values(node.children)
              .sort((a: any, b: any) => {
                if (a.isDirectory === b.isDirectory) return a.name.localeCompare(b.name);
                return a.isDirectory ? -1 : 1;
              })
              .map((child) => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return <div className={cn("space-y-0.5", className)}>{renderNode(tree)}</div>;
}
