const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { verifyPaystackTransaction } = require('../services/paystack');
const { processReferralBonus } = require('../services/bonusEngine');

// GET /pay - Payment checkout screen
router.get('/pay', requireAuth, (req, res) => {
  // If user has already paid, redirect straight to dashboard
  if (Number(req.user.paid_status) === 1) {
    return res.redirect('/dashboard');
  }

  res.render('pay', {
    user: req.user,
    paystackPublicKey: process.env.PAYSTACK_PUBLIC_KEY || 'pk_test_1234567890abcdef1234567890abcdef12345678',
    amount: 250
  });
});

// POST /api/payment/verify - Payment verification endpoint
router.post('/api/payment/verify', requireAuth, async (req, res) => {
  try {
    const { reference } = req.body;

    if (!reference) {
      return res.status(400).json({ success: false, message: 'Payment reference is required.' });
    }

    // Verify payment status with Paystack service
    const verification = await verifyPaystackTransaction(reference);

    if (!verification.success) {
      return res.status(400).json({
        success: false,
        message: verification.message || 'Payment verification failed.'
      });
    }

    // Process user account activation and referral bonus engine
    const bonusResult = await processReferralBonus(req.user.id);

    if (!bonusResult.success) {
      console.warn('[Payment Route] Bonus processing warning:', bonusResult.message);
    }

    return res.json({
      success: true,
      message: 'Payment verified successfully! Your RAM Agent account is now ACTIVE.',
      redirect: '/dashboard'
    });
  } catch (error) {
    console.error('[Payment Verification Route Error]', error);
    return res.status(500).json({
      success: false,
      message: 'Server error verifying payment. Please contact support.'
    });
  }
});

// POST /api/payment/demo-bypass - Developer/Demo instant bypass endpoint
router.post('/api/payment/demo-bypass', requireAuth, async (req, res) => {
  try {
    const demoRef = `RAM_DEMO_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    const bonusResult = await processReferralBonus(req.user.id);

    return res.json({
      success: true,
      reference: demoRef,
      message: 'Demo payment simulated successfully! ₦250 fee marked as paid.',
      redirect: '/dashboard'
    });
  } catch (error) {
    console.error('[Demo Bypass Error]', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
