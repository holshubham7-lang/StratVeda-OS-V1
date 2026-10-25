# Decision Intelligence API

NestJS API for social and manual signup. MongoDB uses the `revenue-intelligence` database, with `users` for accounts, `user_activities` for security activity history, and `company_details` for each user's saved business fingerprint and onboarding step. Mongoose creates unique user identity indexes and a unique sparse index for stored email addresses.

## Configure

Copy `.env.example` to `.env`, provide the OAuth client IDs and secrets and a random `JWT_SECRET` of at least 32 characters, and start MongoDB. Google uses the authorization-code flow, so set `GOOGLE_CLIENT_SECRET` from the same Google OAuth web client as `GOOGLE_CLIENT_ID`. The connection URI defaults to `mongodb://127.0.0.1:27017/revenue-intelligence`; the database name is explicitly set to `revenue-intelligence` even when a different URI is used.

For local HTTP development, keep `COOKIE_SAMESITE=lax` and `COOKIE_SECURE=false`. In Azure, the frontend proxies browser API calls through its own origin, so the session cookie is first-party and does not depend on cross-site cookie support. Keep `COOKIE_SECURE=true` in production; `COOKIE_SAMESITE=lax` is sufficient for the same-origin proxy. `SameSite=None` is only needed for direct cross-origin browser requests and requires HTTPS.

Configure each provider to issue OpenID Connect ID tokens to this application. Google and Microsoft client IDs should match their configured web application. LinkedIn must have OpenID Connect enabled. The API validates signature, issuer, audience, and expiry before creating an account. Never send provider client secrets to the browser. Google, Microsoft, and LinkedIn authorization codes are exchanged by the API using server-side client secrets; configure each exact redirect URI with its provider.

## Signup endpoint

`POST /api/auth/social/{google|microsoft|linkedin}/signup`
`POST /api/auth/manual/signup` with `{ "name", "email", "password" }`
`POST /api/auth/manual/login` with `{ "email", "password" }`
`GET /api/onboarding/business-details` and `POST /api/onboarding/business-details` (authenticated)
`GET /api/onboarding/problem-interview`, `POST /api/onboarding/problem-interview/start`, and `POST /api/onboarding/problem-interview/message` (authenticated)
`GET /api/onboarding/progress` (authenticated)
`POST /api/auth/social/google/exchange` (requires the GIS `X-Requested-With: XmlHttpRequest` header and an allowed frontend origin)
`POST /api/auth/social/logout` (requires the current API bearer token)

```json
{ "idToken": "<provider-issued OpenID Connect ID token>" }
```

