# Plan: Fix ConfigService Missing `set` Method

The DeXMart application crashes on startup because `src/main.ts` attempts to call `context.config.set()`, but `ConfigService` (the type of `context.config`) does not implement the `set` method. `ConfigService` is a wrapper around `ConfigManager`, which *does* implement `set`.

## Proposed Changes

### 1. `src/services/ConfigService.ts`
- Add a `set(key: string, value: any): void` method to the `ConfigService` class.
- The method should delegate to `configManager.set(key, value)`.
- Add a debug log for the set operation.

## Verification Plan

### Automated Tests
- Create a temporary test script to verify that `ConfigService.getInstance().set()` works as expected and that values can be retrieved via `get()`.

### Manual Verification
- Run the application using `pnpm dlx tsx src/main.ts` and verify that it no longer crashes with the `TypeError`.
