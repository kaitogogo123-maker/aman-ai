export const SUPPORTED_LOCALES = ['ru', 'kk', 'en', 'zh'] as const;

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export function resolveLocale(locale: string): SupportedLocale {
  return SUPPORTED_LOCALES.includes(locale as SupportedLocale) ? (locale as SupportedLocale) : 'ru';
}

export function detectPreferredLocale(acceptLanguage: string | null | undefined): SupportedLocale {
  if (!acceptLanguage) {
    return 'ru';
  }

  const candidates = acceptLanguage
    .split(',')
    .map((entry) => {
      const [rawTag, ...params] = entry.trim().split(';');
      const tag = rawTag?.toLowerCase() ?? '';
      const qParam = params.find((param) => param.trim().startsWith('q='));
      const quality = qParam ? Number(qParam.trim().slice(2)) : 1;

      return {
        tag,
        quality: Number.isFinite(quality) ? quality : 0
      };
    })
    .sort((left, right) => right.quality - left.quality);

  for (const candidate of candidates) {
    if (candidate.tag.startsWith('kk')) {
      return 'kk';
    }

    if (candidate.tag.startsWith('zh')) {
      return 'zh';
    }

    if (candidate.tag.startsWith('en')) {
      return 'en';
    }

    if (candidate.tag.startsWith('ru')) {
      return 'ru';
    }
  }

  return 'ru';
}

export function localeLabel(locale: SupportedLocale) {
  // 显示标签用国家码风格(KZ 哈萨克斯坦、CN 中国),与 RU/EN 一致;URL/locale 代码仍为 kk/zh
  return (
    {
      ru: 'RU',
      kk: 'KZ',
      en: 'EN',
      zh: 'CN'
    } as const
  )[locale];
}

export function outputLanguageLabel(locale: SupportedLocale) {
  return (
    {
      ru: 'Russian',
      kk: 'Kazakh',
      en: 'English',
      zh: 'Chinese'
    } as const
  )[locale];
}

export function imageKindLabel(
  locale: SupportedLocale,
  mode: 'product' | 'model' | undefined | null,
  kind: 'selling' | 'white' | 'scene' | 'closeup' | 'closeup_white'
): string {
  const safeMode: 'product' | 'model' = mode === 'model' ? 'model' : 'product';
  const safeKind = kind ?? 'selling';
  return (
    {
      ru: {
        product: {
          selling: 'Главное фото товара',
          white: 'Фото на белом фоне',
          scene: 'Lifestyle-фото',
          closeup: 'Крупный план деталей',
          closeup_white: 'Детали товара крупно'
        },
        model: {
          selling: 'Главное фото на модели',
          white: 'Одежда на белом фоне',
          scene: 'Lifestyle-фото',
          closeup: 'Деталь ткани',
          closeup_white: 'Детали крупно'
        }
      },
      kk: {
        product: {
          selling: 'Тауардың негізгі фотосы',
          white: 'Ақ фондағы фото',
          scene: 'Lifestyle фото',
          closeup: 'Деталь жақын планы',
          closeup_white: 'Тауар детальдары'
        },
        model: {
          selling: 'Модельдегі негізгі сурет',
          white: 'Ақ фондағы киім',
          scene: 'Lifestyle фото',
          closeup: 'Мата детальдары',
          closeup_white: 'Детальдар жақын'
        }
      },
      en: {
        product: {
          selling: 'Main product image',
          white: 'White background photo',
          scene: 'Lifestyle photo',
          closeup: 'Close-up details',
          closeup_white: 'Product details close-up'
        },
        model: {
          selling: 'Main model photo',
          white: 'Clothing on white background',
          scene: 'Lifestyle photo',
          closeup: 'Fabric close-up',
          closeup_white: 'Detail close-up'
        }
      },
      zh: {
        product: {
          selling: '主图',
          white: '白底图',
          scene: '生活场景图',
          closeup: '细节特写',
          closeup_white: '白底细节'
        },
        model: {
          selling: '模特主图',
          white: '服装白底图',
          scene: '穿搭场景',
          closeup: '面料特写',
          closeup_white: '白底细节'
        }
      }
    } as const
  )[locale][safeMode][safeKind];
}

export type TargetPlatformCode =
  | 'general'
  | 'kaspi'
  | 'aman'
  | 'wildberries'
  | 'ozon'
  | 'tmall'
  | 'jd'
  | 'amazon'
  | 'tiktok'
  | 'shopee';

export const PLATFORM_LOCAL_ORDER: Record<SupportedLocale, TargetPlatformCode[]> = {
  zh: ['tmall', 'jd', 'tiktok', 'shopee'],
  en: ['amazon', 'tiktok', 'shopee'],
  ru: ['aman', 'ozon', 'wildberries', 'kaspi'],
  kk: ['kaspi', 'aman', 'wildberries', 'ozon']
};

const PLATFORM_BRAND_LABELS: Record<Exclude<TargetPlatformCode, 'general'>, string> = {
  kaspi: 'Kaspi.kz',
  aman: 'Aman.kz',
  wildberries: 'Wildberries',
  ozon: 'Ozon',
  tmall: 'Tmall',
  jd: 'JD.com',
  amazon: 'Amazon',
  tiktok: 'TikTok Shop',
  shopee: 'Shopee'
};

export function platformLabel(locale: SupportedLocale, code: TargetPlatformCode): string {
  if (code === 'general') {
    return getMessages(locale).platformGeneral;
  }
  return PLATFORM_BRAND_LABELS[code];
}

export function fontStyleLabel(
  locale: SupportedLocale,
  style: 'auto' | 'geometric_sans' | 'bold_sans' | 'elegant_serif'
) {
  return (
    {
      ru: {
        auto: 'Авто',
        geometric_sans: 'Современный',
        bold_sans: 'Жирный заголовок',
        elegant_serif: 'Элегантный'
      },
      kk: {
        auto: 'Авто',
        geometric_sans: 'Заманауи',
        bold_sans: 'Қалың тақырып',
        elegant_serif: 'Әсем'
      },
      en: {
        auto: 'Auto',
        geometric_sans: 'Modern Clean',
        bold_sans: 'Bold Headline',
        elegant_serif: 'Elegant Serif'
      },
      zh: {
        auto: '自动',
        geometric_sans: '时尚简约',
        bold_sans: '醒目大字',
        elegant_serif: '高端衬线'
      }
    } as const
  )[locale][style];
}

function russianImageNoun(count: number, accusative = false) {
  const mod10 = count % 10;
  const mod100 = count % 100;

  if (mod10 === 1 && mod100 !== 11) {
    return accusative ? 'изображение' : 'изображение';
  }

  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return accusative ? 'изображения' : 'изображения';
  }

  return accusative ? 'изображений' : 'изображений';
}

// 鉴权流程文案(登录/注册/短信验证码/找回密码),纯前端 UI
export interface AuthMessages {
  loginTitle: string;
  registerTitle: string;
  recoverTitle: string;
  otpTitle: string;
  newPasswordTitle: string;
  subtitle: string;
  recoverSubtitle: string;
  phoneLabel: string;
  phonePlaceholder: string;
  passwordLabel: string;
  newPasswordLabel: string;
  newPasswordPlaceholder: string;
  confirmPasswordLabel: string;
  confirmPasswordPlaceholder: string;
  loginBtn: string;
  receiveSmsBtn: string;
  restoreBtn: string;
  continueBtn: string;
  noAccount: string;
  createAccountLink: string;
  haveAccount: string;
  loginLink: string;
  forgotPassword: string;
  wrongPassword: string;
  wrongCode: string;
  serverError: string;
  numberExists: string;
  numberNotExist: string;
  invalidPhone: string;
  tooManyRequests: string;
  invalidEmail: string;
  passwordsMismatch: string;
  codeSentTo: string;
  resendAfter: (sec: number) => string;
  resendNow: string;
  loginNav: string;
  // 注册账号资料表单(验证码通过后)
  regFirstNameLabel: string;
  regFirstNamePlaceholder: string;
  regLastNameLabel: string;
  regLastNamePlaceholder: string;
  regEmailLabel: string;
  regEmailPlaceholder: string;
  regPasswordLabel: string;
  regPasswordPlaceholder: string;
  regPasswordHint: string;
  regConfirmLabel: string;
  regConfirmPlaceholder: string;
  forwardBtn: string;
  // 创建页未登录拦截 modal
  gateTitle: string;
  gateLoginBtn: string;
  gateRegisterBtn: string;
}

// 「我的-订单」页（marketplace 订单历史，country=kz 本地 / ch 中国商品）
export interface OrdersMessages {
  navOrders: string;
  heading: string;
  tabLocal: string;
  tabChina: string;
  empty: string;
  loadError: string;
  retry: string;
  loading: string;
  loadMore: string;
  priceLabel: string;
  statusLabel: string;
  dateLabel: string;
  trackLabel: string;
  qtyLabel: string;
  loginRequired: string;
}

export interface AdminAccountingMessages {
  heading: string;
  subtitle: string;
  timezoneNote: string;
  passwordLabel: string;
  passwordPlaceholder: string;
  enter: string;
  wrongPassword: string;
  notConfigured: string;
  loading: string;
  loadError: string;
  retry: string;
  summaryUsers: string;
  summaryBalance: string;
  summaryCredits: string;
  summaryTopup: string;
  summaryRefund: string;
  summarySpent: string;
  summaryFalBalance: string;
  falUnavailable: string;
  usersHeading: string;
  ledgerHeading: string;
  exportUsers: string;
  exportLedger: string;
  colPhone: string;
  colName: string;
  colEmail: string;
  colRegistered: string;
  colLastLogin: string;
  colPaid: string;
  colBalance: string;
  colCredited: string;
  colSpent: string;
  colLoginCount: string;
  colTime: string;
  colAmount: string;
  colAmountKzt: string;
  colReason: string;
  colBalanceAfter: string;
  colCity: string;
  colDevice: string;
  colIp: string;
  colLocation: string;
  colEvent: string;
  colIsp: string;
  colLang: string;
  loginsHeading: string;
  exportLogins: string;
  eventLogin: string;
  eventRegister: string;
  empty: string;
  // 赠送试用额度(后台底部工具)
  grantHeading: string;
  grantHint: string;
  grantPhoneLabel: string;
  grantPhonePlaceholder: string;
  grantCountLabel: string;
  grantSubmit: string;
  grantSubmitting: string;
  grantSuccess: string; // 后接:该用户当前额度数值
  grantNoChange: string; // credited=false:该赠送已记录过,余额未变;后接当前额度
  grantErrorNotFound: string;
  grantErrorInvalid: string;
  grantError: string;
}

