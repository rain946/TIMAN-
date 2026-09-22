import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyBwU2G0W5UsCSaB0voO754fp4Cft6tKvIE",
  authDomain: "timan-3330c.firebaseapp.com",
  projectId: "timan-3330c",
  storageBucket: "timan-3330c.firebasestorage.app",
  messagingSenderId: "1335066571587",
  appId: "1:1335066571587:web:a1e3eeba9cd6517552a3f6",
};

const app =
  getApps().length === 0
    ? initializeApp(firebaseConfig)
    : getApp();

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export default app;
