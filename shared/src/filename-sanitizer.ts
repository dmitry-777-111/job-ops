import type { ChatStyleManualLanguage } from "./types";

type FilenameOptions = {
  language?: ChatStyleManualLanguage | null;
};

type PdfFilenameOptions = FilenameOptions & {
  fallbackBase?: string;
};

const LANGUAGE_TRANSLITERATION_MAPS: Record<
  ChatStyleManualLanguage,
  Record<string, string>
> = {
  english: {
    À: "A",
    Á: "A",
    Â: "A",
    Ã: "A",
    Ä: "A",
    Å: "A",
    Æ: "AE",
    Ç: "C",
    È: "E",
    É: "E",
    Ê: "E",
    Ë: "E",
    Ì: "I",
    Í: "I",
    Î: "I",
    Ï: "I",
    Ñ: "N",
    Ò: "O",
    Ó: "O",
    Ô: "O",
    Õ: "O",
    Ö: "O",
    Ø: "O",
    Ù: "U",
    Ú: "U",
    Û: "U",
    Ü: "U",
    Ý: "Y",
    à: "a",
    á: "a",
    â: "a",
    ã: "a",
    ä: "a",
    å: "a",
    æ: "ae",
    ç: "c",
    è: "e",
    é: "e",
    ê: "e",
    ë: "e",
    ì: "i",
    í: "i",
    î: "i",
    ï: "i",
    ñ: "n",
    ò: "o",
    ó: "o",
    ô: "o",
    õ: "o",
    ö: "o",
    ø: "o",
    ù: "u",
    ú: "u",
    û: "u",
    ü: "u",
    ý: "y",
    ÿ: "y",
    ß: "ss",
    Œ: "OE",
    œ: "oe",
  },
  german: {
    Ä: "Ae",
    Ö: "Oe",
    Ü: "Ue",
    ä: "ae",
    ö: "oe",
    ü: "ue",
    ẞ: "SS",
    ß: "ss",
  },
  french: {
    À: "A",
    Â: "A",
    Æ: "AE",
    Ç: "C",
    É: "E",
    È: "E",
    Ê: "E",
    Ë: "E",
    Î: "I",
    Ï: "I",
    Ô: "O",
    Œ: "OE",
    Ù: "U",
    Û: "U",
    Ü: "U",
    Ÿ: "Y",
    à: "a",
    â: "a",
    æ: "ae",
    ç: "c",
    é: "e",
    è: "e",
    ê: "e",
    ë: "e",
    î: "i",
    ï: "i",
    ô: "o",
    œ: "oe",
    ù: "u",
    û: "u",
    ü: "u",
    ÿ: "y",
  },
  spanish: {
    Á: "A",
    É: "E",
    Í: "I",
    Ñ: "N",
    Ó: "O",
    Ú: "U",
    Ü: "U",
    á: "a",
    é: "e",
    í: "i",
    ñ: "n",
    ó: "o",
    ú: "u",
    ü: "u",
  },
  russian: {
    А: "A",
    Б: "B",
    В: "V",
    Г: "G",
    Д: "D",
    Е: "E",
    Ё: "E",
    Ж: "Zh",
    З: "Z",
    И: "I",
    Й: "Y",
    К: "K",
    Л: "L",
    М: "M",
    Н: "N",
    О: "O",
    П: "P",
    Р: "R",
    С: "S",
    Т: "T",
    У: "U",
    Ф: "F",
    Х: "Kh",
    Ц: "Ts",
    Ч: "Ch",
    Ш: "Sh",
    Щ: "Shch",
    Ъ: "",
    Ы: "Y",
    Ь: "",
    Э: "E",
    Ю: "Yu",
    Я: "Ya",
    а: "a",
    б: "b",
    в: "v",
    г: "g",
    д: "d",
    е: "e",
    ё: "e",
    ж: "zh",
    з: "z",
    и: "i",
    й: "y",
    к: "k",
    л: "l",
    м: "m",
    н: "n",
    о: "o",
    п: "p",
    р: "r",
    с: "s",
    т: "t",
    у: "u",
    ф: "f",
    х: "kh",
    ц: "ts",
    ч: "ch",
    ш: "sh",
    щ: "shch",
    ъ: "",
    ы: "y",
    ь: "",
    э: "e",
    ю: "yu",
    я: "ya",
  },
};

function transliterate(
  value: string,
  language?: ChatStyleManualLanguage | null,
) {
  const languageMap = language
    ? LANGUAGE_TRANSLITERATION_MAPS[language]
    : LANGUAGE_TRANSLITERATION_MAPS.english;

  return Array.from(value, (char) => {
    const mapped =
      languageMap[char] ?? LANGUAGE_TRANSLITERATION_MAPS.english[char];
    return mapped ?? char.normalize("NFKD").replace(/\p{Mark}/gu, "");
  }).join("");
}

function sanitizeFilenamePart(value: string, options: FilenameOptions = {}) {
  const cleaned = transliterate(value, options.language).replace(
    /[^a-z0-9]/gi,
    "_",
  );
  return cleaned.replace(/_/g, "") === "" ? "" : cleaned;
}

export function safeFilenamePart(
  value: string,
  options: FilenameOptions = {},
): string {
  const cleaned = sanitizeFilenamePart(value, options);
  return cleaned || "Unknown";
}

export function safePdfFileName(
  value: string,
  options: PdfFilenameOptions = {},
): string {
  const baseValue = value.trim().replace(/\.pdf$/i, "");
  const sanitized = sanitizeFilenamePart(baseValue, {
    language: options.language,
  }).replace(/^_+|_+$/g, "");
  const fallback = sanitizeFilenamePart(options.fallbackBase ?? "Unknown", {
    language: options.language,
  }).replace(/^_+|_+$/g, "");
  return `${sanitized || fallback || "Unknown"}.pdf`;
}
