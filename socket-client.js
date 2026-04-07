/**
 * Socket.io Client — Real-time Auction Room
 */

// ── Configuration ──
const SOCKET_URL = '/';

// ── State ──
let socket = null;
let auctionId = null;
let auctionEndTime = null;
let countdownInterval = null;
let isAuctionActive = true;
let myUserId = null;

// ── DOM References (populated on DOMContentLoaded) ──
let DOM = {};

// ═══════════════════════════════════════════════
//  Initialisation
// ═══════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
    // Cache DOM references
    DOM = {
        auctionTitle: document.getElementById('auction-title'),
        auctionDescription: document.getElementById('auction-description'),
        auctionImage: document.getElementById('auction-image'),
        sellerName: document.getElementById('seller-name'),
        currentBid: document.getElementById('current-bid'),
        highestBidder: document.getElementById('highest-bidder'),
        bidInput: document.getElementById('bid-amount'),
        bidBtn: document.getElementById('bid-btn'),
        bidHistory: document.getElementById('bid-history'),
        bidCount: document.getElementById('bid-count'),
        onlineCount: document.getElementById('online-count'),
        countdownDays: document.getElementById('cd-days'),
        countdownHours: document.getElementById('cd-hours'),
        countdownMinutes: document.getElementById('cd-minutes'),
        countdownSeconds: document.getElementById('cd-seconds'),
        countdownContainer: document.getElementById('countdown-timer'),
        statusBanner: document.getElementById('status-banner'),
        connectionStatus: document.getElementById('connection-status'),
        toastContainer: document.getElementById('toast-container'),
        winnerModal: document.getElementById('winner-modal'),
        outbidBanner: document.getElementById('outbid-banner'),
    };

    // Get auction ID from global variable (set in EJS), URL params, or URL path
    auctionId = window.currentAuctionId || 
                new URLSearchParams(window.location.search).get('id') ||
                window.location.pathname.split('/').filter(Boolean).pop();

    if (!auctionId) {
        showToast('No auction ID provided.', 'error');
        if (DOM.auctionTitle) DOM.auctionTitle.textContent = 'No Auction Selected';
        if (DOM.auctionDescription) DOM.auctionDescription.textContent = 'Please return to the catalog and select an auction.';
        return;
    }

    initSocket();
    bindEvents();
});

// ═══════════════════════════════════════════════
//  Socket.io Connection
// ═══════════════════════════════════════════════

function initSocket() {
    updateConnectionStatus('connecting');

    // Use auto-connect to current host
    socket = io({
        reconnection: true,
        reconnectionAttempts: 15,
        reconnectionDelay: 2000,
    });

    // ── Connection events ──
    socket.on('connect', () => {
        updateConnectionStatus('connected');
        socket.emit('joinAuction', auctionId);
    });

    socket.on('disconnect', () => {
        updateConnectionStatus('disconnected');
    });

    socket.on('reconnecting', () => {
        updateConnectionStatus('reconnecting');
    });

    socket.on('connect_error', (err) => {
        console.error('Connection error:', err.message);
        updateConnectionStatus('error');
    });

    // ── Auction state (received on join) ──
    socket.on('auctionState', ({ auction }) => {
        renderAuctionDetails(auction);
        auctionEndTime = new Date(auction.endTime);
        isAuctionActive = auction.status === 'active';
        startCountdown();

        if (!isAuctionActive) {
            disableBidding('This auction has ended.');
        }
    });

    // ── Bid history (received on join) ──
    socket.on('bidHistory', ({ bids }) => {
        renderBidHistory(bids);
    });

    // ── Timer synchronization from the server ──
    socket.on('timerSync', (data) => {
        if (data.auctionId === auctionId) {
            auctionEndTime = new Date(data.endTime);
            updateCountdownUI(data.remainingMs);
            
            // Urgency states based on server data
            if (DOM.countdownContainer) {
                DOM.countdownContainer.classList.remove('urgent', 'critical');
                if (data.remainingMs <= 60000) {
                    DOM.countdownContainer.classList.add('critical');
                } else if (data.remainingMs <= 300000) {
                    DOM.countdownContainer.classList.add('urgent');
                }
            }
        }
    });

    // ── Real-time bid update ──
    socket.on('newBid', (data) => {
        updateCurrentBid(data.currentHighestBid, data.highestBidder.name);
        prependBid(data.bid);
        pulseAmount();
    });

    // ── User presence ──
    socket.on('userJoined', ({ onlineCount, totalBids }) => {
        updateOnlineCount(onlineCount);
        if (totalBids !== undefined && DOM.bidCount) {
            DOM.bidCount.textContent = totalBids;
        }
    });

    socket.on('userLeft', ({ onlineCount }) => {
        updateOnlineCount(onlineCount);
    });

    // ── Auction ended — WINNER CELEBRATION ──
    socket.on('auctionEnded', (data) => {
        isAuctionActive = false;
        disableBidding(data.message);
        showWinnerModal(data);
    });

    // ── Bid error ──
    socket.on('bidError', ({ message }) => {
        showToast(message, 'error');
        enableBidButton();
        if (DOM.bidBtn) {
            DOM.bidBtn.classList.add('shake');
            setTimeout(() => DOM.bidBtn.classList.remove('shake'), 500);
        }
    });

    // ── General error ──
    socket.on('error', ({ message }) => {
        showToast(message, 'error');
    });
}

