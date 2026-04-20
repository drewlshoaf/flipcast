# Flipcast Advertising Page Spec

## Objective

Create a marketing page at `/advertising` that presents Flipcast's advertiser offering in a polished, on-brand way and gives advertisers a clear path to request more information.

This page is a conversion-oriented marketing page, not a documentation page and not a self-serve ad dashboard.

## Primary Goal

Encourage advertisers, sponsors, and brand partners to submit interest or contact Flipcast for more information.

## Secondary Goals

- Explain the advertising program clearly
- Establish Flipcast as a differentiated advertising channel
- Communicate audience and listening-context value
- Highlight contextual and targeted advertising potential
- Reinforce brand consistency across the marketing site

## Audience

Primary audiences:
- Brand marketers
- Agency buyers
- Sponsorship decision-makers
- Partnership leads
- Early-stage advertisers interested in emerging media formats

Secondary audiences:
- Investors or partners evaluating monetization strategy
- Press or ecosystem partners reviewing the business model

## Route

`/advertising`

## Entry Point

A **small footer link** labeled:

`Advertising`

This link should appear alongside other subtle footer links such as:
- Terms
- Privacy
- Contact

The Advertising link should route to `/advertising`.

## Visual Direction

This page should match the established Flipcast aesthetic:

- Light background
- Soft gradients
- Premium but playful feel
- Rounded cards and containers
- Airy spacing
- Accent colors in pink, blue, and green
- Soft glow / blur treatment where appropriate
- Clean modern typography
- Consistent visual language with the home page

### Visual Keywords

- personalized
- fresh
- bright
- premium
- creative-tech
- audio-native
- modern startup polish

## Tone of Copy

- Confident
- Strategic
- Clear
- Modern
- Sales-oriented without sounding pushy
- Optimistic about the category

Avoid:
- stiff corporate language
- ad-tech jargon overload
- vague claims with no structure
- overly technical platform detail

## Core Messaging Themes

The page should cover these themes:

### 1. Advertising Program
Explain that Flipcast offers advertising and sponsorship opportunities within personalized, on-demand audio experiences.

### 2. Reach
Explain that Flipcast is built for engaged listeners and high-intent sessions, not passive feed scrolling.

### 3. Unique Positioning
Explain that Flipcast sits at the intersection of personalized media, podcast-style audio, and on-demand generation.

### 4. Targeted Advertising
Explain that topic, listener intent, and session context create a stronger surface for contextual ad placement than generic inventory.

### 5. Advertiser Contact / Interest
Give advertisers a clear next step to request information.

## Suggested Page Structure

### 1. Hero Section
Purpose:
- establish the value proposition immediately
- position Flipcast as a differentiated ad channel

Suggested content:
- eyebrow or badge
- large headline
- supporting paragraph
- primary CTA
- secondary CTA optional
- visual summary panel or themed campaign snapshot card

Possible message direction:
- Reach listeners inside a more personal audio moment
- Personalized audio placements built around active listener intent
- A better environment for contextual advertising

### 2. Why Advertise With Flipcast
Purpose:
- summarize top reasons quickly

Format:
- 3-up or 4-up feature cards

Possible themes:
- contextual placement
- high-intent listening
- differentiated media format
- early mover advantage

### 3. Advertising Program Section
Purpose:
- explain the types of opportunities available

Possible content:
- pre-roll
- sponsor placements
- contextual insertion
- branded partnerships
- launch partner opportunities

Note:
Do not imply finalized inventory products if the business has not finalized them. Keep wording directional and credible.

### 4. Reach / Audience Value Section
Purpose:
- frame the quality of the audience and listening context

Possible themes:
- topic-driven sessions
- intentional listening
- cross-platform behavior
- repeat engagement potential
- emerging personalized audio category

### 5. Targeted Advertising Section
Purpose:
- explain how contextual targeting works at a high level

Possible targeting dimensions:
- topic or interest area
- listener-selected content theme
- geography
- device/platform context
- time-of-day patterns
- engagement-based segments

Important:
Keep this high-level. Do not overpromise targeting capabilities beyond what the product will support.

### 6. Contact / Advertiser Interest Section
Purpose:
- provide clear conversion action

Should include:
- short contact pitch
- simple interest form UI or placeholder
- direct email option if needed

Suggested fields:
- company name
- work email
- budget range
- what are you hoping to promote?

CTA examples:
- Request information
- Talk to our team
- Learn about advertiser partnerships

### 7. Footer
Include the small footer navigation with:
- Terms
- Privacy
- Advertising
- Contact

The Advertising link should appear active or selected on this page.

## Functional Requirements

### Navigation
- Footer link labeled `Advertising`
- Link points to `/advertising`

### CTA Behavior
One of the following is acceptable in v1:
- CTA scrolls to an advertiser-interest form section on the page
- CTA opens a contact form flow
- CTA links to a contact endpoint or mailto if needed temporarily

### Responsive Behavior
The page must work well across:
- desktop
- tablet
- mobile

Specific expectations:
- hero stacks cleanly on mobile
- cards collapse into single-column or two-column as appropriate
- CTA remains prominent
- spacing stays breathable
- footer links remain readable and tap-friendly

## Content Requirements

The page must explicitly communicate all of the following:
- Flipcast has an advertising program
- Flipcast offers differentiated reach
- Flipcast has unique positioning versus standard channels
- Flipcast supports a more contextual/targeted ad model
- Advertisers can request more information

## UX Requirements

- Clear hierarchy from headline to conversion
- No cluttered, dense walls of text
- Strong CTA placement above the fold
- Cards and sections should feel scannable
- Use visual contrast to separate message blocks
- Page should feel premium and investor-safe, not experimental or messy

## Component Suggestions

Potential components:
- hero section
- stat or snapshot card
- feature cards
- section headers
- targeting bullets or chip list
- dark CTA band or card near the bottom
- footer nav

## Accessibility

- Good contrast for all text
- Semantic headings
- Buttons and links should have visible hover/focus states
- Form controls should have labels
- Mobile tap targets should be appropriate size

## Performance

- Keep gradients and blur effects tasteful and lightweight
- Avoid overly heavy animation
- Prioritize fast first paint on mobile
- Any decorative visual should degrade gracefully

## Non-Goals for V1

Do not build these unless explicitly requested:
- full advertiser portal
- media kit download system
- campaign analytics
- account creation
- self-serve ad purchase flow
- pricing calculator
- audience dashboard

## Deliverable

A polished themed marketing page mockup or implementation for `/advertising` that is consistent with the Flipcast site style and is reachable from the footer link labeled `Advertising`.

## Acceptance Criteria

The page is complete when:

1. A footer link labeled `Advertising` exists.
2. The link routes to `/advertising`.
3. The page visually matches the Flipcast light-theme style.
4. The page includes sections for:
   - advertising program
   - reach
   - unique positioning
   - targeted advertising
   - advertiser interest/contact
5. The page is responsive and visually polished.
6. The page feels like part of the existing marketing site rather than a disconnected one-off.
