/**
 * components-loader.js
 * Dynamically loads and injects header and footer components.
 * Handles active navigation state and mobile toggle initialization.
 */

async function loadComponent(id, url) {
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Failed to load ${url}`);
        const html = await response.text();
        document.getElementById(id).innerHTML = html;
        return true;
    } catch (error) {
        console.error('Component loading error:', error);
        return false;
    }
}

function setActiveNavLink() {
    const currentPath = window.location.pathname;
    const navLinks = document.querySelectorAll('.nav-link');

    navLinks.forEach(link => {
        const linkPath = new URL(link.href, window.location.origin).pathname;

        // Match home or directory-based routing
        if (currentPath === linkPath || (linkPath !== '/' && currentPath.startsWith(linkPath))) {
            link.classList.add('active');
            link.setAttribute('aria-current', 'page');
        } else {
            link.classList.remove('active');
            link.removeAttribute('aria-current');
        }
    });
}

function initMobileNav() {
    const toggle = document.getElementById('nav-toggle');
    const nav = document.getElementById('main-nav');
    if (!toggle || !nav) return;

    toggle.addEventListener('click', (e) => {
        e.stopPropagation();
        const open = nav.classList.toggle('open');
        toggle.classList.toggle('open', open);
        toggle.setAttribute('aria-expanded', String(open));
    });

    // Close on outside click
    document.addEventListener('click', (e) => {
        if (!toggle.contains(e.target) && !nav.contains(e.target)) {
            nav.classList.remove('open');
            toggle.classList.remove('open');
            toggle.setAttribute('aria-expanded', 'false');
        }
    });
}

async function init() {
    // Load header and footer in parallel
    const headerLoaded = loadComponent('header', '/components/header.html');
    const footerLoaded = loadComponent('footer', '/components/footer.html');

    await Promise.all([headerLoaded, footerLoaded]);

    // Initialize UI logic that depends on injected content
    setActiveNavLink();
    initMobileNav();
}

// Run on DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
