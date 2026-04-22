---
description: Finish the current task with verification and git notes
---

# Workflow: Finish Task

## Step 1: Verify Tests (Green Phase)

1.  Run the full test suite for the affected module.
2.  **Constraint:** All tests _must_ pass.

## Step 2: Reflection (2026 Critic Phase)

1.  Review code for "Banned Patterns" (e.g., `useEffect` for data, missing `.js` extensions).
2.  Hypothesize one failure mode and verify mitigation.
3.  **Output:** "Self-Critic Reflection: Identified [X], verified [Y]."

## Step 3: Check Coverage (Optional)

...

## Step 4: Commit

1.  **Format:** `<type>(<scope>): <description>`
2.  Execute `FAST_COMMIT=1 git commit -m "<type>(<scope>): <description>"`

## Step 5: Attach Git Note

1.  **Draft Note:** Include Task Name, Files, Reasoning, and **Reflection Results**.
2.  `git notes add -m "<Note Content>" <hash>`

## Step 6: Update Plan

...

## Step 7: Next Steps

...