export interface Messages {
  navCreate: string;
  navHistory: string;
  landingTitle: string;
  landingAccent: string;
  landingBody: string;
  landingOpenApp: string;
  landingViewHistory: string;
  heroBubble: string;
  statImageTypes: string;
  statAspectRatios: string;
  statLanguages: string;
  statApiReady: string;
  productImage: string;
  uploadedProductPreview: string;
  sourceProductLabel: string;
  chooseFile: string;
  noFileSelected: string;
  uploadUpToFiveImages: string;
  primaryImage: string;
  referenceImage: string;
  setAsPrimaryImage: string;
  removeImage: string;
  clearImages: string;
  maxFiveImages: string;
  clearProductInfo: string;
  analyzeWithAi: string;
  reanalyzeWithAi: string;
  analyzingWithAi: string;
  analysisFailed: string;
  analysisRequiresInput: string;
  analysisOutdated: string;
  productName: string;
  targetAudience: string;
  sellingPoints: string;
  materialDescription: string;
  usageInstructions: string;
  productCategory: string;
  resolution: string;
  imageTypes: string;
  imageTypesHint: string;
  preview: string;
  aspectRatio: string;
  moreAspectRatios: string;
  fewerAspectRatios: string;
  model: string;
  modelStandard: string;
  modelStandardDescription: string;
  modelPremium: string;
  modelPremiumDescription: string;
  modelPro: string;
  modelProDescription: string;
  imageLanguage: string;
  imageLanguageMultiHint: string;
  targetPlatform: string;
  targetPlatformHint: string;
  platformGeneral: string;
  platformLocalRecommendation: string;
  morePlatforms: string;
  fewerPlatforms: string;
  multiLangBatchCreated: (count: number) => string;
  fontStyle: string;
  creatingTask: (target: string) => string;
  creatingTaskTargetAll: string;
  generateImages: (count: number) => string;
  quickChipsCategoryLabel: string;
  quickChipsAudienceLabel: string;
  quickChipsStyleLabel: string;
  quickChipsCategories: readonly string[];
  quickChipsAudiences: readonly string[];
  quickChipsStyles: readonly string[];
  chooseAtLeastOneImage: string;
  uploadImageRequired: string;
  accountLogout: string;
  accountTopup: string;
  balanceLabel: string;
  imagesShort: string;
  languageLabel: string;
  paymentNotConfigured: string;
  paymentStartFailed: string;
  paymentPendingConfirmation: string;
  paymentFailed: string;
  insufficientBalance: string;
  paymentConfirmingNoRetry: string;
  uploadFailed: string;
  generationFailed: string;
  generationContentRejected: string;
  historyTitle: string;
  historyHeading: string;
  historyBody: string;
  historyLoading: string;
  historyLoadingBody: string;
  noTasks: string;
  imagesCount: (count: number) => string;
  resultTitle: string;
  resultLoading: string;
  resultReady: (count: number) => string;
  createMore: string;
  downloadSelected: string;
  generatingTitle: string;
  creatingImages: (count: number) => string;
  taskNotFound: string;
  taskRunning: string;
  taskPreparing: string;
  imageN: (index: number) => string;
  // 结果反馈 modal(生成完成后)
  feedbackTitle: string;
  feedbackSubtitle: string;
  // Aman AI 改版新增
  navHowItWorks: string;
  navPricing: string;
  navContacts: string;
  statSteps: string;
  statUsers: string;
  howTitle: string;
  howSubtitle: string;
  how1Title: string;
  how1Body: string;
  how1Bullets: readonly string[];
  how2Title: string;
  how2Body: string;
  how3Title: string;
  how3Body: string;
  how3Bullets: readonly string[];
  pricingTitle: string;
  pricingSubtitle: string;
  pricingImagesLabel: (count: number) => string;
  pricingPlusLabel: string;
  pricingPerImageSuffix: string;
  pricingBadge: string;
  pricingCta: string;
  pricingBuy: string;
  currencyTenge: string;
  contactsTitle: string;
  contactsSubtitle: string;
  contactPhoneLabel: string;
  contactEmailLabel: string;
  contactEmail: string;
  supportNumberLabel: string;
  contactCallLabel: string;
  contactSmsLabel: string;
  backLabel: string;
  imageCountLabel: string;
  totalCostLabel: string;
  // 历史页（卡片网格 + 筛选）
  historyTotalLabel: string;
  dateFromLabel: string;
  dateToLabel: string;
  resetLabel: string;
  categoryLabel: string;
  allCategoryLabel: string;
  viewLabel: string;
  cardTitleFallback: string;
  loadingLabel: string;
  // 结果详情页
  backToHistory: string;
  platformMetaLabel: string;
  dateCreatedLabel: string;
  imagesMetaLabel: string;
  photoCount: (count: number) => string;
  downloadAllLabel: string;
  shareLabel: string;
  deleteLabel: string;
  deleteConfirm: string;
  toastLoginSuccess: string;
  toastAccountCreated: string;
  toastPasswordChanged: string;
  toastLinkCopied: string;
  toastPaymentUnavailable: string;
  auth: AuthMessages;
  orders: OrdersMessages;
  adminAccounting: AdminAccountingMessages;
}

