import { initializeApp } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCAIEPojlvGkOxW0DR4CUEe-wr2pbRquI8",
  authDomain: "djalvorne-84edc.firebaseapp.com",
  projectId: "djalvorne-84edc",
  storageBucket: "djalvorne-84edc.firebasestorage.app",
  messagingSenderId: "590692869262",
  appId: "1:590692869262:web:18df284f7eda2940cf15df"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
