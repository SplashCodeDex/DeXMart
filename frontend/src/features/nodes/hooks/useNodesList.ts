import type { NodeListParams } from "@openclaw/protocol/index";
import { useQuery } from "@tanstack/react-query";
import { useRpcCall } from "@/lib/gateway/gateway-hooks";

export function useNodesList(params: NodeListParams = {}) {
  const listRpc = useRpcCall("node.list");

  const {
    data: nodes = [],
    isLoading,
    refetch: refresh,
    error,
  } = useQuery({
    queryKey: ["nodes", "list", params],
    queryFn: async () => {
      const res = await listRpc(params);
      return res.nodes || [];
    },
  });

  const listNodes = async (p: NodeListParams = params) => {
    const res = await listRpc(p);
    return res.nodes;
  };

  return {
    nodes,
    isLoading,
    refresh,
    error,
    listNodes,
  };
}
