/**
 * main.js — Home Page Logic
 *
 * Loads and renders all active auctions on the home page.
 */

document.addEventListener('DOMContentLoaded', () => {
    const auctionGrid = document.getElementById('auction-grid');
    const loadingSpinner = document.getElementById('loading-spinner');
    const emptyState = document.getElementById('empty-state');
    const filterBtns = document.querySelectorAll('[data-filter]');
    const prevBtn = document.getElementById('prev-page');
    const nextBtn = document.getElementById('next-page');
    const pageInfo = document.getElementById('page-info');

    let currentPage = 1;
    let currentFilter = '';

    // ── Load auctions ──
    async function loadAuctions() {
        try {
            if (loadingSpinner) loadingSpinner.style.display = 'flex';
            if (auctionGrid) auctionGrid.innerHTML = '';
            if (emptyState) emptyState.style.display = 'none';

            const res = await getAllAuctions(currentPage, currentFilter);
            const auctions = res.data || [];
            const pagination = res.pagination || {};

            if (loadingSpinner) loadingSpinner.style.display = 'none';

            if (auctions.length === 0) {
                if (emptyState) emptyState.style.display = 'block';
                return;
            }

            auctions.forEach((auction) => {
                const card = createAuctionCard(auction);
                auctionGrid.appendChild(card);
            });

            // Re-initialize 3D tilt effects if landing.js is present
            if (typeof initCardTilt === 'function') {
                setTimeout(initCardTilt, 50); // slight delay to ensure DOM is ready
            }

            // Update pagination
            if (pageInfo) pageInfo.textContent = `Page ${pagination.page} of ${pagination.pages}`;
            if (prevBtn) prevBtn.disabled = pagination.page <= 1;
            if (nextBtn) nextBtn.disabled = pagination.page >= pagination.pages;
        } catch (err) {
            if (loadingSpinner) loadingSpinner.style.display = 'none';
            console.error('Failed to load auctions:', err);
        }
    }

    // ── Create auction card ──
    function createAuctionCard(auction) {
        const col = document.createElement('div');
        col.className = 'col-sm-6 col-lg-4 col-xl-3';

        const timeLeft = getTimeLeftString(auction.endTime);
        const isEnded = auction.status === 'completed' || new Date(auction.endTime) <= new Date();
        const statusClass = isEnded ? 'status-ended' : 'status-active';
        const statusText = isEnded ? 'Ended' : 'Live';

        let imgSrc = auction.image || 'https://placehold.co/400x250/faf8f5/c9a96e?text=Auction+Item';
        
        // Resolve image path correctly
        if (imgSrc && !imgSrc.startsWith('http')) {
            // Remove leading slash to prevent double slashes with BACKEND_URL (which might or might not end in /)
            const cleanPath = imgSrc.startsWith('/') ? imgSrc.slice(1) : imgSrc;
            const baseUrl = typeof BACKEND_URL !== 'undefined' ? (BACKEND_URL.endsWith('/') ? BACKEND_URL : BACKEND_URL + '/') : '/';
            imgSrc = baseUrl + cleanPath;
        }

        const roomUrl = `/auction-room/${auction._id}`;

        // Winner info
        const winnerBadge = (isEnded && auction.highestBidder?.name)
            ? `<div class="winner-tag">🏆 Won by ${escapeHtml(auction.highestBidder.name)}</div>`
            : '';

        col.innerHTML = `
      <a href="${roomUrl}" class="auction-card-link" style="text-decoration: none; color: inherit; display: block;">
        <div class="carousel-3d-card auction-card p-0" style="height: 100%; display: flex; flex-direction: column;">
          <div class="auction-card-img-wrap">
            <img src="${escapeAttr(imgSrc)}" alt="${escapeAttr(auction.title)}" class="auction-card-img" />
            <span class="card-live-badge ${statusClass}">${statusText}</span>
          </div>
          <div class="auction-card-body p-4" style="flex: 1; display: flex; flex-direction: column;">
            <div class="story-badge mb-2" style="font-size: 0.65rem;">${isEnded ? 'ARCHIVED' : 'AUCTION ITEM'}</div>
            <h3 class="story-title h5 mb-2">${escapeHtml(auction.title)}</h3>
            <div class="story-subtitle mb-3" style="font-size: 0.75rem;">by ${escapeHtml(auction.seller?.name || 'Auction House')}</div>
            ${winnerBadge}
            <div class="mt-auto">
                <div class="auction-card-bid d-flex justify-content-between align-items-center mb-3">
                  <span class="bid-label text-muted small">CURRENT BID</span>
                  <span class="card-bid-value h4 mb-0" style="color: var(--accent-dark);">$${auction.currentHighestBid.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                </div>
                
                <div class="d-flex justify-content-between align-items-center mt-3 pt-3" style="border-top: 1px solid var(--border);">
                  <div class="auction-card-time small ${isEnded ? 'text-danger fw-bold' : 'text-muted'}">
                    ${timeLeft}
                  </div>
                  <button class="btn btn-sm btn-auth px-3 py-2 m-0" style="width: auto; font-size: 0.8rem;">
                    ${isEnded ? 'View Details' : '🔨 Place Bid'}
                  </button>
                </div>
            </div>
          </div>
        </div>
      </a>
    `;

        return col;
    }

    // ── Time helpers ──
    function getTimeLeftString(endTime) {
        const diff = new Date(endTime) - new Date();
        if (diff <= 0) return 'Auction ended';

        const d = Math.floor(diff / (1000 * 60 * 60 * 24));
        const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
        const m = Math.floor((diff / (1000 * 60)) % 60);

        if (d > 0) return `${d}d ${h}h remaining`;
        if (h > 0) return `${h}h ${m}m remaining`;
        return `${m}m remaining`;
    }

    // ── HTML utilities ──
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function escapeAttr(text) {
        return text.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    // ── Filter buttons ──
    filterBtns.forEach((btn) => {
        btn.addEventListener('click', () => {
            filterBtns.forEach((b) => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.dataset.filter;
            currentPage = 1;
            loadAuctions();
        });
    });

    // ── Pagination ──
    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            if (currentPage > 1) {
                currentPage--;
                loadAuctions();
            }
        });
    }

    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            currentPage++;
            loadAuctions();
        });
    }

    // ── Initial load ──
    loadAuctions();
});
