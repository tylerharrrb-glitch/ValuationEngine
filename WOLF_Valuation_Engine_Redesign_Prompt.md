
# ═══════════════════════════════════════════════════
# PROMPT 1 — WOLF VALUATION ENGINE
# COPY EVERYTHING BELOW UNTIL THE DIVIDER
# ═══════════════════════════════════════════════════

You are redesigning the WOLF Valuation Engine — a full-stack equity valuation platform featuring DCF analysis, Monte Carlo simulations, and Comparable Company Analysis (CCA). The platform already exists and works. Your job is to completely redesign its visual interface to match an exact design system — without breaking any existing functionality. Every calculation, every input, every output must be preserved. Only the visual layer changes.

---

## MISSION

The designer of this platform also built a personal portfolio website at ahmedwael.pages.dev. The portfolio has a world-class dark financial terminal aesthetic. This platform must look like it belongs to the same brand universe — as if it was built by the same person, on the same day, to the same standard. When someone visits both sites, they should feel a seamless visual continuity.

---

## DESIGN SYSTEM — COPY THESE EXACTLY

### CSS Variables (paste into :root)
```css
:root {
  --bg-primary:    #0A0E17;
  --bg-secondary:  #0F1623;
  --bg-card:       #141B2D;
  --accent-gold:   #C9A84C;
  --accent-blue:   #3B82F6;
  --accent-glow:   #3B82F620;
  --text-primary:  #F0F4FF;
  --text-secondary:#8892A4;
  --text-muted:    #4A5568;
  --border:        #1E2D45;
  --gold-glow:     #C9A84C15;
  --ease: cubic-bezier(.4, 0, .2, 1);
  --ff-display: 'Playfair Display', serif;
  --ff-mono:    'IBM Plex Mono', monospace;
  --ff-body:    'Sora', sans-serif;
}
```

