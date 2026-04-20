# Letter to the Development Team

Team,

We are refining the core playback flow for our personalized, on-demand podcast experience so that the listener gets content quickly, the system has time to prepare each segment, and the entire experience feels intentional rather than delayed.

The product behavior we want is not a single long generation followed by one uninterrupted podcast. Instead, we want a staged audio experience where ads and spoken interstitials buy time for generation and assembly of the podcast content in the background.

At a high level, the user enters a podcast topic and presses **Generate**. From that moment forward, the user hears a sequence of pre-rendered and generated audio segments that alternate between ads and podcast scenes. The backend should use each ad window as an opportunity to prepare the next content segment.

The flow begins with a **static, pre-created 20-second ad**. During this first ad, the backend should analyze the user query and produce the initial setup materials needed to start the show. Specifically, the system should generate:

- a short contextual description of the requested topic
- three panelist names
- a short two- to three-second background/biographical description for each panelist
- a short welcome/explanation message that tells the listener we are gathering the panelists and will return after these short ads

Immediately after the first ad, the system plays the **welcome message**. This is a generated spoken segment that introduces the concept of the episode and tells the listener what is happening.

After that, the system plays **two additional 20-second ads**. While those ads are playing, the backend prepares **Scene 1**.

From that point on, the show should alternate between content scenes and ads. The podcast itself should be divided into **four scenes total**, with these target durations:

- Scene 1: 90 seconds
- Scene 2: 90 seconds
- Scene 3: 90 seconds
- Scene 4: 30 seconds

Between the scenes, the system should insert 20-second ads. That means the user-facing playback sequence becomes:

1. Ad 1 — 20 seconds
2. Welcome message — generated spoken interstitial
3. Ad 2 — 20 seconds
4. Ad 3 — 20 seconds
5. Scene 1 — 90 seconds
6. Ad 4 — 20 seconds
7. Scene 2 — 90 seconds
8. Ad 5 — 20 seconds
9. Scene 3 — 90 seconds
10. Ad 6 — 20 seconds
11. Scene 4 — 30 seconds

A critical content requirement is that each of the first three scenes must end naturally with a moderator-led transition that makes the ad break feel intentional. In other words, the moderator should close each of those scenes with something equivalent to: **we’ll be right back after this short break**. The final 30-second scene should instead function as the wrap-up: final thoughts, closing remarks, and a thanks-for-listening ending.

This means the transcript generation process needs to change. We should no longer think in terms of generating one monolithic transcript for direct playback. Instead, we should generate the full discussion, then structure or segment it into four scene blocks with proportional target durations of **90 / 90 / 90 / 30 seconds**. Those scene boundaries need to be content-aware so the conversation feels coherent and each break lands at a natural moment.

Operationally, the platform should be designed so that ads are not only monetization units but also timing buffers that give the backend room to synthesize the next scene, render TTS, and assemble the upcoming audio segment before playback reaches it.

Please treat this as the intended baseline playback architecture for the personalized podcast experience. The next step is to formalize this into a concrete implementation spec covering orchestration, asset preparation, scene segmentation, timing constraints, and queueing/streaming behavior.

Thanks.
