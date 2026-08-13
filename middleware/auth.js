const jwt = require('jsonwebtoken');
const db = require('../config/database');

const JWT_SECRET = process.env.JWT_SECRET || 'ramnet_super_secret_jwt_key_2026_gold_blue';

async function requireAuth(req, res, next) {
  let token = req.cookies?.token;

  if (!token && req.headers.authorization) {
    const parts = req.headers.authorization.split(' ');
    if (parts.length === 2 && parts[0] === 'Bearer') {
      token = parts[1];
    }
  }

  if (!token) {
    if (req.originalUrl.startsWith('/api/')) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }
    return res.redirect('/login');
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await db.get('SELECT * FROM users WHERE id = ?', [decoded.id]);

    if (!user) {
      res.clearCookie('token');
      if (req.originalUrl.startsWith('/api/')) {
        return res.status(401).json({ success: false, message: 'User not found' });
      }
      return res.redirect('/login');
    }

    req.user = user;
    res.locals.user = user;
    next();
  } catch (err) {
    res.clearCookie('token');
    if (req.originalUrl.startsWith('/api/')) {
      return res.status(401).json({ success: false, message: 'Session expired or invalid' });
    }
    return res.redirect('/login');
  }
}

async function requirePaid(req, res, next) {
  if (!req.user) {
    return res.redirect('/login');
  }

  if (Number(req.user.paid_status) !== 1) {
    if (req.originalUrl.startsWith('/api/')) {
      return res.status(402).json({ success: false, message: 'Payment of ₦250 fee required to activate agent account' });
    }
    return res.redirect('/pay');
  }

  next();
}

module.exports = {
  requireAuth,
  requirePaid,
  JWT_SECRET
};
