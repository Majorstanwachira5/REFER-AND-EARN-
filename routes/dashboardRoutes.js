const express = require('express');
const router = express.Router();
const { requireAuth, requirePaid } = require('../middleware/auth');
const db = require('../config/database');

// GET /dashboard - Dashboard
router.get('/dashboard', requireAuth, requirePaid, async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await db.get('SELECT * FROM users WHERE id = ?', [userId]);

    const directReferrals = await db.all(
      `SELECT r.*, u.name as referee_name, u.email as referee_email, u.paid_status as referee_paid_status, u.created_at as joined_at
       FROM referrals r
       JOIN users u ON r.referee_id = u.id
       WHERE r.referrer_id = ? AND r.level = 1
       ORDER BY r.created_at DESC`,
      [userId]
    );

    const indirectReferrals = await db.all(
      `SELECT r.*, u.name as referee_name, u.email as referee_email, u.paid_status as referee_paid_status, u.created_at as joined_at
       FROM referrals r
       JOIN users u ON r.referee_id = u.id
       WHERE r.referrer_id = ? AND r.level = 2
       ORDER BY r.created_at DESC`,
      [userId]
    );

    const directCount = directReferrals.length;
    const indirectCount = indirectReferrals.length;

    const directEarnings = directReferrals.reduce((sum, r) => sum + Number(r.commission_earned), 0);
    const indirectEarnings = indirectReferrals.reduce((sum, r) => sum + Number(r.commission_earned), 0);
    const totalEarned = directEarnings + indirectEarnings;

    const transactions = await db.all(
      'SELECT * FROM transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 20',
      [userId]
    );

    const host = req.get('host') || 'localhost:3000';
    const protocol = req.protocol || 'http';
    const referralLink = `${protocol}://${host}/register?ref=${user.referral_code}`;

    res.render('dashboard', {
      user,
      stats: {
        walletBalance: user.wallet_balance || 0,
        directCount,
        indirectCount,
        directEarnings,
        indirectEarnings,
        totalEarned
      },
      referralLink,
      directReferrals,
      indirectReferrals,
      transactions
    });
  } catch (error) {
    console.error('[Dashboard Error]', error);
    res.status(500).render('index', {
      activeTab: 'login',
      error: 'Failed to load dashboard. Please login again.',
      ref_code: '',
      user: null
    });
  }
});

// POST /api/withdraw - Request withdrawal from wallet
router.post('/api/withdraw', requireAuth, requirePaid, async (req, res) => {
  try {
    const { amount, bankName, accountNumber } = req.body;
    const withdrawAmount = parseFloat(amount);

    if (isNaN(withdrawAmount) || withdrawAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid withdrawal amount.' });
    }

    if (!bankName || !accountNumber) {
      return res.status(400).json({ success: false, message: 'Bank / M-Pesa Name and Account Number are required.' });
    }

    const user = await db.get('SELECT wallet_balance FROM users WHERE id = ?', [req.user.id]);

    if (user.wallet_balance < withdrawAmount) {
      return res.status(400).json({
        success: false,
        message: `Insufficient wallet balance. You have KSh. ${user.wallet_balance.toFixed(2)} available.`
      });
    }

    await db.run('UPDATE users SET wallet_balance = wallet_balance - ? WHERE id = ?', [
      withdrawAmount,
      req.user.id
    ]);

    await db.run(
      'INSERT INTO transactions (user_id, amount, type, description) VALUES (?, ?, ?, ?)',
      [
        req.user.id,
        withdrawAmount,
        'debit',
        `Withdrawal to ${bankName} (${accountNumber})`
      ]
    );

    return res.json({
      success: true,
      message: `Withdrawal request of KSh. ${withdrawAmount.toFixed(2)} submitted successfully!`
    });
  } catch (error) {
    console.error('[Withdrawal Error]', error);
    return res.status(500).json({ success: false, message: 'Server error processing withdrawal.' });
  }
});

module.exports = router;
