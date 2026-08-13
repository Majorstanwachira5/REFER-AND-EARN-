require('dotenv').config();
const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');
const axios = require('axios');

const app = express();
const PORT = process.env.FRONTEND_PORT || 3000;
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8080';

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Serve static files from frontend/public
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, '..', 'public')));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Fetch user profile from Backend API if token exists
app.use(async (req, res, next) => {
  const token = req.cookies?.token;
  res.locals.user = null;
  res.locals.backendUrl = BACKEND_URL;
  if (token) {
    try {
      const response = await axios.get(`${BACKEND_URL}/api/auth/me`, {
        headers: { Cookie: `token=${token}`, Authorization: `Bearer ${token}` }
      });
      if (response.data.success) {
        req.user = response.data.user;
        res.locals.user = response.data.user;
      }
    } catch (err) {
      res.clearCookie('token');
    }
  }
  next();
});

// GET / - Root Page
app.get('/', (req, res) => {
  if (req.user) {
    if (Number(req.user.paid_status) === 1) {
      return res.redirect('/dashboard');
    } else {
      return res.redirect('/pay');
    }
  }
  res.render('index', { activeTab: 'login', error: null, ref_code: req.query.ref || '', user: null });
});

app.get('/login', (req, res) => {
  if (req.user) return res.redirect(Number(req.user.paid_status) === 1 ? '/dashboard' : '/pay');
  res.render('index', { activeTab: 'login', error: null, ref_code: '', user: null });
});

app.get('/register', (req, res) => {
  if (req.user) return res.redirect(Number(req.user.paid_status) === 1 ? '/dashboard' : '/pay');
  res.render('index', { activeTab: 'register', error: null, ref_code: req.query.ref || '', user: null });
});

// POST /login - Forward to Backend API
app.post('/login', async (req, res) => {
  try {
    const response = await axios.post(`${BACKEND_URL}/api/auth/login`, req.body);
    if (response.data.success) {
      res.cookie('token', response.data.token, { httpOnly: true });
      const isPaid = Number(response.data.user.paid_status) === 1;
      return res.redirect(isPaid ? '/dashboard' : '/pay');
    }
    return res.render('index', { activeTab: 'login', error: response.data.message, ref_code: '', user: null });
  } catch (err) {
    const errorMsg = err.response?.data?.message || 'Login failed.';
    return res.render('index', { activeTab: 'login', error: errorMsg, ref_code: '', user: null });
  }
});

// POST /register - Forward to Backend API
app.post('/register', async (req, res) => {
  try {
    const response = await axios.post(`${BACKEND_URL}/api/auth/register`, req.body);
    if (response.data.success) {
      res.cookie('token', response.data.token, { httpOnly: true });
      return res.redirect('/pay');
    }
    return res.render('index', { activeTab: 'register', error: response.data.message, ref_code: req.body.ref_code || '', user: null });
  } catch (err) {
    const errorMsg = err.response?.data?.message || 'Registration failed.';
    return res.render('index', { activeTab: 'register', error: errorMsg, ref_code: req.body.ref_code || '', user: null });
  }
});

// GET /pay - Payment checkout screen
app.get('/pay', (req, res) => {
  if (!req.user) return res.redirect('/login');
  if (Number(req.user.paid_status) === 1) return res.redirect('/dashboard');

  res.render('pay', {
    user: req.user,
    paystackPublicKey: process.env.PAYSTACK_PUBLIC_KEY || 'pk_live_2b4b2db53230210e899c86c257247bf295934593',
    amount: 250,
    backendUrl: BACKEND_URL
  });
});

// GET /dashboard - Dashboard
app.get('/dashboard', async (req, res) => {
  if (!req.user) return res.redirect('/login');
  if (Number(req.user.paid_status) !== 1) return res.redirect('/pay');

  try {
    const token = req.cookies.token;
    const response = await axios.get(`${BACKEND_URL}/api/user/dashboard`, {
      headers: { Cookie: `token=${token}`, Authorization: `Bearer ${token}` }
    });

    if (response.data.success) {
      return res.render('dashboard', {
        user: response.data.user,
        stats: response.data.stats,
        referralLink: `http://localhost:${PORT}/register?ref=${response.data.user.referral_code}`,
        directReferrals: response.data.directReferrals,
        indirectReferrals: response.data.indirectReferrals,
        transactions: response.data.transactions,
        backendUrl: BACKEND_URL
      });
    }
  } catch (err) {
    console.error('[Frontend Dashboard Error]', err.response?.data || err.message);
  }
  res.redirect('/login');
});

// GET /logout
app.get('/logout', (req, res) => {
  res.clearCookie('token');
  res.redirect('/login');
});

app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`  RAMNET FRONTEND CLIENT RUNNING ON PORT ${PORT}`);
  console.log(`  Access App: http://localhost:${PORT}`);
  console.log(`=======================================================`);
});
