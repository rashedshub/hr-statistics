# HR Statistics Dashboard

A web version of the offline HR statistics dashboard: a public read-only view backed by
Firebase Firestore, plus a password-protected admin page for entering each month's numbers.

- **Hosting:** GitHub Pages (plain static HTML/CSS/JS, no build step)
- **Data:** Firebase Firestore
- **Login (admin only):** Firebase Authentication (email/password)

The public dashboard (`index.html`) is visible to anyone with the link. Only people who log
in on `admin.html` can add or edit data.

---

## 1. Create the Firebase project

1. Go to [console.firebase.google.com](https://console.firebase.google.com) → **Add project**.
2. Once created, click the **web** icon (`</>`) to register a web app. You don't need Firebase
   Hosting — you're deploying to GitHub Pages instead.
3. Copy the `firebaseConfig` object it gives you.
4. Paste those values into `js/firebase-config.js` in this project, replacing the placeholders.

## 2. Turn on Authentication

1. In the Firebase Console: **Build → Authentication → Get started**.
2. Enable the **Email/Password** sign-in method.
3. Go to the **Users** tab → **Add user** and create an account for yourself (and anyone else
   who should be able to edit data). There is intentionally no public sign-up page — you create
   admin accounts manually here.

## 3. Turn on Firestore

1. **Build → Firestore Database → Create database**. Start in production mode (any region close
   to you is fine).
2. Go to the **Rules** tab and replace the default rules with the contents of `firestore.rules`
   in this project, then **Publish**. This makes the data publicly *readable* but only
   *writable* by signed-in users.

You don't need to create any documents manually — the Admin page will create the `sites`
collection and each site's `reports` subcollection the first time you use it.

## 4. Run it locally (optional, to test before publishing)

Any static file server works, e.g. from this folder:

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080`. Go to `admin.html`, sign in, add a site (e.g. "YHT"), then
add a monthly report (Period ID like `2026-08`, Period label like `Aug/26`, and fill in the
numbers). Go back to `index.html` and you should see it rendered.

> Firebase Auth restricts sign-in to **authorized domains**. `localhost` is authorized by
> default. Once you publish to GitHub Pages, add that domain too — see step 6.

## 5. Publish to GitHub Pages

1. Create a new GitHub repository and push this folder's contents to it (root of the repo, or
   a `/docs` folder — either works, just set the Pages source to match).
2. In the repo: **Settings → Pages → Source**, pick the branch (usually `main`) and folder
   (`/ (root)` or `/docs`), then **Save**.
3. GitHub gives you a URL like `https://yourusername.github.io/your-repo/`. It can take a
   minute to go live.

## 6. Authorize your GitHub Pages domain in Firebase

1. Firebase Console → **Authentication → Settings → Authorized domains**.
2. Click **Add domain** and add `yourusername.github.io` (just the domain, no path).

Without this step, sign-in on the published `admin.html` will fail with an
`auth/unauthorized-domain` error.

## 7. (Optional) Restrict who can sign up

There is no self-serve sign-up flow in this app — admin accounts can only be created by you in
the Firebase Console, which is the simplest way to control who can edit data. If you later want
self-serve invites, that requires more setup (e.g. Firebase Cloud Functions) and isn't included
here.

---

## Data model

```
sites/{siteId}                → { name: "YHT" }
sites/{siteId}/reports/{periodId}  → { period: "Aug/26", manpower: 6895, ... all KPI fields }
```

`periodId` is whatever you type in Admin (e.g. `2026-08`) — keep it sortable, since the
dashboard and admin list both sort periods by document ID, newest first.

All the fields shown on each card (manpower, direct manpower %, turnover, leave consumption,
injuries, etc.) are defined in one place: **`js/schema.js`**. To add a new KPI card or field,
add an entry there — it will automatically show up in both the admin form and the public
dashboard.

## Project structure

```
index.html          Public dashboard (no login required)
admin.html           Login + data entry
css/style.css        Shared styling
js/firebase-config.js   Your Firebase project keys (edit this)
js/schema.js          Field/card definitions — single source of truth
js/app.js             Public dashboard logic (reads Firestore)
js/admin.js            Admin logic (auth + Firestore read/write)
firestore.rules        Security rules to paste into the Firebase Console
```

## Notes

- Numbers that can be negative (like "Manpower excess/(shortage)") are entered as plain
  negative numbers, e.g. `-18`, and the dashboard shows them in red automatically.
- The site and period pickers on the public dashboard update the URL
  (`?site=...&period=...`) so you can bookmark or share a link to a specific view.
- This is a fully client-side app — there's no server. Firestore's security rules are what
  actually protect the data from being edited by the public; the "Admin" link is just a page,
  not a security boundary by itself.
