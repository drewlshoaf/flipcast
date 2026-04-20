# Letter to the Development Team

## Subject
Flabbercast MVP Development Direction

Team,

We are moving forward on **Flabbercast** (`Flabbercast.com`) as a new product concept: **the world's first personalized on-demand podcast**.

The core experience is simple:

A user comes to the public website, types what they want to learn about or hear about, chooses an approximate duration, chooses voices for the cast, submits the request, watches progress in real time, and receives a playable personalized audio discussion generated on demand.

The generated experience should feel like a short panel podcast. Each Flabbercast episode will have:

- **1 moderator**
- **2 panelists**
- A generated transcript tailored to the user's topic and requested duration
- Distinct selected voices assigned consistently to each speaker
- A final stitched MP3 that can be played immediately on the site and later revisited from the user's history

For the MVP, the website should be a **public-facing Next.js app**. There is no complex portal requirement up front, but we do want to design the system so user accounts and history are supported early. Users should eventually be able to log in and view their past queries, generated Flabbercasts, and playback history.

The backend should be built around an **async job model**. The request should be accepted quickly, persisted, and placed onto a queue for processing. The frontend should maintain a **persistent SSE connection** so the user receives live progress updates as the system moves through moderation, transcript generation, voice synthesis, audio stitching, and completion.

We currently expect the backend shape to look roughly like this:

- HTTP API receives the request
- Request is validated and moderated
- A job is created in persistence
- A BullMQ job is enqueued using Redis
- A worker processes the generation pipeline
- Status is streamed back to the browser via SSE
- Final audio is stored and attached to the request record
- User can immediately play the finished MP3

We also need to account for **advertising insertion**. In the initial business model, some Flabbercasts will include ads embedded into the transcript itself. These ads should not feel bolted on after the fact. They should be written into the original generated transcript so the moderator and panelists can naturally discuss the advertised item, mention the offer, and deliver a promo code or call to action. Later, paid accounts should be able to disable ads entirely.

Another key system requirement is **topic moderation and policy enforcement before content generation begins**. We need a configurable list of prohibited categories and standards. Before creating any transcript, the system must evaluate whether the user's request violates one or more banned topic classes. If it does, generation stops and the user is told the topic is not allowed. This moderation layer is a first-class part of the product and not a bolt-on.

The MVP should optimize for:

- Fast perceived responsiveness
- Clear end-to-end pipeline visibility
- High reliability in generation and audio assembly
- Clean separation between request intake, orchestration, and audio production
- Extensibility for auth, subscriptions, admin controls, analytics, and monetization

Please treat the attached specification as the working source of truth for the MVP and near-term architecture.

A few implementation priorities matter a lot:

1. **Keep the user experience clean and immediate.** The app should feel simple even if the backend pipeline is sophisticated.
2. **Design for recoverability.** Jobs can fail in multiple places; we need resumable, inspectable state.
3. **Keep transcript structure deterministic enough for synthesis.** Speaker segmentation and timestamps must be reliable.
4. **Make moderation explicit and auditable.** We need stored outcomes and reasons.
5. **Build with future monetization in mind.** Ads now, ad-free later, subscriptions after that.

This is an MVP, so we should favor a clean vertical slice over excessive feature breadth. But the slice should be real, polished, and architected so that it can grow into a production platform.

Thanks.

- Andrew
