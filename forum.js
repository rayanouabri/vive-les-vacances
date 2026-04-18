const forumConfig = window.VLV_FORUM_CONFIG || {};
const forumMode = (forumConfig.mode || 'local').toLowerCase();
const apiBaseUrl = (forumConfig.apiBaseUrl || '').replace(/\/$/, '');
const firebaseConfig = forumConfig.firebase || {};
const supabaseConfig = forumConfig.supabase || {};
const POST_CREATION_CODE = (forumConfig.postCreationCode || '').trim();
const wantsServerMode = forumMode === 'server' && Boolean(apiBaseUrl);
const wantsFirebaseMode = forumMode === 'firebase';
const wantsSupabaseMode = forumMode === 'supabase' && Boolean(supabaseConfig.projectUrl && supabaseConfig.anonKey);
const allowStorageUploads = wantsFirebaseMode && forumConfig.storageUploads === true;

let db = null;
let firebaseReady = false;
let storage = null;
let storageReady = false;
let vlvSupabaseClient = null;
let supabaseReady = false;
let selectedPostImages = [];
let currentFilter = 'all';
let forumRefreshTimer = null;

const MAX_POST_PHOTOS = 4;
const MAX_PHOTO_BYTES = 1200000;
const categoryLabels = {
    general: 'Discussion',
    vacances: 'Vacances',
    conseils: 'Conseils',
    entraide: 'Entraide',
    annonces: 'Annonces',
    idees: 'Idees'
};

try {
    const hasRealFirebaseConfig =
        firebaseConfig.apiKey && !firebaseConfig.apiKey.includes('REMPLACE') &&
        firebaseConfig.projectId && !firebaseConfig.projectId.includes('REMPLACE') &&
        firebaseConfig.authDomain && !firebaseConfig.authDomain.includes('REMPLACE') &&
        firebaseConfig.appId && !firebaseConfig.appId.includes('REMPLACE');

    if (wantsFirebaseMode && hasRealFirebaseConfig && window.firebase) {
        firebase.initializeApp(firebaseConfig);
        db = firebase.firestore();
        firebaseReady = true;
        if (allowStorageUploads) {
            try {
                storage = firebase.storage();
                storageReady = true;
            } catch (storageError) {
                console.warn('Firebase Storage non configure:', storageError.message);
            }
        }
    }
} catch (error) {
    console.warn('Initialisation Firebase impossible:', error.message);
}

try {
    if (wantsSupabaseMode) {
        const existingSupabaseScript = document.querySelector('script[src*="supabase-js"]');

        const initSupabase = () => {
            if (window.supabase && window.supabase.createClient) {
                vlvSupabaseClient = window.supabase.createClient(supabaseConfig.projectUrl, supabaseConfig.anonKey);
                supabaseReady = true;
                console.log('Supabase initialise avec succes');
                if (typeof loadSupabaseTopics === 'function') {
                    loadSupabaseTopics();
                }
            }
        };

        if (existingSupabaseScript) {
            if (window.supabase && window.supabase.createClient) {
                initSupabase();
            } else {
                existingSupabaseScript.onload = initSupabase;
            }
        } else {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
            script.async = true;
            script.onload = initSupabase;
            script.onerror = () => {
                console.warn('Impossible de charger la bibliotheque Supabase');
                if (forumConfig.fallbackToLocal) {
                    fallbackToLocalStorage('Mode local (Supabase non disponible)');
                }
            };
            document.head.appendChild(script);
        }
    }
} catch (error) {
    console.warn('Initialisation Supabase impossible:', error.message);
    if (forumConfig.fallbackToLocal) {
        fallbackToLocalStorage('Mode local (erreur Supabase)');
    }
}

function showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 400);
    }, 3500);
}

const hamburger = document.getElementById('hamburger');
const nav = document.getElementById('nav');
const scrollBtn = document.getElementById('scrollToTopBtn');

