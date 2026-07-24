<div align="center">
  <h1>🎮 LootRadar</h1>
  <p><i>The ultimate, zero-build web dashboard for tracking free games and limited-time deals across the multiverse. Runs entirely in your browser!</i></p>
  
  <a href="https://gamelootradar.us.ci/">
    <img src="https://img.shields.io/badge/🔥_LIVE_APP-gamelootradar.us.ci-FF416C?style=for-the-badge&logo=cloudflare&logoColor=white" alt="Live View">
  </a>
  
  <br>
  
  <img src="https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white" alt="HTML5">
  <img src="https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white" alt="Tailwind CSS">
  <img src="https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black" alt="Vanilla JS">
  <img src="https://img.shields.io/badge/Zero--Build-HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white" alt="Zero Build">
  
  <br>
  
  <img src="https://img.shields.io/badge/PWA-5A0FC8?style=for-the-badge&logo=pwa&logoColor=white" alt="PWA Ready">
  <img src="https://img.shields.io/badge/Cloudflare-F38020?style=for-the-badge&logo=cloudflare&logoColor=white" alt="Cloudflare">
  <img src="https://img.shields.io/badge/Workers-API-orange?style=for-the-badge&logo=cloudflare&logoColor=white" alt="Cloudflare Workers">
  <img src="https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white" alt="CSS3">
  <img src="https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge" alt="License">

  <br><br>

  <img src="https://img.shields.io/github/last-commit/yikchun1234/loot-game-radar?style=for-the-badge" alt="Last Commit">
  <img src="https://img.shields.io/github/repo-size/yikchun1234/loot-game-radar?style=for-the-badge" alt="Repo Size">
  
</div>

---

### ✨ Features
* 🌍 **Universal Tracking:** Automatically scrapes and aggregates free game deals from Steam, Epic Games, Prime Gaming, GOG, Ubisoft, iOS, Android, and Consoles. Powered by **Cloudflare Worker API** with multi-source fallback: Reddit RSS → AppSales (Android) / CheapCharts (iOS). Features **ID-based deduplication** with persistent publish date tracking across data sources!
* 💰 **My Loot Library & Wallet:** Keep a permanent record of every game you claim. The app automatically calculates your **Total Lifetime Savings**. Manage your library with precision by removing expired, failed, or paywalled games (featuring custom visual UI states) to keep your financial stats 100% accurate, with full support to reclaim them later!
* 📊 **Loot Analytics Dashboard:** A zero-dependency, 100% Vanilla JS and SVG-powered statistics dashboard. Features interactive Donut Charts for platform breakdowns, monthly activity Bar Charts, and a Robinhood-style Line Chart with an interactive date scrubber to track your lifetime wealth generation.
* 🗜️ **Extreme Storage Optimization:** Utilizes **LZ-String UTF-16 Compression** directly on local storage, shrinking save data by up to 90%. This bypasses standard 5MB browser limits, allowing users to effortlessly store over **100,000+ items** locally. Features seamless background "Auto-Healing" to upgrade legacy V1 saves without data loss.
* ☁️ **Cloud Sync (PIN Transfer):** Securely migrate your claimed games library, deleted item history, and total savings to another device in seconds using a 15-minute 5-digit PIN (Powered by Cloudflare Workers & highly-compressed payloads).
* 📱 **Native App Experience & Fluid UI:** Fully installable as a PWA on iOS and Android. Features mobile-native interactions like **Pull-to-Refresh**, context-aware **Scroll-to-Top**, and desktop-optimized **Mouse Drag-to-Scroll** navigation. Wrapped in a slick glassmorphism UI with flawless Z-index sliding animations.
* 🌐 **International Support (9 Languages):** Fully localized in English, 简体中文, Español, Français, Deutsch, Русский, 日本語, 한국어, and Português (Including dynamic translations for all charts and analytics).
* 🛡️ **Advanced Security:** Built-in Domain Lockdown and Anti-Debugger/Inspect Element blockers to prevent unauthorized scraping or cloning of the app.
* 🌓 **Dynamic Theming:** Seamless Light and Dark mode toggling.
* ⚡ **Lightning Fast Performance:** Highly optimized DOM rendering uses Document Fragments, **Background Pre-rendering**, and decoupled CSS transitions to instantly load, filter, and render hundreds of games with zero layout thrashing or lag.

