// ===== Vive Les Vacances ! - Forum (Firebase Firestore) =====

const forumConfig = window.VLV_FORUM_CONFIG || {};
const forumMode = (forumConfig.mode || 'local').toLowerCase();
const wantsFirebaseMode = forumMode === 'firebase';
const allowStorageUploads = wantsFirebaseMode && forumConfig.storageUploads === true;

const firebaseConfig = forumConfig.firebase || {
    apiKey: 'REMPLACE_PAR_TA_CLE_API',
    authDomain: 'REMPLACE.firebaseapp.com',
    projectId: 'REMPLACE_PAR_TON_PROJECT_ID',
    storageBucket: 'REMPLACE.appspot.com',
    messagingSenderId: '123456789',
    appId: '1:123456789:web:abcdef'
};

const POST_CREATION_CODE = (forumConfig.postCreationCode || '').trim();

let db = null;
let firebaseReady = false;
let storage = null;
let storageReady = false;

try {
    const hasRealFirebaseConfig =
        firebaseConfig.apiKey && !firebaseConfig.apiKey.includes('REMPLACE') &&
        firebaseConfig.projectId && !firebaseConfig.projectId.includes('REMPLACE') &&
        firebaseConfig.authDomain && !firebaseConfig.authDomain.includes('REMPLACE') &&
        firebaseConfig.appId && !firebaseConfig.appId.includes('REMPLACE');

    if (wantsFirebaseMode && hasRealFirebaseConfig) {
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
    } else if (wantsFirebaseMode && !hasRealFirebaseConfig) {
        console.warn('Mode firebase demande mais config incomplete: mode local active.');
    } else {
        console.warn('Forum en mode local (sans API).');
    }
} catch (e) {
    console.warn('Firebase non configure — mode local:', e.message);
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

const categoryLabels = {
    general: 'Discussion',
    vacances: 'Vacances',
    conseils: 'Conseils',
    entraide: 'Entraide'
};

const MAX_POST_PHOTOS = 20;
let selectedPostImages = [];
let currentFilter = 'all';

function formatDate(timestamp) {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const diff = Date.now() - date;
    if (diff < 60000) return "A l'instant";
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

function isStorageCorsError(err) {
    const msg = (err && (err.message || err.code || '')).toString().toLowerCase();
    return msg.includes('cors') || msg.includes('failed to fetch') || msg.includes('network-request-failed');
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
                resolve(canvas.toDataURL('image/jpeg', 0.76));
            };
            img.onerror = reject;
            img.src = reader.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function renderTopic(topic, id) {
    const media = Array.isArray(topic.media) ? topic.media : [];
    const mediaHtml = media.length
        ? `<div class="forum-topic-media">${media.map((src, i) => `<img src="${src}" alt="Photo du post ${i + 1}">`).join('')}</div>`
        : '';

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

function applyFilter() {
    const topics = document.querySelectorAll('.forum-topic');
    let count = 0;

    topics.forEach((t) => {
        const show = currentFilter === 'all' || t.dataset.category === currentFilter;
        t.style.display = show ? '' : 'none';
        if (show) count += 1;
    });

    const countEl = document.getElementById('forumCount');
    if (countEl) countEl.textContent = `${count} sujet${count > 1 ? 's' : ''}`;
}

function getLocalTopics() {
    try {
        return JSON.parse(localStorage.getItem('vlv_topics') || '[]');
    } catch {
        return [];
    }
}

function saveLocalTopics(topics) {
    localStorage.setItem('vlv_topics', JSON.stringify(topics));
}

function loadLocalTopics() {
    let topics = getLocalTopics();
    if (topics.length === 0) {
        topics = [
            { id: 'demo1', author: 'Sophie', title: 'Premier sejour a la mer !', content: 'Mon fils a vu la mer pour la premiere fois grace a VLV. Il etait tellement heureux !', category: 'vacances', createdAt: new Date(Date.now() - 86400000).toISOString(), media: [] },
            { id: 'demo2', author: 'Fatima', title: 'Conseils pour preparer les valises', content: "C'est notre premier depart. Qu'est-ce que vous conseillez de mettre dans les valises ?", category: 'conseils', createdAt: new Date(Date.now() - 172800000).toISOString(), media: [] }
        ];
        saveLocalTopics(topics);
    }

    const topicsEl = document.getElementById('forumTopics');
    if (!topicsEl) return;
    topicsEl.innerHTML = topics.map((t) => renderTopic(t, t.id)).join('');
    applyFilter();
}

function fallbackToLocalStorage() {
    const statusEl = document.getElementById('forumStatus');
    if (statusEl) {
        statusEl.innerHTML = '<div class="forum-status-dot error"></div><span>Mode local (sans API)</span>';
    }
    loadLocalTopics();
}

function initFirebaseForum() {
    const statusEl = document.getElementById('forumStatus');
    const topicsEl = document.getElementById('forumTopics');
    if (!statusEl || !topicsEl || !db) return;

    db.collection('topics').orderBy('createdAt', 'desc').onSnapshot(
        (snapshot) => {
            statusEl.innerHTML = '<div class="forum-status-dot connected"></div><span>Forum connecte en temps reel</span>';
            if (snapshot.empty) {
                topicsEl.innerHTML = '<div class="forum-empty"><div class="forum-empty-icon">...</div><p>Aucun sujet pour le moment.</p></div>';
                const countEl = document.getElementById('forumCount');
                if (countEl) countEl.textContent = '0 sujet';
                return;
            }

            let html = '';
            snapshot.forEach((doc) => {
                html += renderTopic(doc.data(), doc.id);
            });
            topicsEl.innerHTML = html;
            applyFilter();
        },
        (error) => {
            console.error('Erreur Firestore:', error);
            statusEl.innerHTML = '<div class="forum-status-dot error"></div><span>Erreur Firebase, bascule locale</span>';
            fallbackToLocalStorage();
        }
    );
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

        emojiPanel.addEventListener('click', (e) => {
            const btn = e.target.closest('.emoji-btn');
            if (!btn) return;
            content.value += btn.dataset.emoji || '';
            content.focus();
        });
    }

    if (photosInput) {
        photosInput.addEventListener('change', async (e) => {
            const files = Array.from(e.target.files || []).filter((f) => f.type.startsWith('image/'));
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
        preview.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-remove-index]');
            if (!btn) return;
            const index = parseInt(btn.dataset.removeIndex, 10);
            if (Number.isNaN(index)) return;
            selectedPostImages.splice(index, 1);
            renderPhotoPreview();
        });
    }
}

function toggleNewTopicForm() {
    const form = document.getElementById('forumForm');
    const btn = document.getElementById('toggleFormBtn');
    if (form) form.classList.toggle('open');
    if (btn) btn.classList.toggle('open');
}

function initFilters() {
    document.querySelectorAll('.filter-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn').forEach((b) => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.dataset.filter;
            applyFilter();
        });
    });
}

