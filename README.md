# POLARIS: The Earth Information Jukebox
> *Translating NASA Earth Observation Data into Real-Time Soundscapes and AI-Guided Narratives*

[![Vercel Deployment](https://img.shields.io/badge/Status-Live%20Production-00F0FF?style=for-the-badge&logo=vercel)](https://polaris-earth-jukebox.vercel.app)
[![NASA Space Apps Challenge 2026](https://img.shields.io/badge/Challenge-Earth%20Information%20Jukebox-F59E0B?style=for-the-badge&logo=nasa)](https://www.spaceappschallenge.org/)
[![Next.js](https://img.shields.io/badge/Tech-Next.js%2016-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![Tone.js](https://img.shields.io/badge/Audio-Tone.js-purple?style=for-the-badge)](https://tonejs.github.io/)

---

## 🚀 Overview
Team **POLARIS** built an interactive web-based "Earth Jukebox" for the **2026 NASA Space Apps Challenge**. It bridges the gap between complex NASA Earth science and multi-sensory public engagement by transforming official NASA Earth Information Center (EIC) visual layers into **real-time musical soundscapes** and **AI-guided scientific narration**. 

Designed with an immersive mission-control aesthetic, POLARIS makes planetary telemetry accessible to blind and low-vision users while offering researchers and educators a brand-new way to listen to our changing planet.

👉 **Live App:** [polaris-earth-jukebox.vercel.app](https://polaris-earth-jukebox.vercel.app)

---

## 🔬 The Problem & Accessibility Gap
NASA’s Earth Information Center provides extraordinary visual insights into global temperatures, ocean currents, and atmospheric phenomena. However:
1. **Visual-Only Exclusion:** Traditional dashboards rely strictly on visual inspection, creating an accessibility barrier for 2.2B+ blind and low-vision individuals.
2. **Cognitive Overload:** Complex multi-gigabyte datasets (like NetCDF files) require expensive local storage and specialized software to interpret.
3. **Missed Patterns:** Auditory processing can often reveal thermal gradients and cyclical anomalies much faster than visual inspection alone.

---

## 🎵 Key Features
* **Zero-Download Data Architecture:** Streams lightweight NASA EIC and GIBS image frames dynamically into the browser without downloading multi-gigabyte files.
* **16-Step Spatial Synthesizer:** Extracts spatial pixel-intensity slices from Earth observations and maps thermal gradients and luminance directly to musical pitch, tempo, and harmonic scales via **Tone.js**.
* **SLM Science Narrator:** Integrates a custom Small Language Model (SLM) backend to generate real-time, plain-language audio briefings and structured JSON telemetry descriptions.
* **Curated NASA Datasets:** Seamlessly switch between Sea Surface Currents & Temperature, DYAMOND Global CO2, GEOS Aerosols, and Decadal Night Lights (2012–2023).

---

## 🛠️ Tech Stack
* **Frontend & Framework:** Next.js (App Router, Turbopack), TypeScript, Tailwind CSS
* **Audio Engine:** A custom-trained Qwen 2.5B model, trained on 900 custom datasets curated from 9 NASA datasets, integrated with Tone.js.
* **Data Sources:** NASA Earth Information Center (EIC), NASA GIBS (Global Imagery Browse Services)
* **Deployment:** Vercel

---

## ⚙️ Getting Started (Local Development)

Clone the repository and run the development server locally:

```bash
# Clone the repository
git clone [https://github.com/LikhinS/earth-information-jukebox.git](https://github.com/LikhinS/earth-information-jukebox.git)

# Navigate to project directory
cd earth-information-jukebox

# Install dependencies
npm install

# Run the development server
npm run dev
```

## 🏆 NASA Space Apps Challenge Alignment

* **POLARIS** directly addresses "The Earth Information Jukebox" challenge by turning planetary data streams into a creative, educational, and fully accessible auditory experience.

---

## 👥 Team **POLARIS**

* **Likhin S** — Team Lead, Documentation & Pitch Presentation
* **Raihan Shiras** - Co-led frontend development and UI/UX design, focusing on visual styling, aesthetics, interface enhancements, and creating an engaging, visually appealing user experience.
* **Melvin Biju** - Co-led frontend development and UI/UX design, focusing on overall layout structure, component arrangement, page organization, and content flow to ensure a clean and intuitive user experience.
* **Febin Baiju** - Engineered the zero-download NASA GIBS WMTS client-side tiling pipeline across 9 active observation layers, the custom 3D orthographic globe renderer with inverse raycasting and offline fallbacks, and the high-contrast mission-control telemetry HUD featuring the 16-step dot-matrix sequencer and WebGL2 hardware-styled controls.
* **Advait Varma** — Engineered the NASA GIBS offscreen canvas telemetry extractor (`gibsOffscreen.ts`), SLM JSON schema/fallback pipeline (`smlPipeline.ts`), `/api/sonify` route, and foundational 16-step Tone.js sequencer.
* **Rohit Fernantez** — Deployed and tuned the GCP `polaris-slm` (Qwen-2.5-3B) inference backend, hardened API concurrency/security, and expanded the Tone.js DSP synthesis chain with pitch sanitization and memory management.
* 
---

## 📄 License
*Released under the MIT License. Built with 💙 for NASA Space Apps 2026*

---
