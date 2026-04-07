/**
 * api.js — Reusable Fetch API Wrapper
 *
 * Centralises all HTTP requests to the backend.
 * Automatically attaches JWT token to protected requests.
 */

// Centralises all HTTP requests to the backend.
const BACKEND_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
    ? 'http://localhost:5000' 
    : window.location.origin;
const API_BASE = `${BACKEND_URL}/api`;

/**
 * Get the stored JWT token.
 */
function getToken() {
    return localStorage.getItem('token');
}

/**
 * Build headers with optional auth token.
 */
function buildHeaders(isFormData = false) {
    const headers = {};
    if (!isFormData) {
        headers['Content-Type'] = 'application/json';
    }
    // Auth bypass: no longer sending JWT tokens
    return headers;
}

/**
 * Generic fetch wrapper.
 */
async function request(endpoint, options = {}) {
    try {
        const res = await fetch(`${API_BASE}${endpoint}`, options);
        const data = await res.json();

        if (!res.ok) {
            throw {
                status: res.status,
                message: data.message || 'Something went wrong.',
                errors: data.errors || [],
            };
        }

        return data;
    } catch (err) {
        if (err.status) throw err;
        throw { status: 0, message: 'Network error. Please try again.' };
    }
}

// ═══════════════════════════════════════════════
//  Auth API
// ═══════════════════════════════════════════════

async function registerUser(name, email, password) {
    return request('/register', {
        method: 'POST',
        headers: buildHeaders(),
        body: JSON.stringify({ name, email, password }),
    });
}

async function loginUser(email, password) {
    return request('/login', {
        method: 'POST',
        headers: buildHeaders(),
        body: JSON.stringify({ email, password }),
    });
}

async function verifyOTP(email, otp) {
    return request('/verify-otp', {
        method: 'POST',
        headers: buildHeaders(),
        body: JSON.stringify({ email, otp }),
    });
}

async function resendOTP(email) {
    return request('/resend-otp', {
        method: 'POST',
        headers: buildHeaders(),
        body: JSON.stringify({ email }),
    });
}

// ═══════════════════════════════════════════════
//  Auction API
// ═══════════════════════════════════════════════

async function getAllAuctions(page = 1, status = '') {
    let endpoint = `/auctions?page=${page}`;
    if (status) endpoint += `&status=${status}`;
    return request(endpoint, {
        method: 'GET',
        headers: buildHeaders(),
    });
}

async function getAuctionById(id) {
    return request(`/auction/${id}`, {
        method: 'GET',
        headers: buildHeaders(),
    });
}

async function createAuction(auctionData) {
    const isFormData = auctionData instanceof FormData;
    return request('/auction/create', {
        method: 'POST',
        headers: buildHeaders(isFormData),
        body: isFormData ? auctionData : JSON.stringify(auctionData),
    });
}

// ═══════════════════════════════════════════════
//  Bid API
// ═══════════════════════════════════════════════

async function placeBidREST(auctionId, amount) {
    return request('/bid', {
        method: 'POST',
        headers: buildHeaders(),
        body: JSON.stringify({ auctionId, amount }),
    });
}

// ═══════════════════════════════════════════════
//  Dashboard API
// ═══════════════════════════════════════════════

async function getDashboard() {
    return request('/dashboard', {
        method: 'GET',
        headers: buildHeaders(),
    });
}
