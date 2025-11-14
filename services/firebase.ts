// This tells TypeScript that the 'firebase' object exists on the global scope
declare var firebase: any;

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBP4KQFfg6gayNS6FsV6Jy4VQ_nGFs4v04",
  authDomain: "simulado-ale-ro.firebaseapp.com",
  projectId: "simulado-ale-ro",
  storageBucket: "simulado-ale-ro.firebasestorage.app",
  messagingSenderId: "497768330120",
  appId: "1:497768330120:web:673d33978f104ea399c03d"
};

// Initialize Firebase
const app = firebase.initializeApp(firebaseConfig);

// Initialize Cloud Firestore and get a reference to the service using the compat API
export const db = app.firestore();
