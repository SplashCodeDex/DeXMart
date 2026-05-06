import express from "express";
import { AnalyticsController } from "../controllers/analyticsController.js";
import { authenticateToken } from "../middleware/authMiddleware.js";

const router = express.Router();

/**
 * GET /dashboard
 * Returns aggregated stats for the dashboard
 */
router.get("/dashboard", AnalyticsController.getDashboardStats);
// ...
router.get("/usage", AnalyticsController.getUsageAnalytics);
// ...
router.get("/messages", AnalyticsController.getMessageAnalytics);

export default router;
