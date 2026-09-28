# User Scenarios (living)

Живые сценарии продукта. Пополняется по мере изменений; начат в рамках fix bug #299.

## POST /api/interview/submit-answer

- **S-299.1 — невалидный `questionIndex`** (missing / -1 / out-of-range / нечисловой):
  сервер отвечает `400 {message:"Invalid question index"}`, данные не изменяются, 500 нет.
  (До fix: TypeError → 500 с текстом исключения.)
- **S-299.2 — неизвестный `interviewId`**: сервер отвечает `404 {message:"Interview not found"}`.
- **S-299.3 — валидный индекс + пустой ответ**: `200`, score 0,
  feedback "You did not submit an answer." — без изменений.
- **Валидный индекс + `timeTaken > timeLimit`**: `200`, score 0,
  feedback "Time limit exceeded. Answer not evaluated." — без изменений.
- **Валидный индекс + ответ в лимите**: AI-оценка, `200 {feedback}` — без изменений.
