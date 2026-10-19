# RevOps Admin Console

The admin app and API are separate Next.js and NestJS services under `admin/`. The admin API reads the existing `users` and `user_activities` collections in the existing revenue-intelligence MongoDB database. It does not create an administrator account or save the admin email, password, or password hash in MongoDB.

## Local development

1. Set the API values in `backend/api/.env` using `.env.example` as a guide. Use a local database or a development-only MongoDB connection. The API needs `MONGODB_URI`, `MONGODB_DATABASE`, `ADMIN_LOGIN_EMAIL`, `ADMIN_PASSWORD_HASH`, and a random `ADMIN_JWT_SECRET` of at least 32 characters. Set `ADMIN_FRONTEND_ORIGINS=http://localhost:3001`.
2. Create a password verifier by running `node scripts/hash-admin-password.cjs` from `admin/backend/api` in an interactive terminal. The helper hides password input and prints only the scrypt hash. Use a password with at least 16 characters.
3. Install dependencies with `npm ci` in `admin/backend/api` and `admin/frontend`.
4. Start the API with `npm run start:dev` from `admin/backend/api`. Start the app with `npm run dev` from `admin/frontend`.

The frontend defaults to `http://localhost:8080/api`. Set `NEXT_PUBLIC_ADMIN_API_BASE_URL` at build time if the API uses another URL. `NEXT_PUBLIC_ADMIN_ENV_LABEL` names the environment in the sidebar (default `Development`); both are addresses or labels only and contain no credential.

## What the console covers

- **Overview** - user totals, active accounts, signups today and over 30 days, a signup trend, sign-in method breakdown, recently joined accounts, and recent sign-in activity.
- **Users** - debounced name/email search, account status and sign-in method filters, and paging at 10, 25, or 50 rows per page. Opening a row shows the account, its last 30 recorded activities, and the access control.
- **Admin activity** - every activation and deactivation with the acting administrator, the resolved target account, and the client address. Deleted accounts stay in history and are labelled `Deleted account` with their internal id. Filter by action or search by administrator or account.

The sidebar health chip reports a real `/api/health` request (reachable, unreachable, or checking) once per minute; it is not a static claim.

## Admin sign-in and data protection

- Set `ADMIN_LOGIN_EMAIL`, `ADMIN_PASSWORD_HASH`, and `ADMIN_JWT_SECRET` as Azure Key Vault referenced App Service settings on **revops-admin-api-dev**. Keep the plaintext password out of source control, application settings, MongoDB, and build logs. Share it only with the intended administrator through an approved private channel.
- Grant the API App Service managed identity permission to read the referenced Key Vault secrets. Keep the MongoDB URI in Key Vault too. Production connections require TLS.
- Generate a distinct random admin JWT secret, separate from the user-facing API's key. The admin session is short lived, signed with HS256, and sent only in an HTTP-only, Secure cookie. Azure uses SameSite=None for the cross-origin admin app/API request; the API accepts writes only from the exact configured frontend origin. Local development uses SameSite=Lax.
- The scrypt hash is intentionally one-way password hashing; the application never stores a reversible encrypted admin password. MongoDB contains only user data and an audit record for user access changes.
- Admin sign-in is rate limited. Admin writes check the exact request origin; API CORS allows only the configured frontend origins.
- Because the session cookie is `SameSite=None` in production, the exact-origin check on `POST /admin/auth/login`, `POST /admin/auth/logout`, and `PATCH /admin/users/:id/active/:status` is the CSRF defence. Only read endpoints accept an unoriginated request, and every response is a `application/json` body that requires the credentialed cross-origin fetch the CORS policy already gates.
- The API trusts only the loopback hop (`trust proxy: loopback`) so audit rows and the login throttle see the real client address behind App Service. A client-supplied `X-Forwarded-For` prefix is ignored because the platform appends the true address to the right.
- Sessions last 15 minutes. When one expires, the next request returns the API's session message and the console returns to the sign-in card with filters and cached views cleared.

## Development Azure services

The workflow deploys the admin API to `revops-admin-api-dev` and frontend to `revops-admin-app-dev`, and runs only for the `development` branch. Add GitHub Actions secrets `AZURE_ADMIN_API_PUBLISH_PROFILE` and `AZURE_ADMIN_APP_PUBLISH_PROFILE` for those existing apps. No admin deployment is configured for the `cybersecurity` branch.

Configure the API App Service settings:

| Setting | Development value |
| --- | --- |
| `NODE_ENV` | `production` |
| `MONGODB_URI` | Key Vault reference to the existing development MongoDB connection string |
| `MONGODB_DATABASE` | `revenue-intelligence` |
| `ADMIN_FRONTEND_ORIGINS` | `https://revops-admin-app-dev.azurewebsites.net` |
| `ADMIN_LOGIN_EMAIL` | Key Vault reference to the chosen admin email |
| `ADMIN_PASSWORD_HASH` | Key Vault reference to the scrypt hash |
| `ADMIN_JWT_SECRET` | Key Vault reference to a new, unique secret of at least 32 characters |

The frontend workflow builds with `NEXT_PUBLIC_ADMIN_API_BASE_URL=https://revops-admin-api-dev.azurewebsites.net/api`. The `NEXT_PUBLIC_` setting is an API address only and contains no credential.

## Custom subdomain

Bind the future admin hostname to `revops-admin-app-dev` and a sibling API hostname to `revops-admin-api-dev`; for example, `admin.example.com` and `admin-api.example.com`. Use HTTPS for both. Then update the API's exact `ADMIN_FRONTEND_ORIGINS` to the frontend origin and set the frontend build's `NEXT_PUBLIC_ADMIN_API_BASE_URL` to `https://admin-api.example.com/api`. Both hosts should share the same registrable domain so browser SameSite cookie rules continue to work. The API cookie stays host-only and is sent only to the API host; it does not need a broad cookie-domain setting.

For a future production environment, use separate App Services, MongoDB database access, credentials, Key Vault secrets, and GitHub deployment secrets. Do not point production at the development database.
