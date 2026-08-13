require('dotenv').config();
const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');
const axios = require('axios');

const app = express();
const PORT = process.env.ADMIN_PORT || 3001;
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8080';

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, '..', 'public')));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Fetch Admin Profile middleware
app.use(async (req, res, next) => {
  const token = req.cookies?.token;
  res.locals.adminUser = null;
  res.locals.backendUrl = BACKEND_URL;
  if (token) {
    try {
      const response = await axios.get(`${BACKEND_URL}/api/auth/me`, {
        headers: { Cookie: `token=${token}`, Authorization: `Bearer ${token}` }
      });
      if (response.data.success && response.data.user.role === 'admin') {
        req.adminUser = response.data.user;
        res.locals.adminUser = response.data.user;
      }
    } catch (err) {
      res.clearCookie('token');
    }
  }
  next();
});

// GET / - Admin Root
app.get('/', (req, res) => {
  if (req.adminUser) {
    return res.redirect('/dashboard');
  }
  res.render('login', { error: null });
});

app.get('/login', (req, res) => {
  if (req.adminUser) return res.redirect('/dashboard');
  res.render('login', { error: null });
});

// POST /login - Forward to Backend API
app.post('/login', async (req, res) => {
  try {
    const response = await axios.post(`${BACKEND_URL}/api/auth/login`, req.body);
    if (response.data.success) {
      if (response.data.user.role !== 'admin') {
        return res.render('login', { error: 'Access Denied: You must be a RAM Administrator to access this portal.' });
      }
      res.cookie('token', response.data.token, { httpOnly: true });
      return res.redirect('/dashboard');
    }
    return res.render('login', { error: response.data.message });
  } catch (err) {
    const msg = err.response?.data?.message || 'Admin login failed.';
    return res.render('login', { error: msg });
  }
});

// GET /dashboard - Executive Admin Dashboard
app.get('/dashboard', async (req, res) => {
  if (!req.adminUser) return res.redirect('/login');

  try {
    const token = req.cookies.token;
    const headers = { Cookie: `token=${token}`, Authorization: `Bearer ${token}` };

    const [statsRes, usersRes, txRes] = await Promise.all([
      axios.get(`${BACKEND_URL}/api/admin/stats`, { headers }),
      axios.get(`${BACKEND_URL}/api/admin/users`, { headers }),
      axios.get(`${BACKEND_URL}/api/admin/transactions`, { headers })
    ]);

    return res.render('dashboard', {
      adminUser: req.adminUser,
      stats: statsRes.data.stats,
      users: usersRes.data.users,
      transactions: txRes.data.transactions,
      backendUrl: BACKEND_URL
    });
  } catch (err) {
    console.error('[Admin Dashboard Error]', err.response?.data || err.message);
    res.redirect('/login');
  }
});

// GET /logout
app.get('/logout', (req, res) => {
  res.clearCookie('token');
  res.redirect('/login');
});

app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`  RAMNET ADMIN PORTAL RUNNING ON PORT ${PORT}`);
  console.log(`  Access Admin Portal: http://localhost:${PORT}`);
  console.log(`=======================================================`);
});
