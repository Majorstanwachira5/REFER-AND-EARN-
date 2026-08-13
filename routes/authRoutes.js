const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/database');
const { JWT_SECRET } = require('../middleware/auth');

// Helper to generate unique referral code (e.g., RAM8X92K)
function generateReferralCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = 'RAM';
  for (let i = 0; i < 5; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// POST /register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, ref_code } = req.body;

    if (!name || !email || !password) {
      return res.status(400).render('index', {
        activeTab: 'register',
        error: 'Please fill in all required fields (Name, Email, Password).',
        ref_code: ref_code || '',
        user: null
      });
    }

    // Check if user already exists
    const existingUser = await db.get('SELECT id FROM users WHERE LOWER(email) = LOWER(?)', [email]);
    if (existingUser) {
      return res.status(400).render('index', {
        activeTab: 'register',
        error: 'An account with this email address already exists. Please login.',
        ref_code: ref_code || '',
        user: null
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate unique referral code for this new user
    let userRefCode = generateReferralCode();
    let isCodeUnique = false;
    let attempts = 0;

    while (!isCodeUnique && attempts < 10) {
      const checkCode = await db.get('SELECT id FROM users WHERE referral_code = ?', [userRefCode]);
      if (!checkCode) {
        isCodeUnique = true;
      } else {
        userRefCode = generateReferralCode();
        attempts++;
      }
    }

    // Find referrer ID if referral code was provided
    let referrerId = null;
    if (ref_code && ref_code.trim()) {
      const referrer = await db.get('SELECT id FROM users WHERE UPPER(referral_code) = UPPER(?)', [ref_code.trim()]);
      if (referrer) {
        referrerId = referrer.id;
      }
    }

    // Create user record
    const result = await db.run(
      'INSERT INTO users (name, email, password, referral_code, referred_by, wallet_balance, paid_status) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [name, email, hashedPassword, userRefCode, referrerId, 0.00, 0]
    );

    const newUserId = result.lastID;

    // Issue JWT cookie
    const token = jwt.sign({ id: newUserId, email, name }, JWT_SECRET, { expiresIn: '7d' });
    res.cookie('token', token, { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000 });

    // API or HTML redirect
    if (req.xhr || req.headers['content-type'] === 'application/json') {
      return res.json({ success: true, redirect: '/pay', message: 'Registration successful! Proceed to payment.' });
    }

    return res.redirect('/pay');
  } catch (error) {
    console.error('[Register Error]', error);
    return res.status(500).render('index', {
      activeTab: 'register',
      error: 'An error occurred during registration. Please try again.',
      ref_code: req.body.ref_code || '',
      user: null
    });
  }
});

// POST /login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).render('index', {
        activeTab: 'login',
        error: 'Please enter both email and password.',
        ref_code: '',
        user: null
      });
    }

    const user = await db.get('SELECT * FROM users WHERE LOWER(email) = LOWER(?)', [email]);
    if (!user) {
      return res.status(400).render('index', {
        activeTab: 'login',
        error: 'Invalid email or password.',
        ref_code: '',
        user: null
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).render('index', {
        activeTab: 'login',
        error: 'Invalid email or password.',
        ref_code: '',
        user: null
      });
    }

    // Issue token
    const token = jwt.sign({ id: user.id, email: user.email, name: user.name }, JWT_SECRET, { expiresIn: '7d' });
    res.cookie('token', token, { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000 });

    // Redirect based on paid_status
    if (Number(user.paid_status) === 1) {
      return res.redirect('/dashboard');
    } else {
      return res.redirect('/pay');
    }
  } catch (error) {
    console.error('[Login Error]', error);
    return res.status(500).render('index', {
      activeTab: 'login',
      error: 'An error occurred during login.',
      ref_code: '',
      user: null
    });
  }
});

// GET /logout
router.get('/logout', (req, res) => {
  res.clearCookie('token');
  res.redirect('/login');
});

module.exports = router;
