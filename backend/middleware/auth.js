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
    return res.status(401).json({ success: false, message: 'Authentication required. Please login.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await db.get('SELECT * FROM users WHERE id = ?', [decoded.id]);

    if (!user) {
      return res.status(401).json({ success: false, message: 'User account not found.' });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Session expired or invalid token.' });
  }
}

async function requirePaid(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Authentication required.' });
  }

  if (req.user.role === 'admin') {
    return next();
  }

  if (Number(req.user.paid_status) !== 1) {
    return res.status(402).json({ success: false, message: 'Account activation required. ₦250 fee unpaid.' });
  }

  next();
}

async function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Authentication required.' });
  }

  if (req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Access denied. Administrator privileges required.' });
  }

  next();
}

module.exports = {
  requireAuth,
  requirePaid,
  requireAdmin,
  JWT_SECRET
};
