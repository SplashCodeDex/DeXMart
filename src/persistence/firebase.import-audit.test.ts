/**
 * Import Audit — Task 1.1 regression guard
 *
 * RED until:
 *  - src/services/FirebaseService.ts is deleted (Task 1.5)
 *  - All runtime imports migrated to @/persistence/firebase.js (Task 1.2)
 *  - All test imports migrated to @/persistence/firebase.js (Task 1.3)
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

const ROOT = path.resolve(__dirname, '../../');
const SRC = path.join(ROOT, 'src');

describe('Import Audit — services/FirebaseService must not exist', () => {
  it('src/services/FirebaseService.ts does not exist', () => {
    const oldFile = path.join(SRC, 'services', 'FirebaseService.ts');
    expect(
      fs.existsSync(oldFile),
      `Old file still present: ${oldFile}. Delete it after migrating all imports.`
    ).toBe(false);
  });
});

describe('Import Audit — no stale @/services/FirebaseService imports in src/', () => {
  it('zero source files import from @/services/FirebaseService (excluding this audit file)', () => {
    // Pattern targets only actual import/mock statements, not comments or string literals inside test code.
    // The audit file itself is excluded via --exclude glob.
    const STALE_PATTERN = `(from|mock)\\(?\\'(@/|\\.\\./)services/FirebaseService`;
    let matches: string[] = [];
    try {
      const result = execSync(
        `grep -rE "${STALE_PATTERN}" "${SRC}" --include="*.ts" --exclude="firebase.import-audit.test.ts" -l`,
        { encoding: 'utf8' }
      );
      matches = result.trim().split('\n').filter(Boolean);
    } catch {
      // grep exits non-zero when no matches — that is the passing state
    }

    expect(
      matches,
      `Stale imports from services/FirebaseService found in:\n${matches.join('\n')}`
    ).toHaveLength(0);
  });
});