### Google Fonts (paste in <head>)
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=Playfair+Display:wght@700;900&family=Sora:wght@300;400;600&display=swap" rel="stylesheet">
```

### Body background + grain noise overlay
```css
body {
  background: var(--bg-primary);
  color: var(--text-primary);
  font-family: var(--ff-body);
  line-height: 1.7;
  overflow-x: hidden;
}
body::before {
  content: '';
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 9999;
  opacity: .035;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")
}
```

---

## COMPONENT SPECIFICATIONS

### Navbar
Fixed top, height 64px, glass morphism:
```css
.navbar {
  position: fixed; top: 0; left: 0; width: 100%;
  z-index: 1000;
  background: rgba(10,14,23,.72);
  backdrop-filter: blur(18px);
  border-bottom: 1px solid rgba(30,45,69,.5);
}
```
- Logo: "WOLF" in Playfair Display font-weight 700, color var(--accent-gold)
- Subtitle next to logo: "Valuation Engine" in IBM Plex Mono, small, var(--text-muted)
- Nav links: IBM Plex Mono, .78rem, var(--text-secondary), gold underline draw animation on hover (scaleX from 0 to 1, transform-origin right → left)
- Right side: a small "← Back to Portfolio" link in mono text pointing to https://ahmedwael.pages.dev/

### Page Header / Hero Area
Below the navbar, a dark hero strip:
```
background: var(--bg-secondary);
border-bottom: 1px solid var(--border);
padding: 48px 0 40px;
```
Content inside:
- Mono label above title: "EQUITY VALUATION · INSTITUTIONAL GRADE" — font-family mono, .75rem, letter-spacing 3px, uppercase, color var(--accent-gold)
- Main title: "WOLF Valuation Engine" in Playfair Display 900, clamp(2rem,5vw,3rem), text-primary
- Subtitle: "DCF Analysis · Monte Carlo Simulation · Comparable Company Analysis" in IBM Plex Mono, var(--text-secondary)
- Three stat badges in a row below: "3 Valuation Methods", "Automated PDF/Excel Output", "Institutional-Grade Accuracy" — each as a pill badge (border: 1px solid var(--border), background: var(--bg-card), mono font, .72rem)
- Subtle radial glow top-right: position absolute, background radial-gradient(circle, var(--accent-glow) 0%, transparent 70%), pointer-events none

### Section Labels
Every major section gets a label above its title:
```css
.section-label {
  font-family: var(--ff-mono);
  font-size: .75rem;
  letter-spacing: 3px;
  text-transform: uppercase;
  color: var(--accent-gold);
  margin-bottom: 12px;
  display: block;
}
```

### Section Titles
```css
.section-title {
  font-family: var(--ff-display);
  font-weight: 900;
  font-size: clamp(1.5rem,3vw,2rem);
  margin-bottom: 28px;
  line-height: 1.2;
}
```

### Cards (all input panels, result panels, output blocks)
```css
.card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 32px;
  transition: border-color .35s var(--ease);
}
.card:hover { border-color: rgba(201,168,76,.35); }
.card.featured { border-left: 3px solid var(--accent-gold); }
```

### Form Inputs
All text inputs, number inputs, selects:
```css
input, select, textarea {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 4px;
  color: var(--text-primary);
  font-family: var(--ff-mono);
  font-size: .85rem;
  padding: 10px 14px;
  width: 100%;
  transition: border-color .3s var(--ease);
}
input:focus, select:focus {
  outline: none;
  border-color: var(--accent-gold);
  box-shadow: 0 0 0 3px var(--gold-glow);
}
```
Input labels: IBM Plex Mono, .75rem, var(--text-secondary), uppercase, letter-spacing 1px, margin-bottom 6px

### Buttons
Primary action (Calculate / Run / Generate):
```css
.btn-gold {
  background: var(--accent-gold);
  color: var(--bg-primary);
  font-family: var(--ff-mono);
  font-size: .82rem;
  font-weight: 500;
  padding: 12px 28px;
  border-radius: 4px;
  border: none;
  cursor: pointer;
  transition: all .35s var(--ease);
  letter-spacing: .5px;
}
.btn-gold:hover {
  background: #d4b35a;
  box-shadow: 0 0 24px var(--gold-glow);
}
```
Secondary (Export PDF / Export Excel / Reset):
```css
.btn-outline {
  background: transparent;
  color: var(--text-primary);
  border: 1px solid var(--border);
  font-family: var(--ff-mono);
  font-size: .82rem;
  padding: 12px 28px;
  border-radius: 4px;
  cursor: pointer;
  transition: all .35s var(--ease);
}
.btn-outline:hover {
  border-color: var(--accent-gold);
  color: var(--accent-gold);
}
```

### Tags (method labels, module labels)
```css
.tag {
  font-family: var(--ff-mono);
  font-size: .7rem;
  color: var(--accent-blue);
  background: rgba(59,130,246,.08);
  padding: 4px 12px;
  border-radius: 4px;
  border: 1px solid rgba(59,130,246,.15);
}
```

### Result / Output Numbers
All calculated output values (valuation numbers, share prices, ranges):
- The number itself: Playfair Display 900, clamp(1.6rem,3vw,2.4rem), color var(--accent-gold)
- The label below it: IBM Plex Mono, .72rem, var(--text-secondary), letter-spacing .5px
- Wrap in a stat card: background var(--bg-secondary), border 1px solid var(--border), border-radius 8px, padding 24px, text-align center

### Section Dividers
Between major sections:
```css
.section-divider {
  height: 1px;
  background: var(--accent-gold);
  opacity: .3;
  max-width: 1100px;
  margin: 0 auto;
}
```

### Scroll Reveal Animation
```css
.reveal {
  opacity: 0;
  transform: translateY(40px);
  transition: opacity .7s var(--ease), transform .7s var(--ease);
}
.reveal.visible {
  opacity: 1;
  transform: translateY(0);
}
```
```javascript
const observer = new IntersectionObserver((entries) => {
  entries.forEach(e => { if(e.isIntersecting) { e.target.classList.add('visible'); } });
}, { threshold: 0.1 });
document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
```
Wrap every major section in a div with class="reveal".

### Charts & Graphs
All chart/graph containers:
- Background: var(--bg-card)
- Border: 1px solid var(--border), border-radius 8px
- Chart lines/bars: use var(--accent-gold) as the primary data color, var(--accent-blue) as secondary
- Chart grid lines: var(--border) at low opacity
- Chart labels/axes: IBM Plex Mono, var(--text-muted), .72rem
- Chart title above chart: IBM Plex Mono, .75rem, uppercase, letter-spacing 2px, var(--accent-gold)
- If using Chart.js: set background to transparent, gridColor to '#1E2D45', tickColor to '#8892A4', font to IBM Plex Mono

### Module/Method Tabs or Switcher
If the engine has tabs for DCF / Monte Carlo / CCA:
- Tab bar: background var(--bg-secondary), border-bottom 1px solid var(--border)
- Inactive tab: IBM Plex Mono, .78rem, var(--text-muted), padding 12px 24px
- Active tab: color var(--text-primary), border-bottom 2px solid var(--accent-gold), background transparent
- Hover tab: color var(--text-secondary)

### Live Badge (for the "Live" status indicator)
```css
.badge-live {
  display: inline-flex; align-items: center; gap: 6px;
  font-family: var(--ff-mono); font-size: .65rem;
  letter-spacing: 1px; text-transform: uppercase;
  color: #4ade80; background: rgba(74,222,128,.1);
  padding: 4px 12px; border-radius: 20px;
  border: 1px solid rgba(74,222,128,.25);
}
.badge-live .dot {
  width: 6px; height: 6px; border-radius: 50%;
  background: #4ade80;
  animation: pulse 2s infinite;
}
@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
```

### Footer
```html
<footer style="padding:40px 0; text-align:center; border-top:1px solid var(--border);">
  <p style="font-family:var(--ff-mono);font-size:.78rem;color:var(--text-secondary);">
    WOLF Valuation Engine · Built by <a href="https://ahmedwael.pages.dev" style="color:var(--accent-gold);">Ahmed Wael Metwally</a> · Cairo, Egypt
  </p>
  <p style="font-family:var(--ff-mono);font-size:.68rem;color:var(--text-muted);margin-top:8px;">
    Institutional-grade equity analysis · FMVA® Certified
  </p>
