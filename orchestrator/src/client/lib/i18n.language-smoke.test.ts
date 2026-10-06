import { describe, expect, it } from "vitest";
import { INTERFACE_LANGUAGE_OPTIONS, translateUi } from "./i18n";

const expected = {
  es: {
    "What kind of jobs are you looking for?": "¿Qué tipo de empleo buscas?",
    Automatic: "Automático",
    Manual: "Manual",
    "Generate search": "Crear búsqueda",
  },
  fr: {
    "What kind of jobs are you looking for?":
      "Quel type d’emploi recherchez-vous ?",
    Automatic: "Automatique",
    Manual: "Manuel",
    "Generate search": "Générer la recherche",
  },
  ru: {
    "What kind of jobs are you looking for?": "Какие вакансии вы ищете?",
    Automatic: "Автоматически",
    Manual: "Вручную",
    "Generate search": "Сформировать поиск",
  },
  de: {
    "What kind of jobs are you looking for?": "Welche Stellen suchen Sie?",
    Automatic: "Automatisch",
    Manual: "Manuell",
    "Generate search": "Suche erstellen",
  },
} as const;

describe("interface-language coverage", () => {
  it("supports exactly the five configured interface languages", () => {
    expect(INTERFACE_LANGUAGE_OPTIONS.map((item) => item.value)).toEqual([
      "en",
      "es",
      "fr",
      "ru",
      "de",
    ]);
  });

  for (const [language, translations] of Object.entries(expected)) {
    it(`translates the search composer to ${language}`, () => {
      for (const [source, translated] of Object.entries(translations)) {
        expect(translateUi(source, language as "es" | "fr" | "ru" | "de")).toBe(
          translated,
        );
      }
    });
  }
});