if (scrollBtn) {
    window.addEventListener('scroll', () => {
        scrollBtn.classList.toggle('visible', window.scrollY > 400);
    }, { passive: true });
    scrollBtn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
}

if (hamburger && nav) {
    hamburger.addEventListener('click', () => {
        hamburger.classList.toggle('active');
        nav.classList.toggle('open');
        document.body.style.overflow = nav.classList.contains('open') ? 'hidden' : '';
    });

    nav.querySelectorAll('.nav-link').forEach((link) => {
        link.addEventListener('click', () => {
            hamburger.classList.remove('active');
            nav.classList.remove('open');
            document.body.style.overflow = '';
        });
    });
}

function getStatusElement() {
    return document.getElementById('forumStatus');
}

function getTopicsElement() {
    return document.getElementById('forumTopics');
}

function getForumCountElement() {
    return document.getElementById('forumCount');
}

function updateStatus(message, state = 'connected') {
    const statusEl = getStatusElement();
    if (!statusEl) return;

    statusEl.innerHTML = `<div class="forum-status-dot ${state}"></div><span>${message}</span>`;
}

function formatDate(timestamp) {
    if (!timestamp) return "A l'instant";

    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    if (Number.isNaN(date.getTime())) return "A l'instant";

    const diff = Date.now() - date.getTime();
    if (diff < 60000) return "A l'instant";
    if (diff < 3600000) return `il y a ${Math.floor(diff / 60000)} min`;
    if (diff < 86400000) return `il y a ${Math.floor(diff / 3600000)}h`;

    return date.toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
    });
}

function sanitize(value) {
    const div = document.createElement('div');
    div.textContent = String(value || '');
    return div.innerHTML;
}

function formatPostContent(value) {
    return sanitize(value).replace(/\n/g, '<br>');
}

function normalizeTopic(topic, fallbackId = '') {
    return {
        id: topic.id || fallbackId || `topic_${Date.now()}`,
        author: String(topic.author || 'Anonyme').trim(),
        title: String(topic.title || 'Sans titre').trim(),
        content: String(topic.content || '').trim(),
        category: String(topic.category || 'general').trim(),
        createdAt: topic.createdAt || new Date().toISOString(),
        media: Array.isArray(topic.media) ? topic.media.filter(Boolean) : []
    };
}

function renderTopic(topic) {
    const mediaHtml = topic.media.length ? `
        <div class="forum-topic-media">
            ${topic.media.map((src, index) => `<img src="${sanitize(src)}" alt="Photo du post ${index + 1}">`).join('')}
        </div>
    ` : '';

    return `
        <div class="forum-topic" data-category="${sanitize(topic.category)}" data-id="${sanitize(topic.id)}">
            <div class="forum-topic-header">
                <span class="forum-topic-title">${sanitize(topic.title)}</span>
                <span class="forum-topic-badge badge-${sanitize(topic.category)}">${sanitize(categoryLabels[topic.category] || topic.category)}</span>
            </div>
            <div class="forum-topic-meta">Par <strong>${sanitize(topic.author)}</strong> - ${sanitize(formatDate(topic.createdAt))}</div>
            <div class="forum-topic-content">${formatPostContent(topic.content)}</div>
            ${mediaHtml}
        </div>
    `;
}

function renderTopics(topics) {
    const topicsEl = getTopicsElement();
    const countEl = getForumCountElement();
    if (!topicsEl || !countEl) return;

    const visibleTopics = topics.filter((topic) => currentFilter === 'all' || topic.category === currentFilter);

    if (!visibleTopics.length) {
        topicsEl.innerHTML = '<div class="forum-empty"><div class="forum-empty-icon">...</div><p>Aucun sujet pour le moment. Soyez le premier a publier.</p></div>';
        countEl.textContent = '0 sujet';
        return;
    }

    topicsEl.innerHTML = visibleTopics.map((topic) => renderTopic(topic)).join('');
    countEl.textContent = `${visibleTopics.length} sujet${visibleTopics.length > 1 ? 's' : ''}`;
}

