# 🍳 Breakfast Ordering Platform — Frontend

React + Vite frontend for the Breakfast Ordering Platform.

## Setup

```bash
npm install
cp .env.example .env   # then edit with your keys
npm run dev
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `VITE_API_URL` | Backend API URL (default: http://localhost:3000) | Yes |
| `VITE_GOOGLE_MAPS_API_KEY` | Google Maps API key for restaurant picker | No |

## Pages

- `/` — Home page (create session)
- `/join/:sessionId` — Join and place order
- `/host/:sessionId` — Host dashboard
- `/admin` — Admin panel (manage restaurants & menus)

## Features

- 🍽️ Restaurant management with Google Maps place picker
- 🤖 AI-powered menu extraction from images
- 📋 Menu catalog with search and variant pricing
- 💰 Automatic cost splitting with delivery fee
- 💳 InstaPay payment tracking
- 📱 Responsive design with dark glass-morphism theme
