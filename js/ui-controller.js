/**
 * ui-controller.js
 * DOM orchestrator for PasswordScan tool.
 * Handles: real-time input, strength meter, score grid,
 *          suggestions, visibility toggle, clipboard copy.
 * @module uiController
 */

import { analyzePassword } from './strength-engine.js';

// ── DOM REFERENCES ──────────────────────────────────────────────────────────
const passwordInput = document.getElementById('password-input');
const toggleVisBtn = document.getElementById('toggle-visibility');
const copyBtn = document.getElementById('copy-btn');
const meterFill = document.getElementById('meter-fill');
const strengthLabel = document.getElementById('strength-label');
const scoreBadge = document.getElementById('score-badge');
const cardLength = document.getElementById('card-length');
const cardVariety = document.getElementById('card-variety');
const cardEntropy = document.getElementById('card-entropy');
const cardCrackTime = document.getElementById('card-crack-time');
const suggestionsPanel = document.getElementById('suggestions-panel');
const suggestionsList = document.getElementById('suggestions-list');
const statusAnnounce = document.getElementById('strength-announce');

// ── STATE ───────────────────────────────────────────────────────────────────
let debounceTimer = null;
let isVisible = false;
let currentPassword = '';

// ── STRENGTH CLASS MAP ──────────────────────────────────────────────────────
const STRENGTH_CLASS = {
    'Weak': 'weak',
    'Moderate': 'moderate',
    'Strong': 'strong',
    'Very Strong': 'very-strong',
};

// ── FACTOR ICONS ────────────────────────────────────────────────────────────
const FACTOR_IDS = [
    { id: 'factor-length', label: 'Length ≥ 12 chars', check: (pw, f) => pw.length >= 12 },
    { id: 'factor-upper', label: 'Uppercase letters', check: (pw, f) => f.hasUpper },
    { id: 'factor-lower', label: 'Lowercase letters', check: (pw, f) => f.hasLower },
    { id: 'factor-numbers', label: 'Numbers', check: (pw, f) => f.hasDigit },
    { id: 'factor-symbols', label: 'Special characters', check: (pw, f) => f.hasSymbol },
    { id: 'factor-common', label: 'Not a common password', check: (pw, f) => !f.isCommon },
    { id: 'factor-sequence', label: 'No sequential patterns', check: (pw, f) => !f.sequential },
    { id: 'factor-keyboard', label: 'No keyboard patterns', check: (pw, f) => !f.keyboard },
];

// ── UPDATE UI ───────────────────────────────────────────────────────────────
function updateUI(result, password) {
    const cls = result.label ? STRENGTH_CLASS[result.label] : '';

    // Strength bar
    meterFill.style.width = `${result.score}%`;
    meterFill.className = `meter-fill${cls ? ` ${cls}` : ''}`;

    // Label
    strengthLabel.textContent = result.label || 'Enter a password';
    strengthLabel.className = `strength-label-text${cls ? ` ${cls}` : ''}`;

    // Score badge
    scoreBadge.textContent = password ? `${result.score}/100` : '—';
    scoreBadge.className = `score-badge${cls ? ` ${cls}` : ''}`;

    // Score grid cards
    if (password) {
        const varieties = [result.factors.hasUpper, result.factors.hasLower,
        result.factors.hasDigit, result.factors.hasSymbol]
            .filter(Boolean).length;

        cardLength.textContent = `${password.length} chars`;
        cardVariety.textContent = `${varieties}/4 types`;
        cardEntropy.textContent = `${result.entropy} bits`;
        cardCrackTime.textContent = result.crackTime;
    } else {
        cardLength.textContent = '—';
        cardVariety.textContent = '—';
        cardEntropy.textContent = '—';
        cardCrackTime.textContent = '—';
    }

    // Suggestions panel
    if (result.suggestions && result.suggestions.length > 0) {
        suggestionsPanel.classList.add('visible');
        suggestionsList.innerHTML = result.suggestions
            .map(s => `<li class="suggestion-item">${escapeHtml(s)}</li>`)
            .join('');
    } else {
        suggestionsPanel.classList.remove('visible');
        suggestionsList.innerHTML = '';
    }

    // Factor checklist
    if (password && result.factors) {
        updateFactors(password, result.factors);
    } else {
        resetFactors();
    }

    // ARIA live region
    if (password && result.label) {
        statusAnnounce.textContent = `Password strength: ${result.label}. Score: ${result.score} out of 100. Estimated crack time: ${result.crackTime}.`;
    } else {
        statusAnnounce.textContent = '';
    }
}

