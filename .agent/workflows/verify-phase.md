---
description: Verify a completed phase and create a checkpoint
---

# Workflow: Verify Phase

## Step 1: Identify Phase Scope

1.  Read `plan.md` to find the start of the current phase (or previous checkpoint).
2.  Identify all files changed since that point.

## Step 2: Audit Tests

1.  For every changed _code_ file, verify a corresponding test exists.
2.  **Action:** If missing, write the test now.

## Step 3: Automated Verification

1.  Run the full project test suite.
2.  **Constraint:** Must pass 100%.

## Step 4: Manual Verification Plan

1.  Generate a list of manual steps the user should perform to verify the user-facing deliverables of this phase.
2.  **Prompt User:** "Please perform these manual checks... [List]. Reply 'CONFIRMED' when done."
3.  **Wait** for user confirmation.

## Step 5: Checkpoint Commit

1.  Create a commit: `FAST_COMMIT=1 git commit -m "conductor(checkpoint): Phase <Name> Complete"`.
2.  Attach a Git Note containing the "Verification Report" (Tests run + Manual checks confirmed).

## Step 6: Update Plan

1.  Mark the Phase header in `plan.md` with `[checkpoint: <sha>]`.
2.  Commit the plan update with `FAST_COMMIT=1 git commit -m "conductor(update): Update plan after phase completion"`.

## Step 7: Celebrate

1.  **Output:** "Phase complete! Checkpoint secured. Ready for the next phase."
