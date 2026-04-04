import { Request, Response } from 'express';
import { flowService } from '../services/flowService.js';
import logger from '../utils/logger.js';
import { z } from 'zod';

const flowSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  description: z.string().optional(),
  nodes: z.array(z.any()),
  edges: z.array(z.any()),
  isActive: z.boolean().default(true),
});

export class FlowController {
  static async saveFlow(req: Request, res: Response) {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) return res.status(401).json({ success: false, error: 'Unauthorized' });

      const flowData = flowSchema.parse(req.body);
      const result = await flowService.saveFlow(tenantId, flowData);

      if (result.success) {
        res.json({ success: true, data: result.data });
      } else {
        res.status(400).json({ success: false, error: result.error?.message });
      }
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, error: error.issues[0].message });
      }
      logger.error('FlowController.saveFlow error:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }

  static async listFlows(req: Request, res: Response) {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) return res.status(401).json({ success: false, error: 'Unauthorized' });

      const result = await flowService.listFlows(tenantId);

      if (result.success) {
        res.json({ success: true, data: result.data });
      } else {
        res.status(400).json({ success: false, error: result.error?.message });
      }
    } catch (error: any) {
      logger.error('FlowController.listFlows error:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }

  static async getFlow(req: Request, res: Response) {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) return res.status(401).json({ success: false, error: 'Unauthorized' });

      const flowId = req.params.id as string;
      const result = await flowService.getFlow(tenantId, flowId);

      if (result.success) {
        res.json({ success: true, data: result.data });
      } else {
        res.status(404).json({ success: false, error: result.error?.message });
      }
    } catch (error: any) {
      logger.error('FlowController.getFlow error:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }

  static async deleteFlow(req: Request, res: Response) {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) return res.status(401).json({ success: false, error: 'Unauthorized' });

      const flowId = req.params.id as string;
      const result = await flowService.deleteFlow(tenantId, flowId);

      if (result.success) {
        res.json({ success: true });
      } else {
        res.status(400).json({ success: false, error: result.error?.message });
      }
    } catch (error: any) {
      logger.error('FlowController.deleteFlow error:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }
}
