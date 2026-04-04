import { Request, Response } from 'express';
import billingService from '../services/billingService.js';
import logger from '../utils/logger.js';
import { AppError } from '../types/result.js';

export const createCheckoutSession = async (req: Request, res: Response) => {
  try {
    const { planId, interval } = req.body;
    const user = (req as any).user;

    const result = await billingService.createCheckoutSession(
      user.tenantId,
      user.userId,
      user.email,
      planId,
      interval
    );

    if (result.success) {
      return res.json({ success: true, data: result.data });
    }

    const error = result.error as AppError;
    return res.status(error.statusCode).json({
      success: false,
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
      },
    });
  } catch (error: unknown) {
    if (error instanceof Error) {
      logger.error('Error creating checkout session', { error: error.message });
      return res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to create checkout session',
        },
      });
    }
    return res.status(500).json({
      success: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message: 'An unexpected error occurred',
      },
    });
  }
};

export const getSubscription = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const result = await billingService.getSubscription(user.tenantId);

    if (result.success) {
      return res.json({ success: true, data: result.data });
    }

    const error = result.error as AppError;
    return res.status(error.statusCode).json({
      success: false,
      error: {
        code: error.code,
        message: error.message,
      },
    });
  } catch (error: unknown) {
    if (error instanceof Error) {
      logger.error('Error getting subscription', { error: error.message });
      return res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to get subscription info',
        },
      });
    }
    return res.status(500).json({
      success: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message: 'An unexpected error occurred',
      },
    });
  }
};

export const getInvoices = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const result = await billingService.getInvoices(user.tenantId);

    if (result.success) {
      return res.json({ success: true, data: result.data });
    }

    const error = result.error as AppError;
    return res.status(error.statusCode).json({
      success: false,
      error: {
        code: error.code,
        message: error.message,
      },
    });
  } catch (error: unknown) {
    if (error instanceof Error) {
      logger.error('Error getting invoices', { error: error.message });
      return res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to get invoices',
        },
      });
    }
    return res.status(500).json({
      success: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message: 'An unexpected error occurred',
      },
    });
  }
};

export const getPaymentMethods = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const result = await billingService.getPaymentMethods(user.tenantId);

    if (result.success) {
      return res.json({ success: true, data: result.data });
    }

    const error = result.error as AppError;
    return res.status(error.statusCode).json({
      success: false,
      error: {
        code: error.code,
        message: error.message,
      },
    });
  } catch (error: unknown) {
    if (error instanceof Error) {
      logger.error('Error getting payment methods', { error: error.message });
      return res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to get payment methods',
        },
      });
    }
    return res.status(500).json({
      success: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message: 'An unexpected error occurred',
      },
    });
  }
};

export const deletePaymentMethod = async (req: Request, res: Response) => {
  try {
    const paymentMethodId = req.params.paymentMethodId as string;
    const user = (req as any).user;
    const result = await billingService.deletePaymentMethod(user.tenantId, paymentMethodId);

    if (result.success) {
      return res.json({ success: true, data: result.data });
    }

    const error = result.error as AppError;
    return res.status(error.statusCode).json({
      success: false,
      error: {
        code: error.code,
        message: error.message,
      },
    });
  } catch (error: unknown) {
    if (error instanceof Error) {
      logger.error('Error deleting payment method', { error: error.message });
      return res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to delete payment method',
        },
      });
    }
    return res.status(500).json({
      success: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message: 'An unexpected error occurred',
      },
    });
  }
};
