/*
  firebase-config.js
  -------------------------------------------------------------
  Djlvorne's login uses Firebase Authentication (free Spark plan, no card).

  HOW TO FILL THIS IN (about 5 minutes):
   1. Go to https://console.firebase.google.com and click "Add project".
      Turn Google Analytics OFF. Name it anything, e.g. "djlvorne".
   2. In the project: Build > Authentication > Get started >
      Sign-in method > Email/Password > Enable > Save.
   3. Project settings (gear icon) > General > "Your apps" > the </> Web icon.
      Register the app (skip Firebase Hosting). Firebase shows a config block.
   4. Copy the four values below from that block.
   5. Authentication > Settings > Authorized domains: make sure the place you
      open the app from is listed (localhost is there by default).

  If you leave apiKey EMPTY, the app runs in "device-only" mode: accounts are
  stored in this browser only. That is fine for testing the screens, but it is
  not real security and nothing syncs between devices.

  These values are NOT secrets. Firebase designs them to sit in front-end code.
  Your protection comes from Firebase security rules (set up in a later step).
*/
window.FIREBASE_CONFIG = {
  apiKey: "AIzaSyCAIEPojlvGkOxW0DR4CUEe-wr2pbRquI8",
  authDomain: "djalvorne-84edc.firebaseapp.com",
  projectId: "djalvorne-84edc",
  appId: "1:590692869262:web:18df284f7eda2940cf15df"
};
