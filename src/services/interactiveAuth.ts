import { db } from '../lib/firebase.js';
import { Timestamp } from 'firebase-admin/firestore';
import { logger } from '../utils/logger.js';

class InteractiveAuthEnhancement {
  unifiedAuth: any;
  phoneticAlphabet: Record<string, string>;

  constructor(unifiedAuth: any) {
    this.unifiedAuth = unifiedAuth;
    this.phoneticAlphabet = {
      A: 'Alpha', B: 'Bravo', C: 'Charlie', D: 'Delta', E: 'Echo',
      F: 'Foxtrot', G: 'Golf', H: 'Hotel', I: 'India', J: 'Juliet',
      K: 'Kilo', L: 'Lima', M: 'Mike', N: 'November', O: 'Oscar',
      P: 'Papa', Q: 'Quebec', R: 'Romeo', S: 'Sierra', T: 'Tango',
      U: 'Uniform', V: 'Victor', W: 'Whiskey', X: 'X-ray', Y: 'Yankee', Z: 'Zulu',
    };
  }

  /**
   * Detect existing authenticated session
   */
  async detectExistingSession() {
    try {
      logger.info('🔍 Detecting existing authenticated session...');

      const sessionId = this.unifiedAuth.config.channel?.sessionId || 'default_session';
      const sessionRef = db.collection('waba_sessions').doc(sessionId);
      const doc = await sessionRef.get();

      if (!doc.exists) {
        return { hasSession: false, isValid: false, reason: 'No session found in Firestore' };
      }

      const credsData = doc.data()?.creds;
      if (!credsData) {
        return { hasSession: false, isValid: false, reason: 'Session document exists but empty' };
      }

      const credsAnalysis = await this.analyzeCredsData(credsData);

      // Check if session is valid and registered
      const isValid =
        credsAnalysis.hasKeys && credsAnalysis.hasRegistration && credsAnalysis.hasPhoneNumber;

      if (isValid) {
        return {
          hasSession: true,
          isValid: true,
          sessionInfo: {
            phoneNumber: credsAnalysis.phoneNumber,
            registrationId: credsAnalysis.registrationId,
            lastActive:
              credsAnalysis.processedHistoryMessages.length > 0
                ? new Date().toISOString()
                : 'Unknown',
          },
        };
      }

      return { hasSession: false, isValid: false, reason: 'Session exists but not valid' };
    } catch (error: any) {
      logger.error('Failed to detect existing session:', { error: (error as any).message });
      return { hasSession: false, isValid: false, reason: 'Detection failed' };
    }
  }

  /**
   * Interactive session choice for existing sessions
   */
  async promptSessionChoice(sessionInfo: any): Promise<any> {
    return new Promise(resolve => {
      logger.info('\n' + '╔══════════════════════════════════════════════════════════════╗');
      logger.info('║                    DeXMart Authentication                   ║');
      logger.info('╠══════════════════════════════════════════════════════════════╣');
      logger.info('║                                                              ║');
      logger.info(`║  ✅ Session Status: Active session found                     ║`);
      logger.info(
        `║  📱 Phone: ${this.padRight(this.formatPhoneNumber(sessionInfo.sessionInfo.phoneNumber) || 'Unknown', 42)} ║`
      );
      logger.info(
        `║  🕒 Last active: ${this.padRight(sessionInfo.sessionInfo.lastActive || 'Unknown', 43)} ║`
      );
      logger.info('║                                                              ║');
      logger.info('║  What would you like to do?                                  ║');
      logger.info('║                                                              ║');
      logger.info('║  1. 🚀 Continue existing session                             ║');
      logger.info('║  2. 🔄 Re-authenticate (New session)                         ║');
      logger.info('║  3. 📊 View session analytics                                ║');
      logger.info('║                                                              ║');
      logger.info('║  Your choice (1-3) [Default: Continue]:                      ║');
      logger.info('╚══════════════════════════════════════════════════════════════╝');

      // Set timeout for auto-selection
      const timeout = setTimeout(() => {
        logger.info('\n⏰ No input received, continuing with existing session...');
        resolve('continue');
      }, 15000); // 15 seconds

      // Handle user input
      process.stdin.once('data', data => {
        clearTimeout(timeout);
        const input = data.toString().trim().toLowerCase();

        switch (input) {
          case '1':
          case 'continue':
          case 'c':
            logger.info('✅ Continuing with existing authenticated session');
            resolve('continue');
            break;
          case '2':
          case 're-auth':
          case 'r':
            logger.info('🔄 Re-authentication requested');
            resolve('re-auth');
            break;
          case '3':
          case 'analytics':
          case 'a':
            this.displayAnalytics();
            // After showing analytics, ask again
            setTimeout(() => {
              this.promptSessionChoice(sessionInfo).then(resolve);
            }, 2000);
            break;
          default:
            logger.info(`❌ Invalid choice: ${input}. Please enter 1, 2, or 3.`);
            // Retry
            setTimeout(() => {
              this.promptSessionChoice(sessionInfo).then(resolve);
            }, 1000);
            break;
        }
      });
    });
  }

