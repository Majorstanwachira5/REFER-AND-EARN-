const express = require('express');
const router = express.Router();
const { requireAuth, requireAdmin } = require('../middleware/auth');
const db = require('../config/database');
const { processReferralBonus } = require('../services/bonusEngine');

/**
 * @openapi
 * /api/admin/stats:
 *   get:
 *     summary: Get platform executive analytics (Revenue, Payouts, Net Margin, Agent Counts)
 *     tags: [Admin Management]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Executive financial summary
 */
router.get('/stats', requireAuth, requireAdmin, async (req, res) => {
  try {
    const allUsers = await db.all('SELECT id, role, paid_status, wallet_balance FROM users');
    const agents = allUsers.filter(u => u.role === 'agent');

    const totalAgents = agents.length;
    const paidAgents = agents.filter(u => Number(u.paid_status) === 1).length;
    const unpaidAgents = totalAgents - paidAgents;

    // Financial math: ₦250 fee per paid agent
    const REGISTRATION_FEE = 250.00;
    const totalPlatformRevenue = paidAgents * REGISTRATION_FEE;

    // Total commissions paid out
    const allReferrals = await db.all('SELECT commission_earned FROM referrals');
    const totalCommissionsPaid = allReferrals.reduce((sum, r) => sum + Number(r.commission_earned), 0);

    // Company net margin
    const companyNetMargin = totalPlatformRevenue - totalCommissionsPaid;

    return res.json({
      success: true,
      stats: {
        totalAgents,
        paidAgents,
        unpaidAgents,
        totalPlatformRevenue,
        totalCommissionsPaid,
        companyNetMargin
      }
    });
  } catch (error) {
    console.error('[Admin Stats API Error]', error);
    return res.status(500).json({ success: false, message: 'Server error loading admin stats.' });
  }
});

/**
 * @openapi
 * /api/admin/users:
 *   get:
 *     summary: List all system users with referral details
 *     tags: [Admin Management]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Array of users
 */
router.get('/users', requireAuth, requireAdmin, async (req, res) => {
  try {
    const users = await db.all(
      'SELECT id, name, email, role, referral_code, referred_by, wallet_balance, paid_status, created_at FROM users ORDER BY created_at DESC'
    );

    return res.json({ success: true, users });
  } catch (error) {
    console.error('[Admin Users API Error]', error);
    return res.status(500).json({ success: false, message: 'Server error loading users.' });
  }
});

/**
 * @openapi
 * /api/admin/users/{id}/activate:
 *   post:
 *     summary: Manually activate an unpaid agent account and trigger commission distribution
 *     tags: [Admin Management]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: User activated successfully.
 */
router.post('/users/:id/activate', requireAuth, requireAdmin, async (req, res) => {
  try {
    const userId = req.params.id;
    const bonusResult = await processReferralBonus(userId);

    return res.json({
      success: true,
      message: `User #${userId} manually activated by Admin. Referral commissions processed.`,
      bonusResult
    });
  } catch (error) {
    console.error('[Admin Activate User Error]', error);
    return res.status(500).json({ success: false, message: 'Failed to manually activate user.' });
  }
});

/**
 * @openapi
 * /api/admin/transactions:
 *   get:
 *     summary: List all system financial transactions
 *     tags: [Admin Management]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: System transaction logs
 */
router.get('/transactions', requireAuth, requireAdmin, async (req, res) => {
  try {
    const transactions = await db.all(
      `SELECT t.*, u.name as user_name, u.email as user_email
       FROM transactions t
       JOIN users u ON t.user_id = u.id
       ORDER BY t.created_at DESC`
    );

    return res.json({ success: true, transactions });
  } catch (error) {
    console.error('[Admin Transactions API Error]', error);
    return res.status(500).json({ success: false, message: 'Server error loading transactions.' });
  }
});

module.exports = router;