function getLocalTopics() {
    try {
        return JSON.parse(localStorage.getItem('vlv_topics') || '[]').map((topic) => normalizeTopic(topic));
    } catch {
        return [];
    }
}

function saveLocalTopics(topics) {
    localStorage.setItem('vlv_topics', JSON.stringify(topics));
}

function getDemoTopics() {
    return [
        normalizeTopic({
            id: 'demo1',
            author: 'Equipe VLV',
            title: 'Bienvenue sur le forum',
            content: 'Partagez vos idees, vos retours et vos propositions pour faire vivre le collectif.',
            category: 'annonces',
            createdAt: new Date(Date.now() - 86400000).toISOString(),
            media: []
        }),
        normalizeTopic({
            id: 'demo2',
            author: 'Fatou',
            title: 'Idee sortie famille',
            content: 'On pourrait organiser une sortie au parc avec un atelier jeux cooperatifs pendant les vacances.',
            category: 'idees',
            createdAt: new Date(Date.now() - 172800000).toISOString(),
            media: []
        })
    ];
}

function loadLocalTopics() {
    let topics = getLocalTopics();
    if (!topics.length) {
        topics = getDemoTopics();
        saveLocalTopics(topics);
    }

    renderTopics(topics);
}

async function getSupabaseTopics() {
    if (!vlvSupabaseClient || !supabaseReady) return [];
    try {
        const { data, error } = await vlvSupabaseClient
            .from(supabaseConfig.tableName || 'forum_topics')
            .select('*')
            .order('created_at', { ascending: false });
        if (error) throw error;
        return (data || []).map(topic => normalizeTopic({
            id: topic.id,
            author: topic.author,
            title: topic.title,
            content: topic.content,
            category: topic.category,
            createdAt: topic.created_at,
            media: topic.media || []
        }));
    } catch (error) {
        console.warn('Erreur Supabase getTopics:', error.message);
        return [];
    }
}

async function saveSupabaseTopic(topic) {
    if (!vlvSupabaseClient || !supabaseReady) return false;
    try {
        const { error } = await vlvSupabaseClient
            .from(supabaseConfig.tableName || 'forum_topics')
            .insert([{
                id: topic.id,
                author: topic.author,
                title: topic.title,
                content: topic.content,
                category: topic.category,
                media: topic.media || [],
                created_at: new Date().toISOString()
            }]);
        if (error) throw error;
        return true;
    } catch (error) {
        console.warn('Erreur Supabase saveTopic:', error.message);
        return false;
    }
}

async function loadSupabaseTopics() {
    if (!supabaseReady) {
        loadLocalTopics();
        return;
    }
    updateStatus('Chargement depuis Supabase...', 'connected');
    const topics = await getSupabaseTopics();
    if (topics.length > 0) {
        renderTopics(topics);
        updateStatus('Forum en ligne', 'connected');
    } else {
        const demoTopics = getDemoTopics();
        renderTopics(demoTopics);
        updateStatus('Forum en ligne (demo)', 'connected');
    }
}

function fallbackToLocalStorage(message) {
    updateStatus(message || 'Mode local actif sur cet appareil.', 'error');
    loadLocalTopics();
}

function renderPhotoPreview() {
    const preview = document.getElementById('photoPreview');
    if (!preview) return;

    if (!selectedPostImages.length) {
        preview.innerHTML = '';
        return;
    }

    preview.innerHTML = selectedPostImages.map((src, index) => `
        <div class="photo-thumb">
            <img src="${sanitize(src)}" alt="Photo a publier ${index + 1}">
            <button type="button" class="remove-photo-btn" data-remove-index="${index}" aria-label="Supprimer la photo">x</button>
        </div>
    `).join('');
}

