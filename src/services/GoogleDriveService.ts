import { google } from 'googleapis';
import { ConfigService } from './ConfigService.js';
import logger from '../utils/logger.js';
import { Result, success, failure, AppError } from '../types/result.js';
import { Readable } from 'stream';

export class GoogleDriveService {
    private static instance: GoogleDriveService;

    private constructor() { }

    public static getInstance(): GoogleDriveService {
        if (!GoogleDriveService.instance) {
            GoogleDriveService.instance = new GoogleDriveService();
        }
        return GoogleDriveService.instance;
    }

    private getOAuth2Client() {
        const config = ConfigService.getInstance();
        const clientId = config.get('GOOGLE_CLIENT_ID');
        const clientSecret = config.get('GOOGLE_CLIENT_SECRET');
        const redirectUri = config.get('GOOGLE_REDIRECT_URI') || `${config.get('NEXT_PUBLIC_APP_URL') || 'http://localhost:3000'}/api/integrations/google/callback`;

        return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
    }

    /**
     * Generates the URL for users to authorize the app.
     */
    public generateAuthUrl(tenantId: string): Result<string> {
        try {
            const oauth2Client = this.getOAuth2Client();

            const url = oauth2Client.generateAuthUrl({
                access_type: 'offline', // Demands a refresh token
                prompt: 'consent', // Force consent screen to ensure refresh token is returned
                scope: [
                    'https://www.googleapis.com/auth/drive.file' // Only grants access to files created by the app
                ],
                state: tenantId // Pass tenant ID through the OAuth flow
            });

            return { success: true, data: url };
        } catch (error: any) {
            logger.error('Failed to generate Google Drive auth URL', { error: error.message });
            return { success: false, error: AppError.internal('Failed to generate auth URL') };
        }
    }

    /**
     * Exchanges an authorization code for a refresh token.
     */
    public async getRefreshTokenFromCode(code: string): Promise<Result<string>> {
        try {
            const oauth2Client = this.getOAuth2Client();
            const { tokens } = await oauth2Client.getToken(code);

            if (!tokens.refresh_token) {
                // This can happen if the user had already authorized it, and didn't see the consent screen.
                return { success: false, error: AppError.badRequest('No refresh token returned. User may need to revoke access and try again.') };
            }

            return { success: true, data: tokens.refresh_token };
        } catch (error: any) {
            logger.error('Failed to get refresh token', { error: error.message });
            return { success: false, error: AppError.internal('Failed to exchange auth code') };
        }
    }

    /**
     * Uploads a file buffer/stream to a tenant's Google Drive.
     */
    public async uploadFile(
        refreshToken: string,
        fileName: string,
        mimeType: string,
        fileStream: Readable
    ): Promise<Result<{ driveFileId: string; size: number }>> {
        try {
            const oauth2Client = this.getOAuth2Client();
            oauth2Client.setCredentials({ refresh_token: refreshToken });

            const drive = google.drive({ version: 'v3', auth: oauth2Client });

            const fileMetadata = {
                name: fileName,
            };

            const media = {
                mimeType: mimeType,
                body: fileStream,
            };

            const file = await drive.files.create({
                requestBody: fileMetadata,
                media: media,
                fields: 'id, size',
            });

            if (!file.data.id) {
                return { success: false, error: AppError.internal('Drive API did not return a file ID') };
            }

            return {
                success: true,
                data: {
                    driveFileId: file.data.id,
                    size: file.data.size ? parseInt(file.data.size, 10) : 0
                }
            };
        } catch (error: any) {
            logger.error('Failed to upload file to Google Drive', { error: error.message });
            return { success: false, error: AppError.internal('Failed to upload backup to Google Drive') };
        }
    }
}

export const googleDriveService = GoogleDriveService.getInstance();
export default googleDriveService;