function initSubmit() {
    const form = document.getElementById('forumForm');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const author = document.getElementById('authorName').value.trim();
        const accessCode = document.getElementById('postAccessCode').value.trim();
        const title = document.getElementById('topicTitle').value.trim();
        const content = document.getElementById('topicContent').value.trim();
        const category = document.getElementById('topicCategory').value;

        if (!author || !title || !content) return;

        if (!POST_CREATION_CODE || POST_CREATION_CODE === 'CHANGE_ME') {
            showToast('Code de publication non configure.', 'error');
            return;
        }

        if (accessCode !== POST_CREATION_CODE) {
            showToast('Code incorrect: publication refusee', 'error');
            return;
        }

        const btn = form.querySelector('button[type="submit"]');
        const btnText = btn ? btn.querySelector('.btn-text') : null;
        const btnLoader = btn ? btn.querySelector('.btn-loader') : null;

        if (btn) btn.disabled = true;
        if (btnText) btnText.textContent = 'Publication...';
        if (btnLoader) btnLoader.style.display = 'inline-block';

        try {
            if (firebaseReady) {
                let media = selectedPostImages.slice();

                if (selectedPostImages.length && storageReady) {
                    const uploaded = await Promise.allSettled(
                        selectedPostImages.map((src, idx) => uploadPostImage(src, idx))
                    );

                    const okUrls = uploaded.filter((r) => r.status === 'fulfilled').map((r) => r.value);
                    const failed = uploaded.filter((r) => r.status === 'rejected');

                    if (failed.length && !okUrls.length) {
                        const corsLike = failed.some((r) => isStorageCorsError(r.reason));
                        media = [];
                        showToast(
                            corsLike
                                ? 'Photos non envoyees (CORS/regles). Sujet publie sans photo.'
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
            } else {
                const topics = getLocalTopics();
                topics.unshift({
                    id: `topic_${Date.now()}`,
                    author,
                    title,
                    content,
                    category,
                    media: selectedPostImages.slice(),
                    createdAt: new Date().toISOString()
                });
                saveLocalTopics(topics);
                loadLocalTopics();
            }

            form.reset();
            selectedPostImages = [];
            renderPhotoPreview();
            toggleNewTopicForm();
            showToast('Sujet publie avec succes !');
        } catch (err) {
            console.error(err);
            showToast('Erreur lors de la publication', 'error');
        } finally {
            if (btn) btn.disabled = false;
            if (btnText) btnText.textContent = 'Publier le sujet';
            if (btnLoader) btnLoader.style.display = 'none';
        }
    });
}

initPostComposer();
initFilters();
initSubmit();

if (firebaseReady) {
    initFirebaseForum();
} else {
    fallbackToLocalStorage();
}

window.toggleNewTopicForm = toggleNewTopicForm;