function compressImage(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const img = new Image();
            img.onload = () => {
                const maxW = 1280;
                const maxH = 1280;
                let width = img.width;
                let height = img.height;
                const ratio = Math.min(maxW / width, maxH / height, 1);

                width = Math.round(width * ratio);
                height = Math.round(height * ratio);

                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d', { alpha: false });
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, width, height);
                ctx.drawImage(img, 0, 0, width, height);

                let quality = 0.8;
                let out = canvas.toDataURL('image/jpeg', quality);
                while (out.length > MAX_PHOTO_BYTES && quality > 0.45) {
                    quality -= 0.08;
                    out = canvas.toDataURL('image/jpeg', quality);
                }

                resolve(out);
            };
            img.onerror = reject;
            img.src = reader.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

async function uploadPostImage(dataUrl, index) {
    if (!storageReady || !storage) return dataUrl;

    const path = `forum-posts/${Date.now()}-${Math.random().toString(36).slice(2)}-${index}.jpg`;
    const ref = storage.ref().child(path);
    const snap = await ref.putString(dataUrl, 'data_url');
    return snap.ref.getDownloadURL();
}

function isStorageCorsError(error) {
    const msg = (error && (error.message || error.code || '')).toString().toLowerCase();
    return msg.includes('cors') || msg.includes('failed to fetch') || msg.includes('network-request-failed');
}

function toggleNewTopicForm() {
    const form = document.getElementById('forumForm');
    const btn = document.getElementById('toggleFormBtn');
    if (!form || !btn) return;

    form.classList.toggle('open');
    btn.classList.toggle('open');
}

function applyFilter() {
    const topics = Array.from(document.querySelectorAll('.forum-topic'));
    let visibleCount = 0;

    topics.forEach((topic) => {
        const show = currentFilter === 'all' || topic.dataset.category === currentFilter;
        topic.style.display = show ? '' : 'none';
        if (show) visibleCount += 1;
    });

    const countEl = getForumCountElement();
    if (countEl) {
        countEl.textContent = `${visibleCount} sujet${visibleCount > 1 ? 's' : ''}`;
    }
}

function bindFilters() {
    document.querySelectorAll('.filter-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn').forEach((button) => button.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.dataset.filter || 'all';
            applyFilter();
        });
    });
}

function initPostComposer() {
    const emojiToggle = document.getElementById('emojiToggle');
    const emojiPanel = document.getElementById('emojiPanel');
    const content = document.getElementById('topicContent');
    const photosInput = document.getElementById('topicPhotos');
    const preview = document.getElementById('photoPreview');

    if (emojiToggle && emojiPanel && content) {
        emojiToggle.addEventListener('click', () => {
            emojiPanel.hidden = !emojiPanel.hidden;
        });

        emojiPanel.addEventListener('click', (event) => {
            const button = event.target.closest('.emoji-btn');
            if (!button) return;
            content.value += button.dataset.emoji || '';
            content.focus();
        });
    }

    if (photosInput) {
        photosInput.addEventListener('change', async (event) => {
            const files = Array.from(event.target.files || []).filter((file) => file.type.startsWith('image/'));
            if (!files.length) return;

            const remaining = MAX_POST_PHOTOS - selectedPostImages.length;
            if (remaining <= 0) {
                showToast(`Maximum ${MAX_POST_PHOTOS} photos par post`, 'info');
                photosInput.value = '';
                return;
            }

            const toProcess = files.slice(0, remaining);
            try {
                const compressed = await Promise.all(toProcess.map((file) => compressImage(file)));
                selectedPostImages = selectedPostImages.concat(compressed);
                renderPhotoPreview();
                if (files.length > remaining) {
                    showToast(`Seules ${MAX_POST_PHOTOS} photos sont autorisees`, 'info');
                }
            } catch {
                showToast('Impossible de traiter une photo', 'error');
            }

            photosInput.value = '';
        });
    }

    if (preview) {
        preview.addEventListener('click', (event) => {
            const button = event.target.closest('[data-remove-index]');
            if (!button) return;

            const index = parseInt(button.dataset.removeIndex, 10);
            if (Number.isNaN(index)) return;

            selectedPostImages.splice(index, 1);
            renderPhotoPreview();
        });
    }
}

