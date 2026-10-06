import type { InterfaceLanguage } from "@shared/types";

export const INTERFACE_LANGUAGE_OPTIONS: Array<{
  value: InterfaceLanguage;
  label: string;
}> = [
  { value: "en", label: "English" },
  { value: "es", label: "Español" },
  { value: "fr", label: "Français" },
  { value: "ru", label: "Русский" },
  { value: "de", label: "Deutsch" },
];

const translations: Record<
  string,
  Partial<Record<InterfaceLanguage, string>>
> = {
  "Interface language": {
    es: "Idioma de la interfaz",
    fr: "Langue de l’interface",
    ru: "Язык интерфейса",
    de: "Sprache der Oberfläche",
  },
  "Resume & application language": {
    es: "Idioma del CV y las candidaturas",
    fr: "Langue du CV et des candidatures",
    ru: "Язык резюме и откликов",
    de: "Sprache für Lebenslauf und Bewerbungen",
  },
  "AI-assisted": {
    es: "Con IA",
    fr: "Assisté par IA",
    ru: "С поддержкой ИИ",
    de: "KI-gestützt",
  },
  Today: { es: "Hoy", fr: "Aujourd’hui", ru: "Сегодня", de: "Heute" },
  Matches: {
    es: "Vacantes",
    fr: "Offres",
    ru: "Вакансии",
    de: "Stellen",
  },
  Applications: {
    es: "Candidaturas",
    fr: "Candidatures",
    ru: "Отклики",
    de: "Bewerbungen",
  },
  Improve: {
    es: "Mejorar",
    fr: "Améliorer",
    ru: "Улучшить",
    de: "Verbessern",
  },
  Profile: { es: "Perfil", fr: "Profil", ru: "Профиль", de: "Profil" },
  Connections: {
    es: "Conexiones",
    fr: "Connexions",
    ru: "Подключения",
    de: "Verbindungen",
  },
  Account: { es: "Cuenta", fr: "Compte", ru: "Аккаунт", de: "Konto" },
  "Switch account": {
    es: "Cambiar cuenta",
    fr: "Changer de compte",
    ru: "Сменить аккаунт",
    de: "Konto wechseln",
  },
  "Sign out": {
    es: "Cerrar sesión",
    fr: "Se déconnecter",
    ru: "Выйти",
    de: "Abmelden",
  },
  "Set up The JobAgent": {
    es: "Configurar The JobAgent",
    fr: "Configurer The JobAgent",
    ru: "Настройка The JobAgent",
    de: "The JobAgent einrichten",
  },
  "A few focused choices, then you're in. You can review the strategy before it becomes active.":
    {
      es: "Unas pocas decisiones importantes y listo. Podrás revisar la estrategia antes de activarla.",
      fr: "Quelques choix ciblés, puis c’est prêt. Vous pourrez vérifier la stratégie avant son activation.",
      ru: "Несколько важных шагов — и всё готово. Стратегию можно проверить до её активации.",
      de: "Ein paar gezielte Angaben, dann kann es losgehen. Die Strategie kann vor der Aktivierung geprüft werden.",
    },
  "Your search": {
    es: "Qué buscas",
    fr: "Votre recherche",
    ru: "Что вы ищете",
    de: "Ihre Suche",
  },
  "Your strategy": {
    es: "Tu estrategia",
    fr: "Votre stratégie",
    ru: "Ваша стратегия",
    de: "Ihre Strategie",
  },
  "Your resume": {
    es: "Tu CV",
    fr: "Votre CV",
    ru: "Ваше резюме",
    de: "Ihr Lebenslauf",
  },
  Complete: { es: "Listo", fr: "Terminé", ru: "Готово", de: "Fertig" },
  "Up next": {
    es: "Siguiente",
    fr: "À suivre",
    ru: "Далее",
    de: "Als Nächstes",
  },
  Locked: {
    es: "Bloqueado",
    fr: "Verrouillé",
    ru: "Недоступно",
    de: "Gesperrt",
  },
  "Create your workspace account": {
    es: "Crea tu cuenta",
    fr: "Créez votre compte",
    ru: "Создайте аккаунт",
    de: "Konto erstellen",
  },
  "Your best new opportunities, ready to act on": {
    es: "Tus mejores oportunidades nuevas, listas para actuar",
    fr: "Vos meilleures nouvelles opportunités, prêtes à être examinées",
    ru: "Лучшие новые возможности, с которыми уже можно работать",
    de: "Ihre besten neuen Chancen, bereit zum Handeln",
  },
  "Use real market response to improve fit, positioning and profile quality": {
    es: "Usa la respuesta real del mercado para mejorar tu perfil y posicionamiento",
    fr: "Utilisez les réactions réelles du marché pour améliorer votre profil et votre positionnement",
    ru: "Используйте реальную реакцию рынка, чтобы улучшать профиль и позиционирование",
    de: "Nutzen Sie echte Marktreaktionen, um Profil und Positionierung zu verbessern",
  },
};

export function translateUi(text: string, language: InterfaceLanguage): string {
  if (language === "en") return text;
  return translations[text]?.[language] ?? text;
}
