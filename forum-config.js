// Configuration du forum VLV
// Remplis ce fichier avant mise en production.

window.VLV_FORUM_CONFIG = {
    // Code requis pour publier un nouveau sujet.
    // Les reponses restent ouvertes a tous.
    postCreationCode: "CHANGE_ME",

    // Configuration Firebase (Firestore) pour activer le forum temps reel multi-utilisateurs.
    // Si tu laisses les valeurs de demo, le forum reste en mode local (localStorage).
    firebase: {
        apiKey: "REMPLACE_PAR_TA_CLE_API",
        authDomain: "REMPLACE.firebaseapp.com",
        projectId: "REMPLACE_PAR_TON_PROJECT_ID",
        storageBucket: "REMPLACE.appspot.com",
        messagingSenderId: "123456789",
        appId: "1:123456789:web:abcdef"
    }
};
