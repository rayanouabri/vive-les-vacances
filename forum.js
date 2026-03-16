// ===== Vive Les Vacances ! ! - Forum (Firebase Firestore) =====

const forumConfig = window.VLV_FORUM_CONFIG || {};
const firebaseConfig = forumConfig.firebase || {
    apiKey: "REMPLACE_PAR_TA_CLE_API",
    authDomain: "REMPLACE.firebaseapp.com",
    projectId: "REMPLACE_PAR_TON_PROJECT_ID",
    storageBucket: "REMPLACE.appspot.com",
    messagingSenderId: "123456789",
    appId: "1:123456789:web:abcdef"
};

// Code requis uniquement pour publier un sujet.
const POST_CREATION_CODE = (forumConfig.postCreationCode || "").trim();

let db = null;
let firebaseReady = false;
let storage = null;
let storageReady = false;

try {
    const hasRealFirebaseConfig =
        firebaseConfig.apiKey && !firebaseConfig.apiKey.includes('REMPLACE') &&
        firebaseConfig.projectId && !firebaseConfig.projectId.includes('REMPLACE');

    if (hasRealFirebaseConfig) {
        firebase.initializeApp(firebaseConfig);
        db = firebase.firestore();
        firebaseReady = true;
        try {
            storage = firebase.storage();
            storageReady = true;
        } catch (storageError) {
            console.warn('Firebase Storage non configure:', storageError.message);
        }
    } else {
        console.warn('Firebase non configure: forum en mode local.');
    }
} catch (e) {
    console.warn("Firebase non configuré — mode démo:", e.message);
}

// ===== Toast =====
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

// ===== Header / Mobile menu =====
const header = document.getElementById('header');
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
    nav.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', () => {
            hamburger.classList.remove('active');
            nav.classList.remove('open');
            document.body.style.overflow = '';
        });
    });
}

// ===== Forum helpers =====
const categoryLabels = {
    general: '💬 Discussion',
    vacances: '🏕️ Vacances',
    conseils: '💡 Conseils',
    entraide: '🤝 Entraide'
};

const MAX_POST_PHOTOS = 20;
let selectedPostImages = [];

function formatDate(timestamp) {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const diff = Date.now() - date;
    if (diff < 60000) return "À l'instant";
    if (diff < 3600000) return `il y a ${Math.floor(diff / 60000)} min`;
    if (diff < 86400000) return `il y a ${Math.floor(diff / 3600000)}h`;
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

function sanitize(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function formatPostContent(str) {
    return sanitize(str).replace(/\n/g, '<br>');
}

async function uploadPostImage(dataUrl, index) {
    if (!storageReady || !storage) return dataUrl;

    const path = `forum-posts/${Date.now()}-${Math.random().toString(36).slice(2)}-${index}.jpg`;
    const ref = storage.ref().child(path);
    const snap = await ref.putString(dataUrl, 'data_url');
    return snap.ref.getDownloadURL();
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
            <img src="${src}" alt="Photo a publier ${index + 1}">
            <button type="button" class="remove-photo-btn" data-remove-index="${index}" aria-label="Supprimer la photo">×</button>
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
                let w = img.width;
                let h = img.height;
                const ratio = Math.min(maxW / w, maxH / h, 1);
                w = Math.round(w * ratio);
                h = Math.round(h * ratio);

                const canvas = document.createElement('canvas');
                canvas.width = w;
                canvas.height = h;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, w, h);

                const out = canvas.toDataURL('image/jpeg', 0.76);
                resolve(out);
            };
            img.onerror = reject;
            img.src = reader.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function initPostComposer() {
    const emojiToggle = document.getElementById('emojiToggle');
    const emojiPanel = document.getElementById('emojiPanel');
    const content = document.getElementById('topicContent');
    const photosInput = document.getElementById('topicPhotos');
    const preview = document.getElementById('photoPreview');

    if (!emojiToggle || !emojiPanel || !content || !photosInput || !preview) return;

    emojiToggle.addEventListener('click', () => {
        emojiPanel.hidden = !emojiPanel.hidden;
    });

    emojiPanel.addEventListener('click', (e) => {
        const btn = e.target.closest('.emoji-btn');
        if (!btn) return;
        content.value += btn.dataset.emoji || '';
        content.focus();
    });

    photosInput.addEventListener('change', async (e) => {
        const files = Array.from(e.target.files || []).filter(f => f.type.startsWith('image/'));
        if (!files.length) return;

        const remaining = MAX_POST_PHOTOS - selectedPostImages.length;
        if (remaining <= 0) {
            showToast(`Maximum ${MAX_POST_PHOTOS} photos par post`, 'info');
            photosInput.value = '';
            return;
        }

        const toProcess = files.slice(0, remaining);
        try {
            const compressed = await Promise.all(toProcess.map(compressImage));
            selectedPostImages = selectedPostImages.concat(compressed);
            renderPhotoPreview();
            if (files.length > remaining) showToast(`Seules ${MAX_POST_PHOTOS} photos sont autorisees`, 'info');
        } catch {
            showToast('Impossible de traiter une photo', 'error');
        }
        photosInput.value = '';
    });

    preview.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-remove-index]');
        if (!btn) return;
        const index = parseInt(btn.dataset.removeIndex, 10);
        if (Number.isNaN(index)) return;
        selectedPostImages.splice(index, 1);
        renderPhotoPreview();
    });
}