function bindEvents() {
    if (DOM.bidBtn) {
        DOM.bidBtn.addEventListener('click', handlePlaceBid);
    }

    if (DOM.bidInput) {
        DOM.bidInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') handlePlaceBid();
        });
    }

    const quickBidBtns = document.querySelectorAll('.quick-bid-btn');
    quickBidBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const increment = parseFloat(btn.dataset.inc);
            const currentAmountText = DOM.currentBid.textContent.replace(/[$,]/g, '');
            const currentAmount = parseFloat(currentAmountText) || 0;
            const newBid = Math.ceil(currentAmount + increment);
            DOM.bidInput.value = newBid;
            btn.classList.add('quick-bid-active');
            setTimeout(() => btn.classList.remove('quick-bid-active'), 300);
        });
    });

    if (DOM.outbidBanner) {
        DOM.outbidBanner.addEventListener('click', () => {
            DOM.outbidBanner.classList.remove('show');
        });
    }
}

function handlePlaceBid() {
    if (!isAuctionActive) {
        showToast('This auction has ended.', 'error');
        return;
    }

    const amount = parseFloat(DOM.bidInput.value);
    if (isNaN(amount) || amount <= 0) {
        showToast('Please enter a valid bid amount.', 'error');
        return;
    }

    DOM.bidBtn.disabled = true;
    DOM.bidBtn.innerHTML = '<span class="bid-spinner"></span> Placing...';

    socket.emit('placeBid', { auctionId, amount });

    setTimeout(enableBidButton, 2000);
    DOM.bidInput.value = '';
}

function enableBidButton() {
    if (DOM.bidBtn && isAuctionActive) {
        DOM.bidBtn.disabled = false;
        DOM.bidBtn.innerHTML = '🔨 Place Bid';
    }
}

function renderAuctionDetails(auction) {
    if (DOM.auctionTitle) DOM.auctionTitle.textContent = auction.title;
    if (DOM.auctionDescription) DOM.auctionDescription.textContent = auction.description;
    if (DOM.sellerName) DOM.sellerName.textContent = auction.seller?.name || 'Auction House';

    if (DOM.auctionImage && auction.image) {
        DOM.auctionImage.src = auction.image;
        DOM.auctionImage.style.display = 'block';
    }

    updateCurrentBid(
        auction.currentHighestBid,
        auction.highestBidder?.name || 'No bids yet'
    );
}

