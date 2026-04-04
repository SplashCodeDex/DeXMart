import { Router } from 'express';
import { 
  createCheckoutSession, 
  getSubscription, 
  getInvoices, 
  getPaymentMethods, 
  deletePaymentMethod 
} from '../controllers/billingController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';

const router = Router();

router.post('/checkout', authenticateToken, createCheckoutSession);
router.get('/subscription', authenticateToken, getSubscription);
router.get('/invoices', authenticateToken, getInvoices);
router.get('/payment-methods', authenticateToken, getPaymentMethods);
router.delete('/payment-methods/:paymentMethodId', authenticateToken, deletePaymentMethod);

export default router;
