================  ENGLISH  ================

Hi team! 👋

The new Aman AI site is really coming together — thank you for all the great work! You can preview the current version here: https://tamga.kaitogogo123.workers.dev/

To kick off the next phase (user accounts + payments), we'd love a little help from you. No rush at all, whenever you get a chance 🙏

A few things for design:
1. Where should login / sign-up be triggered? The mockups have the login, sign-up and password-reset screens, but it's not clear how a user gets there — a "Log in" button in the header, a prompt when opening the app / creating, or asking to log in when saving a result? Just let us know the entry point and when it should appear.
2. Quick pricing question: the create page shows "2 images = 2000 ₸", but the pricing page shows "2 images = 1000 ₸". Which one is right? Also, what's the price for more than 5 images?
3. Logo: could you confirm the final wordmark, and whether we need a light version of the logo for dark backgrounds?
4. Contacts page: right now it shows phone and email — would you like to add an address, working hours, social links, or a contact form?
5. Auth flow: a quick flow showing how sign-up, login, password reset and phone verification connect (where success, error and wrong-code states go) would be super helpful.

And a few things for the tech team:
1. SMS verification code API — send + verify (rate limit, expiry, code length).
2. Registration / login API — phone + code and/or email + password; the session method you return (JWT or token refresh); and a phone-number uniqueness check.
3. Password reset API, plus a current-user info endpoint.
4. Payment API docs — create order, pay, callback, status check; currency in tenge (₸); when the charge happens (before generating, or settled after) and the refund rules; payment channels (Kaspi Pay, bank cards, etc.); and balance / transaction endpoints if it's a prepaid model.
5. Access + resources — production server / deployment access; SMS and payment merchant credentials; how to migrate existing device-based history into accounts; and the official phone, email, domain and high-res brand assets.

Thank you so much! Happy to hop on a quick call if anything's unclear 😊


================  РУССКИЙ  ================

Здравствуйте! 👋

Новый сайт Aman AI уже отлично складывается — спасибо за проделанную работу! Текущую версию можно посмотреть здесь: https://tamga.kaitogogo123.workers.dev/

Чтобы перейти к следующему этапу (аккаунты и оплата), нам пригодится ваша помощь по нескольким пунктам. Совсем без спешки, когда будет удобно 🙏

Несколько вопросов по дизайну:
1. Где должны запускаться вход и регистрация? В макетах есть экраны входа, регистрации и восстановления пароля, но не видно, как пользователь туда попадает — кнопка «Войти» в шапке, запрос при открытии приложения / создании, или просьба войти при сохранении результата? Подскажите, пожалуйста, точку входа и когда она должна появляться.
2. Небольшой вопрос по ценам: на странице создания указано «2 изображения = 2000 ₸», а на странице тарифов — «2 изображения = 1000 ₸». Как правильно? И какая цена за более чем 5 изображений?
3. Логотип: подтвердите, пожалуйста, финальное написание и нужна ли светлая версия логотипа для тёмного фона.
4. Страница контактов: сейчас там телефон и e-mail — хотите добавить адрес, часы работы, ссылки на соцсети или форму обратной связи?
5. Логика авторизации: было бы очень кстати получить схему переходов между регистрацией, входом, восстановлением пароля и подтверждением номера (куда ведут успех, ошибка и неверный код).

И несколько пунктов для технической команды:
1. API кода из SMS — отправка и проверка (ограничение частоты, срок действия, длина кода).
2. API регистрации / входа — телефон + код и/или e-mail + пароль; механизм сессии, который вы возвращаете (JWT или обновление токена); и проверка уникальности номера телефона.
3. API восстановления пароля и эндпоинт с данными текущего пользователя.
4. Документация платёжного API — создание заказа, оплата, колбэк, проверка статуса; валюта в тенге (₸); момент списания (до генерации или расчёт после) и правила возврата; платёжные каналы (Kaspi Pay, банковские карты и т.д.); а также эндпоинты баланса / операций, если модель предоплатная.
5. Доступы и ресурсы — доступ к продакшен-серверу и деплою; учётные данные SMS- и платёжного провайдера; как перенести текущую историю по устройству в аккаунты; и официальные телефон, e-mail, домен и логотип в высоком разрешении.

Большое спасибо! С удовольствием созвонимся, если что-то будет непонятно 😊
