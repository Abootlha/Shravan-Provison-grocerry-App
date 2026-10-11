# ShravanKirana Admin

Static Astro + React dashboard for the NestJS backend (`../backend`).

| Command              | Action                                            |
|----------------------|---------------------------------------------------|
| `npm run dev`        | Dev server at `localhost:4321`                    |
| `npm run build`      | Static build to `dist/` (needs `PUBLIC_API_URL` and `PUBLIC_TRACKING_URL`) |
| `npm test`           | Vitest, single run (`npm run test:watch` to watch) |

Configuration is in `.env` (see `.env.example`). `PUBLIC_*` values are baked into the
bundle and are public.

## Auth model

- Login stores the access token, refresh token and user in `localStorage`.
- `src/layouts/AdminLayout.astro` has an inline guard in `<head>`. It hides the page and
  redirects to `/login` when there is no valid token. It refreshes the token first when
  only the access token has expired.
- `src/lib/api.ts` reads the JWT `exp` claim. On a 401 it makes one shared
  `POST /auth/refresh` call (`{ refreshToken }`), retries the request, and sends the user
  to `/login` if that fails. Logout calls `POST /auth/logout` and clears every stored key.
- The guard only hides UI. The backend enforces authorization on every request.

**Accepted risk:** a static site with no server of its own cannot use httpOnly cookies,
so tokens sit in `localStorage` and an XSS bug could read them. To limit this, keep
access tokens short-lived, don't add third-party scripts, and never render untrusted
HTML.
