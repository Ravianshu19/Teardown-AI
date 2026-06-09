# TeardownAI — Hosted Version

## Why a server is needed
The Anthropic API requires an `x-api-key` header and `anthropic-version` header.
Browsers block both as unsafe cross-origin headers (CORS), so the analysis
always fails from a plain HTML file. This server acts as a proxy — the browser
calls `/api/analyze`, the server adds your API key and forwards to Anthropic.

## Project structure
```
teardownai-hosted/
├── server.js          ← Express proxy server
├── package.json
├── .env.example       ← Copy to .env and add your key
└── public/
    └── index.html     ← The full TeardownAI frontend
```

## Local setup (5 minutes)
```bash
# 1. Install dependencies
npm install

# 2. Add your Anthropic API key
cp .env.example .env
# Edit .env and set: ANTHROPIC_API_KEY=sk-ant-api03-...

# 3. Run
node server.js
# Open http://localhost:3000
```

## Deploy to Railway (recommended — free tier available)
1. Push this folder to a GitHub repo
2. Go to railway.app → New Project → Deploy from GitHub
3. Add environment variable: ANTHROPIC_API_KEY = your key
4. Railway auto-detects Node and runs `npm start`
5. Done — you get a live URL like `https://teardownai.railway.app`

## Deploy to Render (also free)
1. Push to GitHub
2. Go to render.com → New Web Service → Connect repo
3. Build command: `npm install`
4. Start command: `node server.js`
5. Add env var: ANTHROPIC_API_KEY
6. Deploy

## Deploy to Vercel (serverless)
Vercel needs a slightly different setup for serverless functions.
Use Railway or Render for the simpler Express approach above.

## Get your Anthropic API key
1. Go to console.anthropic.com
2. Sign up / log in
3. Go to API Keys → Create Key
4. Copy the key starting with `sk-ant-api03-...`

## Cost estimate
- Claude Haiku (used here): ~$0.00025 per 1K input tokens
- A full teardown uses ~1,500 tokens input + ~1,200 output
- Cost per teardown: ~$0.0006 (less than 0.1 cent)
- 1,000 teardowns/month ≈ $0.60