  /**
   * Interactive authentication method choice
   */
  async promptAuthenticationChoice(): Promise<any> {
    return new Promise(resolve => {
      logger.info('\n' + '╔══════════════════════════════════════════════════════════════╗');
      logger.info('║                   DeXMart Authentication                    ║');
      logger.info('╠══════════════════════════════════════════════════════════════╣');
      logger.info('║                                                              ║');
      logger.info('║  🔍 Session Status: No active session found                  ║');
      logger.info('║                                                              ║');
      logger.info('║  Choose authentication method:                               ║');
      logger.info('║                                                              ║');
      logger.info('║  1. 📱 QR Code (Recommended for beginners)                   ║');
      logger.info('║     Scan with WhatsApp camera                                ║');
      logger.info('║                                                              ║');
      logger.info('║  2. 🔢 Pairing Code (Advanced users)                         ║');
      logger.info('║     Enter code in WhatsApp Linked Devices                    ║');
      logger.info('║                                                              ║');
      logger.info('║  3. 🔄 Auto-select (Based on learning data)                  ║');
      logger.info('║                                                              ║');
      logger.info('║  Your choice (1-3) [Press Enter for auto]:                   ║');
      logger.info('╚══════════════════════════════════════════════════════════════╝');

      // Set timeout for auto-selection
      const timeout = setTimeout(() => {
        logger.info('\n⏰ No input received, auto-selecting based on learning data...');
        resolve('auto');
      }, 20000); // 20 seconds

      // Handle user input
      process.stdin.once('data', data => {
        clearTimeout(timeout);
        const input = data.toString().trim().toLowerCase();

        switch (input) {
          case '1':
          case 'qr':
          case 'q':
            logger.info('📱 QR Code authentication selected');
            resolve('qr');
            break;
          case '2':
          case 'pairing':
          case 'p':
            logger.info('🔢 Pairing Code authentication selected');
            resolve('pairing');
            break;
          case '3':
          case 'auto':
          case 'a':
          case '': // Enter key
            logger.info('🔄 Auto-selection based on learning data');
            resolve('auto');
            break;
          default:
            logger.info(`❌ Invalid choice: ${input}. Please enter 1, 2, or 3.`);
            // Retry
            setTimeout(() => {
              this.promptAuthenticationChoice().then(resolve);
            }, 1000);
            break;
        }
      });
    });
  }

  /**
   * Execute chosen authentication method
   */
  async executeChosenMethod(choice: any, config: any) {
    try {
      let method;
      let result;

      switch (choice) {
        case 'qr':
          method = 'qr';
          result = await this.unifiedAuth.handleQRStrategy(config);
          break;
        case 'pairing':
          method = 'pairing';
          result = await this.unifiedAuth.handlePairingStrategy(config);
          break;
        case 'auto':
        default:
          const smartMethod = await this.unifiedAuth.getSmartAuthMethod(config);
          method = smartMethod.method;
          result = await this.unifiedAuth.authStrategies[method](config);
          break;
      }

      // Record user choice for learning
      await this.unifiedAuth.recordUserChoice({
        type: 'authentication_method',
        choice: method,
        timestamp: Date.now(),
        userSelected: choice !== 'auto',
      });

      return { method, result };
    } catch (error: any) {
      logger.error('Failed to execute chosen authentication method:', { error: error.message });
      throw error;
    }
  }

  /**
   * Display analytics information
   */
  displayAnalytics() {
    const analytics = this.unifiedAuth.getAnalytics();

    logger.info('\n' + '📊 UNIFIED AUTHENTICATION ANALYTICS');
    logger.info('═'.repeat(50));
    logger.info(`Total Attempts: ${analytics.totalAttempts}`);
    logger.info(`Success Rate: ${analytics.successRate}`);
    logger.info(`Active Sessions: ${analytics.activeSessions}`);
    logger.info(`Learning Data Points: ${analytics.learningDataPoints}`);

    if (analytics.methodStats && Object.keys(analytics.methodStats).length > 0) {
      logger.info('\nMethod Performance:');
      Object.entries(analytics.methodStats).forEach(([method, stats]: [string, any]) => {
        logger.info(`  ${method}: ${stats.successes}/${stats.attempts} successes`);
      });
    }

    logger.info('\nPress Enter to continue...');
  }

  /**
   * Format phone number for display
   */
  formatPhoneNumber(phone: string) {
    if (!phone) return 'Not configured';
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 10) {
      return `+${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6)}`;
    }
    if (cleaned.length === 12) {
      return `+${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6, 9)} ${cleaned.slice(9)}`;
    }
    return `+${cleaned}`;
  }

  /**
   * Analyze credentials data object
   */
  async analyzeCredsData(credsData: any) {
    try {
      return {
        hasKeys: !!(credsData.noiseKey && credsData.signedIdentityKey),
        hasRegistration: credsData.registered === true,
        hasPhoneNumber: !!(credsData.me && credsData.me.id),
        phoneNumber: credsData.me?.id || null,
        pairingCode: credsData.pairingCode || null,
        registrationId: credsData.registrationId || null,
        accountSettings: credsData.accountSettings || {},
        processedHistoryMessages: credsData.processedHistoryMessages || [],
      };
    } catch (error: any) {
      logger.error('Failed to analyze creds data:', { error: (error as any).message });
      throw error;
    }
  }

  private padRight(str: string, length: number): string {
    return str + ' '.repeat(Math.max(0, length - str.length));
  }
}

export default InteractiveAuthEnhancement;
