// ===== Vive Les Vacances ! - Script principal (index.html) =====

function normalizeBrandingText(value) {
    return value
        .replace(/\\r?\\n/g, ' ')
        .replace(/Vive\s+les\s+Vacances\s*!+/gi, 'Vive Les Vacances !')
        .replace(/Vive\s+Les\s+Vacances(?:\s*!\s*){2,}/g, 'Vive Les Vacances !');
}

function sanitizeBranding(root = document.body) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const textNodes = [];

    while (walker.nextNode()) {
        textNodes.push(walker.currentNode);
    }

    textNodes.forEach((node) => {
        const nextValue = normalizeBrandingText(node.nodeValue || '');
        if (nextValue !== node.nodeValue) {
            node.nodeValue = nextValue;
        }
    });

    if (document.title) {
        document.title = normalizeBrandingText(document.title);
    }

    document.querySelectorAll('img[alt], meta[content]').forEach((element) => {
        if (element.hasAttribute('alt')) {
            element.setAttribute('alt', normalizeBrandingText(element.getAttribute('alt') || ''));
        }
        if (element.hasAttribute('content')) {
            element.setAttribute('content', normalizeBrandingText(element.getAttribute('content') || ''));
        }
    });
}

sanitizeBranding();

// Header scroll
const header = document.getElementById('header');
const scrollBtn = document.getElementById('scrollToTopBtn');

window.addEventListener('scroll', () => {
    header.classList.toggle('scrolled', window.scrollY > 60);
    scrollBtn.classList.toggle('visible', window.scrollY > 400);
}, { passive: true });

scrollBtn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
});

// Mobile menu
const hamburger = document.getElementById('hamburger');
const nav = document.getElementById('nav');

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

// Active nav on scroll
const sections = document.querySelectorAll('section[id]');
const navLinks = document.querySelectorAll('.nav-link');

window.addEventListener('scroll', () => {
    const y = window.scrollY + 120;
    sections.forEach(s => {
        const top = s.offsetTop;
        const id = s.getAttribute('id');
        if (y >= top && y < top + s.offsetHeight) {
            navLinks.forEach(l => l.classList.remove('active'));
            const a = document.querySelector('.nav-link[href="#' + id + '"]');
            if (a) a.classList.add('active');
        }
    });
}, { passive: true });

// Counter animation
function animateCounters() {
    document.querySelectorAll('.stat-number[data-target]').forEach(el => {
        const target = parseInt(el.dataset.target);
        const duration = 2000;
        const start = performance.now();
        function tick(now) {
            const p = Math.min((now - start) / duration, 1);
            const eased = 1 - Math.pow(1 - p, 3);
            el.textContent = Math.floor(target * eased);
            if (p < 1) requestAnimationFrame(tick);
            else el.textContent = target;
        }
        requestAnimationFrame(tick);
    });
}

// Intersection observer for animations
const observer = new IntersectionObserver((entries) => {
    entries.forEach(e => {
        if (e.isIntersecting) {
            e.target.classList.add('visible');
            observer.unobserve(e.target);
        }
    });
}, { threshold: 0.15 });

document.querySelectorAll('.fade-in, .stat-card, .footer-col, .testimonial-inner, .contact-form, .value-card, .centre-card').forEach(el => {
    if (!el.classList.contains('fade-in')) el.classList.add('fade-in');
    observer.observe(el);
});

// Fallback: keep sections visible even if an observer callback fails.
setTimeout(() => {
    document.querySelectorAll('.fade-in').forEach((el) => el.classList.add('visible'));
}, 1200);

// Counter trigger
let countersDone = false;
const statsSection = document.querySelector('.section-stats');
if (statsSection) {
    new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && !countersDone) {
            countersDone = true;
            animateCounters();
        }
    }, { threshold: 0.3 }).observe(statsSection);
}

// Contact form
const contactForm = document.getElementById('contactForm');
if (contactForm) {
    contactForm.addEventListener('submit', (e) => {
        e.preventDefault();
        alert('Merci pour votre message ! Nous vous répondrons rapidement.');
        contactForm.reset();
    });
}




