# Bug #299 — Fix Proposal (step 4/13, propose-change)

Issue: https://github.com/enginow-in/interview-iq/issues/299 (READ ONLY — all work in fork)
Fork: https://github.com/kobzevvv/interview-iq, branch `eng/playbooks-e2e-plan-ac8b8492`
Root cause: `docs/bug-299-root-cause.md`

## 1. Proposal (зачем)

**Сценарий:** клиент (или кто угодно) POST `/api/interview/submit-answer` с отсутствующим /
невалидным `questionIndex` (missing, -1, 99, "abc") → сервер падает в TypeError
(`question.score = 0` на `undefined`) → generic 500 `failed to submit answer TypeError…`.
Смежный латентный баг в той же функции: невалидный `interviewId` → `interview` = null →
null-deref на `interview.questions`.

**Ценность:** API отвечает 400/404 вместо 500 с текстом исключения (не течь внутренние
детали наружу), сервер не крашится на несовместимом входе, контракт становится явным.

**Что меняется:** только `server/controllers/interview.controller.js` → `submitAnswer`
(2 guard-а) + регрессионный харнесс `server/test/repro-299.mjs`.

**Влияние:** модуль — один (interview controller); контракт — статусы ошибок 500 → 400/404;
данные — нет (краш происходил ДО save, битых данных нет); другие сервисы — нет.
Официальный клиент (`client/src/components/Step2Interview.jsx:248`) шлёт числовые
индексы и в catch только `console.log` — happy path и UX не меняются.

## 2. Design (наименьшее изменение)

В `submitAnswer` (server/controllers/interview.controller.js:226), сразу после `findById`:

```js
const interview = await Interview.findById(interviewId)
if (!interview) {
  return res.status(404).json({ message: "Interview not found" });
}

const idx = typeof questionIndex === "number" ? questionIndex : NaN;
if (!Number.isInteger(idx) || idx < 0 || idx >= interview.questions.length) {
  return res.status(400).json({ message: "Invalid questionIndex" });
}
const question = interview.questions[idx]
```

- Guard 1 (null interview) — следует паттерну `getInterviewReport:416` / `finishInterview:341`
  (те же файл и модель).
- Guard 2 — строгий: принимается только JSON-число-integer, иначе 400.
  `"abc"`/missing/`-1`/`99`/`""`/`1.5` → 400; строковый `"0"` тоже отклоняется —
  официальный клиент всегда шлёт число, контракт ужесточается осознанно.
- Остальное тело `submitAnswer` — без изменений (happy path, пустой ответ,
  превышение времени, AI-путь).
- Почему не проще: один `if (!interview)` уже чинит соседний null-bug (паттерн дешёвый —
  чиним сразу); одна проверка индекса закрывает все 5 вариантов репро. zod/joi /
  middleware-слой — over-engineering для одного эндпоинта в репо без валидационного слоя.

## 3. Spec delta (docs/user-scenarios)

В репо нет `docs/user-scenarios` — создан `docs/user-scenarios.md` (living) с затронутыми
сценариями. Добавляются/меняются:

- **+ S-299.1** `submit-answer` с невалидным `questionIndex` (missing / -1 / out-of-range /
  нечисловой) → **400** `{message:"Invalid questionIndex"}`, без записи в БД, без 500.
- **+ S-299.2** `submit-answer` с неизвестным `interviewId` → **404** `{message:"Interview not found"}`.
- **= S-299.3** (меняется статус ошибки) раньше любой крэш → 500 c текстом TypeError; теперь 400/404.
- **без изменений:** валидный индекс + пустой ответ → 200; индекс валиден + `timeTaken >
  timeLimit` → 200 score 0; happy path → 200 (AI-путь не покрыт харнессом — нет сети/ключа).
- Удаляемых сценариев нет.

## 4. Срезы (tasks) — порядок реализации

1. **T1 — guard-ы в `submitAnswer`** (404 + 400, см. Design). Файл один.
   Тест: прогон существующего харнесса — invalid-варианты теперь обязаны дать 400/404 (не 500).
2. **T2 — регрессионный харнесс** `server/test/repro-299.mjs`: ожидания перевести с 500 на
   400/404; добавить сценарии: `interviewId: null` → 404 (mock `findById` → null);
   валидный индекс + пустой ответ → 200; валидный индекс + `timeTaken > timeLimit` → 200.
   Переименовать вывод в «regression», `npm test` → exit 0.
3. **T3 — docs**: `docs/user-scenarios.md` (delta выше) — уже написан в этом шаге, проверить.
4. Порядок: T1 → T2 → `cd server && npm test` (exit 0) → один коммит `fix(bug-299): …`.

Каждый срез проверяем: T1 — invalid-сценарии падают на 500 до правки, 400/404 после;
T2 — `npm test` exit 0; T3 — наличие файла/секций.

## 5. План проверки (уровень S)

| Шаг сценария | Проверка |
|---|---|
| S-299.1 (4 варианта invalid index) | автотест харнесс (мок Interview, без сети) |
| S-299.2 (null interview) | автотест харнесс (mock → null) |
| S-299.3 валидный + пустой ответ → 200 | автотест харнесс |
| валидный + timeTaken>limit → 200 | автотест харнесс |
| happy path (AI) | ⏭ вне автотеста (нужен ключ OpenRouter); ручной/сценарий песочницы — нет, деплоя нет |

**Целевой уровень: S2** — юнит-уровень с моком модели (`npm test`, детерминированно, без
внешних сервисов). Выше (интеграция через express + супertest) — не требуется: вся логика
фиксится внутри одного обработчика, репо без test-инфраструктуры.

## 6. Риски и откат

- **Кого задевает ошибка (радиус):** никто — крэш случался до `save()`, битых данных нет,
  починка данных не нужна. Падение возвращало 500 без записи.
- **Риск фикса:** смена кодов 500 → 400/404. Клиент в catch лишь логирует — деградации нет.
  Строгая типизация индекса отклонит строковые числа — осознанно, других потребителей нет
  (grep: единственный вызов `submit-answer` — Step2Interview.jsx).
- **Откат:** `git revert` одного коммита; флагов и миграций нет, миграция назад не нужна.
- **Соседний паттерн:** остальные unvalidated index-deref в репо отсутствуют (скан в
  root-cause) — отдельный issue не нужен.