async function fetchServerTopics() {
    const response = await fetch(`${apiBaseUrl}/topics`, {
        headers: { Accept: 'application/json' },
        cache: 'no-store'
    });
    const payload = await response.json().catch(() => null);

    if (!response.ok) {
        throw new Error(payload && payload.message ? payload.message : 'Impossible de charger le forum public.');
    }

    return Array.isArray(payload) ? payload.map((topic) => normalizeTopic(topic)) : [];
}

async function createServerTopic(topic) {
    const response = await fetch(`${apiBaseUrl}/topics`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json'
        },
        body: JSON.stringify(topic)
    });
    const payload = await response.json().catch(() => null);

    if (!response.ok) {
        throw new Error(payload && payload.message ? payload.message : 'Publication impossible pour le moment.');
    }

    return normalizeTopic(payload);
}

async function initServerForum() {
    updateStatus('Connexion au forum public...', 'connected');
    const topics = await fetchServerTopics();
    renderTopics(topics);
    updateStatus('Forum public en ligne', 'connected');

    if (forumRefreshTimer) {
        window.clearInterval(forumRefreshTimer);
    }

    forumRefreshTimer = window.setInterval(async () => {
        try {
            const refreshedTopics = await fetchServerTopics();
            renderTopics(refreshedTopics);
        } catch (error) {
            console.warn('Rafraichissement du forum impossible:', error);
        }
    }, 20000);
}

function initFirebaseForum() {
    db.collection('topics').orderBy('createdAt', 'desc').onSnapshot(
        (snapshot) => {
            const topics = snapshot.docs.map((doc) => normalizeTopic({
                id: doc.id,
                ...doc.data(),
                createdAt: doc.data().createdAt && doc.data().createdAt.toDate
                    ? doc.data().createdAt.toDate().toISOString()
                    : doc.data().createdAt
            }, doc.id));
            renderTopics(topics);
            updateStatus('Forum connecte en temps reel', 'connected');
        },
        (error) => {
            console.error('Erreur Firestore:', error);
            fallbackToLocalStorage('Connexion Firebase indisponible. Mode local actif.');
        }
    );
}

