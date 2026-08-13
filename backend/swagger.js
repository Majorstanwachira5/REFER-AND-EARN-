const swaggerJSDoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Refer & Earn More (RamNet) API Specification',
      version: '2.0.0',
      description: 'Production-ready REST API for the Refer & Earn More 2-Tier Referral Earning System. Includes user authentication, Paystack ₦250 payment verification, Level 1 & Level 2 commission distributions, Agent dashboard statistics, and Admin platform analytics.',
      contact: {
        name: 'RamNet Engineering Team',
        email: 'api@ramnet.com'
      }
    },
    servers: [
      {
        url: 'http://localhost:8080',
        description: 'Local API Server (Port 8080)'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter your JWT token'
        },
        cookieAuth: {
          type: 'apiKey',
          in: 'cookie',
          name: 'token',
          description: 'Session cookie'
        }
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            name: { type: 'string', example: 'John Doe' },
            email: { type: 'string', example: 'agent@example.com' },
            role: { type: 'string', example: 'agent' },
            referral_code: { type: 'string', example: 'RAM8X92K' },
            wallet_balance: { type: 'number', example: 150.00 },
            paid_status: { type: 'integer', example: 1 }
          }
        },
        Transaction: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 101 },
            user_id: { type: 'integer', example: 1 },
            amount: { type: 'number', example: 100.00 },
            type: { type: 'string', example: 'credit' },
            description: { type: 'string', example: 'Direct Referral Bonus (Level 1) from Jane Smith' },
            created_at: { type: 'string', example: '2026-08-13T14:00:00Z' }
          }
        },
        PlatformStats: {
          type: 'object',
          properties: {
            totalAgents: { type: 'integer', example: 50 },
            paidAgents: { type: 'integer', example: 40 },
            unpaidAgents: { type: 'integer', example: 10 },
            totalPlatformRevenue: { type: 'number', example: 10000.00 },
            totalCommissionsPaid: { type: 'number', example: 4500.00 },
            companyNetMargin: { type: 'number', example: 5500.00 }
          }
        }
      }
    }
  },
  apis: ['./backend/routes/*.js', './routes/*.js']
};

const swaggerSpec = swaggerJSDoc(options);

function setupSwagger(app) {
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customCss: '.swagger-ui .topbar { background-color: #0a2540; border-bottom: 2px solid #f5a623; } .swagger-ui .topbar a { content: url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 64 64\' width=\'40\'><circle cx=\'32\' cy=\'32\' r=\'30\' fill=\'%23f5a623\'/><text x=\'50%\' y=\'55%\' dominant-baseline=\'middle\' text-anchor=\'middle\' font-weight=\'bold\' fill=\'%230a2540\'>RAM</text></svg>"); }',
    customSiteTitle: 'RamNet API Documentation & Swagger UI'
  }));

  app.get('/api-docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });

  console.log('[Swagger] API Documentation exposed at http://localhost:8080/api-docs');
}

module.exports = setupSwagger;
