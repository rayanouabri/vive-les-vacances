// ===== Vive Les Vacances - Forum (Firebase Firestore) =====

// Firebase config — REMPLACE par tes vraies valeurs
const firebaseConfig = {
    apiKey: "REMPLACE_PAR_TA_CLE_API",
    authDomain: "REMPLACE.firebaseapp.com",
    projectId: "REMPLACE_PAR_TON_PROJECT_ID",
    storageBucket: "REMPLACE.appspot.com",
    messagingSenderId: "123456789",
    appId: "1:123456789:web:abcdef"
};

let db = null;
let firebaseReady = false;

try {
    firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
    firebaseReady = true;
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

// ===== Render topic =====
function renderTopic(topic, id) {
    const replies = topic.replies || [];
    const repliesHtml = replies.map(r => `
        <div class="forum-reply">
            <div class="forum-reply-meta"><strong>${sanitize(r.author)}</strong> — ${formatDate(r.date)}</div>
            <p>${sanitize(r.content)}</p>
        </div>
    `).join('');

    return `
        <div class="forum-topic" data-category="${topic.category}" data-id="${id}">
            <div class="forum-topic-header">
                <span class="forum-topic-title">${sanitize(topic.title)}</span>
                <span class="forum-topic-badge badge-${topic.category}">${categoryLabels[topic.category] || topic.category}</span>
            </div>
            <div class="forum-topic-meta">Par <strong>${sanitize(topic.author)}</strong> — ${formatDate(topic.createdAt)}</div>
            <div class="forum-topic-content">${sanitize(topic.content)}</div>
            ${replies.length > 0 ? `
                <button class="forum-toggle-replies" onclick="toggleReplies('${id}')">
                    💬 ${replies.length} réponse${replies.length > 1 ? 's' : ''}
                </button>
                <div class="forum-replies" id="replies-${id}" style="display:none;">
                    ${repliesHtml}
                </div>
            ` : ''}
            <div class="reply-form">
                <input type="text" placeholder="Prénom" maxlength="50" id="replyAuthor-${id}">
                <textarea placeholder="Votre réponse..." maxlength="1000" id="replyContent-${id}"></textarea>
                <button onclick="addReply('${id}')">Répondre</button>
            </div>
        </div>
    `;
}

function toggleReplies(id) {
    const el = document.getElementById(`replies-${id}`);
    if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
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
            { id: 'demo1', author: 'Sophie', title: 'Premier séjour à la mer !', content: 'Mon fils de 7 ans a vu la mer pour la première fois grâce à VLV. Il était tellement heureux !', category: 'vacances', createdAt: new Date(Date.now() - 86400000).toISOString(), replies: [] },
            { id: 'demo2', author: 'Fatima', title: 'Conseils pour préparer les valises', content: "C'est notre premier départ. Qu'est-ce que vous conseillez de mettre dans les valises ?", category: 'conseils', createdAt: new Date(Date.now() - 172800000).toISOString(), replies: [{ author: 'Marie', content: 'Pense à la crème solaire et aux chapeaux !', date: new Date(Date.now() - 100000000).toISOString() }] },
            { id: 'demo3', author: 'Karim', title: 'Merci à toute l\'équipe !', content: 'Un grand merci aux bénévoles. Mes 3 enfants ont des souvenirs incroyables.', category: 'general', createdAt: new Date(Date.now() - 259200000).toISOString(), replies: [] }
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
    const title = document.getElementById('topicTitle').value.trim();
    const content = document.getElementById('topicContent').value.trim();
    const category = document.getElementById('topicCategory').value;
    if (!author || !title || !content) return;

    const btn = e.target.querySelector('button[type="submit"]');
    const btnText = btn.querySelector('.btn-text');
    const btnLoader = btn.querySelector('.btn-loader');
    btn.disabled = true;
    if (btnText) btnText.textContent = 'Publication...';
    if (btnLoader) btnLoader.style.display = 'inline-block';

    try {
        if (firebaseReady) {
            await db.collection('topics').add({
                author, title, content, category,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                replies: []
            });
        } else {
            const topics = getLocalTopics();
            topics.unshift({ id: 'topic_' + Date.now(), author, title, content, category, createdAt: new Date().toISOString(), replies: [] });
            saveLocalTopics(topics);
            loadLocalTopics();
        }
        e.target.reset();
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

// ===== Add reply =====
async function addReply(topicId) {
    const authorInput = document.getElementById(`replyAuthor-${topicId}`);
    const contentInput = document.getElementById(`replyContent-${topicId}`);
    const author = authorInput.value.trim();
    const content = contentInput.value.trim();
    if (!author || !content) { showToast('Remplis ton prénom et ta réponse', 'info'); return; }

    const reply = { author, content, date: new Date().toISOString() };

    try {
        if (firebaseReady) {
            await db.collection('topics').doc(topicId).update({
                replies: firebase.firestore.FieldValue.arrayUnion(reply)
            });
        } else {
            const topics = getLocalTopics();
            const topic = topics.find(t => t.id === topicId);
            if (topic) { topic.replies.push(reply); saveLocalTopics(topics); loadLocalTopics(); }
        }
        authorInput.value = '';
        contentInput.value = '';
        showToast('Réponse ajoutée !');
        const repliesEl = document.getElementById(`replies-${topicId}`);
        if (repliesEl) repliesEl.style.display = 'block';
    } catch (err) {
        console.error(err);
        showToast("Erreur lors de l'envoi", 'error');
    }
}

// ===== Init =====
if (firebaseReady) { initFirebaseForum(); }
else { fallbackToLocalStorage(); }

// ===== Expose globals =====
window.toggleNewTopicForm = toggleNewTopicForm;
window.toggleReplies = toggleReplies;
window.addReply = addReply;
