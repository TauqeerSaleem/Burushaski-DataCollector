# User role flow

The app uses `app_users` for usernames, backend-assigned participant IDs, and role-based dashboards.

## Database setup

Run `backend/db/app_users.sql` in the Supabase SQL editor.

The backend should use:

```text
VITE_SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
```

`VITE_SUPABASE_ANON_KEY` still works as a local fallback, but production user writes should use the service-role key on the backend only.

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
  "dialect": "hunza",
  "gender": "female",
  "age": "21",
  "otherLanguages": ["Urdu", "English"],
  "placeOfBirth": "Karachi",
  "placesLived": ["Karachi", "Hunza"],
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

### Update profile or role

```http
PATCH /api/users/amn
Content-Type: application/json
```

```json
{
  "role": "researcher",
  "dialect": "yasin"
}
```

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
  dialect,
  gender,
  age,
  otherLanguages,
  placeOfBirth,
  placesLived,
  consentAccepted
}
```

After `setUser(user)`, navigating to `/dashboard` will show the correct dashboard for that role.
