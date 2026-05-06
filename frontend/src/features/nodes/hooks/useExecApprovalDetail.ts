import type { ExecApprovalResolveParams } from "@openclaw/protocol";
import { useRpcCall } from "@/lib/gateway/gateway-hooks";

export function useExecApprovalDetail(requestId: string) {
  const getRpc = useRpcCall("exec.approval.get");
  const resolveRpc = useRpcCall("exec.approval.resolve");

  const getDetail = async () => {
    return await getRpc({ requestId });
  };

  const resolve = async (params: Omit<ExecApprovalResolveParams, "requestId">) => {
    return await resolveRpc({ ...params, requestId });
  };

  return {
    getDetail,
    resolve,
  };
}
