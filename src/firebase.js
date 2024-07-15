import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional


const firebaseConfig = {
  apiKey: "AIzaSyBviE_a0r-ufQZpDdwqaKaSIDQI0dbnSig",
  authDomain: "daifugo-8cd0a.firebaseapp.com",
  projectId: "daifugo-8cd0a",
  storageBucket: "daifugo-8cd0a.appspot.com",
  messagingSenderId: "919929594411",
  appId: "1:919929594411:web:1ddc672ed89594f0f3806e",
  measurementId: "G-1HQRFELEH7"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
export default db;