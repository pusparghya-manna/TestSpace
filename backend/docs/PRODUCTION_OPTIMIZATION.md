# Production notes (Appwrite)

- Run backend as an Appwrite Function or a long-lived Node process using Appwrite env vars
- Prefer Telegram webhooks over long-polling when on serverless Functions
- Collections and storage buckets are created on first boot via server API key
- Frontend deploys as Appwrite Sites
