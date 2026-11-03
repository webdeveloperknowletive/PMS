# On-demand data loading

The login flow already fetches the session user before navigating. Permission checks remain immediate, and existing module queries remain attached to their pages. This change reduces additional startup traffic rather than delaying authentication or serializing every request.

Changes:
- Chat conversations and personal chat settings are enabled when the widget is open. The closed widget no longer fetches conversations on first mount; its conversation-derived unread badge is populated after chat has been opened. Global notifications continue to provide updates.
- Header notification presentation settings are fetched when there are unread notifications. Chat sound/settings requests are fetched when chat is open or an unread chat notification needs them. Existing feed polling and permission checks remain.
- A closed calendar event dialog no longer requests the project list. Opening it enables that query.
- The dashboard work overview mounts when it enters the scroll viewport, using a dynamically loaded component and loading placeholder. A manual load control and an IntersectionObserver fallback support browsers without automatic observation. Once mounted it remains mounted until navigation, so scrolling does not restart its queries.

The dashboard still loads data required by its visible statistics, task list and resources; this is not a replacement of full-list queries with server-side aggregate endpoints. Background reminders and the notification feed are retained. Query cache defaults and backend authorization are unchanged.

Validation: frontend TypeScript check passed. Frontend production build passed, with existing image and hook warnings. Scoped diff whitespace checks passed. Interactive and production timing checks remain pending deployment. No measured production timing claim is made.

Deployment: commit and push the intended changes to the source revision used by Coolify, then rebuild/redeploy the frontend. No backend change or migration is required for these performance changes. Earlier authentication repairs have their separate deployment requirements.

Acceptance checks on a test account:
1. In DevTools Network, compare sign-in to usable dashboard on the same account/network with the old and new deployments.
2. With chat closed, confirm no conversation-list request is sent. Open chat and confirm conversations load and polling starts; close it and confirm polling stops.
3. With the event dialog closed, confirm it does not initiate a separate project picker request. Open it and confirm choices load.
4. Keep the work overview below the viewport, confirm its component and work-session queries are deferred, then scroll to it and confirm the panel loads. Navigate directly to a module and confirm its own data and loading state work normally.
5. Check an unread notification and chat notification still display using the configured presentation settings.

Unreachable API, CORS errors, slow SQL and slow essential session endpoints are separate causes; deferring module data cannot fix them. Do not request each module sequentially on login: fetch independent data in parallel only for the currently needed screen.
