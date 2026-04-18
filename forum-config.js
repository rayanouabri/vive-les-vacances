// Configuration du forum VLV
// Supabase PostgreSQL pour le stockage des topics

window.VLV_FORUM_CONFIG = {
    // Mode recommande: "supabase" pour un forum avec base de donnees PostgreSQL
    mode: "supabase",

    // Configuration Supabase
    supabase: {
        projectUrl: "https://rdharosbdconzljxmwyr.supabase.co",
        anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJkaGFyb3NiZGNvbnpsanhtd3lyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzNDczMTYsImV4cCI6MjA5MTkyMzMxNn0.FpgQuPYc_YujH40oAo2bNOXHZjzobAEKYnMVfODYhfk",
        tableName: "forum_topics"
    },

    // Code optionnel pour valider les publications
    postCreationCode: "",

    // Pour fallback localStorage en cas d'erreur
    fallbackToLocal: true
};
