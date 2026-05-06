import { Request, Response } from "express";
import { userContextResolver } from "../tenancy/resolver-instance.js";
import logger from "../utils/logger.js";

/**
 * AuthorityController
 *
 * Handles requests related to tenant capabilities and system gating.
 */
export class AuthorityController {
  /**
   * GET /api/authority/capabilities
   * Returns the user's specific capability matrix based on their billing tier.
   */
  public static async getCapabilities(req: Request, res: Response) {
    try {
      const user = req.user;
      if (!user || !user.tenantId) {
        return res.status(401).json({ success: false, error: "Unauthorized" });
      }

      // Use the UserContextResolver to fetch the latest context,
      // which already implements caching and standard structures.
      const ctx = await userContextResolver.fromUserId(user.tenantId);

      res.json({
        success: true,
        data: {
          tier: ctx.plan,
          capabilities: ctx.capabilities,
        },
      });
    } catch (error: any) {
      logger.error("AuthorityController.getCapabilities error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
}