// ===== Render topic =====
function renderTopic(topic, id) {
    const media = Array.isArray(topic.media) ? topic.media : [];
    const mediaHtml = media.length ? `
        <div class="forum-topic-media">
            ${media.map((src, i) => `<img src="${src}" alt="Photo du post ${i + 1}">`).join('')}
        </div>
    ` : '';

    return `
        <div class="forum-topic" data-category="${topic.category}" data-id="${id}">
            <div class="forum-topic-header">
                <span class="forum-topic-title">${sanitize(topic.title)}</span>
                <span class="forum-topic-badge badge-${topic.category}">${categoryLabels[topic.category] || topic.category}</span>
            </div>
            <div class="forum-topic-meta">Par <strong>${sanitize(topic.author)}</strong> — ${formatDate(topic.createdAt)}</div>
            <div class="forum-topic-content">${formatPostContent(topic.content)}</div>
            ${mediaHtml}
        </div>
    `;
}

// ===== Toggle form =====
function toggleNewTopicForm() {
    const form = document.getElementById('forumForm');
    const btn = document.getElementById('toggleFormBtn');
    form.classList.toggle('open');
    btn.classList.toggle('open');
}

// ===== Filters =====
let currentFilter = 'all';

document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentFilter = btn.dataset.filter;
        applyFilter();
    });
});

function applyFilter() {
    const topics = document.querySelectorAll('.forum-topic');
    let count = 0;
    topics.forEach(t => {
        const show = currentFilter === 'all' || t.dataset.category === currentFilter;
        t.style.display = show ? '' : 'none';
        if (show) count++;
    });
    document.getElementById('forumCount').textContent = `${count} sujet${count > 1 ? 's' : ''}`;
}

// ===== Firebase mode =====
function initFirebaseForum() {
    const statusEl = document.getElementById('forumStatus');
    const topicsEl = document.getElementById('forumTopics');

    db.collection('topics').orderBy('createdAt', 'desc').onSnapshot(
        (snapshot) => {
            statusEl.innerHTML = '<div class="forum-status-dot connected"></div><span>Forum connecté en temps réel</span>';
            if (snapshot.empty) {
                topicsEl.innerHTML = '<div class="forum-empty"><div class="forum-empty-icon">💬</div><p>Aucun sujet pour le moment. Soyez le premier à publier !</p></div>';
                document.getElementById('forumCount').textContent = '0 sujets';
                return;
            }
            let html = '';
            snapshot.forEach(doc => { html += renderTopic(doc.data(), doc.id); });
            topicsEl.innerHTML = html;
            applyFilter();
        },
        (error) => {
            console.error('Erreur Firestore:', error);
            statusEl.innerHTML = '<div class="forum-status-dot error"></div><span>Erreur — mode hors-ligne</span>';
            fallbackToLocalStorage();
        }
    );
}