---

### 🚀 Zero-Build Setup

No Node.js, Webpack, or Vite required! The entire application runs natively in a **single `index.html` file**.

1. Clone or download this repository.
2. Open `index.html` directly in any modern web browser.

> [!WARNING]
> **Domain Security Lock:** For security purposes, this application is domain-locked. If you wish to host it yourself, you must add your domain to the `allowedDomains` array at the very top of the `index.html` file, otherwise it will trigger a Security Alert and halt execution.

---

### 📱 Installing on your Phone (PWA)

You can install LootRadar to use exactly like a native mobile app!

* **iOS (Safari):** Tap the **Share** icon at the bottom of the screen and select **"Add to Home Screen"**.
* **Android (Chrome):** Tap the browser menu (three dots) and select **"Install App"** or **"Add to Home screen"**.

---

### 📖 How to Use

1. **Scan for Loot:** Open the app to trigger an automatic scan of current free games. Use the platform filters at the top to narrow down your search.
2. **Claim Games:** Tap the **Claim Now** button on any game card to be taken directly to the store page.
3. **Track Savings:** Once claimed, the game moves to your "Loot Library" and its original price is added to your total savings wallet.
4. **Device Sync:** Tap the Disclaimer/Info icon (ℹ️) to access the Device Sync menu. Generate an Export PIN on your old device, and enter it on your new device to instantly transfer your library!

---

### 📄 License & Usage

* **Non-Commercial Use Only:** This project is strictly for personal, educational, and non-commercial use. You may not use this application, its source code, or its scraping logic for any business, commercial, or monetized purposes.
* **Forks & Attribution:** You are welcome to fork, modify, and experiment with this code for your own personal projects! However, if you share your forked version, **you must provide proper citation** to the original author (Amos) and include a direct link back to this repository.

---

### 🏗️ Architecture

```mermaid
flowchart LR
    subgraph Worker["☁️ Cloudflare Worker API"]
        direction TB
        R["🔴 Reddit RSS"]
        A["📱 AppSales"]
        C["🍎 CheapCharts"]
        G["🎮 GamerPower"]
        R -->|fallback| A
        R -->|fallback| C
    end

    subgraph Frontend["🖥️ Frontend (index.html)"]
        direction TB
        D["🔄 ID Deduplication"]
        S["📊 Sort: Date → Price"]
        L["🗜️ LZ-String Compress"]
        D --> S --> L
    end

    subgraph Storage["💾 localStorage (compressed)"]
        direction TB
        CG["✅ claimed_games"]
        PD["📅 publish_dates"]
        DH["🗑️ deleted_history"]
    end

    Worker -->|JSON data| Frontend
    Frontend -->|save| Storage

    style Worker fill:#f38020,color:#fff,stroke:#333
    style Frontend fill:#38bdf8,color:#fff,stroke:#333
    style Storage fill:#22c55e,color:#fff,stroke:#333
```

---

### ⚖️ Disclaimer

Games are fetched via third-party APIs and community web scraping (Reddit RSS, AppSales.net, CheapCharts, GamerPower). Offers are time-limited. Always verify that the final price on the store page is "Free" or "0.00" before confirming any purchase. LootRadar is an independent tracker and is not affiliated with Steam, Epic Games, Apple, Google, or other listed platforms.

---

<div align="center">
  <b>Designed and Developed by Amos</b>
  <br>
  <sub><i>Tracking freebies so you don't have to.</i></sub>
</div>
