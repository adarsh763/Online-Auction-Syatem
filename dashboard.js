/**
 * dashboard.js — User Dashboard Page Logic
 */

document.addEventListener('DOMContentLoaded', () => {
    if (!requireAuth()) return;

    const user = getUser();
    const welcomeName = document.getElementById('welcome-name');
    if (welcomeName && user) welcomeName.textContent = user.name;

    loadDashboard();
});

async function loadDashboard() {
    const loadingEl = document.getElementById('dashboard-loading');
    const contentEl = document.getElementById('dashboard-content');

    try {
        if (loadingEl) loadingEl.style.display = 'flex';

        const res = await getDashboard();
        const { myAuctions, biddingOn, auctionsWon, stats } = res.data;

        if (loadingEl) loadingEl.style.display = 'none';
        if (contentEl) contentEl.style.display = 'block';

        // Update stats
        setText('stat-created', stats.totalCreated);
        setText('stat-bidding', stats.activeBids);
        setText('stat-won', stats.totalWon);

        // Render tables
        renderAuctionList('my-auctions-list', myAuctions, 'seller');
        renderAuctionList('bidding-list', biddingOn, 'bidder');
        renderAuctionList('won-list', auctionsWon, 'winner');
    } catch (err) {
        if (loadingEl) loadingEl.style.display = 'none';
        console.error('Dashboard error:', err);
    }
}

function renderAuctionList(containerId, auctions, mode) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (auctions.length === 0) {
        container.innerHTML = '<p class="empty-text">No auctions to show.</p>';
        return;
    }

    container.innerHTML = auctions
        .map((a) => {
            const isEnded = a.status === 'completed';
            const statusClass = isEnded ? 'status-ended' : 'status-active';
            const statusText = isEnded ? 'Completed' : 'Active';
            const winner = a.highestBidder?.name || 'No bids';

            let extraInfo = '';
            if (mode === 'seller') {
                extraInfo = `Highest: $${a.currentHighestBid.toFixed(2)} by ${esc(winner)}`;
            } else if (mode === 'bidder') {
                extraInfo = `Current: $${a.currentHighestBid.toFixed(2)}`;
            } else if (mode === 'winner') {
                extraInfo = `Won at $${a.currentHighestBid.toFixed(2)}`;
            }

            // Resolve image path
            let imgSrc = a.image || 'https://placehold.co/60x60/faf8f5/c9a96e?text=🔨';
            
            // Resolve image path correctly
            if (imgSrc && !imgSrc.startsWith('http')) {
                const cleanPath = imgSrc.startsWith('/') ? imgSrc.slice(1) : imgSrc;
                const baseUrl = typeof BACKEND_URL !== 'undefined' ? (BACKEND_URL.endsWith('/') ? BACKEND_URL : BACKEND_URL + '/') : '/';
                imgSrc = baseUrl + cleanPath;
            }

            return `
        <a href="/auction-room/${a._id}" class="dashboard-auction-item glass-card">
          <div class="d-flex align-items-center gap-3">
            <img src="${imgSrc}" alt="${esc(a.title)}"
                 style="width: 56px; height: 56px; object-fit: cover; border-radius: 10px; flex-shrink: 0; border: 1px solid var(--border);" />
            <div class="flex-grow-1">
              <div class="d-flex justify-content-between align-items-start">
                <div>
                  <h6 class="mb-1">${esc(a.title)}</h6>
                  <small class="text-muted">${extraInfo}</small>
                </div>
                <span class="auction-status-badge ${statusClass}" style="position:static;">${statusText}</span>
              </div>
            </div>
          </div>
        </a>
      `;
        })
        .join('');
}

function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
}

function esc(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
}
