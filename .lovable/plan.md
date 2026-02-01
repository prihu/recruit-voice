

# Landing Page Redesign: Inspired by Salesix.ai

## Overview

Transform the current dashboard-style Index page into a modern, high-impact marketing landing page inspired by Salesix.ai. The new page will use a dark theme with bold typography, animated elements, and a clear value proposition for the AI Phone Screener platform.

---

## Design Analysis: Salesix.ai Key Elements

The Salesix landing page features:
- **Dark theme** with black background and white/green accents
- **Bold, large typography** (HUMANOID VOICE AI EXPERIENCE)
- **Audio waveform visualization** at the bottom of hero
- **Floating feature cards** with subtle animations
- **Trust indicators** (stars, "Trusted by 500+ Teams")
- **Feature sections** with numbered cards (01, 02, 03, 04)
- **Interactive demo widget** ("Meet Your AI Agent")
- **Client testimonials** with photos and company logos
- **Scrolling use case marquee**
- **Why Choose Us** section with icon cards

---

## Architecture Decision

### Option A: Replace Index.tsx completely
- Pros: Clean implementation, no legacy code
- Cons: Loses the dashboard functionality

### Option B: Create separate LandingPage.tsx (RECOMMENDED)
- Pros: Preserves dashboard for logged-in users, marketing page for visitors
- Cons: More files to maintain

**Decision**: Create a new `LandingPage.tsx` component and update routing so:
- `/` shows the new marketing landing page
- `/dashboard` shows the existing dashboard (move current Index.tsx logic)

---

## Implementation Plan

### Phase 1: File Structure and Routing

**New Files:**
1. `src/pages/LandingPage.tsx` - Main landing page component
2. `src/pages/Dashboard.tsx` - Move current Index.tsx content here
3. `src/components/landing/HeroSection.tsx` - Hero with large typography
4. `src/components/landing/AudioWaveform.tsx` - Animated waveform SVG
5. `src/components/landing/FeatureCard.tsx` - Numbered feature cards
6. `src/components/landing/UseCaseMarquee.tsx` - Scrolling use cases
7. `src/components/landing/TestimonialCarousel.tsx` - Client reviews
8. `src/components/landing/WhyChooseUs.tsx` - Benefits section
9. `src/components/landing/DemoWidget.tsx` - Interactive AI agent demo
10. `src/components/landing/LandingNavbar.tsx` - Marketing-style navbar
11. `src/components/landing/LandingFooter.tsx` - Footer with links

**Routing Updates in App.tsx:**
```
/ -> LandingPage (public marketing page)
/dashboard -> Dashboard (app dashboard)
```

---

### Phase 2: Landing Page Sections

#### Section 1: Navigation Bar
- Logo + "AI Screener" branding
- Nav links: Features, Use Cases, Pricing, About
- Login button (outline)
- Get Started button (primary, green accent)
- Sticky on scroll with glass effect

