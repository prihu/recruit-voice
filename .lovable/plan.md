

## What

Redesign the landing page to match the platform's neobrutalist design system: light background, black borders, sharp corners (0 radius), bold box shadows, Space Grotesk typography — instead of the current dark theme with rounded corners and translucent elements.

## Current vs Target

The platform uses:
- Light `bg-background` with `bg-gradient-subtle`
- Black borders (`border-border`)
- Sharp corners (`rounded-lg` = 0rem)
- Bold box shadows (`shadow-sm` = `3px 3px 0px 0px #000`)
- `hsl(var(--primary))` = black, emerald only for success states
- Space Grotesk font

The landing page currently uses:
- Dark `bg-[#0a0a0a]` with white text
- Translucent borders (`border-white/[0.06]`)
- Rounded corners (`rounded-2xl`)
- No box shadows
- Emerald-500 as primary accent
- Custom dark navbar/footer

## Changes

### `src/pages/LandingPage.tsx`
- Remove `landing-dark bg-[#0a0a0a] text-white` wrapper; use `bg-background text-foreground`
- Update mission section, CTA section to use platform colors (`bg-primary text-primary-foreground`, `border`, `shadow-md`)
- Replace all hardcoded dark-theme colors with CSS variable-based classes

### `src/components/landing/HeroSection.tsx`
- Remove dark radial gradients and emerald glows
- Use `bg-gradient-primary` for accent areas
- Replace `text-emerald-400` with `text-primary` or keep as accent via `text-success`
- Use neobrutalist button styles: `bg-primary text-primary-foreground border shadow-sm`
- Style the waveform section to fit light theme

### `src/components/landing/LandingNavbar.tsx`
- Match the platform header: `glass border-b`, `bg-background` when scrolled
- Replace emerald logo background with `bg-gradient-primary`
- Use `text-foreground`, `text-muted-foreground` for links
- Neobrutalist CTA buttons with borders and shadows

### `src/components/landing/FeatureCard.tsx`
- Use `bg-card border shadow-sm hover:shadow-md` instead of translucent dark cards
- Replace emerald icon backgrounds with `bg-muted`
- Use `text-foreground`, `text-muted-foreground` for text

### `src/components/landing/WhyChooseUs.tsx`
- Same card treatment as FeatureCard: light cards, black borders, sharp corners, shadows

### `src/components/landing/UseCaseMarquee.tsx`
- Use `border-y border-border` instead of `border-white/5`
- Text in `text-muted-foreground` or `text-foreground/10`
- Dot accent: `bg-primary` instead of `bg-emerald-500/40`

### `src/components/landing/AudioWaveform.tsx`
- Change gradient from emerald to primary colors (`from-primary to-primary/60`)

### `src/components/landing/LandingFooter.tsx`
- Light background, `border-t border-border`
- Use `text-foreground`, `text-muted-foreground` for links
- Match platform header logo style

### Files to change
- `src/pages/LandingPage.tsx`
- `src/components/landing/HeroSection.tsx`
- `src/components/landing/LandingNavbar.tsx`
- `src/components/landing/FeatureCard.tsx`
- `src/components/landing/WhyChooseUs.tsx`
- `src/components/landing/UseCaseMarquee.tsx`
- `src/components/landing/AudioWaveform.tsx`
- `src/components/landing/LandingFooter.tsx`