// ===== LocalStorage fallback =====
function fallbackToLocalStorage() {
    document.getElementById('forumStatus').innerHTML = '<div class="forum-status-dot error"></div><span>Mode démo (données locales uniquement)</span>';
    loadLocalTopics();
}

function getLocalTopics() {
    try { return JSON.parse(localStorage.getItem('vlv_topics') || '[]'); }
    catch { return []; }
}

function saveLocalTopics(topics) {
    localStorage.setItem('vlv_topics', JSON.stringify(topics));
}

function loadLocalTopics() {
    let topics = getLocalTopics();
    if (topics.length === 0) {
        topics = [
            { id: 'demo1', author: 'Sophie', title: 'Premier séjour à la mer !', content: 'Mon fils de 7 ans a vu la mer pour la première fois grâce à VLV. Il était tellement heureux ! 😍', category: 'vacances', createdAt: new Date(Date.now() - 86400000).toISOString(), media: [] },
            { id: 'demo2', author: 'Fatima', title: 'Conseils pour préparer les valises', content: "C'est notre premier départ. Qu'est-ce que vous conseillez de mettre dans les valises ?", category: 'conseils', createdAt: new Date(Date.now() - 172800000).toISOString(), media: [] },
            { id: 'demo3', author: 'Karim', title: 'Merci à toute l\'équipe !', content: 'Un grand merci aux bénévoles. Mes 3 enfants ont des souvenirs incroyables. 👏', category: 'general', createdAt: new Date(Date.now() - 259200000).toISOString(), media: [] }
        ];
        saveLocalTopics(topics);
    }
    const topicsEl = document.getElementById('forumTopics');
    topicsEl.innerHTML = topics.map(t => renderTopic(t, t.id)).join('');
    applyFilter();
}

// ===== Add topic =====
document.getElementById('forumForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const author = document.getElementById('authorName').value.trim();
    const accessCode = document.getElementById('postAccessCode').value.trim();
    const title = document.getElementById('topicTitle').value.trim();
    const content = document.getElementById('topicContent').value.trim();
    const category = document.getElementById('topicCategory').value;
    if (!author || !title || !content) return;

    if (!POST_CREATION_CODE || POST_CREATION_CODE === 'CHANGE_ME') {
        showToast('Code de publication non configure. Modifie forum-config.js', 'error');
        return;
    }

    if (accessCode !== POST_CREATION_CODE) {
        showToast('Code incorrect: publication refusee', 'error');
        return;
    }

    const btn = e.target.querySelector('button[type="submit"]');
    const btnText = btn.querySelector('.btn-text');
    const btnLoader = btn.querySelector('.btn-loader');
    btn.disabled = true;
    if (btnText) btnText.textContent = 'Publication...';
    if (btnLoader) btnLoader.style.display = 'inline-block';

    try {
        if (firebaseReady) {
            let media = selectedPostImages;
            if (selectedPostImages.length && storageReady) {
                media = await Promise.all(selectedPostImages.map((src, idx) => uploadPostImage(src, idx)));
            }

            await db.collection('topics').add({
                author,
                title,
                content,
                category,
                media,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        } else {
            const topics = getLocalTopics();
            topics.unshift({ id: 'topic_' + Date.now(), author, title, content, category, media: selectedPostImages, createdAt: new Date().toISOString() });
            saveLocalTopics(topics);
            loadLocalTopics();
        }
        e.target.reset();
        selectedPostImages = [];
        renderPhotoPreview();
        toggleNewTopicForm();
        showToast('Sujet publié avec succès !');
    } catch (err) {
        console.error(err);
        showToast('Erreur lors de la publication', 'error');
    }

    btn.disabled = false;
    if (btnText) btnText.textContent = 'Publier le sujet';
    if (btnLoader) btnLoader.style.display = 'none';
});

// ===== Init =====
initPostComposer();
if (firebaseReady) { initFirebaseForum(); }
else { fallbackToLocalStorage(); }

// ===== Expose globals =====
window.toggleNewTopicForm = toggleNewTopicForm;
