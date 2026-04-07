/**
 * auth.js — Authentication Utilities (Bypass Version)
 *
 * All users are now treated as 'Guest'. Login/Register requirements are removed.
 */

// ═══════════════════════════════════════════════
//  Mock User Management
// ═══════════════════════════════════════════════

const GUEST_USER = {
  name: 'Guest Player',
  email: 'guest@example.com',
  upiId: 'guest@upi'
};

function saveAuth(token, user) {
  // No-op: we don't need to save anything
}

function getUser() {
  return GUEST_USER;
}

function isLoggedIn() {
  return true; // Always logged in as Guest
}

function logout() {
  // Logout just refreshes the page or goes home, since auth is removed
  window.location.href = '/';
}

// ═══════════════════════════════════════════════
//  Navbar State (Simplified)
// ═══════════════════════════════════════════════

function updateNavbar() {
  const authNav = document.getElementById('auth-nav');
  if (!authNav) return;

  const isLandingPage = authNav.classList.contains('nav-links');
  const user = getUser();

  if (isLandingPage) {
    // Landing page — simple <li><a> styling
    authNav.innerHTML = `
            <li><a href="/create-auction">Create Auction</a></li>
            <li><a href="/dashboard">Dashboard</a></li>
            <li><strong style="color: var(--accent-gold); margin-left: 1rem;">${escapeHtml(user.name)}</strong></li>
          `;
  } else {
    // Inner pages — Bootstrap navbar styling
    authNav.innerHTML = `
            <li class="nav-item">
              <a class="nav-link" href="/dashboard">
                <span class="nav-icon">📊</span> Dashboard
              </a>
            </li>
            <li class="nav-item">
              <a class="nav-link" href="/create-auction">
                <span class="nav-icon">➕</span> Create Auction
              </a>
            </li>
            <li class="nav-item">
              <span class="nav-link" style="color: var(--accent-gold); font-weight: 600;">
                <span class="nav-icon">👤</span> ${escapeHtml(user.name)}
              </span>
            </li>
          `;
  }
}

// ═══════════════════════════════════════════════
//  Utilities
// ═══════════════════════════════════════════════

function getBasePath() {
  return '/';
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function showFormError(formId, message) {
  const errorDiv = document.getElementById(formId + '-error');
  if (errorDiv) {
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
  }
}

function hideFormError(formId) {
  const errorDiv = document.getElementById(formId + '-error');
  if (errorDiv) {
    errorDiv.style.display = 'none';
  }
}

/**
 * Require auth — Now always returns true.
 */
function requireAuth() {
  return true;
}

// ── Initialise navbar on every page ──
document.addEventListener('DOMContentLoaded', updateNavbar);
