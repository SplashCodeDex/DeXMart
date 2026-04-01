// Simulates initEnv.ts — uses top-level await to set process.env
console.log('[initFirst] BEFORE await — process.env.TEST_VAR =', process.env.TEST_VAR);
await new Promise<void>(resolve => {
    process.env.TEST_VAR = 'LOADED_BY_TLA';
    console.log('[initFirst] AFTER set — process.env.TEST_VAR =', process.env.TEST_VAR);
    resolve();
});
console.log('[initFirst] Module evaluation COMPLETE');
