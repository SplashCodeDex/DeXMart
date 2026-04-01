# DeXMart Product Guidelines

## 1. Tone and Voice

- **Professional & Authoritative:** Instill confidence through technical precision and formal language. Communications should reflect the enterprise-grade nature of the platform.
- **Clarity & Precision:** Use clear, concise, and business-oriented language. Labels, tooltips, and system messages must be unambiguous.
- **Supportive Resilience:** When errors occur (e.g., bot disconnection), provide actionable solutions and clear guidance rather than just stating a failure.
- **Transparancy:** Be honest about system status, especially regarding the limitations of the "Free" tier vs. "Premium" capabilities.
- **Real-time Reasoning Transparency:** Prioritize live, granular monitoring of AI thought processes. Users should see each stage of reasoning (Researching, Auditing, Executing) as it happens, fostering trust through visibility.

## 2. Visual Identity & Aesthetic

- **Sleek & Minimalist:** Prioritize high contrast, generous whitespace, and a sophisticated "Dark Mode" (or high-quality light theme) to reduce visual fatigue for power users.
- **Pixel Perfection:** Every component must adhere to strict spacing tokens (Tailwind v4 tokens). Hover, active, and focus-visible states are mandatory for all interactive elements.
- **Tactile Depth:** Apply multi-layered drop shadows and subtle background noise to create a premium, high-end feel.
- **Branding:** Use the iconic WhatsApp green (`#25D366`) sparingly as an accent color for status indicators and primary calls to action, maintaining a clean enterprise look.

## 3. User Experience (UX) Principles

- **Server-First Interaction:** Leverage Next.js 16 Server Components and Actions to ensure the UI is fast and reactive.
- **Optimistic UI:** Use `useOptimistic` for state mutations to provide immediate feedback to the user while backend processes complete.
- **Accessibility (A11Y):** Adhere to WCAG 2.1 AA standards. Ensure keyboard navigability and meaningful semantic labels (Radix UI primitives).
- **Mobile Responsiveness:** The dashboard must be fully functional and aesthetically pleasing on all screen sizes, from desktop to mobile.

## 4. Product Logic & Tiers

- **User-Centric:** All UI and logic is scoped to the individual user (B2C model). Users should feel their environment is personal, private, and secure — like Spotify or CapCut.
- **Tier-Aware UI:** Feature availability must be clearly communicated via the `UserContext.capabilities`. Provide clear "Upgrade" paths for premium features (e.g., additional channel slots, advanced AI models) without being intrusive.
- **Initialization Clarity:** The process of linking a WhatsApp Channel (QR Scan/Pairing Code) must be the most polished and guided experience in the app.

## 5. Animation & Motion

- **Purposeful Motion:** Use Framer Motion for GPU-accelerated animations that provide context or feedback (e.g., page transitions, modal entries).
- **Standardized Durations:** 150ms (micro), 250ms (normal), 400ms (page transitions).
- **Performance First:** Animate only `transform` and `opacity` to maintain 60fps performance.
