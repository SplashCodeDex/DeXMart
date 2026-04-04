import { Request, Response } from 'express';
import { googleDriveService } from '../services/GoogleDriveService.js';
import { db } from '../lib/firebase.js';
import logger from '../utils/logger.js';
import { AppError } from '../types/result.js';

export class IntegrationController {
    /**
     * Generates the Google Drive OAuth URL.
     */
    static async getGoogleAuthUrl(req: Request, res: Response) {
        try {
            // tenantId is usually injected by authMiddleware
            const tenantId = req.user?.tenantId;

            if (!tenantId) {
                throw AppError.unauthorized('Tenant ID is required for integration auth.');
            }

            const result = googleDriveService.generateAuthUrl(tenantId);

            if (!result.success) {
                throw result.error;
            }

            res.status(200).json({ success: true, url: result.data });
        } catch (error: any) {
            logger.error('Error generating Google Auth URL', { error: error.message });
            res.status(error.statusCode || 500).json({
                success: false,
                error: error.message || 'Internal server error'
            });
        }
    }

    /**
     * Handles the Google Drive OAuth callback to exchange code for refresh token.
     */
    static async handleGoogleCallback(req: Request, res: Response) {
        try {
            const { code, state } = req.query;
            const tenantId = state as string;

            if (!code || typeof code !== 'string') {
                throw AppError.badRequest('Missing or invalid authorization code.');
            }

            if (!tenantId) {
                throw AppError.badRequest('Missing tenant state in callback.');
            }

            const result = await googleDriveService.getRefreshTokenFromCode(code);

            if (!result.success) {
                throw result.error;
            }

            const refreshToken = result.data;

            // Store in tenant document
            await db.collection('tenants').doc(tenantId).update({
                googleRefreshToken: refreshToken,
                googleDriveConnected: true,
                updatedAt: new Date()
            });

            logger.info(`Google Drive integrated successfully for tenant ${tenantId}`);

            // Redirect back to frontend settings page or show success message.
            // E.g. <APP_URL>/dashboard/settings?integration=success
            const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
            res.redirect(`${appUrl}/dashboard/settings?integration=google_success`);

        } catch (error: any) {
            logger.error('Error in Google Auth callback', { error: error.message });
            const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
            res.redirect(`${appUrl}/dashboard/settings?integration=google_error&message=${encodeURIComponent(error.message)}`);
        }
    }
}
