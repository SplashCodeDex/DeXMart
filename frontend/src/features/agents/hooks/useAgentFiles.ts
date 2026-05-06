import type { AgentsFileEntry } from "@openclaw/protocol/index";
import { useRpcCall } from "@/lib/gateway/gateway-hooks";

export function useAgentFiles(agentId: string) {
  const listRpc = useRpcCall("agents.files.list");
  const getRpc = useRpcCall("agents.files.get");
  const setRpc = useRpcCall("agents.files.set");

  const listFiles = async (): Promise<AgentsFileEntry[]> => {
    const res = await listRpc({ agentId });
    return res.files as AgentsFileEntry[];
  };

  const getFile = async (name: string): Promise<AgentsFileEntry> => {
    const res = await getRpc({ agentId, name });
    return res.file as AgentsFileEntry;
  };

  const setFile = async (name: string, content: string): Promise<AgentsFileEntry> => {
    const res = await setRpc({ agentId, name, content });
    return res.file as AgentsFileEntry;
  };

  return {
    listFiles,
    getFile,
    setFile,
  };
}
