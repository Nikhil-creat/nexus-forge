# Security
- Set SECRET_KEY, ADMIN_PASSWORD and ORIGINS in production. Without ADMIN_PASSWORD the admin account is disabled; use signup.
- Passwords are stored as salted PBKDF2-SHA256. Tokens are HMAC-signed and expire after one hour.
- The password audit runs only in the browser.
- Report vulnerabilities by email to the repository owner.

- The AI proxy (`frontend/api/chat.js`) keeps provider keys on the server, checks the request origin, rate-limits per visitor, enforces a daily site-wide budget and ignores client-supplied prompts.
- Short links (`frontend/api/share.js`) store only whitelisted text fields (200 KB max) for 30 days, behind an origin check and a per-visitor rate limit. Anyone with a link can read its data, so do not share secrets.
- Uploaded documents are read in the browser and are never sent anywhere except as context to the AI you choose.
