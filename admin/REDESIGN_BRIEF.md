# Fresh RevOps Admin Console

## Source material to avoid

The folder `C:\stratvedatech-project\revops-app\app-v1.1\admin` is reference material only. Do not copy its pages, layout, components, styling, API implementation, authentication, or seed scripts. In particular, do not create an administrator row in MongoDB or reuse its `ADMIN_EMAILS` login model.

## Product goal

Create a new, calm, information-rich operations console for administrators who need to understand and manage the RevOps user base. Prioritize fast answers to: what changed, which accounts need attention, and what will happen if access is changed. Use the current admin API and real data; do not invent revenue or account-health metrics that the API cannot support.

## Visual direction

- Use an editorial operations aesthetic: warm paper canvas, deep ink text, restrained cobalt for navigation/actions, and a small citrus accent for highlights. Avoid the old app's generic gray-card dashboard and the current admin UI's dark vertical sidebar composition.
- Use a compact horizontal application header and a distinct content layout. Do not use a left-hand navigation rail or repeat the old 4-card + two-card dashboard grid.
- Make the overview feel like an operations briefing: a prominent signup trend, provider distribution, a concise account-status summary, and a recent-activity stream. Keep labels and periods explicit.
- Build the account directory around a useful, readable table with name/email, sign-in provider, verification, access status, created date, search, filters, and clear pagination.
- Give account details their own focused view or responsive drawer with profile metadata, recent sign-in events, current access state, and a carefully confirmed access action.
- Present admin changes as an audit ledger with actor, affected account, event, time, and client address where available. Keep deleted targets understandable.
- Make responsive layouts intentional at phone, tablet, laptop, and wide desktop sizes. Do not require horizontal scrolling to reach primary actions.
- Use real SVG/icon assets, accessible labels, visible keyboard focus, readable contrast, touch targets of at least 44px, reduced-motion support, and clear loading/error/empty states.

## Data and security constraints

- Keep the existing stack: Next.js frontend, NestJS API, MongoDB for product user/activity data.
- Keep administrator identity outside MongoDB. Read `ADMIN_LOGIN_EMAIL`, the scrypt `ADMIN_PASSWORD_HASH`, and `ADMIN_JWT_SECRET` from the API environment configured with Azure Key Vault references. Never add a seed-admin script or store administrator credentials in product collections.
- Reuse the admin API already in this repository as the data contract. Do not connect to the user-facing frontend/API's admin implementation in the reference folder.
- Preserve secure, short-lived HTTP-only session cookies, exact-origin write protection, rate-limited login, and audit logging.
- Do not modify `cybersecurity`; work on a local feature branch and push to remote `features` for the existing review path into `development`.

## Available data views

The current API provides user totals and active totals, daily signups for 30 days, provider breakdown, recently created accounts, recent user activity, searchable/paginated users, user detail with recent sign-in activity, active/inactive changes, and a searchable/paginated admin audit log. Use these accurately. If a new view needs backend data, add a narrow endpoint and never return password hashes, provider secrets, or other credentials.

## Review target

The finished panel must look and behave like a new product, not a reskin of the referenced app. Keep code organized into reusable page and UI components, explain meaningful non-obvious decisions in brief comments, and verify production builds and the principal user workflows before delivery.
