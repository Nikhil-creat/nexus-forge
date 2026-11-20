# Security
- Set SECRET_KEY, ADMIN_PASSWORD and ORIGINS in production. Without ADMIN_PASSWORD the admin account is disabled; use signup.
- Passwords are stored as salted PBKDF2-SHA256. Tokens are HMAC-signed and expire after one hour.
- The password audit runs only in the browser.
- Report vulnerabilities by email to the repository owner.

- The AI proxy (`frontend/api/chat.js`) keeps provider keys on the server, checks the request origin, rate-limits per visitor, enforces a daily site-wide budget and ignores client-supplied prompts.
