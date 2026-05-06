"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Files, AlertCircle, RefreshCw, FileCode } from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAgentFiles } from "../hooks/useAgentFiles";
import { AgentFileEditor } from "./AgentFileEditor";
import { AgentFileTree } from "./AgentFileTree";

interface AgentFilesFeatureProps {
  agentId: string;
}

export function AgentFilesFeature({ agentId }: AgentFilesFeatureProps) {
  const queryClient = useQueryClient();
  const { listFiles, getFile, setFile } = useAgentFiles(agentId);
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const [isEditorDirty, setIsEditorDirty] = useState(false);

  const {
    data: files = [],
    isLoading: isListLoading,
    error: listError,
    refetch: refetchList,
  } = useQuery({
    queryKey: ["agents", agentId, "files"],
    queryFn: listFiles,
    enabled: !!agentId,
  });

  const {
    data: selectedFile,
    isLoading: isFileLoading,
    error: fileError,
  } = useQuery({
    queryKey: ["agents", agentId, "files", selectedFilePath],
    queryFn: () => (selectedFilePath ? getFile(selectedFilePath) : null),
    enabled: !!selectedFilePath,
  });

  const saveMutation = useMutation({
    mutationFn: ({ path, content }: { path: string; content: string }) => setFile(path, content),
    onSuccess: () => {
      toast.success("File saved successfully");
      queryClient.invalidateQueries({ queryKey: ["agents", agentId, "files", selectedFilePath] });
    },
    onError: (error) => {
      toast.error(
        `Failed to save file: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    },
  });

  const handleSave = async (content: string) => {
    if (!selectedFilePath) return;
    await saveMutation.mutateAsync({ path: selectedFilePath, content });
  };

  const handleFileSelect = (path: string) => {
    if (isEditorDirty) {
      const confirmed = window.confirm(
        "You have unsaved changes. Are you sure you want to switch files? Your changes will be lost.",
      );
      if (!confirmed) return;
    }
    setSelectedFilePath(path);
    setIsEditorDirty(false);
  };

  const handleCloseEditor = () => {
    if (isEditorDirty) {
      const confirmed = window.confirm(
        "You have unsaved changes. Are you sure you want to close the editor? Your changes will be lost.",
      );
      if (!confirmed) return;
    }
    setSelectedFilePath(null);
    setIsEditorDirty(false);
  };

  if (listError) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>
          {listError instanceof Error ? listError.message : "Failed to load agent files"}
        </AlertDescription>
        <Button variant="outline" size="sm" onClick={() => refetchList()} className="mt-2">
          <RefreshCw className="mr-2 h-3 w-3" />
          Retry
        </Button>
      </Alert>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[250px_1fr] h-[600px]">
      <div className="flex flex-col space-y-4 overflow-hidden border rounded-xl bg-card/40 backdrop-blur-sm">
        <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/20">
          <div className="flex items-center space-x-2">
            <Files className="h-4 w-4 text-primary" />
            <span className="text-xs font-bold uppercase tracking-wider">Workspace</span>
          </div>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => refetchList()}>
            <RefreshCw className={isListLoading ? "animate-spin h-3 w-3" : "h-3 w-3"} />
          </Button>
        </div>

        <div className="flex-1 overflow-auto p-2">
          {isListLoading && files.length === 0 ? (
            <div className="space-y-2 p-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-6 w-full" />
              ))}
            </div>
          ) : files.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-4">
              <FileCode className="h-8 w-8 text-muted-foreground/20 mb-2" />
              <p className="text-[10px] text-muted-foreground italic">
                No files found in workspace
              </p>
            </div>
          ) : (
            <AgentFileTree
              files={files}
              selectedFile={selectedFilePath}
              onSelect={handleFileSelect}
            />
          )}
        </div>
      </div>

      <div className="relative h-full overflow-hidden">
        {selectedFilePath ? (
          isFileLoading ? (
            <div className="flex flex-col h-full space-y-4 p-4 border rounded-xl bg-card">
              <Skeleton className="h-8 w-1/3" />
              <Skeleton className="flex-1 w-full" />
            </div>
          ) : fileError ? (
            <Alert variant="destructive" className="h-fit">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error loading file</AlertTitle>
              <AlertDescription>
                {fileError instanceof Error ? fileError.message : "Failed to load file content"}
              </AlertDescription>
            </Alert>
          ) : selectedFile ? (
            <AgentFileEditor
              filename={selectedFilePath}
              initialContent={selectedFile.content || ""}
              onSave={handleSave}
              onClose={handleCloseEditor}
              onDirtyChange={setIsEditorDirty}
            />
          ) : null
        ) : (
          <div className="flex flex-col items-center justify-center h-full border-2 border-dashed rounded-xl bg-muted/5 text-center p-12">
            <div className="h-16 w-16 rounded-full bg-primary/5 flex items-center justify-center mb-6">
              <FileCode className="h-8 w-8 text-primary/30" />
            </div>
            <h5 className="font-bold text-lg italic tracking-tight">Construct Editor Ready</h5>
            <p className="text-sm text-muted-foreground mt-2 max-w-xs mx-auto leading-relaxed">
              Select a source file from the workspace tree to begin direct neural manipulation of
              the agent's logic.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
