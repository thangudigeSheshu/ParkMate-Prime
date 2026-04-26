/* script.js - Advanced Pathfinding & Performance Optimized */
if (!pmStore.getItem('pmCurrentUser')) window.location.href = "index.html?v=1";

const TOTAL = 800;
const COLS = 50; // Grid columns for coordinate calculation
const PAYMENT_LOCK_KEY = 'pm_unpaid_expired_lock_v1';

function loadPaymentLock() {
    try {
        const raw = localStorage.getItem(PAYMENT_LOCK_KEY) || 'null';
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
        return null;
    }
}

function clearPaymentLock() {
    try {
        localStorage.removeItem(PAYMENT_LOCK_KEY);
    } catch {}
}

// ALGORITHM: Manhattan Distance Heuristic
// Formula: d = |x1 - x2| + |y1 - y2|
function calculateRoute(targetSlot) {
    const x1 = 0, y1 = 0; // Entrance Coordinates
    const x2 = (targetSlot - 1) % COLS;
    const y2 = Math.floor((targetSlot - 1) / COLS);
    
    const distance = Math.abs(x1 - x2) + Math.abs(y1 - y2);
    const zone = String.fromCharCode(65 + Math.floor((targetSlot - 1) / 50));
    
    return {
        dist: distance,
        eta: (distance * 0.2).toFixed(1) + " mins",
        zone: zone
    };
}

// ═══════════════════════════════════════════════════════
//   GLOBAL SESSION MANAGER (Multi-Device Kickout)
// ═══════════════════════════════════════════════════════
(function initGlobalSessionHeartbeat() {
    function checkGlobalSession() {
        const uid = localStorage.getItem("pm_user_id") || sessionStorage.getItem("pm_session_user");
        const tok = localStorage.getItem("pm_session_token");
        if (!uid || !tok) return;
        fetch("api.php?action=heartbeat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ user_id: uid, session_token: tok })
        })
        .then(r => r.json())
        .then(data => {
            if (data && data.valid === false) {
                const keys = ["pm_user_id", "pm_session_token", "pm_device_id", "pm_last_active", "pmCurrentUser", "currentUser", "activeTicket", "pm_active_tickets", "pm_active_ticket_selected", "bookedSlots", "admin_records", "parkmate_booking_sync", "pm_ticket_banner_snapshot", "pm_session_user", "currentUserId"];
                keys.forEach(k => { localStorage.removeItem(k); sessionStorage.removeItem(k); });
                Object.keys(localStorage).forEach(k => { if (k.startsWith("pm_active_ticket")) localStorage.removeItem(k); });
                const msg = data.reason === "device_conflict" ? "This account is active on another device. You have been signed out here." : "Your session has expired or you signed in elsewhere.";
                if (window.Swal) {
                    window.Swal.fire({ title: "Session Ended", text: msg, icon: "info", showConfirmButton: false, timer: 2000, background: "#0d1117", color: "#ffffff" }).then(() => { window.location.replace("index.html"); });
                } else {
                    window.location.replace("index.html");
                }
            }
        }).catch(()=>{});
    }
    setInterval(checkGlobalSession, 15000);
    document.addEventListener("visibilitychange", () => { if (!document.hidden) checkGlobalSession(); });
    window.addEventListener("focus", checkGlobalSession);
    setTimeout(checkGlobalSession, 2000);
})();

function init() {
    const grid = document.getElementById("grid");
    if(!grid) return; 
    
    const booked = JSON.parse(pmStore.getItem('bookedSlots')) || [];
    const ticket = JSON.parse(pmStore.getItem('activeTicket'));
    const mySlot = ticket ? parseInt(ticket.slot) : null;
    let free = 0;

    // DATA STRUCTURE: DocumentFragment for O(1) DOM Insertion performance
    const fragment = document.createDocumentFragment();

    for (let i = 1; i <= TOTAL; i++) {
        const el = document.createElement("div");
        let status = booked.includes(i) ? 'occupied' : 'free';
        if (i === mySlot) status = 'my-slot';

        el.className = `slot ${status}`;
        el.title = `Slot ${i}`;

        if (status === 'free') {
            free++;
            el.onclick = async () => {
                const pendingPayment = loadPaymentLock();
                if (pendingPayment) {
                    const currentUser = JSON.parse(pmStore.getItem('pmCurrentUser') || pmStore.getItem('currentUser') || 'null');
                    const userId = currentUser?.id || localStorage.getItem('pm_user_id');
                    let stillPending = true;
                    if (userId) {
                        try {
                            const res = await fetch(`api.php?action=get_user&id=${encodeURIComponent(userId)}`);
                            const data = await res.json();
                            if (!data?.unpaidExpiredTicket) {
                                clearPaymentLock();
                                stillPending = false;
                            }
                        } catch {}
                    }
                    if (stillPending) {
                        const slotText = pendingPayment.slot || pendingPayment.ticket?.slot ? `Slot #${pendingPayment.slot || pendingPayment.ticket?.slot}` : 'your expired booking';
                        Swal.fire({
                            title: 'Payment Required',
                            html: `Complete payment for <b>${slotText}</b> before booking a new slot.<br><br>You will be redirected to Tickets.`,
                            icon: 'warning',
                            confirmButtonText: 'Go To Tickets',
                            allowOutsideClick: false
                        }).then(() => {
                            window.location.href = 'tickets.html';
                        });
                        return;
                    }
                }
                if(mySlot) {
                    Swal.fire('Limit Reached', 'You already have an active booking.', 'warning');
                } else {
                    const route = calculateRoute(i);
                    Swal.fire({
                        title: `Confirm Slot #${i}`,
                        html: `<b>Zone:</b> ${route.zone}<br><b>Distance:</b> ${route.dist} units<br><b>ETA:</b> ${route.eta}`,
                        showCancelButton: true,
                        confirmButtonText: 'Navigate & Book'
                    }).then(res => {
                        if(res.isConfirmed) {
                            localStorage.setItem('selected_slot_id', i);
                            window.location.href = `token.html?v=8&slot=${i}`;
                        }
                    });
                }
            };
        }
        fragment.appendChild(el);
    }
    grid.innerHTML = "";
    grid.appendChild(fragment);
    
    document.getElementById('freeC').innerText = free;
    document.getElementById('occC').innerText = TOTAL - free;
}

window.onload = init;
