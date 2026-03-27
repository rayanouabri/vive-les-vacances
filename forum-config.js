// Configuration du forum VLV
// Remplis ce fichier avant mise en production.

window.VLV_FORUM_CONFIG = {
    // Mode recommande: "server" pour un forum public sans cle API exposee.
    mode: "server",

    // API serveur WordPress pour le forum public.
    apiBaseUrl: "https://vive-les-vacances.fr/wp-json/vlv-forum/v1",

    // Code requis pour publier un nouveau sujet.
    // En mode serveur, la verification du code se fait cote PHP.
    postCreationCode: "",

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
