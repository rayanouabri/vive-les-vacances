// Copy this file to forum-config.local.js and keep it private (not committed).
// Use mode: "firebase" only after securing Firestore/Storage rules and API restrictions.

window.VLV_FORUM_CONFIG = {
    mode: "firebase",
    postCreationCode: "CHANGE_ME",
    storageUploads: true,
    firebase: {
        apiKey: "REMPLACE_PAR_TA_CLE_API",
        authDomain: "REMPLACE.firebaseapp.com",
        projectId: "REMPLACE_PAR_TON_PROJECT_ID",
        storageBucket: "REMPLACE.appspot.com",
        messagingSenderId: "REMPLACE_PAR_TON_SENDER_ID",
        appId: "REMPLACE_PAR_TON_APP_ID"
    }
};
