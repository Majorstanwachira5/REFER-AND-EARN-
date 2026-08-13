require('dotenv').config();
const { spawn } = require('child_process');
const path = require('path');

console.log(`=======================================================`);
console.log(`  REFER & EARN MORE (RAMNET) - MULTI-SERVICE SYSTEM   `);
console.log(`=======================================================`);
console.log(`  Starting 3 Services Concurrently:`);
console.log(`   1. Backend API & Swagger Docs -> http://localhost:8080/api-docs`);
console.log(`   2. Frontend Client Application -> http://localhost:3000`);
console.log(`   3. Admin Management Portal     -> http://localhost:3001`);
console.log(`=======================================================\n`);

// Require and launch Backend API on Port 8080
try {
  require('./backend/server');
} catch (err) {
  console.error('[Root Launcher] Error launching Backend API:', err);
}

// Require and launch Agent Frontend on Port 3000
try {
  require('./frontend/server');
} catch (err) {
  console.error('[Root Launcher] Error launching Agent Frontend:', err);
}

// Require and launch Admin Portal on Port 3001
try {
  require('./admin/server');
} catch (err) {
  console.error('[Root Launcher] Error launching Admin Portal:', err);
}
