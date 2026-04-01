import express from 'express';
import { signup, login, logout, getMe, checkAvailability, loginWithGoogle, refresh } from '../controllers/authController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { authRateLimiter } from '../middleware/httpSecurity.js';


const router = express.Router();

router.post('/register', authRateLimiter, signup);
router.post('/login', authRateLimiter, login);
router.post('/google', authRateLimiter, loginWithGoogle);
router.post('/logout', logout);
router.post('/refresh', authRateLimiter, refresh);

router.get('/availability', checkAvailability);
router.route('/me').get(authenticateToken, getMe).post(authenticateToken, getMe);

export default router;
