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

  "Your JobAgent journey": {
    es: "Tu camino con JobAgent",
    fr: "Votre parcours avec JobAgent",
    ru: "Ваш путь с JobAgent",
    de: "Ihr Weg mit JobAgent",
  },
  "You have enough application activity to start learning from market response.":
    {
      es: "Ya hay suficiente actividad de candidaturas para aprender de la respuesta del mercado.",
      fr: "Il y a suffisamment d’activité de candidature pour commencer à apprendre des réactions du marché.",
      ru: "Уже достаточно активности по откликам, чтобы анализировать реакцию рынка.",
      de: "Es gibt genügend Bewerbungsaktivität, um aus der Marktreaktion zu lernen.",
    },
  "You have active applications. Review progress while The JobAgent keeps searching.":
    {
      es: "Tienes candidaturas activas. Revisa el progreso mientras The JobAgent sigue buscando.",
      fr: "Vous avez des candidatures actives. Suivez leur progression pendant que The JobAgent poursuit la recherche.",
      ru: "У вас есть активные отклики. Проверяйте их статус, пока The JobAgent продолжает поиск.",
      de: "Sie haben aktive Bewerbungen. Prüfen Sie den Fortschritt, während The JobAgent weitersucht.",
    },
  "Strong matches are ready. The best next action is to review and prepare applications.":
    {
      es: "Hay coincidencias sólidas listas. El siguiente paso es revisarlas y preparar las candidaturas.",
      fr: "De bonnes correspondances sont prêtes. L’étape suivante consiste à les examiner et préparer les candidatures.",
      ru: "Есть сильные совпадения. Следующий шаг — проверить их и подготовить отклики.",
      de: "Starke Treffer sind bereit. Als Nächstes sollten Sie diese prüfen und Bewerbungen vorbereiten.",
    },
  "The JobAgent is building market evidence and watching for stronger matches.":
    {
      es: "The JobAgent recopila señales del mercado y busca coincidencias más fuertes.",
      fr: "The JobAgent accumule des signaux du marché et recherche de meilleures correspondances.",
      ru: "The JobAgent собирает данные рынка и ищет более сильные совпадения.",
      de: "The JobAgent sammelt Marktsignale und sucht nach stärkeren Treffern.",
    },
  "Improve my profile": {
    es: "Mejorar mi perfil",
    fr: "Améliorer mon profil",
    ru: "Улучшить профиль",
    de: "Profil verbessern",
  },
  "Tell us about yourself": {
    es: "Cuéntanos sobre ti",
    fr: "Parlez-nous de vous",
    ru: "Расскажите о себе",
    de: "Erzählen Sie uns von sich",
  },
  "Tell us what you want": {
    es: "Dinos qué buscas",
    fr: "Dites-nous ce que vous recherchez",
    ru: "Скажите, что вы ищете",
    de: "Sagen Sie uns, was Sie suchen",
  },
  "Receive suitable jobs": {
    es: "Recibe vacantes adecuadas",
    fr: "Recevez des offres adaptées",
    ru: "Получайте подходящие вакансии",
    de: "Passende Stellen erhalten",
  },
  "Get an application-ready package": {
    es: "Recibe un paquete listo para postular",
    fr: "Recevez un dossier prêt à candidater",
    ru: "Получайте готовый пакет для отклика",
    de: "Bewerbungsfertiges Paket erhalten",
  },
  "Improve from real outcomes": {
    es: "Mejora con resultados reales",
    fr: "Améliorez-vous grâce aux résultats réels",
    ru: "Улучшайте стратегию по реальным результатам",
    de: "Aus echten Ergebnissen verbessern",
  },
  Step: { es: "Paso", fr: "Étape", ru: "Шаг", de: "Schritt" },
  "The JobAgent found": {
    es: "The JobAgent encontró",
    fr: "The JobAgent a trouvé",
    ru: "The JobAgent нашёл",
    de: "The JobAgent hat gefunden",
  },
  match: {
    es: "coincidencia",
    fr: "correspondance",
    ru: "совпадение",
    de: "Treffer",
  },
  matches: {
    es: "coincidencias",
    fr: "correspondances",
    ru: "совпадений",
    de: "Treffer",
  },
  "These vacancies passed your current search and scoring rules. Open the original posting or prepare an application package.":
    {
      es: "Estas vacantes superaron tus reglas actuales de búsqueda y puntuación. Abre la publicación original o prepara un paquete de candidatura.",
      fr: "Ces offres ont satisfait vos règles actuelles de recherche et de notation. Ouvrez l’annonce originale ou préparez un dossier de candidature.",
      ru: "Эти вакансии прошли текущие правила поиска и оценки. Откройте исходную вакансию или подготовьте пакет для отклика.",
      de: "Diese Stellen haben Ihre aktuellen Such- und Bewertungsregeln erfüllt. Öffnen Sie die Originalanzeige oder bereiten Sie ein Bewerbungspaket vor.",
    },
  "No new matches in this period": {
    es: "No hay nuevas coincidencias en este período",
    fr: "Aucune nouvelle correspondance sur cette période",
    ru: "За этот период новых совпадений нет",
    de: "Keine neuen Treffer in diesem Zeitraum",
  },
  "Monitoring can keep running in the background. You can widen the period or adjust what you are looking for.":
    {
      es: "El monitoreo puede seguir en segundo plano. Puedes ampliar el período o ajustar lo que buscas.",
      fr: "La surveillance peut continuer en arrière-plan. Vous pouvez élargir la période ou ajuster votre recherche.",
      ru: "Мониторинг может продолжаться в фоне. Можно увеличить период или скорректировать параметры поиска.",
      de: "Die Überwachung kann im Hintergrund weiterlaufen. Sie können den Zeitraum erweitern oder die Suche anpassen.",
    },
  "Adjust my search": {
    es: "Ajustar mi búsqueda",
    fr: "Ajuster ma recherche",
    ru: "Настроить поиск",
    de: "Suche anpassen",
  },
  Adjust: { es: "Ajustar", fr: "Ajuster", ru: "Настроить", de: "Anpassen" },
  Posting: { es: "Oferta", fr: "Annonce", ru: "Вакансия", de: "Anzeige" },
  "Prepare application": {
    es: "Preparar candidatura",
    fr: "Préparer la candidature",
    ru: "Подготовить отклик",
    de: "Bewerbung vorbereiten",
  },
  "Loading your latest matches…": {
    es: "Cargando tus últimas coincidencias…",
    fr: "Chargement de vos dernières correspondances…",
    ru: "Загружаем последние совпадения…",
    de: "Neueste Treffer werden geladen…",
  },
  "Could not load matches. Please try again shortly.": {
    es: "No se pudieron cargar las coincidencias. Inténtalo de nuevo en breve.",
    fr: "Impossible de charger les correspondances. Réessayez dans un instant.",
    ru: "Не удалось загрузить совпадения. Попробуйте ещё раз немного позже.",
    de: "Treffer konnten nicht geladen werden. Bitte versuchen Sie es gleich erneut.",
  },
  "24 hours": {
    es: "24 horas",
    fr: "24 heures",
    ru: "24 часа",
    de: "24 Stunden",
  },
  "3 days": { es: "3 días", fr: "3 jours", ru: "3 дня", de: "3 Tage" },
  "7 days": { es: "7 días", fr: "7 jours", ru: "7 дней", de: "7 Tage" },
  "Sign in": {
    es: "Iniciar sesión",
    fr: "Se connecter",
    ru: "Войти",
    de: "Anmelden",
  },
  "Create account": {
    es: "Crear cuenta",
    fr: "Créer un compte",
    ru: "Создать аккаунт",
    de: "Konto erstellen",
  },
  Username: {
    es: "Usuario",
    fr: "Identifiant",
    ru: "Логин",
    de: "Benutzername",
  },
  Password: {
    es: "Contraseña",
    fr: "Mot de passe",
    ru: "Пароль",
    de: "Passwort",
  },
  "Remembered on this browser": {
    es: "Recordado en este navegador",
    fr: "Mémorisé dans ce navigateur",
    ru: "Сохранённые аккаунты в этом браузере",
    de: "In diesem Browser gespeichert",
  },
  "Enter username": {
    es: "Introduce el usuario",
    fr: "Saisissez l’identifiant",
    ru: "Введите логин",
    de: "Benutzername eingeben",
  },
  "Enter password": {
    es: "Introduce la contraseña",
    fr: "Saisissez le mot de passe",
    ru: "Введите пароль",
    de: "Passwort eingeben",
  },
  "Current account": {
    es: "Cuenta actual",
    fr: "Compte actuel",
    ru: "Текущий аккаунт",
    de: "Aktuelles Konto",
  },
  "System Admin": {
    es: "Administrador del sistema",
    fr: "Administrateur système",
    ru: "Системный администратор",
    de: "Systemadministrator",
  },
  Candidate: {
    es: "Candidato",
    fr: "Candidat",
    ru: "Кандидат",
    de: "Kandidat",
  },
  "Admin workspace": {
    es: "Área de administración",
    fr: "Espace administrateur",
    ru: "Административная панель",
    de: "Admin-Bereich",
  },
  "Run search": {
    es: "Iniciar búsqueda",
    fr: "Lancer la recherche",
    ru: "Запустить поиск",
    de: "Suche starten",
  },
  "Close search": {
    es: "Cerrar búsqueda",
    fr: "Fermer la recherche",
    ru: "Закрыть поиск",
    de: "Suche schließen",
  },
  "Search running": {
    es: "Búsqueda en curso",
    fr: "Recherche en cours",
    ru: "Поиск выполняется",
    de: "Suche läuft",
  },
};

export function translateUi(text: string, language: InterfaceLanguage): string {
  if (language === "en") return text;
  return translations[text]?.[language] ?? text;
}