const MESSAGES: Record<SupportedLocale, Messages> = {
  ru: {
    navCreate: 'Создать',
    navHistory: 'История',
    landingTitle: 'Фото товара →',
    landingAccent: 'карточка для Kaspi за 1 минуту',
    landingBody:
      'Создавайте готовые изображения для Kaspi, Wildberries, TikTok и Aman без дизайнера.',
    landingOpenApp: 'Попробовать сейчас',
    landingViewHistory: 'История',
    heroBubble: 'хочу классные карточки для моего товара',
    statImageTypes: 'типов изображений',
    statAspectRatios: 'соотношений сторон',
    statLanguages: 'языка вывода',
    statApiReady: 'API-ядро готово',
    productImage: 'Изображение товара',
    uploadedProductPreview: 'Предпросмотр товара',
    sourceProductLabel: 'Товар для загрузки',
    chooseFile: 'Выберите файл',
    noFileSelected: 'Файл не выбран',
    uploadUpToFiveImages: 'Загрузите до 5 фото товара',
    primaryImage: 'Главное фото',
    referenceImage: 'Референс',
    setAsPrimaryImage: 'Сделать главным',
    removeImage: 'Удалить',
    clearImages: 'Очистить',
    maxFiveImages: 'Можно загрузить не больше 5 изображений.',
    clearProductInfo: 'Очистить описание',
    analyzeWithAi: 'AI заполнит за меня',
    reanalyzeWithAi: 'Перезаполнить с AI',
    analyzingWithAi: 'AI анализирует...',
    analysisFailed: 'Не удалось выполнить анализ.',
    analysisRequiresInput: 'Сначала загрузите фото товара или заполните описание.',
    analysisOutdated: 'Описание изменилось. Запустите AI-анализ снова, чтобы обновить структурированные поля.',
    productName: 'Название товара',
    targetAudience: 'Целевая аудитория',
    sellingPoints: 'Описание преимуществ',
    materialDescription: 'Описание материалов',
    usageInstructions: 'Способ использования',
    productCategory: 'Категория товара',
    resolution: 'Разрешение',
    imageTypes: 'Типы изображений',
    imageTypesHint: 'Укажите, сколько изображений нужно для каждого типа.',
    preview: 'Предпросмотр',
    aspectRatio: 'Формат фото',
    moreAspectRatios: 'Ещё',
    fewerAspectRatios: 'Скрыть',
    model: 'Выбор версии',
    modelStandard: 'Базовая Standard',
    modelStandardDescription: 'баланс качества изображения и сходства, лучше понимает задачу',
    modelPremium: 'Премиум Premium',
    modelPremiumDescription: 'усиленная генерация, высокое качество изображения и более точное следование описанию',
    modelPro: 'Профессиональная Pro',
    modelProDescription: 'надёжный многоязычный текст на изображении: заголовки, цены и описания на RU/KK/ZH/EN без ошибок',
    imageLanguage: 'Язык текста на готовом изображении',
    imageLanguageMultiHint: 'Можно выбрать несколько языков — по каждому будет создан отдельный пакет.',
    targetPlatform: 'Где вы продаёте?',
    targetPlatformHint: 'Выбор площадки автоматически подбирает формат фото, языки и набор изображений.',
    platformGeneral: 'Для всех площадок',
    platformLocalRecommendation: 'Рекомендуемая для вашего региона',
    morePlatforms: 'Другие площадки',
    fewerPlatforms: 'Скрыть',
    multiLangBatchCreated: (count) => `Создано ${count} пакетов (${russianImageNoun(count, true)} для каждого языка)`,
    fontStyle: 'Стиль шрифта',
    creatingTask: (target) => `Готовим фото для ${target}...`,
    creatingTaskTargetAll: 'всех маркетплейсов',
    // 客户原文: "Create image" - 主按钮不显示 count, count 参数保留只为类型兼容
    generateImages: () => 'Создать изображение',
    quickChipsCategoryLabel: 'Категория товара',
    quickChipsAudienceLabel: 'Целевая аудитория',
    quickChipsStyleLabel: 'Стиль фото',
    quickChipsCategories: ['Одежда', 'Косметика', 'Дом', 'Электроника'],
    quickChipsAudiences: ['Женщины', 'Мужчины', 'Дети'],
    quickChipsStyles: ['Aman', 'Kaspi', 'Wildberries', 'Премиум'],
    chooseAtLeastOneImage: 'Выберите хотя бы одно изображение.',
    uploadImageRequired: 'Сначала загрузите изображение товара.',
    accountLogout: 'Выйти',
    accountTopup: 'Пополнить',
    balanceLabel: 'Баланс',
    imagesShort: 'изобр.',
    languageLabel: 'Язык',
    paymentNotConfigured: 'Оплата пока подключается. Мы сообщим, когда пополнение будет доступно.',
    paymentStartFailed: 'Не удалось открыть оплату. Попробуйте позже.',
    paymentPendingConfirmation: 'Платёж получен. Баланс обновится после подтверждения.',
    paymentFailed: 'Платёж не завершён или был отменён.',
    insufficientBalance: 'Недостаточно средств. Пополните баланс.',
    paymentConfirmingNoRetry: 'Платёж получен, идёт подтверждение. Пожалуйста, не платите повторно.',
    uploadFailed: 'Не удалось загрузить файл.',
    generationFailed: 'Не удалось запустить генерацию.',
    generationContentRejected:
      'Модель изображений отклонила запрос по правилам безопасности контента. Избегайте описаний людей или персонажей (особенно аниме-персонажей) и попробуйте снова с реальным товаром.',
    historyTitle: 'История',
    historyHeading: 'История создания',
    historyBody: 'Здесь сохраняются последние задачи генерации для текущего устройства.',
    historyLoading: 'Загружаем историю...',
    historyLoadingBody: 'Проверяем последние генерации для этого устройства. Обычно это занимает несколько секунд.',
    noTasks: 'Пока нет задач. Сначала запустите генерацию.',
    imagesCount: (count) => `${count} изображ.`,
    resultTitle: 'Результат',
    resultLoading: 'Загрузка результата',
    resultReady: (count) => `Готово · ${count} изображ.`,
    createMore: 'Создать ещё',
    downloadSelected: 'Скачать выбранное',
    generatingTitle: 'Генерация',
    creatingImages: (count) => `Создаём ${count} ${russianImageNoun(count)}`,
    taskNotFound: 'Задача не найдена или генерация завершилась ошибкой.',
    taskRunning: 'Генерация выполняется. Эта страница обновляется, пока каждое изображение не будет готово.',
    taskPreparing: 'Подготавливаем задачу генерации.',
    feedbackTitle: 'Как вам результат?',
    feedbackSubtitle: 'Ваше мнение поможет нам стать лучше',
    imageN: (index) => `Изображение ${index}`,
    navHowItWorks: 'Как это работает',
    navPricing: 'Цены',
    navContacts: 'Наши контакты',
    statSteps: 'простых шага',
    statUsers: 'довольных пользователей',
    howTitle: 'Как это работает',
    howSubtitle: 'Простой трёхшаговый процесс для создания профессиональных карточек товаров',
    how1Title: 'Загрузите фото товара',
    how1Body: 'Просто перетащите изображение вашего продукта в область загрузки или выберите файл из галереи. Поддерживаются форматы JPG, PNG и WEBP.',
    how1Bullets: ['Быстрая загрузка без потери качества', 'Автоматическое улучшение изображения', 'Поддержка пакетной загрузки'],
    how2Title: 'Выберите концепт',
    how2Body: 'Выберите один из готовых шаблонов или создайте свой уникальный концепт. Наш AI адаптирует товар под выбранный стиль.',
    how3Title: 'Получите результат',
    how3Body: 'AI автоматически добавит инфографику, преимущества товара и адаптирует изображение под требования выбранного маркетплейса.',
    how3Bullets: ['Автоматическая инфографика', 'Адаптация под маркетплейсы', 'Оптимизация под форматы (1:1, 3:4, 9:16)'],
    pricingTitle: 'Цены',
    pricingSubtitle: 'Прозрачная тарификация. Платите только за то, что используете.',
    pricingImagesLabel: (count) => `${count} ${russianImageNoun(count)}`,
    pricingPlusLabel: '5+ изображений',
    pricingPerImageSuffix: 'за изображение',
    pricingBadge: 'Выгодно',
    pricingCta: 'Начать',
    pricingBuy: 'Купить',
    currencyTenge: '₸',
    contactsTitle: 'Наши контакты',
    contactsSubtitle: 'Свяжитесь с нами любым удобным способом.',
    contactPhoneLabel: 'Телефон',
    contactEmailLabel: 'Эл. почта',
    contactEmail: 'info@aman.ai',
    supportNumberLabel: 'Номер поддержки',
    contactCallLabel: 'Позвонить',
    contactSmsLabel: 'Написать в WhatsApp',
    backLabel: 'Назад',
    imageCountLabel: 'Количество фото',
    totalCostLabel: 'Общая сумма',
    historyTotalLabel: 'Всего карточек',
    dateFromLabel: 'Дата от',
    dateToLabel: 'Дата до',
    resetLabel: 'Сбросить',
    categoryLabel: 'Категория',
    allCategoryLabel: 'Все',
    viewLabel: 'Просмотреть',
    cardTitleFallback: 'Карточка товара',
    loadingLabel: 'Загрузка…',
    backToHistory: 'Назад к истории',
    platformMetaLabel: 'Платформа',
    dateCreatedLabel: 'Дата создания',
    imagesMetaLabel: 'Изображений',
    photoCount: (count) => `${count} фото`,
    downloadAllLabel: 'Скачать все',
    shareLabel: 'Поделиться',
    deleteLabel: 'Удалить',
    deleteConfirm: 'Удалить эту карточку?',
    toastLoginSuccess: 'Вы вошли в аккаунт',
    toastAccountCreated: 'Аккаунт создан',
    toastPasswordChanged: 'Пароль изменён',
    toastLinkCopied: 'Ссылка скопирована',
    toastPaymentUnavailable: 'Оплата временно недоступна. Пожалуйста, попробуйте позже.',
    orders: {
      navOrders: 'Заказы',
      heading: 'Мои заказы',
      tabLocal: 'Местные товары',
      tabChina: 'Товары из Китая',
      empty: 'Заказов пока нет.',
      loadError: 'Не удалось загрузить заказы.',
      retry: 'Повторить',
      loading: 'Загрузка...',
      loadMore: 'Показать ещё',
      priceLabel: 'Сумма',
      statusLabel: 'Статус',
      dateLabel: 'Дата',
      trackLabel: 'Трек-код',
      qtyLabel: 'Кол-во',
      loginRequired: 'Войдите, чтобы увидеть свои заказы.'
    },
    adminAccounting: {
      heading: 'Внутренняя бухгалтерия',
      subtitle: 'Суммы (₸) — реальные платежи; баланс/начисления/расход — кредиты генерации (шт.), не деньги.',
      timezoneNote: 'Все даты и время — по Астане (UTC+5)',
      passwordLabel: 'Пароль администратора',
      passwordPlaceholder: 'Введите пароль',
      enter: 'Войти',
      wrongPassword: 'Неверный пароль.',
      notConfigured: 'Пароль администратора не настроен.',
      loading: 'Загрузка...',
      loadError: 'Не удалось загрузить данные.',
      retry: 'Повторить',
      summaryUsers: 'Пользователи',
      summaryBalance: 'Остаток кредитов (шт.)',
      summaryCredits: 'Начислено кредитов (шт.)',
      summaryTopup: 'Доход (₸)',
      summaryRefund: 'Возвраты (₸)',
      summarySpent: 'Списано (шт.)',
      summaryFalBalance: 'Баланс API генерации ($)',
      falUnavailable: 'недоступно',
      usersHeading: 'Пользователи',
      ledgerHeading: 'Финансовые операции',
      exportUsers: 'Экспорт пользователей (CSV)',
      exportLedger: 'Экспорт операций (CSV)',
      colPhone: 'Телефон',
      colName: 'Имя',
      colEmail: 'Email',
      colRegistered: 'Регистрация',
      colLastLogin: 'Последний вход',
      colPaid: 'Оплачено (₸)',
      colBalance: 'Баланс (шт.)',
      colCredited: 'Начислено (шт.)',
      colSpent: 'Списано (шт.)',
      colLoginCount: 'Входов',
      colTime: 'Время',
      colLang: 'Язык',
      colAmount: 'Кредиты (±)',
      colAmountKzt: 'Сумма (₸)',
      colReason: 'Основание',
      colBalanceAfter: 'Остаток (шт.)',
      colCity: 'Город',
      colDevice: 'Устройство',
      colIp: 'IP',
      colLocation: 'Местоположение',
      colEvent: 'Событие',
      colIsp: 'Оператор',
      loginsHeading: 'Активность входов',
      exportLogins: 'Экспорт входов (CSV)',
      eventLogin: 'вход',
      eventRegister: 'регистрация',
      empty: 'Нет данных',
      grantHeading: 'Начислить пробные генерации',
      grantHint: 'Пользователь должен быть уже зарегистрирован. Начисляется как бесплатный бонус (не учитывается в выручке).',
      grantPhoneLabel: 'Номер телефона',
      grantPhonePlaceholder: '7086110912',
      grantCountLabel: 'Количество (шт.)',
      grantSubmit: 'Начислить',
      grantSubmitting: 'Начисление…',
      grantSuccess: 'Готово. Текущий баланс пользователя:',
      grantNoChange: 'Без изменений: это начисление уже было записано. Текущий баланс:',
      grantErrorNotFound: 'Номер не зарегистрирован. Сначала попросите пользователя зарегистрироваться.',
      grantErrorInvalid: 'Укажите корректный номер и количество (1–100).',
      grantError: 'Не удалось начислить. Повторите попытку.'
    },
    auth: {
      loginTitle: 'Войдите в ваш аккаунт',
      registerTitle: 'Создать аккаунт',
      recoverTitle: 'Восстановление пароля',
      otpTitle: 'Введите код из СМС',
      newPasswordTitle: 'Восстановление пароля',
      subtitle: 'Введите данные, чтоб войти в личный кабинет',
      recoverSubtitle: 'Укажите ваш номер, на который мы отправим вам СМС',
      phoneLabel: 'Номер телефона',
      phonePlaceholder: '7086110912',
      passwordLabel: 'Пароль',
      newPasswordLabel: 'Придумайте новый пароль',
      newPasswordPlaceholder: 'Напишите пароль',
      confirmPasswordLabel: 'Подтвердите новый пароль',
      confirmPasswordPlaceholder: 'Повторите пароль',
      loginBtn: 'Войти',
      receiveSmsBtn: 'Получить СМС',
      restoreBtn: 'Восстановить',
      continueBtn: 'Продолжить',
      noAccount: 'У вас нет аккаунта?',
      createAccountLink: 'Создать аккаунт',
      haveAccount: 'У вас уже есть аккаунт?',
      loginLink: 'Войти',
      forgotPassword: 'Забыли пароль?',
      wrongPassword: 'Неправильный пароль',
      wrongCode: 'Неправильный код',
      serverError: 'Сервис временно недоступен. Попробуйте позже.',
      numberExists: 'Такой номер уже существует',
      invalidPhone: 'Введите корректный номер телефона',
      tooManyRequests: 'Слишком много попыток. Попробуйте позже.',
      invalidEmail: 'Введите корректный email',
      passwordsMismatch: 'Пароли не совпадают',
      codeSentTo: 'Код отправлен на номер',
      resendAfter: (sec) => `Отправить код ещё раз через ${sec} сек`,
      resendNow: 'Отправить код ещё раз',
      loginNav: 'Войти',
      numberNotExist: 'Такой номер не существует',
      regFirstNameLabel: 'Имя',
      regFirstNamePlaceholder: 'Введите имя',
      regLastNameLabel: 'Фамилия',
      regLastNamePlaceholder: 'Введите фамилию',
      regEmailLabel: 'Почта',
      regEmailPlaceholder: 'Введите почту',
      regPasswordLabel: 'Придумайте пароль',
      regPasswordPlaceholder: 'Напишите пароль',
      regPasswordHint: 'От 4 до 20 символов',
      regConfirmLabel: 'Подтвердите пароль',
      regConfirmPlaceholder: 'Повторите пароль',
      forwardBtn: 'Вперед',
      gateTitle: 'Создание карточек доступно после входа или регистрации',
      gateLoginBtn: 'Войти',
      gateRegisterBtn: 'Регистрация'
    }
  },
  kk: {
    navCreate: 'Жасау',
    navHistory: 'Тарих',
    landingTitle: 'Тауар фотосы →',
    landingAccent: 'Kaspi карточкасы 1 минутта',
    landingBody:
      'Kaspi, Wildberries, TikTok және Aman үшін дизайнерсіз дайын визуал жасаңыз.',
    landingOpenApp: 'Қазір байқап көру',
    landingViewHistory: 'Тарих',
    heroBubble: 'тауарыма арналған керемет карточкалар керек',
    statImageTypes: 'сурет түрі',
    statAspectRatios: 'пропорция',
    statLanguages: 'шығыс тілі',
    statApiReady: 'API өзегі дайын',
    productImage: 'Тауар суреті',
    uploadedProductPreview: 'Тауарды алдын ала қарау',
    sourceProductLabel: 'Жүктелетін тауар',
    chooseFile: 'Файл таңдау',
    noFileSelected: 'Файл таңдалмаған',
    uploadUpToFiveImages: '5 суретке дейін жүктеңіз',
    primaryImage: 'Негізгі сурет',
    referenceImage: 'Қосымша сурет',
    setAsPrimaryImage: 'Негізгі ету',
    removeImage: 'Жою',
    clearImages: 'Тазалау',
    maxFiveImages: 'Ең көбі 5 сурет жүктеуге болады.',
    clearProductInfo: 'Сипаттаманы тазалау',
    analyzeWithAi: 'AI өзі толтырады',
    reanalyzeWithAi: 'AI-мен қайта толтыру',
    analyzingWithAi: 'AI талдап жатыр...',
    analysisFailed: 'Талдау орындалмады.',
    analysisRequiresInput: 'Алдымен тауар суретін жүктеңіз немесе сипаттаманы толтырыңыз.',
    analysisOutdated: 'Сипаттама өзгерді. Құрылымдалған өрістерді жаңарту үшін AI-талдауын қайта іске қосыңыз.',
    productName: 'Тауар атауы',
    targetAudience: 'Мақсатты аудитория',
    sellingPoints: 'Артықшылық сипаттамасы',
    materialDescription: 'Материал сипаттамасы',
    usageInstructions: 'Пайдалану тәсілі',
    productCategory: 'Тауар санаты',
    resolution: 'Ажыратымдылық',
    imageTypes: 'Сурет санаттары',
    imageTypesHint: 'Әр санат бойынша неше сурет керек екенін таңдаңыз.',
    preview: 'Алдын ала қарау',
    aspectRatio: 'Сурет форматы',
    moreAspectRatios: 'Көбірек',
    fewerAspectRatios: 'Жасыру',
    model: 'Нұсқа таңдау',
    modelStandard: 'Базалық Standard',
    modelStandardDescription: 'сурет сапасы мен ұқсастық теңгерімі, тапсырманы жақсы түсінеді',
    modelPremium: 'Премиум Premium',
    modelPremiumDescription: 'күшейтілген генерация, жоғары сапалы сурет және сипаттаманы дәлірек орындайды',
    modelPro: 'Кәсіби Pro',
    modelProDescription: 'суреттегі көп тілді мәтін сенімді: тақырып, баға, сипаттама RU/KK/ZH/EN тілдерінде қатесіз',
    imageLanguage: 'Дайын суреттегі мәтін тілі',
    imageLanguageMultiHint: 'Бірнеше тіл таңдауға болады — әрқайсысы бойынша бөлек пакет жасалады.',
    targetPlatform: 'Қайда сатасыз?',
    targetPlatformHint: 'Алаңды таңдау сурет форматын, тілдерді және сурет жинағын автоматты түрде келтіреді.',
    platformGeneral: 'Барлық алаңдарға',
    platformLocalRecommendation: 'Сіздің аймағыңызға ұсынылады',
    morePlatforms: 'Басқа алаңдар',
    fewerPlatforms: 'Жасыру',
    multiLangBatchCreated: (count) => `${count} пакет тіл бойынша жасалды`,
    fontStyle: 'Қаріп стилі',
    creatingTask: (target) => `${target} үшін сурет дайындалуда...`,
    creatingTaskTargetAll: 'барлық маркетплейстер',
    generateImages: () => 'Сурет жасау',
    quickChipsCategoryLabel: 'Тауар санаты',
    quickChipsAudienceLabel: 'Мақсатты аудитория',
    quickChipsStyleLabel: 'Сурет стилі',
    quickChipsCategories: ['Киім', 'Косметика', 'Үй', 'Электроника'],
    quickChipsAudiences: ['Әйелдер', 'Ер адамдар', 'Балалар'],
    quickChipsStyles: ['Aman', 'Kaspi', 'Wildberries', 'Премиум'],
    chooseAtLeastOneImage: 'Кемінде бір сурет таңдаңыз.',
    uploadImageRequired: 'Алдымен тауар суретін жүктеңіз.',
    accountLogout: 'Шығу',
    accountTopup: 'Толтыру',
    balanceLabel: 'Баланс',
    imagesShort: 'сурет',
    languageLabel: 'Тіл',
    paymentNotConfigured: 'Төлем әзірге қосылып жатыр. Баланс толтыру қолжетімді болғанда хабарлаймыз.',
    paymentStartFailed: 'Төлемді ашу мүмкін болмады. Кейінірек қайталап көріңіз.',
    paymentPendingConfirmation: 'Төлем қабылданды. Баланс растаудан кейін жаңартылады.',
    paymentFailed: 'Төлем аяқталмады немесе тоқтатылды.',
    insufficientBalance: 'Қаражат жеткіліксіз. Балансты толтырыңыз.',
    paymentConfirmingNoRetry: 'Төлем қабылданды, расталуда. Қайтадан төлемеңіз.',
    uploadFailed: 'Файлды жүктеу сәтсіз аяқталды.',
    generationFailed: 'Генерацияны бастау сәтсіз аяқталды.',
    generationContentRejected:
      'Сурет моделі мазмұн қауіпсіздігі ережелері бойынша сұранысты қабылдамады. Адам немесе кейіпкер сипаттамаларынан (әсіресе аниме кейіпкерлерінен) аулақ болып, нақты тауармен қайта көріңіз.',
    historyTitle: 'Тарих',
    historyHeading: 'Жасау тарихы',
    historyBody: 'Мұнда осы құрылғыдағы соңғы генерация тапсырмалары сақталады.',
    historyLoading: 'Тарих жүктеліп жатыр...',
    historyLoadingBody: 'Осы құрылғыдағы соңғы генерацияларды тексеріп жатырмыз. Әдетте бірнеше секунд қана алады.',
    noTasks: 'Әзірге тапсырма жоқ. Алдымен генерацияны іске қосыңыз.',
    imagesCount: (count) => `${count} сурет`,
    resultTitle: 'Нәтиже',
    resultLoading: 'Нәтиже жүктелуде',
    resultReady: (count) => `Дайын · ${count} сурет`,
    createMore: 'Тағы жасау',
    downloadSelected: 'Таңдалғанын жүктеу',
    generatingTitle: 'Генерация',
    creatingImages: (count) => `${count} сурет жасалып жатыр`,
    taskNotFound: 'Тапсырма табылмады немесе генерация қате аяқталды.',
    taskRunning: 'Генерация жүріп жатыр. Бұл бет әр сурет дайын болғанша жаңарып отырады.',
    taskPreparing: 'Генерация тапсырмасы дайындалып жатыр.',
    feedbackTitle: 'Нәтиже қалай?',
    feedbackSubtitle: 'Сіздің пікіріңіз бізге жақсаруға көмектеседі',
    imageN: (index) => `${index}-сурет`,
    navHowItWorks: 'Қалай жұмыс істейді',
    navPricing: 'Бағалар',
    navContacts: 'Байланыс',
    statSteps: 'қарапайым қадам',
    statUsers: 'риза пайдаланушы',
    howTitle: 'Қалай жұмыс істейді',
    howSubtitle: 'Кәсіби тауар карточкаларын жасаудың қарапайым үш қадамдық процесі',
    how1Title: 'Тауар суретін жүктеңіз',
    how1Body: 'Тауарыңыздың суреттерін жүктеу аймағына апарыңыз немесе галереядан файл таңдаңыз. JPG, PNG және WEBP форматтары қолдау табады.',
    how1Bullets: ['Сапасын жоғалтпай жылдам жүктеу', 'Суретті автоматты жақсарту', 'Пакеттік жүктеуді қолдау'],
    how2Title: 'Концепт таңдаңыз',
    how2Body: 'Дайын үлгілердің бірін таңдаңыз немесе өзіңіздің бірегей концептіңізді жасаңыз. AI тауарды таңдалған стильге бейімдейді.',
    how3Title: 'Нәтиже алыңыз',
    how3Body: 'AI инфографика мен тауар артықшылықтарын автоматты қосып, суретті таңдалған маркетплейс талаптарына бейімдейді.',
    how3Bullets: ['Автоматты инфографика', 'Маркетплейстерге бейімдеу', 'Форматтарға оңтайландыру (1:1, 3:4, 9:16)'],
    pricingTitle: 'Бағалар',
    pricingSubtitle: 'Ашық тарификация. Тек пайдаланғаныңыз үшін төлейсіз.',
    pricingImagesLabel: (count) => `${count} сурет`,
    pricingPlusLabel: '5+ сурет',
    pricingPerImageSuffix: 'сурет үшін',
    pricingBadge: 'Тиімді',
    pricingCta: 'Бастау',
    pricingBuy: 'Сатып алу',
    currencyTenge: '₸',
    contactsTitle: 'Байланыс',
    contactsSubtitle: 'Бізбен кез келген ыңғайлы тәсілмен хабарласыңыз.',
    contactPhoneLabel: 'Телефон',
    contactEmailLabel: 'Эл. пошта',
    contactEmail: 'info@aman.ai',
    supportNumberLabel: 'Қолдау нөмірі',
    contactCallLabel: 'Қоңырау шалу',
    contactSmsLabel: 'WhatsApp арқылы жазу',
    backLabel: 'Артқа',
    imageCountLabel: 'Фото саны',
    totalCostLabel: 'Жалпы сома',
    historyTotalLabel: 'Барлық карточка',
    dateFromLabel: 'Күннен',
    dateToLabel: 'Күнге дейін',
    resetLabel: 'Тазарту',
    categoryLabel: 'Санат',
    allCategoryLabel: 'Барлығы',
    viewLabel: 'Қарау',
    cardTitleFallback: 'Тауар карточкасы',
    loadingLabel: 'Жүктелуде…',
    backToHistory: 'Тарихқа оралу',
    platformMetaLabel: 'Алаң',
    dateCreatedLabel: 'Жасалған күні',
    imagesMetaLabel: 'Суреттер',
    photoCount: (count) => `${count} фото`,
    downloadAllLabel: 'Барлығын жүктеу',
    shareLabel: 'Бөлісу',
    deleteLabel: 'Жою',
    deleteConfirm: 'Бұл карточканы жою керек пе?',
    toastLoginSuccess: 'Сіз аккаунтқа кірдіңіз',
    toastAccountCreated: 'Аккаунт жасалды',
    toastPasswordChanged: 'Құпиясөз өзгертілді',
    toastLinkCopied: 'Сілтеме көшірілді',
    toastPaymentUnavailable: 'Төлем уақытша қолжетімсіз. Кейінірек қайталап көріңіз.',
    orders: {
      navOrders: 'Тапсырыстар',
      heading: 'Менің тапсырыстарым',
      tabLocal: 'Жергілікті тауарлар',
      tabChina: 'Қытай тауарлары',
      empty: 'Әзірге тапсырыс жоқ.',
      loadError: 'Тапсырыстарды жүктеу мүмкін болмады.',
      retry: 'Қайталау',
      loading: 'Жүктелуде...',
      loadMore: 'Тағы көрсету',
      priceLabel: 'Сома',
      statusLabel: 'Күйі',
      dateLabel: 'Күні',
      trackLabel: 'Трек-код',
      qtyLabel: 'Саны',
      loginRequired: 'Тапсырыстарыңызды көру үшін кіріңіз.'
    },
    adminAccounting: {
      heading: 'Ішкі бухгалтерия',
      subtitle: 'Сомалар (₸) — нақты төлемдер; баланс/есептеу/шығыс — генерация кредиттері (дана), ақша емес.',
      timezoneNote: 'Барлық күн мен уақыт — Астана уақыты (UTC+5)',
      passwordLabel: 'Әкімші құпиясөзі',
      passwordPlaceholder: 'Құпиясөзді енгізіңіз',
      enter: 'Кіру',
      wrongPassword: 'Құпиясөз қате.',
      notConfigured: 'Әкімші құпиясөзі бапталмаған.',
      loading: 'Жүктелуде...',
      loadError: 'Деректерді жүктеу мүмкін болмады.',
      retry: 'Қайталау',
      summaryUsers: 'Пайдаланушылар',
      summaryBalance: 'Кредит қалдығы (дана)',
      summaryCredits: 'Есептелген кредит (дана)',
      summaryTopup: 'Табыс (₸)',
      summaryRefund: 'Қайтарымдар (₸)',
      summarySpent: 'Шығыс (дана)',
      summaryFalBalance: 'Генерация API балансы ($)',
      falUnavailable: 'қолжетімсіз',
      usersHeading: 'Пайдаланушылар',
      ledgerHeading: 'Қаржы операциялары',
      exportUsers: 'Пайдаланушыларды экспорттау (CSV)',
      exportLedger: 'Операцияларды экспорттау (CSV)',
      colPhone: 'Телефон',
      colName: 'Аты',
      colEmail: 'Email',
      colRegistered: 'Тіркелген',
      colLastLogin: 'Соңғы кіру',
      colPaid: 'Төленген (₸)',
      colBalance: 'Баланс (дана)',
      colCredited: 'Есептелді (дана)',
      colSpent: 'Шығыс (дана)',
      colLoginCount: 'Кірулер',
      colTime: 'Уақыт',
      colLang: 'Тіл',
      colAmount: 'Кредит (±)',
      colAmountKzt: 'Сома (₸)',
      colReason: 'Негіз',
      colBalanceAfter: 'Қалдық (дана)',
      colCity: 'Қала',
      colDevice: 'Құрылғы',
      colIp: 'IP',
      colLocation: 'Орналасуы',
      colEvent: 'Оқиға',
      colIsp: 'Оператор',
      loginsHeading: 'Кіру журналы',
      exportLogins: 'Кірулерді экспорттау (CSV)',
      eventLogin: 'кіру',
      eventRegister: 'тіркелу',
      empty: 'Дерек жоқ',
      grantHeading: 'Сынақ генерацияларын беру',
      grantHint: 'Пайдаланушы алдын ала тіркелген болуы керек. Тегін бонус ретінде беріледі (табысқа кірмейді).',
      grantPhoneLabel: 'Телефон нөмірі',
      grantPhonePlaceholder: '7086110912',
      grantCountLabel: 'Саны (дана)',
      grantSubmit: 'Беру',
      grantSubmitting: 'Беріліп жатыр…',
      grantSuccess: 'Дайын. Пайдаланушының ағымдағы балансы:',
      grantNoChange: 'Өзгеріссіз: бұл есептеу бұрын тіркелген. Ағымдағы баланс:',
      grantErrorNotFound: 'Нөмір тіркелмеген. Алдымен пайдаланушыдан тіркелуін сұраңыз.',
      grantErrorInvalid: 'Дұрыс нөмір мен санды енгізіңіз (1–100).',
      grantError: 'Беру сәтсіз аяқталды. Қайталап көріңіз.'
    },
    auth: {
      loginTitle: 'Жеке кабинетке кіру',
      registerTitle: 'Аккаунт құру',
      recoverTitle: 'Құпиясөзді қалпына келтіру',
      otpTitle: 'СМС кодын енгізіңіз',
      newPasswordTitle: 'Құпиясөзді қалпына келтіру',
      subtitle: 'Жеке кабинетке кіру үшін деректерді енгізіңіз',
      recoverSubtitle: 'СМС жіберетін нөміріңізді көрсетіңіз',
      phoneLabel: 'Телефон нөмірі',
      phonePlaceholder: '7086110912',
      passwordLabel: 'Құпиясөз',
      newPasswordLabel: 'Жаңа құпиясөз ойлап табыңыз',
      newPasswordPlaceholder: 'Құпиясөзді жазыңыз',
      confirmPasswordLabel: 'Жаңа құпиясөзді растаңыз',
      confirmPasswordPlaceholder: 'Құпиясөзді қайталаңыз',
      loginBtn: 'Кіру',
      receiveSmsBtn: 'СМС алу',
      restoreBtn: 'Қалпына келтіру',
      continueBtn: 'Жалғастыру',
      noAccount: 'Аккаунт жоқ па?',
      createAccountLink: 'Аккаунт құру',
      haveAccount: 'Аккаунтыңыз бар ма?',
      loginLink: 'Кіру',
      forgotPassword: 'Құпиясөзді ұмыттыңыз ба?',
      wrongPassword: 'Қате құпиясөз',
      wrongCode: 'Қате код',
      serverError: 'Қызмет уақытша қолжетімсіз. Кейінірек қайталаңыз.',
      numberExists: 'Бұл нөмір тіркелген',
      invalidPhone: 'Дұрыс телефон нөмірін енгізіңіз',
      tooManyRequests: 'Тым көп әрекет. Кейінірек қайталаңыз.',
      invalidEmail: 'Дұрыс email енгізіңіз',
      passwordsMismatch: 'Құпиясөздер сәйкес келмейді',
      codeSentTo: 'Код нөмірге жіберілді',
      resendAfter: (sec) => `Кодты ${sec} сек кейін қайта жіберу`,
      resendNow: 'Кодты қайта жіберу',
      loginNav: 'Кіру',
      numberNotExist: 'Мұндай нөмір тіркелмеген',
      regFirstNameLabel: 'Аты',
      regFirstNamePlaceholder: 'Атыңызды енгізіңіз',
      regLastNameLabel: 'Тегі',
      regLastNamePlaceholder: 'Тегіңізді енгізіңіз',
      regEmailLabel: 'Пошта',
      regEmailPlaceholder: 'Поштаңызды енгізіңіз',
      regPasswordLabel: 'Құпиясөз ойлап табыңыз',
      regPasswordPlaceholder: 'Құпиясөзді жазыңыз',
      regPasswordHint: '4-20 таңба',
      regConfirmLabel: 'Құпиясөзді растаңыз',
      regConfirmPlaceholder: 'Құпиясөзді қайталаңыз',
      forwardBtn: 'Алға',
      gateTitle: 'Карточкаларды жасау кіру немесе тіркелуден кейін қолжетімді',
      gateLoginBtn: 'Кіру',
      gateRegisterBtn: 'Тіркелу'
    }
  },
  en: {
    navCreate: 'Create',
    navHistory: 'History',
    landingTitle: 'Product photo →',
    landingAccent: 'marketplace card in 1 minute',
    landingBody:
      'Create ready-to-sell visuals for Kaspi, Wildberries, TikTok, and Aman without a designer.',
    landingOpenApp: 'Try now',
    landingViewHistory: 'View history',
    heroBubble: 'I want great cards for my product',
    statImageTypes: 'image types',
    statAspectRatios: 'aspect ratios',
    statLanguages: 'output languages',
    statApiReady: 'API core ready',
    productImage: 'Product image',
    uploadedProductPreview: 'Uploaded product preview',
    sourceProductLabel: 'Source product',
    chooseFile: 'Choose file',
    noFileSelected: 'No file selected',
    uploadUpToFiveImages: 'Upload up to 5 product images',
    primaryImage: 'Primary image',
    referenceImage: 'Reference image',
    setAsPrimaryImage: 'Set as primary',
    removeImage: 'Remove',
    clearImages: 'Clear',
    maxFiveImages: 'You can upload up to 5 images.',
    clearProductInfo: 'Clear description',
    analyzeWithAi: 'AI will fill it for me',
    reanalyzeWithAi: 'Re-fill with AI',
    analyzingWithAi: 'Analyzing with AI...',
    analysisFailed: 'AI analysis failed.',
    analysisRequiresInput: 'Upload a product image or enter a description first.',
    analysisOutdated: 'The description changed. Run AI analysis again to refresh the structured fields.',
    productName: 'Product name',
    targetAudience: 'Target audience',
    sellingPoints: 'Selling points',
    materialDescription: 'Material description',
    usageInstructions: 'Usage instructions',
    productCategory: 'Product category',
    resolution: 'Resolution',
    imageTypes: 'Image types',
    imageTypesHint: 'Choose how many images to generate for each type.',
    preview: 'Preview',
    aspectRatio: 'Photo format',
    moreAspectRatios: 'More ratios',
    fewerAspectRatios: 'Show less',
    model: 'Version selection',
    modelStandard: 'Standard',
    modelStandardDescription: 'balances image quality and similarity with stronger prompt understanding',
    modelPremium: 'Premium',
    modelPremiumDescription: 'strongest generation mode with high image quality and more accurate instruction following',
    modelPro: 'Pro',
    modelProDescription: 'stable multilingual on-image text: headlines, prices and copy in CN/RU/KK/EN render correctly without garbled characters',
    imageLanguage: 'Generated image text language',
    imageLanguageMultiHint: 'Select multiple languages — a separate batch will be generated for each.',
    targetPlatform: 'Where will you sell?',
    targetPlatformHint: 'Choosing a marketplace auto-applies the recommended photo format, languages, and image set.',
    platformGeneral: 'For all marketplaces',
    platformLocalRecommendation: 'Recommended for your region',
    morePlatforms: 'Other platforms',
    fewerPlatforms: 'Show fewer',
    multiLangBatchCreated: (count) => `Created ${count} batches, one per language`,
    fontStyle: 'Font style',
    creatingTask: (target) => `Preparing photos for ${target}...`,
    creatingTaskTargetAll: 'all marketplaces',
    generateImages: () => 'Create image',
    quickChipsCategoryLabel: 'Product category',
    quickChipsAudienceLabel: 'Target audience',
    quickChipsStyleLabel: 'Photo style',
    quickChipsCategories: ['Clothing', 'Cosmetics', 'Home', 'Electronics'],
    quickChipsAudiences: ['Women', 'Men', 'Children'],
    quickChipsStyles: ['Aman', 'Kaspi', 'Wildberries', 'Premium'],
    chooseAtLeastOneImage: 'Choose at least one image.',
    uploadImageRequired: 'Please upload a product image first.',
    accountLogout: 'Log out',
    accountTopup: 'Top up',
    balanceLabel: 'Balance',
    imagesShort: 'img',
    languageLabel: 'Language',
    paymentNotConfigured: 'Payment top-up is being connected. We will enable it once the payment provider is ready.',
    paymentStartFailed: 'Could not open payment. Please try again later.',
    paymentPendingConfirmation: 'Payment received. Your balance will update after confirmation.',
    paymentFailed: 'Payment was not completed or was cancelled.',
    insufficientBalance: 'Insufficient balance. Please top up.',
    paymentConfirmingNoRetry: 'Payment received — confirming. Please do not pay again.',
    uploadFailed: 'Upload failed.',
    generationFailed: 'Generation failed.',
    generationContentRejected:
      'The image model rejected this request due to its content safety policy. Avoid descriptions of people or characters (especially anime characters) and try again with a real product.',
    historyTitle: 'History',
    historyHeading: 'Creation history',
    historyBody: 'Recent generation tasks for this device are listed here.',
    historyLoading: 'Loading history...',
    historyLoadingBody: 'Fetching recent generations for this device. This usually takes a few seconds.',
    noTasks: 'No tasks yet. Create a generation first.',
    imagesCount: (count) => `${count} images`,
    resultTitle: 'Result',
    resultLoading: 'Loading result',
    resultReady: (count) => `Ready · ${count} images`,
    createMore: 'Create more',
    downloadSelected: 'Download selected',
    generatingTitle: 'Generating',
    creatingImages: (count) => `Creating ${count} image${count === 1 ? '' : 's'}`,
    taskNotFound: 'Task not found or generation failed.',
    taskRunning: 'Generation is running. This page refreshes until each image is ready.',
    taskPreparing: 'Preparing the generation task.',
    feedbackTitle: 'How do you like the result?',
    feedbackSubtitle: 'Your feedback helps us improve',
    imageN: (index) => `Image ${index}`,
    navHowItWorks: 'How it works',
    navPricing: 'Pricing',
    navContacts: 'Contacts',
    statSteps: 'simple steps',
    statUsers: 'happy users',
    howTitle: 'How it works',
    howSubtitle: 'A simple three-step process to create professional product cards',
    how1Title: 'Upload a product photo',
    how1Body: 'Just drag your product images into the upload area or pick a file from the gallery. JPG, PNG and WEBP are supported.',
    how1Bullets: ['Fast upload without quality loss', 'Automatic image enhancement', 'Batch upload support'],
    how2Title: 'Choose a concept',
    how2Body: 'Pick one of the ready-made templates or create your own unique concept. Our AI adapts the product to the chosen style.',
    how3Title: 'Get the result',
    how3Body: 'The AI automatically adds infographics and product benefits, and adapts the image to the requirements of the chosen marketplace.',
    how3Bullets: ['Automatic infographics', 'Marketplace adaptation', 'Format optimization (1:1, 3:4, 9:16)'],
    pricingTitle: 'Pricing',
    pricingSubtitle: 'Transparent pricing. Pay only for what you use.',
    pricingImagesLabel: (count) => `${count} image${count === 1 ? '' : 's'}`,
    pricingPlusLabel: '5+ images',
    pricingPerImageSuffix: 'per image',
    pricingBadge: 'Best value',
    pricingCta: 'Start',
    pricingBuy: 'Buy',
    currencyTenge: '₸',
    contactsTitle: 'Contacts',
    contactsSubtitle: 'Get in touch with us in any convenient way.',
    contactPhoneLabel: 'Phone',
    contactEmailLabel: 'Email',
    contactEmail: 'info@aman.ai',
    supportNumberLabel: 'Support number',
    contactCallLabel: 'Call',
    contactSmsLabel: 'WhatsApp',
    backLabel: 'Back',
    imageCountLabel: 'Number of images',
    totalCostLabel: 'Total',
    historyTotalLabel: 'Total cards',
    dateFromLabel: 'Date from',
    dateToLabel: 'Date to',
    resetLabel: 'Reset',
    categoryLabel: 'Category',
    allCategoryLabel: 'All',
    viewLabel: 'View',
    cardTitleFallback: 'Product card',
    loadingLabel: 'Loading…',
    backToHistory: 'Back to history',
    platformMetaLabel: 'Platform',
    dateCreatedLabel: 'Created',
    imagesMetaLabel: 'Images',
    photoCount: (count) => `${count} photo${count === 1 ? '' : 's'}`,
    downloadAllLabel: 'Download all',
    shareLabel: 'Share',
    deleteLabel: 'Delete',
    deleteConfirm: 'Delete this card?',
    toastLoginSuccess: 'You are logged in',
    toastAccountCreated: 'Account created',
    toastPasswordChanged: 'Password changed',
    toastLinkCopied: 'Link copied',
    toastPaymentUnavailable: 'Payment is temporarily unavailable. Please try again later.',
    orders: {
      navOrders: 'Orders',
      heading: 'My orders',
      tabLocal: 'Local products',
      tabChina: 'China products',
      empty: 'No orders yet.',
      loadError: 'Failed to load orders.',
      retry: 'Retry',
      loading: 'Loading...',
      loadMore: 'Load more',
      priceLabel: 'Total',
      statusLabel: 'Status',
      dateLabel: 'Date',
      trackLabel: 'Track code',
      qtyLabel: 'Qty',
      loginRequired: 'Sign in to see your orders.'
    },
    adminAccounting: {
      heading: 'Internal Accounting',
      subtitle: 'Amounts (₸) are real payments; balance/credited/spent are generation credits (images), not money.',
      timezoneNote: 'All dates & times in Astana time (UTC+5)',
      passwordLabel: 'Admin password',
      passwordPlaceholder: 'Enter password',
      enter: 'Sign in',
      wrongPassword: 'Wrong password.',
      notConfigured: 'Admin password is not configured.',
      loading: 'Loading...',
      loadError: 'Failed to load data.',
      retry: 'Retry',
      summaryUsers: 'Users',
      summaryBalance: 'Credit balance (imgs)',
      summaryCredits: 'Credits issued (imgs)',
      summaryTopup: 'Revenue (₸)',
      summaryRefund: 'Refunds (₸)',
      summarySpent: 'Spent (imgs)',
      summaryFalBalance: 'Generation API balance ($)',
      falUnavailable: 'unavailable',
      usersHeading: 'Users',
      ledgerHeading: 'Financial ledger',
      exportUsers: 'Export users (CSV)',
      exportLedger: 'Export ledger (CSV)',
      colPhone: 'Phone',
      colName: 'Name',
      colEmail: 'Email',
      colRegistered: 'Registered',
      colLastLogin: 'Last login',
      colPaid: 'Paid (₸)',
      colBalance: 'Balance (imgs)',
      colCredited: 'Credited (imgs)',
      colSpent: 'Spent (imgs)',
      colLoginCount: 'Logins',
      colTime: 'Time',
      colLang: 'Language',
      colAmount: 'Credits (±)',
      colAmountKzt: 'Amount (₸)',
      colReason: 'Reason',
      colBalanceAfter: 'Balance (imgs)',
      colCity: 'City',
      colDevice: 'Device',
      colIp: 'IP',
      colLocation: 'Location',
      colEvent: 'Event',
      colIsp: 'Network',
      loginsHeading: 'Login activity',
      exportLogins: 'Export logins (CSV)',
      eventLogin: 'login',
      eventRegister: 'sign-up',
      empty: 'No data',
      grantHeading: 'Grant trial generations',
      grantHint: 'The user must already be registered. Added as a free bonus (not counted as revenue).',
      grantPhoneLabel: 'Phone number',
      grantPhonePlaceholder: '7086110912',
      grantCountLabel: 'Count (imgs)',
      grantSubmit: 'Grant',
      grantSubmitting: 'Granting…',
      grantSuccess: 'Done. User current balance:',
      grantNoChange: 'No change: this grant was already recorded. Current balance:',
      grantErrorNotFound: 'This number is not registered. Ask the user to register first.',
      grantErrorInvalid: 'Enter a valid phone number and count (1–100).',
      grantError: 'Grant failed. Please try again.'
    },
    auth: {
      loginTitle: 'Log in to your account',
      registerTitle: 'Create an account',
      recoverTitle: 'Password recovery',
      otpTitle: 'Enter the code from the SMS',
      newPasswordTitle: 'Password recovery',
      subtitle: 'Enter your details to access your account',
      recoverSubtitle: "Enter your phone number and we'll send you an SMS",
      phoneLabel: 'Phone number',
      phonePlaceholder: '7086110912',
      passwordLabel: 'Password',
      newPasswordLabel: 'Create a new password',
      newPasswordPlaceholder: 'Write your password',
      confirmPasswordLabel: 'Confirm your new password',
      confirmPasswordPlaceholder: 'Repeat password',
      loginBtn: 'Login',
      receiveSmsBtn: 'Receive SMS',
      restoreBtn: 'Restore',
      continueBtn: 'Continue',
      noAccount: "Don't have an account?",
      createAccountLink: 'Create an account',
      haveAccount: 'Do you already have an account?',
      loginLink: 'Login',
      forgotPassword: 'Forgot your password?',
      wrongPassword: 'Wrong password',
      wrongCode: 'Wrong code',
      serverError: 'Service is temporarily unavailable. Please try again later.',
      numberExists: 'This number already exists',
      invalidPhone: 'Enter a valid phone number',
      tooManyRequests: 'Too many attempts. Please try again later.',
      invalidEmail: 'Enter a valid email',
      passwordsMismatch: 'Passwords do not match',
      codeSentTo: 'Code sent to number',
      resendAfter: (sec) => `Send code again after ${sec} sec`,
      resendNow: 'Send code again',
      loginNav: 'Login',
      numberNotExist: 'This number does not exist',
      regFirstNameLabel: 'First name',
      regFirstNamePlaceholder: 'Enter your first name',
      regLastNameLabel: 'Last name',
      regLastNamePlaceholder: 'Enter your last name',
      regEmailLabel: 'Email',
      regEmailPlaceholder: 'Enter your email',
      regPasswordLabel: 'Create a password',
      regPasswordPlaceholder: 'Write your password',
      regPasswordHint: '4-20 characters',
      regConfirmLabel: 'Confirm password',
      regConfirmPlaceholder: 'Repeat password',
      forwardBtn: 'Continue',
      gateTitle: 'Card creation is available after logging in or registering.',
      gateLoginBtn: 'Login',
      gateRegisterBtn: 'Registration'
    }
  },
  zh: {
    navCreate: '创建',
    navHistory: '历史',
    landingTitle: '商品照片 →',
    landingAccent: '1 分钟生成 Kaspi 商品卡',
    landingBody:
      '无需设计师，为 Kaspi、Wildberries、TikTok 和 Aman 生成可直接使用的销售图。',
    landingOpenApp: '立即试用',
    landingViewHistory: '查看历史',
    heroBubble: '想要我商品的精美卡片',
    statImageTypes: '图片类型',
    statAspectRatios: '画幅比例',
    statLanguages: '输出语言',
    statApiReady: 'API 核心已就绪',
    productImage: '商品图片',
    uploadedProductPreview: '商品预览',
    sourceProductLabel: '待上传商品',
    chooseFile: '选择文件',
    noFileSelected: '未选择文件',
    uploadUpToFiveImages: '上传最多 5 张商品图',
    primaryImage: '主图',
    referenceImage: '参考图',
    setAsPrimaryImage: '设为主图',
    removeImage: '删除',
    clearImages: '清空',
    maxFiveImages: '最多上传 5 张图片。',
    clearProductInfo: '清空描述',
    analyzeWithAi: 'AI 帮我填写',
    reanalyzeWithAi: '重新让 AI 填写',
    analyzingWithAi: 'AI分析中...',
    analysisFailed: 'AI分析失败。',
    analysisRequiresInput: '请先上传商品图或填写描述。',
    analysisOutdated: '描述已变更，请重新进行 AI 分析以刷新结构化字段。',
    productName: '产品名称',
    targetAudience: '目标受众',
    sellingPoints: '卖点描述',
    materialDescription: '材质描述',
    usageInstructions: '使用方式',
    productCategory: '产品类目',
    resolution: '分辨率',
    imageTypes: '图片类型',
    imageTypesHint: '为每种类型选择要生成的图片张数。',
    preview: '预览',
    aspectRatio: '图片格式',
    moreAspectRatios: '更多比例',
    fewerAspectRatios: '收起',
    model: '版本选择',
    modelStandard: '基础版 Standard',
    modelStandardDescription: '兼顾图片质量与相似率，理解能力更强',
    modelPremium: '高级版 Premium',
    modelPremiumDescription: '图片生成最强模式，高质量图片，对指令理解能力更强',
    modelPro: '专业版 Pro',
    modelProDescription: '主图标题/价格/卖点 写中俄哈英不乱码，文字稳定',
    imageLanguage: '生成图片文字语言',
    imageLanguageMultiHint: '可多选语言，每个语言会生成一套图。',
    targetPlatform: '你在哪里销售？',
    targetPlatformHint: '选择平台后自动应用推荐格式、语言和图片组合。',
    platformGeneral: '适用所有平台',
    platformLocalRecommendation: '当地推荐',
    morePlatforms: '其他平台',
    fewerPlatforms: '收起',
    multiLangBatchCreated: (count) => `已创建 ${count} 个任务，每种语言一套`,
    fontStyle: '字体风格',
    creatingTask: (target) => `正在为 ${target} 准备图片...`,
    creatingTaskTargetAll: '所有电商平台',
    generateImages: () => '创建图片',
    quickChipsCategoryLabel: '商品类目',
    quickChipsAudienceLabel: '目标受众',
    quickChipsStyleLabel: '图片风格',
    quickChipsCategories: ['服装', '化妆品', '家居', '电子'],
    quickChipsAudiences: ['女性', '男性', '儿童'],
    quickChipsStyles: ['Aman', 'Kaspi', 'Wildberries', '高端'],
    chooseAtLeastOneImage: '至少选择一种图片。',
    uploadImageRequired: '请先上传商品图片。',
    accountLogout: '退出',
    accountTopup: '充值',
    balanceLabel: '余额',
    imagesShort: '张',
    languageLabel: '语言',
    paymentNotConfigured: '支付充值正在接入中，支付方准备好后会开放。',
    paymentStartFailed: '无法打开支付，请稍后再试。',
    paymentPendingConfirmation: '支付已返回，余额会在服务端确认后更新。',
    paymentFailed: '支付未完成或已取消。',
    insufficientBalance: '余额不足,请充值。',
    paymentConfirmingNoRetry: '支付已收到,正在确认到账,请勿重复支付。',
    uploadFailed: '上传失败。',
    generationFailed: '生成失败。',
    generationContentRejected:
      '图像模型的内容安全策略拒绝了本次生成。请避免人物/角色类描述（尤其是动漫人物），改用真实商品信息后重试。',
    historyTitle: '历史',
    historyHeading: '创建历史',
    historyBody: '这里展示当前设备最近的生成任务。',
    historyLoading: '正在加载历史记录...',
    historyLoadingBody: '正在读取当前设备的最近生成记录，通常只需要几秒。',
    noTasks: '还没有任务，请先发起一次生成。',
    imagesCount: (count) => `${count} 张图片`,
    resultTitle: '结果',
    resultLoading: '结果加载中',
    resultReady: (count) => `已完成 · ${count} 张图片`,
    createMore: '继续创建',
    downloadSelected: '下载当前图片',
    generatingTitle: '生成中',
    creatingImages: (count) => `正在生成 ${count} 张图片`,
    taskNotFound: '任务不存在，或生成已失败。',
    taskRunning: '生成正在进行中。该页面会持续刷新，直到每张图都完成。',
    taskPreparing: '正在准备生成任务。',
    feedbackTitle: '结果还满意吗？',
    feedbackSubtitle: '您的反馈能帮助我们改进',
    imageN: (index) => `图片 ${index}`,
    navHowItWorks: '如何工作',
    navPricing: '价格',
    navContacts: '联系我们',
    statSteps: '简单步骤',
    statUsers: '满意用户',
    howTitle: '如何工作',
    howSubtitle: '简单三步，生成专业的商品卡片',
    how1Title: '上传商品照片',
    how1Body: '直接把商品图片拖进上传区，或从相册选择文件。支持 JPG、PNG、WEBP 格式。',
    how1Bullets: ['无损快速上传', '自动增强图像', '支持批量上传'],
    how2Title: '选择概念',
    how2Body: '从现成模板中挑选，或创建你的专属概念。AI 会把商品适配到所选风格。',
    how3Title: '获取成品',
    how3Body: 'AI 自动添加信息图与卖点，并按所选电商平台的要求适配图片。',
    how3Bullets: ['自动信息图', '电商平台适配', '画幅优化（1:1 / 3:4 / 9:16）'],
    pricingTitle: '价格',
    pricingSubtitle: '透明计费，按使用量付费。',
    pricingImagesLabel: (count) => `${count} 张图片`,
    pricingPlusLabel: '5+ 张图片',
    pricingPerImageSuffix: '每张',
    pricingBadge: '超值',
    pricingCta: '开始',
    pricingBuy: '购买',
    currencyTenge: '₸',
    contactsTitle: '联系我们',
    contactsSubtitle: '通过任意便捷方式与我们联系。',
    contactPhoneLabel: '电话',
    contactEmailLabel: '邮箱',
    contactEmail: 'info@aman.ai',
    supportNumberLabel: '客服电话',
    contactCallLabel: '拨打电话',
    contactSmsLabel: '通过 WhatsApp 联系',
    backLabel: '返回',
    imageCountLabel: '图片数量',
    totalCostLabel: '总计',
    historyTotalLabel: '卡片总数',
    dateFromLabel: '起始日期',
    dateToLabel: '结束日期',
    resetLabel: '重置',
    categoryLabel: '类目',
    allCategoryLabel: '全部',
    viewLabel: '查看',
    cardTitleFallback: '商品卡片',
    loadingLabel: '加载中…',
    backToHistory: '返回历史',
    platformMetaLabel: '平台',
    dateCreatedLabel: '创建日期',
    imagesMetaLabel: '图片数',
    photoCount: (count) => `${count} 张`,
    downloadAllLabel: '全部下载',
    shareLabel: '分享',
    deleteLabel: '删除',
    deleteConfirm: '删除这张卡片？',
    toastLoginSuccess: '已登录',
    toastAccountCreated: '账户已创建',
    toastPasswordChanged: '密码已修改',
    toastLinkCopied: '链接已复制',
    toastPaymentUnavailable: '支付暂时不可用，请稍后再试。',
    orders: {
      navOrders: '订单',
      heading: '我的订单',
      tabLocal: '本地商品',
      tabChina: '中国商品',
      empty: '暂无订单。',
      loadError: '加载订单失败。',
      retry: '重试',
      loading: '加载中...',
      loadMore: '加载更多',
      priceLabel: '金额',
      statusLabel: '状态',
      dateLabel: '日期',
      trackLabel: '物流单号',
      qtyLabel: '数量',
      loginRequired: '登录后查看你的订单。'
    },
    adminAccounting: {
      heading: '内部对账',
      subtitle: '金额(₸)为真实付费;余额/入账/消耗为生图额度(张),非货币。生图API余额为美元($)。',
      timezoneNote: '所有日期与时间均为阿斯塔纳时间(UTC+5)',
      passwordLabel: '管理员密码',
      passwordPlaceholder: '请输入密码',
      enter: '进入',
      wrongPassword: '密码错误。',
      notConfigured: '尚未配置管理员密码。',
      loading: '加载中...',
      loadError: '数据加载失败。',
      retry: '重试',
      summaryUsers: '注册用户',
      summaryBalance: '额度余额(张)',
      summaryCredits: '累计发放额度(张)',
      summaryTopup: '付费收入(₸)',
      summaryRefund: '退款(₸)',
      summarySpent: '累计消耗(张)',
      summaryFalBalance: '生图API 余额($)',
      falUnavailable: '不可用',
      usersHeading: '用户列表',
      ledgerHeading: '财务流水',
      exportUsers: '导出用户 (CSV)',
      exportLedger: '导出流水 (CSV)',
      colPhone: '手机号',
      colName: '姓名',
      colEmail: '邮箱',
      colRegistered: '注册时间',
      colLastLogin: '最近登录',
      colPaid: '付费金额(₸)',
      colBalance: '余额(张)',
      colCredited: '累计入账(张)',
      colSpent: '累计消耗(张)',
      colLoginCount: '登录次数',
      colTime: '时间',
      colLang: '语言',
      colAmount: '额度变动(±)',
      colAmountKzt: '金额(₸)',
      colReason: '事由',
      colBalanceAfter: '变动后余额(张)',
      colCity: '城市',
      colDevice: '设备',
      colIp: 'IP',
      colLocation: '位置',
      colEvent: '事件',
      colIsp: '运营商',
      loginsHeading: '登录记录',
      exportLogins: '导出登录记录 (CSV)',
      eventLogin: '登录',
      eventRegister: '注册',
      empty: '暂无数据',
      grantHeading: '赠送试用额度',
      grantHint: '用户须已注册。作为免费赠送发放(不计入营收)。',
      grantPhoneLabel: '手机号',
      grantPhonePlaceholder: '7086110912',
      grantCountLabel: '张数',
      grantSubmit: '赠送',
      grantSubmitting: '赠送中…',
      grantSuccess: '赠送成功。该用户当前额度:',
      grantNoChange: '未变动:该赠送此前已记录,余额未变。当前额度:',
      grantErrorNotFound: '该手机号未注册,请先让用户注册后再赠送。',
      grantErrorInvalid: '请输入有效的手机号和张数(1–100)。',
      grantError: '赠送失败,请重试。'
    },
    auth: {
      loginTitle: '登录账户',
      registerTitle: '创建账户',
      recoverTitle: '找回密码',
      otpTitle: '输入短信验证码',
      newPasswordTitle: '找回密码',
      subtitle: '请输入信息以登录您的账户',
      recoverSubtitle: '请输入您的手机号，我们将向其发送短信',
      phoneLabel: '手机号',
      phonePlaceholder: '7086110912',
      passwordLabel: '密码',
      newPasswordLabel: '设置新密码',
      newPasswordPlaceholder: '请输入密码',
      confirmPasswordLabel: '确认新密码',
      confirmPasswordPlaceholder: '请再次输入密码',
      loginBtn: '登录',
      receiveSmsBtn: '获取短信',
      restoreBtn: '重置',
      continueBtn: '继续',
      noAccount: '还没有账户？',
      createAccountLink: '创建账户',
      haveAccount: '已有账户？',
      loginLink: '登录',
      forgotPassword: '忘记密码？',
      wrongPassword: '密码错误',
      wrongCode: '验证码错误',
      serverError: '服务暂时不可用,请稍后再试。',
      numberExists: '该手机号已注册',
      invalidPhone: '请输入有效的手机号',
      tooManyRequests: '尝试次数过多,请稍后再试。',
      invalidEmail: '请输入有效邮箱',
      passwordsMismatch: '两次密码不一致',
      codeSentTo: '验证码已发送至',
      resendAfter: (sec) => `${sec} 秒后重新发送验证码`,
      resendNow: '重新发送验证码',
      loginNav: '登录',
      numberNotExist: '该手机号不存在',
      regFirstNameLabel: '名字',
      regFirstNamePlaceholder: '请输入名字',
      regLastNameLabel: '姓氏',
      regLastNamePlaceholder: '请输入姓氏',
      regEmailLabel: '邮箱',
      regEmailPlaceholder: '请输入邮箱',
      regPasswordLabel: '设置密码',
      regPasswordPlaceholder: '请输入密码',
      regPasswordHint: '4-20 个字符',
      regConfirmLabel: '确认密码',
      regConfirmPlaceholder: '请再次输入密码',
      forwardBtn: '下一步',
      gateTitle: '登录或注册后即可创建卡片',
      gateLoginBtn: '登录',
      gateRegisterBtn: '注册'
    }
  }
};

export function getMessages(locale: string): Messages {
  return MESSAGES[resolveLocale(locale)];
}
