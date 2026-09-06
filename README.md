# TestSpace

```
teacher/   Teacher dashboard (Vite + React)
student/   Student web app — email/password (Vite + React)
backend/   Appwrite Function API
docs/
```

**No Telegram. No Railway.** Students use the browser with email login.

## Production

| App | URL |
|-----|-----|
| Teacher | https://testspace-dashboard.appwrite.network |
| Student | https://testspace-webapp.appwrite.network |
| API | https://testspace-api.appwrite.network |

Teacher login: `admin` / `testspace123`

## Deploy backend

```bash
appwrite functions create-deployment --function-id api --code ./backend \
  --entrypoint src/main.js --commands "npm install" --activate true
```

## Env

See `.env.example`
