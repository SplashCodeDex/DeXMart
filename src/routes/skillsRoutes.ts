import express, { Request, Response } from "express";
import { db } from "../lib/firebase.js";
import logger from "../utils/logger.js";

const router = express.Router();

/**
 * GET /skills
 * List all available skills and whether they are enabled for the current tenant
 */
router.get("/", async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ success: false, error: "Authentication required" });
    }

    res.json({ success: true, data: [] });
  } catch (error: any) {
    logger.error("Route /skills GET error", error);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

export default router;