async function publishFirebaseTopic(author, title, content, category) {
    let media = selectedPostImages.slice();

    if (selectedPostImages.length && storageReady) {
        const uploaded = await Promise.allSettled(
            selectedPostImages.map((src, idx) => uploadPostImage(src, idx))
        );

        const okUrls = uploaded
            .filter((result) => result.status === 'fulfilled')
            .map((result) => result.value);

        const failed = uploaded.filter((result) => result.status === 'rejected');

        if (failed.length && !okUrls.length) {
            const corsLike = failed.some((result) => isStorageCorsError(result.reason));
            media = [];
            showToast(
                corsLike
                    ? 'Photos non envoyees. Sujet publie sans photo.'
                    : 'Photos non envoyees. Sujet publie sans photo.',
                'info'
            );
        } else if (failed.length && okUrls.length) {
            media = okUrls;
            showToast('Certaines photos ont echoue. Sujet publie avec les photos valides.', 'info');
        } else {
            media = okUrls;
        }
    }

    await db.collection('topics').add({
        author,
        title,
        content,
        category,
        media,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
}

async function publishSupabaseTopic(author, title, content, category, accessCode) {
    if (POST_CREATION_CODE && accessCode !== POST_CREATION_CODE) {
        throw new Error('Code incorrect: publication refusee');
    }

    const newTopic = normalizeTopic({
        id: `topic_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
        author,
        title,
        content,
        category,
        media: selectedPostImages.slice(),
        createdAt: new Date().toISOString()
    });

    const success = await saveSupabaseTopic(newTopic);
    if (!success) {
        throw new Error('Erreur lors de la publication. Veuillez reessayer.');
    }

    const topics = await getSupabaseTopics();
    renderTopics(topics);
}

async function publishLocalTopic(author, title, content, category, accessCode) {
    if (POST_CREATION_CODE && accessCode !== POST_CREATION_CODE) {
        throw new Error('Code incorrect: publication refusee');
    }

    const topics = getLocalTopics();
    topics.unshift(normalizeTopic({
        id: `topic_${Date.now()}`,
        author,
        title,
        content,
        category,
        media: selectedPostImages.slice(),
        createdAt: new Date().toISOString()
    }));
    saveLocalTopics(topics);
    renderTopics(topics);
}

function bindSubmit() {
    const form = document.getElementById('forumForm');
    if (!form) return;

    form.addEventListener('submit', async (event) => {
        event.preventDefault();

        const author = document.getElementById('authorName').value.trim();
        const accessCode = document.getElementById('postAccessCode').value.trim();
        const title = document.getElementById('topicTitle').value.trim();
        const content = document.getElementById('topicContent').value.trim();
        const category = document.getElementById('topicCategory').value;

        if (!author || !title || !content) {
            showToast('Merci de remplir tous les champs obligatoires', 'error');
            return;
        }

        const btn = form.querySelector('button[type="submit"]');
        const btnText = btn ? btn.querySelector('.btn-text') : null;
        const btnLoader = btn ? btn.querySelector('.btn-loader') : null;

        if (btn) btn.disabled = true;
        if (btnText) btnText.textContent = 'Publication...';
        if (btnLoader) btnLoader.style.display = 'inline-block';

        try {
            if (wantsServerMode) {
                await createServerTopic({
                    author,
                    title,
                    content,
                    category,
                    accessCode,
                    media: selectedPostImages.slice()
                });
                const topics = await fetchServerTopics();
                renderTopics(topics);
                updateStatus('Forum public en ligne', 'connected');
            } else if (supabaseReady) {
                await publishSupabaseTopic(author, title, content, category, accessCode);
                updateStatus('Forum en ligne', 'connected');
            } else if (firebaseReady) {
                await publishFirebaseTopic(author, title, content, category);
            } else {
                await publishLocalTopic(author, title, content, category, accessCode);
            }

            form.reset();
            selectedPostImages = [];
            renderPhotoPreview();
            toggleNewTopicForm();
            showToast('Sujet publie avec succes');
        } catch (error) {
            console.error(error);
            showToast(error.message || 'Erreur lors de la publication', 'error');
        } finally {
            if (btn) btn.disabled = false;
            if (btnText) btnText.textContent = 'Publier le sujet';
            if (btnLoader) btnLoader.style.display = 'none';
        }
    });
}

async function initForum() {
    bindFilters();
    initPostComposer();
    bindSubmit();
    renderPhotoPreview();

    if (wantsServerMode) {
        try {
            await initServerForum();
            return;
        } catch (error) {
            console.error('Forum public indisponible:', error);
            fallbackToLocalStorage('Serveur forum indisponible. Mode local actif.');
            return;
        }
    }

    if (wantsSupabaseMode) {
        updateStatus('Initialisation Supabase...', 'connected');
        let waitCount = 0;
        while (!supabaseReady && waitCount < 50) {
            await new Promise(resolve => setTimeout(resolve, 100));
            waitCount++;
        }
        if (supabaseReady) {
            await loadSupabaseTopics();
            setInterval(async () => {
                const topics = await getSupabaseTopics();
                renderTopics(topics);
            }, 30000);
            return;
        } else {
            fallbackToLocalStorage('Supabase indisponible. Mode local actif.');
            return;
        }
    }

    if (firebaseReady) {
        initFirebaseForum();
        return;
    }

    fallbackToLocalStorage('Mode local actif sur cet appareil.');
}

initForum();
window.toggleNewTopicForm = toggleNewTopicForm;
