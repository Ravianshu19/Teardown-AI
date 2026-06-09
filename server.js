/**
 * TeardownAI — Proxy Server
 * Sits between the browser and Anthropic API to handle CORS + API key injection.
 * Deploy on: Railway, Render, Fly.io, Vercel (serverless), or any Node host.
 *
 * Setup:
 *   npm install
 *   ANTHROPIC_API_KEY=sk-ant-... node server.js
 */

const express  = require('express');
const cors     = require('cors');
const fetch    = require('node-fetch');
const path     = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;
const KEY      = process.env.ANTHROPIC_API_KEY || '';
const RZP_KEY  = process.env.RAZORPAY_KEY_ID     || 'rzp_test_SyRjWkQSmF4vn4';   // from dashboard.razorpay.com → Settings → API Keys
const RZP_SEC  = process.env.RAZORPAY_KEY_SECRET || '369647Ya8uijAO1Z5gxbI2Nl';   // keep secret — never send to browser

if (!KEY) {
  console.warn('⚠️  ANTHROPIC_API_KEY not set — /api/analyze will return 500');
}

// Allow requests from any origin (your hosted frontend)
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Serve the frontend HTML
app.use(express.static(path.join(__dirname, 'public')));

// ── Proxy endpoint ──
app.post('/api/analyze', async (req, res) => {
  if (!KEY) return res.status(500).json({ error: 'API key not configured on server.' });

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method:  'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(req.body),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json(data);
    }
    res.json(data);

  } catch (err) {
    console.error('Proxy error:', err.message);
    res.status(500).json({ error: err.message || 'Proxy error' });
  }
});

// Verify Razorpay payment server-side (call this from your frontend after payment success)
app.post('/api/verify-payment', (req, res) => {
  const crypto = require('crypto');
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
  const body = razorpay_order_id + '|' + razorpay_payment_id;
  const expected = crypto.createHmac('sha256', RZP_SEC).update(body).digest('hex');
  if (expected === razorpay_signature) {
    // Payment is verified — activate the user's subscription in your database here
    res.json({ verified: true, payment_id: razorpay_payment_id });
  } else {
    res.status(400).json({ verified: false, error: 'Signature mismatch' });
  }
});

// Health check
app.get('/health', (_, res) => res.json({ status: 'ok', razorpay: !!RZP_KEY, anthropic: !!KEY }));

/* Always return JSON errors, never HTML */
app.use((err, req, res, next) => {
  res.status(500).json({ error: err.message || 'Internal error' });
});

app.listen(PORT, () => {
  console.log(`TeardownAI proxy running on http://localhost:${PORT}`);
  console.log(`Anthropic key: ${KEY ? 'SET ✓' : 'MISSING ✗ — set ANTHROPIC_API_KEY in .env'}`);
  console.log(`Razorpay key:  ${RZP_KEY ? 'SET ✓' : 'MISSING ✗ — set RAZORPAY_KEY_ID in .env'}`);
});
