const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();
const axios = require('axios'); // Diperlukan untuk fetchPublicKey
const jwt = require('jsonwebtoken'); // Diperlukan untuk verifyToken

// Variabel global untuk menyimpan public key
let publicKey = null;

/**
 * Mengambil public key dari rest-api.
 * Akan mencoba lagi setiap 5 detik jika gagal.
 */
async function fetchPublicKey() {
  try {
    const restApiUrl = process.env.REST_API_URL || 'http://localhost:3001';
    const response = await axios.get(`${restApiUrl}/api/users/public-key`);
    publicKey = response.data;
    console.log('Public key fetched successfully from rest-api');
  } catch (error) {
    console.error(`Failed to fetch public key from ${process.env.REST_API_URL}/api/users/public-key. Retrying...`, error.message);
    // Coba lagi setelah 5 detik
    setTimeout(fetchPublicKey, 5000); 
  }
}

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet());

// CORS configuration
app.use(cors({
  origin: [
    'http://localhost:3002', // Frontend
    'http://localhost:3000', // Gateway itself
    'http://frontend-app:3002' // Docker container name
  ],
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use(limiter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    services: {
      'rest-api': process.env.REST_API_URL || 'http://localhost:3001',
      'graphql-api': process.env.GRAPHQL_API_URL || 'http://localhost:4000'
    },
    publicKeyFetched: !!publicKey // Tambahkan status apakah kunci sudah diambil
  });
});

/**
 * Middleware untuk memverifikasi JWT
 */
const verifyToken = (req, res, next) => {
  if (!publicKey) {
    return res.status(503).json({ error: 'Public key not available. Service starting up.' });
  }

  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1]; // Bearer <token>

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, publicKey, { algorithms: ['RS256'] });
    req.user = decoded; // Tambahkan payload user ke request
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
};

// Proxy configuration for REST API
// Rute ini tetap PUBLIK untuk login, registrasi, dan pengambilan public key
const restApiProxy = createProxyMiddleware({
  target: process.env.REST_API_URL || 'http://localhost:3001',
  changeOrigin: true,
  pathRewrite: {
    '^/api': '/api', // Keep the /api prefix
  },
  onError: (err, req, res) => {
    console.error('REST API Proxy Error:', err.message);
    res.status(500).json({ 
      error: 'REST API service unavailable',
      message: err.message 
    });
  },
  onProxyReq: (proxyReq, req, res) => {
    console.log(`[REST API] ${req.method} ${req.url} -> ${proxyReq.path}`);
  }
});

// Proxy configuration for GraphQL API
// Rute ini DIPROTEKSI dan meneruskan info user
const graphqlApiProxy = createProxyMiddleware({
  target: process.env.GRAPHQL_API_URL || 'http://localhost:4000',
  changeOrigin: true,
  ws: true, // Enable WebSocket proxying for subscriptions
  onError: (err, req, res) => {
    console.error('GraphQL API Proxy Error:', err.message);
    res.status(500).json({ 
      error: 'GraphQL API service unavailable',
      message: err.message 
    });
  },
  onProxyReq: (proxyReq, req, res) => {
    console.log(`[GraphQL API] ${req.method} ${req.url} -> ${proxyReq.path}`);
    // Forward payload user yang sudah diverifikasi ke service graphql
    if (req.user) {
      proxyReq.setHeader('x-user-payload', JSON.stringify(req.user));
    }
  }
});

// Apply proxies
// Rute /api (REST) bersifat publik
app.use('/api', restApiProxy); 
// Rute /graphql (GraphQL) dilindungi oleh verifyToken
app.use('/graphql', verifyToken, graphqlApiProxy);

// Catch-all route
app.get('*', (req, res) => {
  res.status(404).json({ 
    error: 'Route not found',
    availableRoutes: [
      '/health',
      '/api/* (proxied to REST API - Public)',
      '/graphql (proxied to GraphQL API - Protected)'
    ]
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Gateway Error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// Panggil fetchPublicKey() saat startup.
// Ini akan berjalan di background dan mencoba lagi jika gagal.
fetchPublicKey();

const server = app.listen(PORT, () => {
  console.log(`🚀 API Gateway running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🔄 Proxying /api/* to: ${process.env.REST_API_URL || 'http://localhost:3001'}`);
  console.log(`🔄 Proxying /graphql to: ${process.env.GRAPHQL_API_URL || 'http://localhost:4000'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
  });
});

module.exports = app;