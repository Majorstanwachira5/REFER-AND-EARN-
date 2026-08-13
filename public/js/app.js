/* ==========================================================================
   REFER & EARN MORE (RAMNET) CLIENT INTERACTION SCRIPT
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    // 1. Auto-detect referral code from URL query parameter (e.g. ?ref=RAM123)
    const urlParams = new URLSearchParams(window.location.search);
    const refParam = urlParams.get('ref');

    if (refParam) {
        const refInput = document.getElementById('reg-refcode');
        if (refInput) {
            refInput.value = refParam.toUpperCase();
            // Automatically switch to registration tab if ref param present
            switchAuthTab('register');
        }
    }
});

/**
 * Switch Auth Forms (Login vs Register)
 */
function switchAuthTab(tab) {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const tabBtns = document.querySelectorAll('.tab-btn');

    if (!loginForm || !registerForm) return;

    if (tab === 'login') {
        loginForm.classList.remove('hidden');
        registerForm.classList.add('hidden');
        tabBtns[0]?.classList.add('active');
        tabBtns[1]?.classList.remove('active');
    } else {
        loginForm.classList.add('hidden');
        registerForm.classList.remove('hidden');
        tabBtns[0]?.classList.remove('active');
        tabBtns[1]?.classList.add('active');
    }
}

/**
 * Copy Agent Referral Link to Clipboard
 */
function copyReferralLink() {
    const linkInput = document.getElementById('referral-url-input');
    const copyBtnText = document.getElementById('copy-btn-text');
    const toast = document.getElementById('copy-toast');

    if (!linkInput) return;

    linkInput.select();
    linkInput.setSelectionRange(0, 99999); // For mobile devices

    try {
        navigator.clipboard.writeText(linkInput.value);
    } catch (err) {
        document.execCommand('copy');
    }

    if (copyBtnText) copyBtnText.innerText = 'Copied!';
    if (toast) {
        toast.classList.remove('hidden');
        setTimeout(() => {
            toast.classList.add('hidden');
            if (copyBtnText) copyBtnText.innerText = 'Copy Link';
        }, 3000);
    }
}

/**
 * Switch Referral Tree Network Tabs (Direct vs Indirect)
 */
function switchTreeTab(level) {
    const directPanel = document.getElementById('direct-tree-panel');
    const indirectPanel = document.getElementById('indirect-tree-panel');
    const tabBtns = document.querySelectorAll('.tree-tab-btn');

    if (!directPanel || !indirectPanel) return;

    if (level === 'direct') {
        directPanel.classList.remove('hidden');
        indirectPanel.classList.add('hidden');
        tabBtns[0]?.classList.add('active');
        tabBtns[1]?.classList.remove('active');
    } else {
        directPanel.classList.add('hidden');
        indirectPanel.classList.remove('hidden');
        tabBtns[0]?.classList.remove('active');
        tabBtns[1]?.classList.add('active');
    }
}

/**
 * Withdraw Modal Controls
 */
function openWithdrawModal() {
    const modal = document.getElementById('withdraw-modal');
    if (modal) modal.classList.remove('hidden');
}

function closeWithdrawModal() {
    const modal = document.getElementById('withdraw-modal');
    if (modal) modal.classList.add('hidden');
}

/**
 * Handle Withdrawal Request Submission
 */
async function handleWithdraw(event) {
    event.preventDefault();

    const amount = document.getElementById('w-amount').value;
    const bankName = document.getElementById('w-bank').value;
    const accountNumber = document.getElementById('w-account').value;

    try {
        const res = await fetch('/api/withdraw', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount, bankName, accountNumber })
        });

        const data = await res.json();
        if (data.success) {
            alert(data.message);
            closeWithdrawModal();
            window.location.reload();
        } else {
            alert('Withdrawal Error: ' + data.message);
        }
    } catch (err) {
        alert('Server error: ' + err.message);
    }
}
