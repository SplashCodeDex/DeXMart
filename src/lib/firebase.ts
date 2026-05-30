import { readFileSync } from "fs";
import path from "path";
import admin from "firebase-admin";
import { ConfigService } from "../services/ConfigService.js";
import logger from "../utils/logger.js";

let _db: admin.firestore.Firestore | null = null;

function getDbInstance(): admin.firestore.Firestore {
  if (_db) return _db;

  const config = ConfigService.getInstance();

  try {
    if (admin.apps.length === 0) {
      const options: any = {};

      const serviceAccountPath = config.get("FIREBASE_SERVICE_ACCOUNT_PATH");
      const projectId = config.get("FIREBASE_PROJECT_ID");
      const clientEmail = config.get("FIREBASE_CLIENT_EMAIL");
      const privateKey = config.get("FIREBASE_PRIVATE_KEY");

      logger.info(`Firebase Config: path=${serviceAccountPath}, projectId=${projectId}, hasEmail=${!!clientEmail}, hasKey=${!!privateKey}`);

      if (serviceAccountPath) {
        logger.info(`Loading service account via direct path: ${serviceAccountPath}`);
        options.credential = admin.credential.cert(path.resolve(serviceAccountPath));
        options.projectId = projectId; // SDK will favor file content, but this provides a fallback
      } else if (projectId && clientEmail && privateKey) {

        logger.info(`Using explicit credentials for project: ${projectId}`);
        options.credential = admin.credential.cert({
          projectId,
          clientEmail,
          privateKey: privateKey.replace(/\\n/g, "\n"),
        });
        options.projectId = projectId;
      } else {
        logger.info("Using application default credentials");
        options.credential = admin.credential.applicationDefault();
        if (projectId) {
          options.projectId = projectId;
        }
        // Defense-in-depth: try reading project_id from service account file directly
        if (!options.projectId) {
          const saPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
          if (saPath) {
            try {
              const sa = JSON.parse(readFileSync(saPath, "utf8"));
              if (sa.project_id) {
                options.projectId = sa.project_id;
                logger.warn(
                  `⚠️ FIREBASE_SERVICE_ACCOUNT_PATH was set in env but not loaded by ConfigService. Read project_id="${sa.project_id}" directly from file as fallback.`,
                );
              }
            } catch {
              /* non-fatal — file may not exist */
            }
          }
          if (!options.projectId) {
            logger.error(
              "❌ No Firebase Project ID available. Firestore queries will fail. Check FIREBASE_SERVICE_ACCOUNT_PATH or FIREBASE_PROJECT_ID.",
            );
          }
        }
      }

      logger.info("Initializing Firebase Admin...");
      admin.initializeApp(options);
      logger.info(`🔥 Firebase Admin Initialized (Project: ${options.projectId || "ADC"})`);
    }
    _db = admin.firestore();
    _db.settings({ ignoreUndefinedProperties: true });
    return _db;
  } catch (error: any) {
    logger.error("Failed to initialize Firebase:", error);
    throw error;
  }
}

/**
 * Lazy-initialized Firestore instance
 */
export const db = new Proxy({} as admin.firestore.Firestore, {
  get(_target, prop) {
    const instance = getDbInstance();
    const value = (instance as any)[prop];
    return typeof value === "function" ? value.bind(instance) : value;
  },
});

export { admin };
