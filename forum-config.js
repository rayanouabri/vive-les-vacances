// Configuration du forum VLV
// Remplis ce fichier avant mise en production.

window.VLV_FORUM_CONFIG = {
    // Mode recommande: "local" (sans API) tant que la securite Firebase n'est pas terminee.
    // Passe a "firebase" uniquement quand les regles Firestore/Storage et restrictions API sont en place.
    mode: "local",

    // Code requis pour publier un nouveau sujet.
    // Les reponses restent ouvertes a tous.
    postCreationCode: "Six-Seven",

    // Active l'upload photo Firebase Storage uniquement en mode "firebase".
    storageUploads: false,

    // Configuration Firebase (Firestore) pour activer le forum temps reel multi-utilisateurs.
    // Si tu laisses les valeurs de demo, le forum reste en mode local (localStorage).
    firebase: {
        apiKey: "REMPLACE_PAR_TA_CLE_API",
        authDomain: "REMPLACE.firebaseapp.com",
        projectId: "REMPLACE_PAR_TON_PROJECT_ID",
        storageBucket: "REMPLACE.appspot.com",
        messagingSenderId: "REMPLACE_PAR_TON_SENDER_ID",
        appId: "REMPLACE_PAR_TON_APP_ID"
    }
};