#### Section 2: Hero Section
- Full viewport height, dark background (#0A0A0A)
- Large bold typography (similar to "HUMANOID VOICE AI EXPERIENCE"):
  ```
  AUTOMATED
  PHONE SCREENING
  EXPERIENCE
  ```
- Right side: Floating card with tagline
- Bottom: Animated audio waveform (green bars)
- CTA buttons: "Get Started" + "Watch Demo"
- Trust badge: "Trusted by 100+ Recruiting Teams"

#### Section 3: Mission Statement
- "OUR MISSION" badge
- Large text: "Powering India's fastest-growing companies with AI-powered phone screening. Screen faster. Hire smarter."
- Explore CTA

#### Section 4: Services Grid (4 cards)
```
01 - Roles & Questions: Configure custom screening questions, scoring rules, and AI agent personas for each position
02 - Bulk Screening: Import candidates via CSV and initiate hundreds of AI phone calls simultaneously
03 - Smart Evaluation: AI evaluates responses in real-time with sentiment analysis and keyword detection
04 - Analytics & Export: Comprehensive dashboards with exportable reports and interview transcripts
```

#### Section 5: Use Case Marquee
Scrolling banner with use cases (inspired by Salesix):
- Interview Screening
- Candidate Qualification
- Availability Check
- Salary Discussion
- Location Verification
- Skills Assessment
- Language Proficiency
- Reference Checks
- Offer Discussion
- Onboarding Calls

#### Section 6: Feature Highlights (4 detailed sections)
```
01. Humanoid Voice Agent
    - Natural conversation flow
    - Indian accent support
    - FAQ handling
    - Emotional intelligence
    [Visual: Agent on call mockup]

02. Automate Bulk Calling
    - 1000+ concurrent calls
    - Scheduled campaigns
    - Retry logic
    - Real-time monitoring
    [Visual: Dashboard with live stats]

03. Smart Actions
    - Candidate scoring
    - Pass/Fail/Review routing
    - Email notifications
    - ATS integration
    [Visual: Workflow diagram]

04. Intelligent Reports
    - Full transcripts
    - Sentiment analysis
    - Performance metrics
    - Export to CSV/Excel
    [Visual: Report preview]
```

#### Section 7: Interactive Demo Widget
- "Meet Your AI Screener" heading
- Phone widget showing agent status
- Click to hear sample call button
- Status indicator (STANDBY/ON CALL)

#### Section 8: Why Choose Us Grid
```
01 - Indian Voice Support: Native Hindi, Tamil, Telugu, and more
02 - Enterprise Scale: Handle 10,000+ calls per day
03 - 50+ AI Voices: Professional voices for every need
04 - Secure & Compliant: SOC2, GDPR ready
05 - Indian Phone Numbers: Build local trust with +91 numbers
```

#### Section 9: Testimonials Carousel
- Client reviews with:
  - Quote
  - Name, title, company
  - Avatar
- Auto-rotating carousel
- Clutch/G2 rating badge

#### Section 10: CTA Section
- "Ready to Transform Your Hiring?"
- Large "Start Free Trial" button
- "No credit card required"

#### Section 11: Footer
- Logo
- Product links
- Company links
- Resources links
- Social media
- Copyright

---

### Phase 3: Styling and Animations

**CSS Additions to index.css:**
```css
/* Landing page dark theme override */
.landing-dark {
  --background: 0 0% 4%;
  --foreground: 0 0% 98%;
  --accent: 142 76% 45%; /* Green accent like Salesix */
}

/* Audio waveform animation */
@keyframes waveform {
  0%, 100% { height: 20%; }
  50% { height: 100%; }
}

/* Marquee scroll */
@keyframes marquee {
  0% { transform: translateX(0); }
  100% { transform: translateX(-50%); }
}

/* Floating animation */
@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-10px); }
}
```

**Component-specific styles:**
- Hero text: `text-[8rem] font-black tracking-tight`
- Feature cards: Glass effect with green borders on hover
- Waveform bars: Green gradient, staggered animation delays
- Marquee: Infinite horizontal scroll

---

### Phase 4: Responsive Design

**Breakpoints:**
- Mobile (< 768px): Stack hero text, hide some waveform bars
- Tablet (768-1024px): 2-column feature grid
- Desktop (> 1024px): Full layout with floating elements

---

## Technical Details

### Dependencies
No new dependencies required. Using existing:
- Tailwind CSS for styling
- Lucide React for icons
- React Router for navigation
- Framer Motion could be added for animations (optional)

### File Changes Summary

| File | Action | Description |
|------|--------|-------------|
| `src/pages/LandingPage.tsx` | Create | New marketing landing page |
| `src/pages/Dashboard.tsx` | Create | Move current Index.tsx content |
| `src/pages/Index.tsx` | Modify | Import and render LandingPage |
| `src/App.tsx` | Modify | Add /dashboard route |
| `src/components/landing/*` | Create | 11 new landing components |
| `src/index.css` | Modify | Add landing page styles |
| `src/components/layout/AppLayout.tsx` | Modify | Add Dashboard link to nav |

### Component Hierarchy

```text
LandingPage.tsx
├── LandingNavbar.tsx
├── HeroSection.tsx
│   └── AudioWaveform.tsx
├── MissionSection (inline)
├── ServicesGrid (inline)
├── UseCaseMarquee.tsx
├── FeatureCard.tsx (x4)
├── DemoWidget.tsx
├── WhyChooseUs.tsx
├── TestimonialCarousel.tsx
├── CTASection (inline)
└── LandingFooter.tsx
```

---

## Migration Strategy

1. Create all new landing components first
2. Build LandingPage.tsx assembling all sections
3. Create Dashboard.tsx with current Index.tsx logic
4. Update routing in App.tsx
5. Update navigation links
6. Test all flows
7. Remove unused code from old Index.tsx

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Dark theme conflicts with app theme | Medium | Use scoped .landing-dark class |
| Waveform animation performance | Low | Use CSS animations, not JS |
| Large bundle size | Low | Code-split landing components |
| Breaking existing dashboard links | High | Keep /roles, /screens, etc. unchanged |

---

## Validation Checklist

After implementation:
- [ ] Landing page renders at /
- [ ] Dashboard accessible at /dashboard
- [ ] All navigation links work
- [ ] Waveform animation runs smoothly
- [ ] Marquee scrolls infinitely
- [ ] Responsive on mobile/tablet/desktop
- [ ] CTA buttons navigate correctly
- [ ] Dark theme properly scoped to landing page

