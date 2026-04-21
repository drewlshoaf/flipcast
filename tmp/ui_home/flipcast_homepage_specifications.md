# Flipcast Home Page Specifications

## 1. Goal

Create a new Flipcast home page that:
- feels discovery-first rather than studio-first
- visualizes a large cloud of possible topics
- centers fully around a single strong start action
- aligns with the approved Flipcast style guide
- preserves a clean central reading zone for the main copy

## 2. Experience Summary

The page should present:
- a light atmospheric background with soft multicolor gradients
- a clean top nav with Flipcast branding
- a large central pink play button
- a large headline and short supporting paragraph in the center
- many colorful topic/question bubbles distributed around the page
- lower supporting feature cards reinforcing speed, fun, and immediacy

This page is a **home/discovery surface**, not a creation form and not a studio/editor.

## 3. Style Guide Requirements

### Brand personality
The page must feel:
- playful
- bright
- creative
- immediate
- modern
- consumer-friendly
- confident without feeling corporate

### Background
Use:
- pale sky / near-white base
- subtle radial gradients
- soft blue, pink, mint, and lavender-adjacent atmosphere

Avoid:
- dark backgrounds
- flat sterile white with no depth
- enterprise dashboard mood

### Surfaces
Use:
- white or semi-translucent white cards
- frosted / glassy feeling surfaces where appropriate
- soft blur and light borders
- soft tinted shadows

### Color direction
Primary palette:
- sky blue
- pink
- mint / emerald green

Supporting palette:
- very light sky backgrounds
- very light pink backgrounds
- very light green backgrounds
- soft slate body text
- white surfaces

### Typography
Headlines should be:
- large
- bold
- tight-tracking
- emotionally clear
- simple

Body copy should be:
- short
- plainspoken
- highly readable
- medium-contrast slate on light background

## 4. Core Layout

### Top navigation
Include:
- Flipcast / flip.audio logo at top left
- light navigation treatment in the center or near-center
- a primary action on the right such as “Open Studio”
- optional avatar/account chip

The navigation should feel light and premium, not heavy.

### Hero center
The center of the page must include:
- large circular pink play button as the focal point
- headline
- supporting paragraph
- optional secondary CTA such as “Surprise me”

Approved messaging direction:
- **Make the show first.**
- **Flipcast should feel like play, not setup. Start from any tiny spark — a question, a rumor, a hot take, a trend — and jump straight into a fresh episode.**

Equivalent copy is acceptable if product wants to refine later, but the tone should remain aligned.

### Read zone requirement
This is a key implementation rule.

The headline and paragraph must sit inside a **protected central read zone**. Topic bubbles must not overlap, crowd, or visually clash with this area.

Implementation expectations:
- create a clear exclusion zone around the central copy block
- push topic bubbles toward the outer ring of the layout
- keep the central play button and copy readable at a glance
- optional: use a soft white atmospheric glow behind the copy to create visual separation

## 5. Topic Bubble System

### Purpose
The topic bubble field should communicate abundance and discovery.

The user should feel:
- there is always something interesting to tap
- the page is alive with ideas
- Flipcast can begin from culture, trends, questions, debates, news, and curiosity

### Bubble styling
Bubbles should:
- be rounded / pill-like / soft cards
- use colorful but very light tinted treatments
- feel tappable and playful
- vary in size
- use blue / pink / green family accents
- include soft shadows and light borders

### Bubble content
Bubbles can contain short prompts such as:
- why are we suddenly obsessed with matcha?
- are group chats ruining friendship?
- is nuclear power having a comeback?
- why do people romanticize the 2000s?
- can AI regulate itself?
- should cities ban cars downtown?
- is remote work quietly dying?

### Density
The page should suggest **hundreds** of possible starting points.
This does not require literally rendering hundreds of full-sized cards, but the composition should imply that scale through:
- many visible bubbles
- smaller ambient bubbles in the background
- varied placement and layering
- a sense that the cloud extends beyond what is visible

### Distribution rules
- keep the highest density in the outer field
- reduce density near the central text block
- preserve asymmetry and playful variation
- avoid random chaos; the page should still feel designed

## 6. Buttons and Interactions

### Primary play action
The main central play button should:
- be pink-forward
- feel luminous, friendly, and prominent
- use a gradient treatment if helpful
- remain the strongest focal point on the page

### Secondary buttons
Secondary actions such as “Surprise me” should:
- use soft white or lightly tinted treatment
- have subtle border and shadow
- feel playful, not corporate

### Hover states
Hover states should be clear but soft:
- slight lift
- slight brightening
- stronger shadow
- no harsh enterprise-style transitions

## 7. Supporting Feature Row

The lower section may include a small set of supportive feature cards reinforcing the value proposition.

These should feel like lightweight product promises, not enterprise feature modules.

Suggested themes:
- start from any spark
- go from idea to episode
- bright discovery energy
- fun before friction

Keep this row visually subordinate to the hero.

## 8. Do Not Do

Do not make the home page feel like:
- a studio editor
- a settings page
- a heavy dashboard
- an enterprise SaaS landing page
- a dense controls surface
- a technical workflow that requires too much setup before starting

Avoid:
- dark heavy panels
- grayscale-only UI
- too many form fields
- large editor boxes
- clutter in the center copy region

## 9. Implementation Notes

### Recommended structure
Use a layout with:
- global atmospheric background layer
- top navigation
- hero container
- central play/copy stack
- separate bubble field layer
- central glow / read-zone layer if needed
- lower support card row

### Readability safeguards
Ensure:
- the central message remains readable at all desktop sizes
- decorative/background bubbles do not reduce readability
- responsive layouts maintain the protected read zone

### Responsiveness
On smaller screens:
- simplify bubble density
- preserve play button prominence
- keep the headline/copy readable
- stack lower support cards cleanly

## 10. Deliverables

Please produce:
- final desktop home page implementation
- responsive behavior for tablet/mobile
- reusable topic bubble component styles
- protected central read-zone layout behavior
- final polish pass to ensure the page feels playful and consumer-first

## 11. Acceptance Criteria

The work is successful when:
- the page clearly feels less like a studio and more like rich content discovery
- the style guide is consistently reflected in color, surfaces, typography, and interaction
- the central message is readable and calm
- topic bubbles feel abundant and playful without crowding the hero copy
- the page encourages fast-start behavior and feels fun rather than bureaucratic

## Notes For Engineering Review

If implementation choices conflict with a more dashboard-like treatment, choose the lighter, brighter, more consumer-friendly option.

If layout choices conflict with bubble density, preserve the central read zone first.

If styling choices conflict with the earlier Flipcast style guide, the earlier style guide wins.
