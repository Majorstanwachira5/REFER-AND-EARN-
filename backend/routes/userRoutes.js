const express = require('express');
const router = express.Router();
const { requireAuth, requirePaid } = require('../middleware/auth');
const db = require('../config/database');

/**
 * @openapi
 * /api/user/dashboard:
 *   get:
 *     summary: Fetch Dashboard statistics, referral tree, and transactions
 *     tags: [Member Dashboard]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Dashboard statistics and referral tree records
 */
router.get('/dashboard', requireAuth, requirePaid, async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await db.get('SELECT id, name, email, role, referral_code, wallet_balance, paid_status, created_at FROM users WHERE id = ?', [userId]);

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

    return res.json({
      success: true,
      user,
      stats: {
        walletBalance: user.wallet_balance || 0,
        directCount,
        indirectCount,
        directEarnings,
        indirectEarnings,
        totalEarned
      },
      referralLink: `http://localhost:3000/register?ref=${user.referral_code}`,
      directReferrals,
      indirectReferrals,
      transactions
    });
  } catch (error) {
    console.error('[Dashboard API Error]', error);
    return res.status(500).json({ success: false, message: 'Server error loading dashboard.' });
  }
});

/**
 * @openapi
 * /api/user/withdraw:
 *   post:
 *     summary: Request wallet funds withdrawal
 *     tags: [Member Dashboard]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [amount, bankName, accountNumber]
 *             properties:
 *               amount: { type: number, example: 500 }
 *               bankName: { type: string, example: 'M-Pesa' }
 *               accountNumber: { type: string, example: '0712345678' }
 *     responses:
 *       200:
 *         description: Withdrawal request processed successfully.
 */
router.post('/withdraw', requireAuth, requirePaid, async (req, res) => {
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
    console.error('[Withdrawal API Error]', error);
    return res.status(500).json({ success: false, message: 'Server error processing withdrawal.' });
  }
});

module.exports = router;
