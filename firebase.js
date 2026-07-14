// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database"; // Added for your Realtime Database
import { getAuth } from "firebase/auth";         // Added for User Authentication

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCCLhIE25nqpGZpi6SCgBaCcT_Xq4cAJ-s",
  authDomain: "alumniconnect-ea01c.firebaseapp.com",
  databaseURL: "https://alumniconnect-ea01c-default-rtdb.firebaseio.com",
  projectId: "alumniconnect-ea01c",
  storageBucket: "alumniconnect-ea01c.firebasestorage.app",
  messagingSenderId: "637761282971",
  appId: "1:637761282971:web:37a222bb7c4397aec1773e",
  measurementId: "G-0HM4N6K8XH"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export the database and auth tools so your AI agent can use them across the site
export const db = getDatabase(app);
export const auth = getAuth(app);
export default app;
