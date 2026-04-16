// Configuration du forum VLV
// Supabase PostgreSQL pour le stockage des topics

window.VLV_FORUM_CONFIG = {
    // Mode recommande: "supabase" pour un forum avec base de donnees PostgreSQL
    mode: "supabase",

    // Configuration Supabase
    supabase: {
        projectUrl: "https://zqnahuwulelkutwxxklky.supabase.co",
        anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc0xvY2FsIjpmYWxzZSwiZGlzcyI6IjY3NGlpN2pyXzB6bWlTQWQ1LW5YyJdfRkpXZlZTIXRm1yN1ZpG1npxt",
        tableName: "forum_topics"
    },

    // Code optionnel pour valider les publications
    postCreationCode: "",

    // Pour fallback localStorage en cas d'erreur
    fallbackToLocal: true
};
