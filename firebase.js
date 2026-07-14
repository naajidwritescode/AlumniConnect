// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
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
const analytics = getAnalytics(app);