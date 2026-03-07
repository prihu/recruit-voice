

## Footer cleanup

**Current footer links** — ALL are placeholder `href="#"` pointing nowhere:
- Product: Features, Pricing, Integrations, API Docs
- Company: About Us, Careers, Blog, Contact
- Resources: Documentation, Help Center, Community, Status
- Legal: Privacy Policy, Terms of Service, Security, GDPR
- Social: Twitter, LinkedIn, GitHub

**Actual routes that exist in the app:**
`/` (landing), `/dashboard`, `/roles`, `/candidates/import`, `/screens`, `/settings`

**Landing page sections with anchors:** `#features`, `#whyus`

**Verdict:** None of the 16 footer links point to real pages. Pricing, API Docs, About Us, Careers, Blog, Contact, Documentation, Help Center, Community, Status, Privacy Policy, Terms of Service, Security, GDPR — none exist.

### Plan

**Replace `LandingFooter.tsx`** with a minimal footer containing only real links:

- **Product** section: Features (`#features`), Why Us (`#whyus`)
- **Platform** section: Dashboard (`/dashboard`), Roles (`/roles`), Screens (`/screens`), Settings (`/settings`)
- Remove Company, Resources, Legal sections entirely
- Keep social links (Twitter, LinkedIn, GitHub) as placeholders — these are external and acceptable as `#`
- Keep logo and copyright

This reduces the footer from 4 fake sections (16 dead links) to 2 real sections (6 working links).

