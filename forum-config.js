// Configuration du forum VLV
// Remplis ce fichier avant mise en production.

window.VLV_FORUM_CONFIG = {
    // Code requis pour publier un nouveau sujet.
    // Les reponses restent ouvertes a tous.
    postCreationCode: "Six-Seven",

    // Configuration Firebase (Firestore) pour activer le forum temps reel multi-utilisateurs.
    // Si tu laisses les valeurs de demo, le forum reste en mode local (localStorage).
    firebase: {
        apiKey: "AIzaSyDkapn8chCT8ghL69hn7xbaY9S_RIE_x0s",
        authDomain: "vlv-forum.firebaseapp.com",
        projectId: "vlv-forum",
        storageBucket: "vlv-forum.firebasestorage.app",
        messagingSenderId: "373024377238",
        appId: "1:373024377238:web:f5924862b3745fa3a7f5b7"
    }
};
