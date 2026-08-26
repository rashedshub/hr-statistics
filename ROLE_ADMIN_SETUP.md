# Role-based admin access — setup guide

This adds two levels of access:

- **Super Admin** — can manage every plant, add/delete plants, and grant or revoke access for other admins.
- **Plant Admin** — can only view and edit data for the one plant they're assigned to. Every "Plant" dropdown
  across the admin pages is locked to just their plant.

Access is enforced two ways:
1. **In the UI** — a Plant Admin's dropdowns are locked and panels like "Plants" and "Manage Admins" are hidden.
2. **In Firestore's security rules** — this is what actually matters. Even if someone bypassed the UI (e.g. via
   browser dev tools), Firestore itself rejects any write outside what their role allows. Update your rules to
   match `firestore.rules` in this project (Firebase Console → Firestore Database → Rules → paste → Publish).

## One-time setup: creating the first Super Admin

There's a bootstrap problem: only a Super Admin can grant access to others, but nobody starts out as one. So the
**very first** Super Admin has to be created by hand, directly in the Firebase Console — after that, everyone
else can be added from the "Manage Admins" panel in `admin.html`.

1. **Create your login**, if you haven't already: Firebase Console → **Authentication → Users → Add user**
   (email + password).
2. **Copy that user's UID** — it's shown in the Users table right after you create them (a long string like
   `aB3xY9k7...`).
3. **Firebase Console → Firestore Database → Data → Start collection.**
   - Collection ID: `admins`
   - Document ID: paste the UID from step 2
   - Add two fields:
     - `role` (string) → `super`
     - `siteId` (string) → leave empty, or delete this field — it's not used for Super Admins
4. **Save.** Sign in at `login.html` with that account — you now have full access, including the "Manage Admins"
   panel to add everyone else.

## Adding a Plant Admin (after the first Super Admin exists)

This part no longer needs the Firestore Console — do it from the app:

1. **Firebase Console → Authentication → Users → Add user** for that person (email + password). Copy their UID.
2. In `admin.html`, go to **Manage Admins** (visible only to Super Admins).
3. Paste their **User UID**, give them a **label** (e.g. their email, just for your own reference — it isn't
   verified against anything), choose **Plant Admin**, and pick their **Plant**.
4. **Grant access.** They can now sign in at `login.html` and will only see/edit their one plant.

To revoke someone's access at any time — Super Admin or Plant Admin — click **Revoke** next to their name in the
Manage Admins list. This deletes their `admins/{uid}` document; their Firebase Auth login still exists (they
could still sign in), but Firestore's rules will refuse every read/write on `admins/{uid}`-gated actions, and
`login.js` signs them straight back out if that document is missing.

## Data model

```
admins/{uid}   → { role: "super" }
               → { role: "site", siteId: "abc123", label: "sarah@company.com" }
```

## Files touched by this change

```
firestore.rules     Updated — role-aware write rules
login.html            Unchanged
js/login.js            Now checks admins/{uid} exists before letting someone into admin.html
admin.html               New "Manage Admins" panel; role banner; Plants panel hidden for Plant Admins
js/admin.js                Auth guard now reads the caller's role; every "Plant" dropdown across every
                              topic's yearly-entry table is locked to a Plant Admin's one assigned plant
```

`index.html`, `disciplinary.html`, and their scripts are untouched — public viewing was already unrestricted
and stays that way; only write access changes.
