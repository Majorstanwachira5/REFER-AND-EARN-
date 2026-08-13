require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const setupSwagger = require('./swagger');

// Import Database & Routes
const db = require('./config/database');
const authRoutes = require('./routes/authRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const userRoutes = require('./routes/userRoutes');
const adminRoutes = require('./routes/adminRoutes');

const app = express();
const PORT = process.env.BACKEND_PORT || 8080;

// CORS configuration for multi-port setup (3000 Agent App & 3001 Admin Portal)
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001', 'http://127.0.0.1:3000', 'http://127.0.0.1:3001'],
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Setup Swagger OpenAPI Documentation
setupSwagger(app);

// API Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    service: 'Refer & Earn More (RamNet) Backend API',
    port: PORT,
    timestamp: new Date().toISOString()
  });
});

// Register API Routes
app.use('/api/auth', authRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/user', userRoutes);
app.use('/api/admin', adminRoutes);

// Root route redirect to Swagger UI
app.get('/', (req, res) => {
  res.redirect('/api-docs');
});

// 404 API Handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'API endpoint not found (404).' });
});

// Start API Server
app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`  RAMNET BACKEND API SERVER RUNNING ON PORT ${PORT}`);
  console.log(`  Swagger UI Docs: http://localhost:${PORT}/api-docs`);
  console.log(`=======================================================`);
});