// ── FACTOR CHECKLIST ────────────────────────────────────────────────────────
function updateFactors(password, factors) {
    for (const { id, check } of FACTOR_IDS) {
        const el = document.getElementById(id);
        if (!el) continue;
        const indicator = el.querySelector('.factor-indicator');
        const status = el.querySelector('.factor-status');
        const passes = check(password, factors);

        if (indicator) {
            indicator.className = `factor-indicator ${passes ? 'pass' : 'fail'}`;
        }
        if (status) {
            status.textContent = passes ? '✓' : '✗';
            status.className = `factor-status ${passes ? 'pass' : 'fail'}`;
        }
    }
}

function resetFactors() {
    for (const { id } of FACTOR_IDS) {
        const el = document.getElementById(id);
        if (!el) continue;
        const indicator = el.querySelector('.factor-indicator');
        const status = el.querySelector('.factor-status');
        if (indicator) indicator.className = 'factor-indicator';
        if (status) { status.textContent = ''; status.className = 'factor-status'; }
    }
}

// ── ESCAPE HTML ──────────────────────────────────────────────────────────────
function escapeHtml(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// ── INPUT HANDLER (debounced) ───────────────────────────────────────────────
function handleInput() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
        currentPassword = passwordInput.value;
        const result = analyzePassword(currentPassword);
        updateUI(result, currentPassword);
    }, 80);
}

// ── VISIBILITY TOGGLE ───────────────────────────────────────────────────────
function handleToggleVisibility() {
    isVisible = !isVisible;
    passwordInput.type = isVisible ? 'text' : 'password';
    toggleVisBtn.setAttribute('aria-label', isVisible ? 'Hide password' : 'Show password');
    toggleVisBtn.innerHTML = isVisible ? getEyeOffIcon() : getEyeIcon();
}

// ── COPY TO CLIPBOARD ───────────────────────────────────────────────────────
async function handleCopy() {
    if (!currentPassword) return;
    try {
        await navigator.clipboard.writeText(currentPassword);
        showToast('✓ Copied to clipboard!');
    } catch {
        // Fallback for older browsers
        const ta = document.createElement('textarea');
        ta.value = currentPassword;
        ta.style.cssText = 'position:fixed;left:-9999px;top:-9999px';
        document.body.appendChild(ta);
        ta.focus(); ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        showToast('✓ Copied to clipboard!');
    }
}

// ── TOAST ───────────────────────────────────────────────────────────────────
let toastTimer = null;
function showToast(message) {
    let toast = document.getElementById('toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'toast';
        toast.className = 'toast';
        toast.setAttribute('role', 'status');
        toast.setAttribute('aria-live', 'polite');
        document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 2500);
}

// ── FAQ ACCORDION ───────────────────────────────────────────────────────────
function initFAQ() {
    const questions = document.querySelectorAll('.faq-question');
    questions.forEach(btn => {
        btn.addEventListener('click', () => {
            const item = btn.closest('.faq-item');
            const isOpen = item.classList.contains('open');
            // Close all first
            document.querySelectorAll('.faq-item.open').forEach(el => el.classList.remove('open'));
            // Toggle clicked
            if (!isOpen) item.classList.add('open');
        });
    });
}

// ── HEADER SCROLL ───────────────────────────────────────────────────────────
function initHeaderScroll() {
    const header = document.getElementById('site-header');
    if (!header) return;

    const handleScroll = () => {
        if (window.scrollY > 20) {
            header.classList.add('header-scrolled');
        } else {
            header.classList.remove('header-scrolled');
        }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // Initial check
}

// ── MOBILE NAV ──────────────────────────────────────────────────────────────
function initMobileNav() {
    const toggle = document.getElementById('nav-toggle');
    const nav = document.getElementById('main-nav');
    if (!toggle || !nav) return;
    toggle.addEventListener('click', () => {
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

// ── SVG ICONS ───────────────────────────────────────────────────────────────
function getEyeIcon() {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
}

function getEyeOffIcon() {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;
}

// ── INIT ─────────────────────────────────────────────────────────────────────
function init() {
    // These run on EVERY page (blog, about, legal, etc.)
    initFAQ();
    initMobileNav();
    initHeaderScroll();

    // Guard: the rest only applies to pages that have the password tool
    if (!passwordInput) return;

    // Event listeners
    passwordInput.addEventListener('input', handleInput);

    if (toggleVisBtn) {
        toggleVisBtn.innerHTML = getEyeIcon();
        toggleVisBtn.addEventListener('click', handleToggleVisibility);
    }

    if (copyBtn) {
        copyBtn.addEventListener('click', handleCopy);
    }

    // Initial state — empty
    updateUI(analyzePassword(''), '');
}

// Start when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