</footer>
```

---

## LAYOUT STRUCTURE TO IMPLEMENT

Structure the entire page in this order:

1. **Navbar** (fixed, glass)
2. **Hero Strip** (platform title, subtitle, 3 stat badges)
3. **Section Divider**
4. **Input Panel** (all user inputs — company data, assumptions, parameters) — class="card featured reveal", section-label above: "01 — INPUTS", section-title: "Valuation Parameters"
5. **Section Divider**
6. **DCF Analysis Section** — class="reveal", section-label: "02 — DCF ANALYSIS", all DCF outputs as stat cards + charts
7. **Section Divider**
8. **Monte Carlo Section** — class="reveal", section-label: "03 — MONTE CARLO", distribution chart + output range
9. **Section Divider**
10. **CCA Section** — class="reveal", section-label: "04 — COMPARABLE ANALYSIS", peer table + multiples
11. **Section Divider**
12. **Summary / Final Valuation** — class="card featured reveal", section-label: "05 — VALUATION SUMMARY", large output numbers in gold, export buttons
13. **Footer**

Max-width container: 1100px, margin 0 auto, padding 0 24px.
Section padding: 80px 0.

---

## WHAT NOT TO CHANGE
- All calculation logic, formulas, and mathematical functions
- All state management and data flow
- All export functionality (PDF, Excel)
- All input/output data structures
- File structure and build system

---

## FINAL CHECKLIST BEFORE DELIVERING
- [ ] All fonts loading from Google Fonts CDN
- [ ] grain noise overlay on body::before
- [ ] Navbar fixed with glass morphism
- [ ] Gold accent color #C9A84C applied to all key elements
- [ ] All cards use bg-card #141B2D with 1px border #1E2D45
- [ ] All inputs have gold focus state
- [ ] All result numbers in Playfair Display gold
- [ ] Chart colors match gold/blue palette
- [ ] Reveal scroll animations on all sections
- [ ] Footer with portfolio link
- [ ] Fully responsive on mobile (375px), tablet (768px), desktop (1440px)

# ═══════════════════════════════════════════════════
# END OF PROMPT 1 — WOLF VALUATION ENGINE
# ═══════════════════════════════════════════════════

