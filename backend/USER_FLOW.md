# User role flow

The app uses `app_users` for usernames, backend-assigned participant IDs, and role-based dashboards.

## Database setup

Run `backend/db/app_users.sql` in the Supabase SQL editor.

The backend should use:

```text
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
ALLOWED_ORIGINS=https://your-vercel-app.vercel.app,http://localhost:5173
ADMIN_API_KEY=...
```

`SUPABASE_SERVICE_ROLE_KEY` is required for the user-management API because `app_users` has RLS enabled. Do not expose the service-role key in frontend/Vite environment variables.

`ADMIN_API_KEY` protects reminder/admin endpoints such as `/api/send-reminder`, `/api/subscriptions`, and `/api/notification-logs`. It is not needed by normal signup/login users.

The frontend should use:

```text
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
VITE_API_BASE_URL=http://localhost:3001
```

`VITE_SUPABASE_ANON_KEY` should be the public/publishable Supabase key. Do not use the service-role key for any `VITE_` variable.

## Roles

Supported role values:

```text
volunteer
content_contributor
researcher
admin
```

The backend normalizes common labels such as `content contributor`, `content-contributor`, and `content_creator` to `content_contributor`.

## API contract

### Sign up

```http
POST /api/users/signup
Content-Type: application/json
```

```json
{
  "username": "amn",
  "role": "volunteer",
  "name": "Amn",
  "contactPreference": "mobile",
  "mobileNumber": "03XX-XXXXXXX",
  "dialect": "hunza",
  "dialects": ["hunza"],
  "otherDialect": "",
  "gender": "female",
  "age": "18-25",
  "otherLanguageCount": "2",
  "otherLanguages": ["Urdu", "English"],
  "comfortLanguage": "Burushaski",
  "placeOfBirth": "Karachi, Pakistan",
  "placesLived": ["Karachi, Pakistan", "Hunza, Pakistan"],
  "consentAccepted": true
}
```

If a legacy username like `P-023` is used, the backend keeps that as the participant ID so previous local IDs can remain traceable. Otherwise it assigns a new `B-XXXXXXXX` participant ID.

### Log in

```http
POST /api/users/login
Content-Type: application/json
```

```json
{
  "username": "amn"
}
```

### Update profile

```http
PATCH /api/users/amn
Content-Type: application/json
```

```json
{
  "dialect": "yasin"
}
```

The public profile update route does not accept role changes. Roles are set at signup and should only be changed later through a separate admin-controlled flow.

## Frontend handoff

Login/signup screens should import:

```js
import { loginUser, signupUser, updateUserProfile } from "../utils/userApi";
```

Then save the returned user object with `setUser(user)`.

The returned shape is:

```js
{
  id,
  participantId,
  username,
  role,
  name,
  contactPreference,
  mobileNumber,
  dialect,
  dialects,
  otherDialect,
  gender,
  age,
  otherLanguageCount,
  otherLanguages,
  comfortLanguage,
  placeOfBirth,
  placesLived,
  consentAccepted
}
```

After `setUser(user)`, navigating to `/dashboard` will show the correct dashboard for that role.

## Local testing

1. Run `backend/db/app_users.sql` in the Supabase SQL editor for the student database.
2. Put `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in `backend/.env`.
3. Put `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and `VITE_API_BASE_URL=http://localhost:3001` in the root `.env`.
4. Start the backend from `backend/` with `npm run start`.
5. Start the frontend from the repo root with `npm run dev`.
6. Sign up with each non-admin role and confirm `/dashboard` changes by role. Volunteers should see the existing recording dashboard; content contributors and researchers should see the role-specific placeholder dashboard.
