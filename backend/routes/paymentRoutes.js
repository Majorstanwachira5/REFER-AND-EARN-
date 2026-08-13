const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { verifyPaystackTransaction } = require('../services/paystack');
const { processReferralBonus } = require('../services/bonusEngine');

/**
 * @openapi
 * /api/payment/verify:
 *   post:
 *     summary: Verify Paystack KSh. 250 payment reference and trigger referral bonus engine
 *     tags: [Payment]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [reference]
 *             properties:
 *               reference: { type: string, example: 'RAM_1700000000_123' }
 *     responses:
 *       200:
 *         description: Payment verified. Account activated and commissions distributed.
 */
router.post('/verify', requireAuth, async (req, res) => {
  try {
    const { reference } = req.body;

    if (!reference) {
      return res.status(400).json({ success: false, message: 'Payment reference is required.' });
    }

    const verification = await verifyPaystackTransaction(reference);

    if (!verification.success) {
      return res.status(400).json({
        success: false,
        message: verification.message || 'Payment verification failed.'
      });
    }

    const bonusResult = await processReferralBonus(req.user.id);

    return res.json({
      success: true,
      message: 'Payment verified successfully! Your account is now ACTIVE.',
      bonusResult
    });
  } catch (error) {
    console.error('[Payment Verification Route Error]', error);
    return res.status(500).json({
      success: false,
      message: 'Server error verifying payment.'
    });
  }
});

/**
 * @openapi
 * /api/payment/demo-bypass:
 *   post:
 *     summary: Developer & Sandbox demo mode instant payment bypass
 *     tags: [Payment]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Demo payment simulated successfully.
 */
router.post('/demo-bypass', requireAuth, async (req, res) => {
  try {
    const bonusResult = await processReferralBonus(req.user.id);

    return res.json({
      success: true,
      message: 'Demo payment simulated successfully! KSh. 250 fee marked as paid.',
      bonusResult
    });
  } catch (error) {
    console.error('[Demo Bypass Error]', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
