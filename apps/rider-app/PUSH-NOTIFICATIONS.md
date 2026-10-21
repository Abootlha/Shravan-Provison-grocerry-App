# Rider push notifications

The server sends a push alert to the rider's phone for a new order request,
an order packed, cancelled or reassigned, and when the rider is set offline
because the server lost contact. Push works even when the app is closed;
socket events only reach a running app.

The code is in place (`src/services/pushRegistration.ts`, backend
`RiderPushService`). Push turns on once the app is linked to an Expo project
and built with Firebase credentials:

1. **Link the app to Expo (EAS).** In `apps/rider-app` run `npx eas init`.
   It writes the real project UUID to `app.json` → `extra.eas.projectId`
   (currently the placeholder `rider-app-project`, which disables push).
2. **Android (FCM).** In Firebase, add an Android app with package
   `com.shravankirana.rider`, download `google-services.json` into
   `apps/rider-app/`, and add `"googleServicesFile": "./google-services.json"`
   under `expo.android` in `app.json`. Then upload the FCM V1 service account
   key with `npx eas credentials` (Android → Push Notifications).
3. **iOS (APNs).** `eas build` sets up the push key when you build for iOS.
4. **Build a new app binary** (`eas build`). Push does not work in Expo Go.

Check: sign in on the new build and allow notifications. The rider's phone
token is saved on the server (`PUT /riders/me/push-token`). Assign an order
with the app in the background: the phone should ring.
