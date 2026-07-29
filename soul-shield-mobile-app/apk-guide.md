# Building an Android APK with EAS Build

This guide walks through turning this Expo (SDK 54) project into an installable
Android `.apk` file using **EAS Build**, Expo's cloud build service. You already
have an Expo account, so you just need to install the CLI and run a few
commands — no Android Studio or local Android SDK required.

> Why EAS Build and not `expo build:android`? The old `expo build:android`
> command was removed from modern Expo. `eas build` is the current, supported
> way to produce native binaries (APK or AAB) for this project.

---

## Prerequisites

- Node.js and npm already installed and working (`npx expo start` runs fine in
  this project).
- An Expo account (you already created one).
- This project's dependencies installed (`npm install` — already done if you've
  run the app before).

---

## Step 1 — Install the EAS CLI

Install it globally so the `eas` command is available everywhere:

```bash
npm install -g eas-cli
```

Verify it installed:

```bash
eas --version
```

---

## Step 2 — Log in to your Expo account

```bash
eas login
```

Enter the email/username and password for the Expo account you already
created. Confirm you're logged in with:

```bash
eas whoami
```

---

## Step 3 — Configure the project for EAS Build

Run this once from the project root (`F:\Soul_Shield\soul-shield-mobile-app`):

```bash
eas build:configure
```

This will:
- Ask which platforms to configure — choose **Android** (and iOS too if you
  want it later).
- Create an `eas.json` file in the project root with default build profiles
  (`development`, `preview`, `production`).
- Link the project to an EAS project ID, which gets written into `app.json`
  under `extra.eas.projectId`.

> **Known issue hit on this project**: creating the project under the
> `farhan_nadim` personal account failed repeatedly with `GraphQL request
> failed` / `A project with this slug has previously been created by this
> account` — even for brand-new slugs that had never been used. This points
> to broken state on that account server-side, not a real naming conflict.
> The project was successfully created under the `farhannadims-team` account
> instead (`eas init --account farhannadims-team --non-interactive`). The
> project is now linked as `@farhannadims-team/soul-shield-mobile-app-fn2026`
> (`app.json` → `extra.eas.projectId` / `owner`). If you ever want it under
> your personal account instead, contact Expo support about the stuck
> `farhan_nadim` account state, or just keep using the team account — it
> works the same way for building/downloading APKs.

---

## Step 4 — Make sure the build produces an `.apk`, not an `.aab`

By default, EAS's `preview` and `production` profiles build an **AAB**
(Android App Bundle — the format required by the Google Play Store), which
you **cannot** directly install on a phone. To get a directly installable
APK, open the `eas.json` that step 3 created and add `"buildType": "apk"`
under the Android section of the profile you'll use. For example, using the
`preview` profile:

```json
{
  "build": {
    "preview": {
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      }
    },
    "production": {
      "autoIncrement": true
    }
  }
}
```

Keep `production` as an AAB for eventual Play Store submission, and use
`preview` (APK) for testing/sideloading on real devices.

---

## Step 5 — Fix the placeholder production API URL

This project's `.env.production` currently contains a placeholder backend
URL:

```
EXPO_PUBLIC_API_URL=https://api.soulshield.example.com
```

That host doesn't exist yet. If you build with this profile as-is, the app
will install fine but **every network request will fail**. Before building,
do one of the following:

- **Simplest**: edit `.env.production` and replace the URL with your real,
  deployed backend URL.
- **If you don't want the URL committed to the repo**: set it as an EAS
  environment variable instead:
  ```bash
  eas env:create --name EXPO_PUBLIC_API_URL --value https://your-real-backend.com --environment production
  ```

---

## Step 6 — Run the build

From the project root:

```bash
eas build --platform android --profile preview
```

What happens:
- The project is uploaded and the build runs on Expo's servers (not your
  machine).
- On your **first** Android build, EAS will offer to generate and manage a
  signing keystore for you — choose "Generate new keystore" and let EAS
  manage it (recommended; it will reuse the same keystore for every future
  build automatically).
- The terminal prints a build URL (`https://expo.dev/accounts/.../builds/...`)
  where you can watch progress live.
- You can also check status anytime with:
  ```bash
  eas build:list
  ```

Build times on the free tier typically take several minutes, including any
queue wait.

---

## Step 7 — Download and install the APK

Once the build finishes:

- The terminal and the `expo.dev` build page both show a **download link**
  and a **QR code** for the finished `.apk`.
- **On the Android phone itself**: open that link (or scan the QR code with
  the phone's camera) directly in the phone's browser, then tap the
  downloaded file to install.
  - You'll need to allow "Install unknown apps" for the browser app the first
    time — Android will prompt you for this automatically.
- **Via a PC**: download the `.apk` from the build page, connect the phone by
  USB with USB debugging enabled, then run:
  ```bash
  adb install path\to\your-app.apk
  ```

---

## Notes & gotchas

- **Package name**: `app.json` currently sets the Android package to
  `com.anonymous.soulshieldmobileapp`, which is a placeholder. This is fine
  for test APKs, but if you ever plan to publish to the Play Store, change it
  to something like `com.yourcompany.soulshield` *before* your first Play
  Store submission — it cannot be changed afterward.
- **Keystore**: let EAS manage your signing keystore unless you have a
  specific reason to supply your own. You can inspect/manage it later with
  `eas credentials`.
- **Re-building**: after the first successful build, subsequent runs of
  `eas build --platform android --profile preview` reuse the same keystore
  and configuration automatically — no need to repeat steps 1–4.
