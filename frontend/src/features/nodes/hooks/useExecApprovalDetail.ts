import type { ExecApprovalResolveParams } from "@openclaw/protocol";
import { useRpcCall } from "@/lib/gateway/gateway-hooks";

export function useExecApprovalDetail(id: string) {
  const getRpc = useRpcCall("exec.approval.get");
  const resolveRpc = useRpcCall("exec.approval.resolve");

  const getDetail = async () => {
    return await getRpc({ id });
  };

  const resolve = async (params: Omit<ExecApprovalResolveParams, "id">) => {
    return await resolveRpc({ ...params, id });
  };

  return {
    getDetail,
    resolve,
  };
}
