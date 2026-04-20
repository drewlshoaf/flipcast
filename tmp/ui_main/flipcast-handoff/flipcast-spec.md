# Flipcast Website + Studio Specifications

## 1. Product summary

**Flipcast** is a personalized on-demand podcast product where the user creates the show they want to hear by supplying a topic and choosing a small number of creative controls.

The concept includes two connected surfaces:

1. **Marketing homepage**
2. **Flipcast Studio play page**

The homepage should drive users into the studio. The studio should let them design, preview, generate, and remix a Flipcast episode.

---

## 2. Core product positioning

Primary idea:

> The podcast does not exist until the listener asks for it.

Secondary framing:

- Make the podcast you wish already existed
- The listener becomes the creator
- Go from idea to episode without filling out a giant form

---

## 3. Information architecture

## 3.1 Homepage

The homepage should include:

- Brand / masthead
- Hero section
- CTA into the studio
- Example prompt chips
- Product preview card
- Use-case / inspiration section
- Mood / style cards
- Supporting explanation cards
- Final CTA block

### Homepage CTA behavior

The following homepage elements should route into the studio page:

- Primary CTA button
- Hero prompt chips
- Preview card CTA
- Use-case cards
- Final CTA button

When applicable, the clicked prompt or idea should prefill the studio topic field.

---

## 3.2 Studio page

The studio page should be organized around user decisions, not a long static form.

Recommended structure:

### A. Top bar
Contains:
- back to homepage
- Flipcast Studio title
- short supporting subtitle
- estimated length pill
- save draft action
- share action

### B. Creation intro card
Contains:
- short framing headline
- short explanatory copy
- current setup pill or badge
- topic input area
- small prompt modifiers / helper chips

### C. Format section
Large selectable cards for:
- Panel
- Anchor
- Story

Each option should communicate:
- label
- short description
- visual accent or gradient marker

### D. Vibe section
Large selectable cards for:
- Serious
- Playful
- Dramatic
- Cozy

Each option should communicate:
- label
- short description
- immediate visual state when selected

### E. Secondary controls
Keep lightweight and visually subordinate:
- speed slider
- voice mode selection
  - auto-cast voices
  - manual voice picking

### F. Preview + remix area
This is a critical section.

Contains:
- player / play state
- now-playing title
- progress bar
- summary metadata
- live outline / structure preview
- quick remix buttons
- generate button

This area should make it clear what the current settings will produce.

### G. Idea rail
Right-side rail for fast-start inspiration.

Grouped buckets:
- Today’s News
- Learn About
- Talk About

Each item should be clickable and should populate the topic field.

### H. Supporting explanation card
A lightweight explanatory card that reinforces why the workflow is easy:
- topic first
- tappable show shape / vibe
- preview explains output
- remix shortens iteration loop

---

## 4. Studio UX principles

## 4.1 Topic first
The topic input is the main control. It should be visually dominant.

Guidelines:
- use a large multiline text area
- explain what the user can type
- accept headlines, questions, trends, opinions, obsessions
- avoid making the first step feel intimidating

## 4.2 Reduce control friction
Prefer:
- card selection
- chips
- toggles
- obvious actions

Avoid relying on:
- dense forms
- nested settings
- long configuration panels
- dropdown-first interactions

## 4.3 Make output legible before generation
The user should understand the effect of their choices through:
- estimated length
- selected format
- selected vibe
- voice count
- live outline

## 4.4 Remix should feel instant
After generation, the user should be able to quickly adjust the result with one-tap actions like:
- shorter intro
- more contrast
- softer tone
- stronger ending

These should feel like fast follow-up actions, not a full restart.

---

## 5. Required interaction behavior

## 5.1 Homepage to studio routing
Homepage must link into the studio page.

Behavior:
- standard CTA opens studio
- clicking an idea chip preloads topic
- clicking use-case idea preloads topic
- clicking preview CTA opens studio with a sample prompt

## 5.2 Studio generation behavior
When the user clicks **Generate Flipcast**:
- generation state begins
- progress bar animates forward
- preview/player area updates
- generated state resolves into playable preview

This can be mocked visually for prototype purposes.

## 5.3 Play / pause behavior
Player must support a visible play / pause toggle state.

Prototype behavior is acceptable.

## 5.4 Selection behavior
Selected states for format, vibe, and voice mode must be visually obvious.

---

## 6. Content model for the prototype

## 6.1 Format options
### Panel
3 voices with contrast and debate

### Anchor
1 host with a clean news delivery

### Story
Narrated and more cinematic

## 6.2 Vibe options
### Serious
Measured and weighty

### Playful
Bright and witty

### Dramatic
Tense and cinematic

### Cozy
Warm and easygoing

## 6.3 Idea rail groups
### Today’s News
Fresh takes with strong hooks

### Learn About
Unexpected explainers and rabbit holes

### Talk About
Conversation fuel and social tension

---

## 7. Visual design requirements

The studio must use the same design language as the homepage.

Required:
- light background
- soft radial gradient backdrop
- blue / pink / green accent system
- white / translucent surfaces
- rounded corners
- light borders
- soft, colored shadows
- playful but clean consumer polish

Not allowed:
- dark enterprise dashboard feel
- separate visual identity from homepage
- heavy grayscale control-room styling
- dense admin-panel layouts

---

## 8. Layout guidance

## 8.1 Desktop
Preferred studio layout:
- main content on left
- idea rail on right

Main content stack:
1. intro + topic
2. format + vibe controls
3. preview + remix area

## 8.2 Responsive intent
On smaller viewports:
- collapse into a single vertical flow
- keep topic first
- keep generate action prominent
- move idea rail below primary creation controls if needed

---

## 9. Design rationale

The studio should feel like a **creative tool for making audio**, not a settings console.

The page should communicate:

- speed
- clarity
- delight
- authorship
- low-friction experimentation

The best benchmark is not “AI form app.”
The right target is “a joyful media creation studio with strong defaults.”

---

## 10. Deliverables expected from implementation

- cohesive homepage and studio flow
- shared visual design system across both pages
- linked navigation between homepage and studio
- prefilled topic handoff from homepage ideas to studio
- clearly improved usability versus the original skeleton
- polished prototype-ready interactions for generation and preview
