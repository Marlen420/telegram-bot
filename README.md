# Forum Telegram Bot

Telegram-бот для форума с сохранением пользователей, локальными видео и ссылкой на покупку билетов.

## Возможности

- Сохранение данных пользователей в PostgreSQL (id, username, имя, даты первого и последнего визита)
- Меню из 4 кнопок:
  1. **О форуме** — текст + локальное видео
  2. **Цены** — текст + локальное видео
  3. **Подробнее о форуме** — текст + локальное видео
  4. **Как купить билеты** — текст + кнопка-ссылка на сайт

## Настройка

### 1. Переменные окружения (`.env`)

```bash
cp .env.example .env
```

Заполните:
- `BOT_TOKEN` — токен от [@BotFather](https://t.me/BotFather)
- `TICKET_URL` — ссылка на сайт покупки билетов
- `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` — параметры PostgreSQL
- `DATABASE_URL` — строка подключения к БД

### 2. Тексты ответов (`config/content.json`)

Отредактируйте файл `config/content.json` — приветствие, тексты разделов, имена видеофайлов.

### 3. Локальные видео (`videos/`)

Поддерживаются форматы **`.mp4`** и **`.MOV`**. В `content.json` укажите имя без расширения.

При сборке Docker-образа видео автоматически сжимаются (ffmpeg, CRF 27, то же разрешение) и поворачиваются в правильную вертикальную ориентацию.

Локально (нужен `ffmpeg`, например `brew install ffmpeg`):

```bash
npm run optimize-videos
```

Создаст рядом файлы `about.mp4`, `prices.mp4`, `bonuses.mp4` — бот предпочитает их перед `.MOV`.

### 4. QR-код для оплаты (`images/`)

Положите файл `images/qr-payment.png` (или `.jpg`).

### 5. Пересылка @pratovv

В `.env` укажите Telegram ID пользователя @pratovv:

```env
FORWARD_TO_USERNAME=pratovv
FORWARD_TO_CHAT_ID=123456789
```

@pratovv должен один раз написать боту `/start`.

## Сценарий оплаты

1. **Как купить билеты** — тарифы + кнопки «Оплатить по QR» / «Вернуться в меню»
2. **Оплатить по QR** — QR-картинка + инструкция отправить чек и ФИО
3. Пользователь присылает **чек** (фото/PDF) и **ФИО** (текст)
4. Бот пересылает всё @pratovv и возвращает в главное меню

Фото и PDF вне сценария оплаты также пересылаются @pratovv.

## Запуск (Docker)

Поднимает PostgreSQL и бота. Видео и `config/content.json` копируются в образ при сборке:

```bash
docker compose up -d --build
docker compose logs -f bot
```

После изменения видео или текстов пересоберите образ:

```bash
docker compose up -d --build bot
```

### Ошибка `operation not permitted` при mount

На macOS Docker Desktop по умолчанию не имеет доступа к папке `Documents`. Bind-mount убран из `docker-compose.yml` — контент встроен в образ.

Если нужно редактировать файлы без пересборки:
1. Docker Desktop → **Settings** → **Resources** → **File sharing** → добавьте путь к проекту
2. `cp docker-compose.override.example.yml docker-compose.override.yml`
3. `docker compose up -d --build`

Только база данных:

```bash
docker compose up -d db
```

Бот в Docker подключается к БД по адресу `db:5432`. Данные хранятся в volume `postgres-data`.

### Статистика пользователей

После запуска откройте в браузере:

```
http://localhost
```

На Droplet: `http://YOUR_DROPLET_IP` (порт **80**, указывать не нужно)

Локально, если порт 80 занят:

```
STATS_PUBLIC_PORT=8080
```

и открывайте `http://localhost:8080`

Страница показывает:
- всего пользователей, новых, активных, с телефоном, Premium
- клики по каждой кнопке
- таблицу: ID, chat ID, имя, username, **телефон**, язык, Premium, тип чата, последнее сообщение, клики

**Телефон:** Telegram не отдаёт номер автоматически — сохраняется только если пользователь **сам отправит контакт** боту.

Защита через Basic Auth (настройте в `.env`):
```
STATS_USER=admin
STATS_PASSWORD=your_secret_password
```

На Droplet откройте порт в firewall:
```bash
ufw allow 80/tcp
```

## Локальная разработка

1. Запустите PostgreSQL:

```bash
docker compose up -d db
```

2. В `.env` укажите подключение к localhost:

```
DATABASE_URL=postgresql://forum_bot:forum_bot_secret@localhost:5432/forum_bot
```

3. Запустите бота:

```bash
npm install
npm run dev
```

## Данные пользователей

Таблица `users` создаётся автоматически при старте бота.

Подключиться к БД вручную:

```bash
docker compose exec db psql -U forum_bot -d forum_bot -c "SELECT * FROM users;"
```
