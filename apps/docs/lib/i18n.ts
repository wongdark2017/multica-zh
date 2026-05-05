import { defineI18n } from "fumadocs-core/i18n";

// Chinese is the default; English remains available under /en/.
// hideLocale: 'default-locale' keeps Chinese URLs prefix-free
// (`/docs/`) while English lives under `/docs/en/...`.
// parser: 'dot' picks up `page.zh.mdx` and `meta.zh.json`.
export const i18n = defineI18n({
  languages: ["zh", "en"],
  defaultLanguage: "zh",
  hideLocale: "default-locale",
  parser: "dot",
});

export type Lang = (typeof i18n.languages)[number];
