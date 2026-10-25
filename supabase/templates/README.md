# Auth emails and Supabase settings (phase 2)

ImpactOS sends every auth email itself so codes and reset links arrive in English or Hindi with the ImpactOS sender.
Supabase calls `POST /api/auth/email-hook` (Send Email hook) instead of using its built-in templates.

## Hosted project (staging and production)
1. **Authentication → Hooks → Send Email hook**: HTTPS, URL `https://app.theimpactos.in/api/auth/email-hook`.
   Generate the secret and put it in `SEND_EMAIL_HOOK_SECRET` (format `v1,whsec_…`).
2. **Authentication → Providers → Email**: confirm email ON, secure email change ON, OTP length 6, OTP expiry 3600 s.
3. **Authentication → Providers → Google**: client id/secret from Google Cloud (OAuth consent screen "ImpactOS",
   authorised redirect `https://<project-ref>.supabase.co/auth/v1/callback`). This client is only for sign-in; the
   Drive connection in phase 4 uses a separate OAuth client.
4. **Authentication → URL configuration**: Site URL `https://app.theimpactos.in`; redirect URLs
   `https://app.theimpactos.in/api/auth/callback`, `https://console.theimpactos.in/api/auth/callback`.
5. **Authentication → Multi-factor**: TOTP enabled (verify on). **Passwords**: minimum 10 characters, leaked-password
   protection ON (Pro plan).
6. **Authentication → Sessions**: refresh-token rotation ON; JWT expiry 3600 s.
7. **Platform staff**: add rows to `public.platform_staff` with the service role (SQL editor); there is no self-service.

## Local development
`supabase/config.toml` has the same hook against `http://host.docker.internal:3000/api/auth/email-hook`, switched
off by default; set `SEND_EMAIL_HOOK_SECRET` and `enabled = true` to try it. Otherwise local emails go to Inbucket at
http://localhost:54324.