function updateCurrentBid(amount, bidderName) {
    if (DOM.currentBid) {
        DOM.currentBid.textContent = `$${amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
    }
    if (DOM.highestBidder) DOM.highestBidder.textContent = bidderName;
}

function renderBidHistory(bids) {
    if (!DOM.bidHistory) return;
    DOM.bidHistory.innerHTML = '';

    if (bids.length === 0) {
        DOM.bidHistory.innerHTML = '<div class="bid-empty-state">🔨 No bids yet.</div>';
    } else {
        bids.forEach((bid) => {
            const div = createBidElement(bid, false);
            DOM.bidHistory.appendChild(div);
        });
    }

    if (DOM.bidCount) DOM.bidCount.textContent = bids.length;
}

function prependBid(bid) {
    if (!DOM.bidHistory) return;
    const emptyState = DOM.bidHistory.querySelector('.bid-empty-state');
    if (emptyState) emptyState.remove();

    const item = createBidElement(bid, true);
    DOM.bidHistory.prepend(item);

    const currentCount = parseInt(DOM.bidCount?.textContent || '0', 10);
    if (DOM.bidCount) DOM.bidCount.textContent = currentCount + 1;
}

function createBidElement(bid, isNew) {
    const div = document.createElement('div');
    div.className = `bid-item${isNew ? ' bid-item-new' : ''}`;
    const time = new Date(bid.timestamp).toLocaleTimeString();
    const bidderName = bid.bidder?.name || 'Unknown';

    div.innerHTML = `
        <div class="bid-item-left">
            <div class="bid-avatar">${bidderName.charAt(0).toUpperCase()}</div>
            <div>
                <div class="bid-item-name">${escapeHtml(bidderName)}</div>
                <div class="bid-item-time">${time}</div>
            </div>
        </div>
        <div class="bid-item-amount">$${bid.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
    `;
    return div;
}

function pulseAmount() {
    if (DOM.currentBid) {
        DOM.currentBid.classList.remove('pulse-bid');
        void DOM.currentBid.offsetWidth;
        DOM.currentBid.classList.add('pulse-bid');
    }
}

function showWinnerModal(data) {
    if (!DOM.winnerModal) return;
    const hasWinner = data.winner && data.winner.name;
    DOM.winnerModal.innerHTML = `
        <div class="winner-modal-backdrop" onclick="this.parentElement.innerHTML=''"></div>
        <div class="winner-modal-content">
            <h2>${hasWinner ? 'SOLD!' : 'AUCTION ENDED'}</h2>
            <h3>${escapeHtml(data.title)}</h3>
            ${hasWinner ? `
                <p>Winner: ${escapeHtml(data.winner.name)}</p>
                <p>Final Price: $${data.finalPrice.toLocaleString()}</p>
            ` : '<p>No winner.</p>'}
            <button onclick="window.location.href='/auctions'">Return to Catalog</button>
        </div>
    `;
    DOM.winnerModal.classList.add('show');
}

function updateOnlineCount(count) {
    if (DOM.onlineCount) DOM.onlineCount.textContent = count;
}

function updateConnectionStatus(state) {
    if (!DOM.connectionStatus) return;
    const s = {
        connecting: 'Connecting...',
        connected: 'Live',
        disconnected: 'Disconnected',
        reconnecting: 'Reconnecting...',
        error: 'Error'
    }[state];
    DOM.connectionStatus.textContent = s;
}

function disableBidding(message) {
    if (DOM.bidBtn) DOM.bidBtn.disabled = true;
    if (DOM.bidInput) DOM.bidInput.disabled = true;
    if (DOM.statusBanner) {
        DOM.statusBanner.textContent = message;
        DOM.statusBanner.classList.add('show');
    }
}

function startCountdown() {
    if (countdownInterval) clearInterval(countdownInterval);
    const tick = () => {
        if (!auctionEndTime) return;
        const diff = auctionEndTime - new Date();
        updateCountdownUI(diff);
    };
    tick();
    countdownInterval = setInterval(tick, 1000);
}

function updateCountdownUI(diff) {
    if (diff <= 0) {
        if (DOM.countdownSeconds) DOM.countdownSeconds.textContent = '00';
        return;
    }
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const minutes = Math.floor((diff / (1000 * 60)) % 60);
    const seconds = Math.floor((diff / 1000) % 60);

    if (DOM.countdownDays) DOM.countdownDays.textContent = String(days).padStart(2, '0');
    if (DOM.countdownHours) DOM.countdownHours.textContent = String(hours).padStart(2, '0');
    if (DOM.countdownMinutes) DOM.countdownMinutes.textContent = String(minutes).padStart(2, '0');
    if (DOM.countdownSeconds) DOM.countdownSeconds.textContent = String(seconds).padStart(2, '0');
}

function showToast(message, type = 'info') {
    console.log(`[Toast ${type}]: ${message}`);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
