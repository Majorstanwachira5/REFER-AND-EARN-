const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/database');
const { requireAuth, JWT_SECRET } = require('../middleware/auth');

function generateReferralCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = 'RAM';
  for (let i = 0; i < 5; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * @openapi
 * /api/auth/register:
 *   post:
 *     summary: Register a new user account
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, password]
 *             properties:
 *               name: { type: string, example: 'John Doe' }
 *               email: { type: string, example: 'john@example.com' }
 *               password: { type: string, example: 'secret123' }
 *               ref_code: { type: string, example: 'RAM8X92K' }
 *     responses:
 *       200:
 *         description: Account created successfully. Returns JWT cookie and user data.
 */
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, ref_code } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Name, email, and password are required.' });
    }

    const existingUser = await db.get('SELECT id FROM users WHERE LOWER(email) = LOWER(?)', [email]);
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'An account with this email already exists.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    let userRefCode = generateReferralCode();
    let isCodeUnique = false;
    let attempts = 0;
    while (!isCodeUnique && attempts < 10) {
      const checkCode = await db.get('SELECT id FROM users WHERE referral_code = ?', [userRefCode]);
      if (!checkCode) isCodeUnique = true;
      else {
        userRefCode = generateReferralCode();
        attempts++;
      }
    }

    let referrerId = null;
    if (ref_code && ref_code.trim()) {
      const referrer = await db.get('SELECT id FROM users WHERE UPPER(referral_code) = UPPER(?)', [ref_code.trim()]);
      if (referrer) referrerId = referrer.id;
    }

    const result = await db.run(
      'INSERT INTO users (name, email, password, role, referral_code, referred_by, wallet_balance, paid_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [name, email, hashedPassword, 'member', userRefCode, referrerId, 0.00, 0]
    );

    const newUserId = result.lastID;
    const token = jwt.sign({ id: newUserId, email, name, role: 'member' }, JWT_SECRET, { expiresIn: '7d' });

    res.cookie('token', token, { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000 });

    const newUser = await db.get('SELECT id, name, email, role, referral_code, wallet_balance, paid_status FROM users WHERE id = ?', [newUserId]);

    return res.json({
      success: true,
      message: 'Registration successful! Proceed to payment.',
      token,
      user: newUser
    });
  } catch (error) {
    console.error('[API Register Error]', error);
    return res.status(500).json({ success: false, message: 'Registration failed due to server error.' });
  }
});

/**
 * @openapi
 * /api/auth/login:
 *   post:
 *     summary: User & Admin Login
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string, example: 'john@example.com' }
 *               password: { type: string, example: 'secret123' }
 *     responses:
 *       200:
 *         description: Login successful. Returns JWT token.
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }

    const user = await db.get('SELECT * FROM users WHERE LOWER(email) = LOWER(?)', [email]);
    if (!user) {
      return res.status(400).json({ success: false, message: 'Invalid email or password.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Invalid email or password.' });
    }

    const token = jwt.sign({ id: user.id, email: user.email, name: user.name, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    res.cookie('token', token, { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000 });

    const { password: _, ...userWithoutPass } = user;

    return res.json({
      success: true,
      message: 'Login successful.',
      token,
      user: userWithoutPass
    });
  } catch (error) {
    console.error('[API Login Error]', error);
    return res.status(500).json({ success: false, message: 'Login failed due to server error.' });
  }
});

/**
 * @openapi
 * /api/auth/me:
 *   get:
 *     summary: Get currently authenticated user details
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Current user profile
 */
router.get('/me', requireAuth, (req, res) => {
  const { password: _, ...userWithoutPass } = req.user;
  res.json({ success: true, user: userWithoutPass });
});

/**
 * @openapi
 * /api/auth/logout:
 *   post:
 *     summary: Logout user and clear authentication cookies
 *     tags: [Authentication]
 *     responses:
 *       200:
 *         description: Logged out successfully.
 */
router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ success: true, message: 'Logged out successfully.' });
});

module.exports = router;
