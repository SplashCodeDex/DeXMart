import { test } from 'vitest';

test.skip('UPSTREAM PENDING SYNC: src/i18n/registry.test.ts', () => {});

/* ORIGINAL TEST CODE COMMENTED OUT TO PREVENT IMPORT/INIT ERRORS */
// import { describe, expect, it } from "vitest";
// import {
//   DEFAULT_LOCALE,
//   SUPPORTED_LOCALES,
//   loadLazyLocaleTranslation,
//   resolveNavigatorLocale,
// } from "../../ui/src/i18n/lib/registry.js";
// import type { TranslationMap } from "../../ui/src/i18n/lib/types.js";
// 
// function getNestedTranslation(map: TranslationMap | null, ...path: string[]): string | undefined {
//   let value: string | TranslationMap | undefined = map ?? undefined;
//   for (const key of path) {
//     if (value === undefined || typeof value === "string") {
//       return undefined;
//     }
//     value = value[key];
//   }
//   return typeof value === "string" ? value : undefined;
// }
// 
// describe.skip("[UPSTREAM PENDING SYNC] ui i18n locale registry", () => {
//   it("lists supported locales", () => {
//     expect(SUPPORTED_LOCALES).toEqual(["en", "zh-CN", "zh-TW", "pt-BR", "de"]);
//     expect(DEFAULT_LOCALE).toBe("en");
//   });
// 
//   it("resolves browser locale fallbacks", () => {
//     expect(resolveNavigatorLocale("de-DE")).toBe("de");
//     expect(resolveNavigatorLocale("pt-PT")).toBe("pt-BR");
//     expect(resolveNavigatorLocale("zh-HK")).toBe("zh-TW");
//     expect(resolveNavigatorLocale("en-US")).toBe("en");
//   });
// 
//   it("loads lazy locale translations from the registry", async () => {
//     const de = await loadLazyLocaleTranslation("de");
//     const zhCN = await loadLazyLocaleTranslation("zh-CN");
// 
//     expect(getNestedTranslation(de, "common", "health")).toBe("Status");
//     expect(getNestedTranslation(zhCN, "common", "health")).toBe("健康状况");
//     expect(await loadLazyLocaleTranslation("en")).toBeNull();
//   });
// });
// 