Returns only `{ "status": true, "message": "Logged in successfully" }` in JSON. The API JWT is issued in an `HttpOnly`, `SameSite=Lax` cookie, not returned in the response body or exposed to frontend JavaScript. It remains valid for at least 24 hours. Manual signup requires an 8-character password, hashes it with scrypt, and records signup/login activity. Email is trimmed and lowercased; duplicate emails return `409` (including races caught by MongoDB's unique index). Accounts are not silently linked based on email. Repeating signup for the same social provider identity signs in the existing account. Microsoft may omit `email`; the API stores its `email` claim or an email-shaped `preferred_username` fallback and leaves `emailVerified` false unless Microsoft explicitly asserts verification. Microsoft documents that these claims can be absent or mutable, so unverified values are profile data only and must not be used for authorization. An email already owned by any account cannot be used for another social signup.

After provider verification, each successful new registration is recorded in `user_activities` with the user ID, `activity: signup`, provider, timestamp, request IP, user-agent, and available browser/OS/device hints (including device model when the browser supplies it). Returning users are recorded as `login`. Browsers do not expose a reliable unique machine identifier or hardware inventory, so the API does not invent or collect one. IP is taken from Express's resolved request IP; behind a reverse proxy, configure Express `trust proxy` only for the trusted proxy infrastructure before relying on client IP values. These logs contain personal data and should have access controls and a retention policy appropriate to your deployment.

The authenticated onboarding API stores the business fingerprint in the `company_details` collection, one document per user. It enforces required company name, industry, exactly one allowed business model, team size, revenue range, company stage, and country; website, state, and city are optional. Saving the first form sets the resume step to Strategic Context, so a later login returns to that second form. The Previous action can still return to edit the saved company details.

The discovery interview stores the user's problem statement, every successful user/agent turn, and Responses API continuation identifiers in the `problem_interviews` collection, scoped to the authenticated user. It invokes the configured `AZURE_FOUNDRY_INTERVIEW_AGENT_ENDPOINT` and lets the agent choose how many follow-up questions to ask. The agent is prompted to return `[[INTERVIEW_COMPLETE]]` on a line by itself once it has enough information. Login progress is derived from MongoDB: no saved company record resumes at Business Fingerprint Step 1; a saved company record without a completed interview resumes at Step 2; completing the interview advances to Strategic Context. Agent endpoints require Microsoft Entra authentication; API keys are not supported. In Azure App Service, enable a system-assigned managed identity on the API host and grant it the Foundry Agent Consumer role on the project. Locally, `AZURE_FOUNDRY_ACCESS_TOKEN` can hold a short-lived token for the `https://ai.azure.com/` audience.

The API JWT is issued only after the provider token is verified and the account is found or created. It is signed with HS256 and includes an issuer, audience, expiry, and unique token ID. Its lifetime is at least 24 hours; a longer `JWT_EXPIRES_IN` value is honored, while shorter or invalid values fall back to 24 hours. The browser sends the `ri_access_token` cookie on credentialed requests; frontend fetch calls must use `credentials: "include"`. Apply `JwtAuthGuard` to protected API routes so revoked tokens are rejected. Login and logout requests validate the frontend `Origin`, and the cookie uses `SameSite=Lax` (`Secure` is enabled in production). Keep these origin checks when adding state-changing cookie-authenticated routes; add CSRF tokens as well if cross-site use cases require relaxing SameSite.

For browser-based OAuth redirects, the frontend/provider SDK must also use and validate OAuth `state` (and PKCE where supported). That protects the provider authorization redirect; it is separate from CSRF protection for cookie-authenticated API requests.

## Local frontend sign-in

The signup page reads public client IDs from `GET /api/auth/social/config`; it never receives a client secret. Google uses Google Identity Services with a server callback, Microsoft uses the authorization-code flow with PKCE and a Next.js callback, and LinkedIn returns an authorization code to its Next.js callback for the API to exchange. Keep `LINKEDIN_CLIENT_SECRET` in the backend `.env` only.

Register these exact local URLs with the provider apps:

- Google authorized JavaScript origin: `http://localhost:3000`; authorized redirect URI: `http://localhost:3000/api/auth/oauth/google/callback`.
- Microsoft Entra **Web** redirect URI: `http://localhost:3000/api/auth/oauth/microsoft/callback`. Microsoft code redemption happens on the API using `MICROSOFT_CLIENT_SECRET` and the PKCE verifier; do not register this callback only as a Single-page application URI.
- LinkedIn authorized redirect URL: `http://localhost:3000/api/auth/oauth/linkedin/callback`; enable the OpenID Connect sign-in product.

The backend `.env` uses `http://localhost:3000` for CORS and `http://localhost:3000/api/auth/oauth/linkedin/callback` for the LinkedIn redirect. When the frontend origin changes, update `FRONTEND_ORIGIN` and `LINKEDIN_REDIRECT_URI` to match and restart the API.

## Security notes

- Helmet headers, explicit frontend-origin CORS, strict DTO validation, payload limits, and rate limiting are enabled.
- JWTs are signed with a server-only secret, include issuer and audience, and remain valid for at least 24 hours.
- In production, provide secrets through the deployment secret manager, use HTTPS, restrict database network access, and set `FRONTEND_ORIGIN` to the exact trusted origin(s).
