# HR Statistics Dashboard

A web version of the offline HR statistics dashboard: a public read-only view backed by
Firebase Firestore, plus a password-protected admin section for entering each month's numbers.

- **Hosting:** GitHub Pages, deployed straight from the repo root (same layout as your
  `my-dashboard` repo — flat files, `style.css` at the top level, a `js/` folder for scripts).
- **Data:** Firebase Firestore
- **Login (admin only):** Firebase Authentication (email/password)

`index.html` is public — anyone with the link can view it. `admin.html` is protected: if you're
not signed in it sends you to `login.html`, and only accounts you create in the Firebase
Console can sign in (no public sign-up page, on purpose — see note below).

---

## 1. Create the Firebase project

1. Go to [console.firebase.google.com](https://console.firebase.google.com) → **Add project**.
2. Click the **web** icon (`</>`) to register a web app. You don't need Firebase Hosting —
   you're deploying to GitHub Pages instead.
3. Copy the `firebaseConfig` object it gives you.
4. Paste those values into `js/firebase-config.js`, replacing the placeholders.

## 2. Turn on Authentication

1. **Build → Authentication → Get started**.
2. Enable the **Email/Password** sign-in method.
3. **Users** tab → **Add user** → create an account for yourself (and anyone else who should be
   able to edit data). This is the only way to create admin accounts.

## 3. Turn on Firestore

1. **Build → Firestore Database → Create database** (production mode, any nearby region).
2. **Rules** tab → replace the default rules with the contents of `firestore.rules` → **Publish**.
   This makes data publicly *readable* but only *writable* by signed-in users.

The `sites` collection and each site's `reports` subcollection are created automatically the
first time you use the Admin page — no manual document setup needed.

## 4. Run it locally (optional)

From this folder:

```bash
python3 -m http.server 8080
```

Open `http://localhost:8080`. Go to `login.html`, sign in, then on `admin.html` add a site
(e.g. "YHT") and a monthly report (Period ID like `2026-08`, label like `Aug/26`, and the
numbers). Check `index.html` to see it rendered.

`localhost` is authorized for sign-in by default — once published, add your Pages domain too
(step 6).

## 5. Publish to GitHub Pages

1. Push this folder's contents to the root of your repo (matching `my-dashboard`'s layout).
2. **Settings → Pages → Source** → pick the branch (`main`) and `/ (root)` → **Save**.
3. Your URL will look like `https://rashedshub.github.io/your-repo/`.

## 6. Authorize your GitHub Pages domain in Firebase

**Authentication → Settings → Authorized domains → Add domain** → add `rashedshub.github.io`
(just the domain, no path). Without this, sign-in on the published `login.html` fails with
`auth/unauthorized-domain`.

## 7. On the missing sign-up page

Your `my-dashboard` repo has a `signup.html`; this project deliberately doesn't. A public
sign-up form would let anyone create an account able to edit your HR numbers. Creating accounts
yourself in the Firebase Console keeps that closed. If you'd rather have a real sign-up flow
(e.g. gated by an invite code, or restricted to your company's email domain), that's doable —
just ask and I'll add it.

---

## Data model

```
sites/{siteId}                     → { name: "YHT" }
sites/{siteId}/reports/{periodId}  → { period: "Aug/26", manpower: 6895, ... all KPI fields }
```

`periodId` is whatever you type in Admin (e.g. `2026-08`) — keep it sortable, since both the
dashboard and admin list sort periods by document ID, newest first.

Every field shown on a card (manpower, direct manpower %, turnover, leave consumption,
injuries, etc.) is defined once in **`js/schema.js`**. Add an entry there to add a new KPI —
it appears automatically in both the admin form and the public dashboard.

## Project structure

```
index.html            Public dashboard (no login required)
login.html             Sign in
admin.html              Data entry (redirects to login.html if not signed in)
style.css               Shared styling
js/firebase-config.js   Your Firebase project keys (edit this)
js/schema.js            Field/card definitions — single source of truth
js/app.js               Public dashboard logic (reads Firestore)
js/login.js              Sign-in logic
js/admin.js               Admin logic (auth guard + Firestore read/write)
firestore.rules           Security rules to paste into the Firebase Console
```

## Notes

- Numbers that can be negative (like "Manpower excess/(shortage)") are entered as plain
  negative numbers, e.g. `-18`, and the dashboard shows them in red automatically.
- The site and period pickers on the public dashboard update the URL
  (`?site=...&period=...`) so you can bookmark or share a link to a specific view.
- This is a fully client-side app — there's no server. Firestore's security rules are what
  actually protect the data from being edited by the public; `login.html`/`admin.html` are
  just pages, not a security boundary by themselves.
