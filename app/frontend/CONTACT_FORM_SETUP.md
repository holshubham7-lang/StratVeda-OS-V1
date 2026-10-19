# Contact form delivery

The contact form validates submissions in the browser and on the server. It posts enquiries to a Microsoft Teams Workflows webhook from the server, so the webhook URL is never exposed to the browser.

## Connect a Teams channel

1. In Teams, open the channel that should receive website enquiries and choose **More options (…) → Workflows**.
2. Create the **Send webhook alerts to a channel** workflow (or a workflow using the **When a Teams webhook request is received** trigger). Select the destination channel and save it.
3. Copy the generated webhook URL. Treat it like a password; do not commit it or put it in a `NEXT_PUBLIC_*` setting.
4. In Azure, open the `revops-frontend-dev` App Service → **Settings → Environment variables** and add `TEAMS_CONTACT_WEBHOOK_URL` with that URL. Save the setting and let Azure restart the app.
5. Submit a test enquiry through `/contact` and confirm it appears in the selected Teams channel.

The workflow owner should add another owner in Teams so the integration can still be managed if the original owner is unavailable. Until `TEAMS_CONTACT_WEBHOOK_URL` is configured, the form returns a clear “not connected” error instead of claiming that an enquiry was delivered.
