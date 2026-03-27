# Mindful AI

An AI conversation tool with mindfulness built into the experience itself.

This is not a meditation app that happens to use AI. It is an AI tool where the act of using it naturally encourages presence, focus, and intentionality. The mindfulness is in the design of the interface, not in the content it delivers.

## The idea

Most AI chat tools are designed for speed. Type fast, get an answer, move on. The experience can leave you feeling scattered, reactive, and oddly drained.

Mindful AI takes a different approach. Every part of the interface is designed to help you feel more grounded, more intentional, and more in control of your relationship with AI. The interventions are subtle. You might not even notice them consciously. That is by design.

The project is grounded in the research of Cortland Dahl and Richard Davidson at the Center for Healthy Minds, University of Wisconsin-Madison. Their four-pillar framework for well-being (awareness, connection, insight, purpose) provides the scientific foundation for every design decision.

## How it works

### A session, not a chat

Each conversation is a session with a beginning, middle, and end.

1. **Arrive.** The app opens with a breathing animation. No rush. Inhale, hold, exhale. The circles contract inward as you breathe in, expand outward as you breathe out. Just one cycle. Enough to arrive.

2. **Choose to settle (or not).** You are offered a brief guided meditation: 15 seconds, 40 seconds, or 1 minute. Or skip it entirely. This is an invitation, not a requirement.

3. **Set an intention.** Before the conversation begins, you name what you are here for. "I want to think through a decision." "I want to learn about something." This anchors the session.

4. **Converse.** The AI responds with shorter, more spacious messages. It recognizes your effort, validates difficulty, and gently surfaces assumptions you might not have noticed. It references your intention when the conversation drifts. None of this is announced. It just happens.

5. **Reflect.** When you end the session, there is a brief closing meditation. A moment of gratitude. An invitation to name one thing you will carry forward. Then a simple closing: "Thank you for being present."

### What you will notice (and what you will not)

**Things you will probably notice:**
- The breathing animation at the start
- The meditation option
- The intention-setting question
- That the AI's responses feel different from a regular chat, though you may not be able to say exactly how
- The closing reflection

**Things designed to work without you noticing:**
- The background color subtly shifts during the conversation, tinting toward blue during moments of awareness, rose during connection, violet during insight, amber during purpose. The shifts happen over 4 seconds at 7% opacity. Most people do not consciously register them.
- When you send several messages rapidly, the AI's response slows down slightly. Not enough to feel broken. Just enough to create a moment of space.
- A small overlay appears in the bottom-right corner every few exchanges with a quiet question like "What are you noticing right now?" or "How has your thinking about this changed?" It fades away on its own. You can ignore it completely.
- The AI's responses are shaped by your intention. If you said you wanted to think through a decision, the AI will gently bring you back to that when the conversation wanders.
- Five small dots in the bottom-left corner let you note your current state, from scattered to present, at any time during the session. They are always there. You never have to use them.

### The core principle: offering, not demanding

Every mindfulness element in this tool is ambient. Nothing blocks you from typing. Nothing forces you to pause. Nothing lectures you about breathing. The interventions are offers, not demands. You can use this as a regular AI chat and ignore every mindfulness feature. The features still work. The research shows that peripheral sensory input (like subtle color changes) is integrated by the brain without requiring conscious attention.

## The science

The design is based on the four-pillar framework for well-being developed by Cortland Dahl and Richard Davidson, published in the Proceedings of the National Academy of Sciences (2020). The framework identifies four trainable dimensions of well-being:

**Awareness** is the capacity to pay attention to your environment and internal experience. The app trains this through breathing animations, paced text rendering, and gentle invitations to notice your current state. The research shows that even brief attentional practices (5 minutes per day) produce measurable reductions in stress and anxiety.

**Connection** is the capacity for appreciation, kindness, and compassion. The app trains this through the AI's response style. The AI models compassionate communication: recognizing effort, validating difficulty, taking perspective. You absorb these patterns through interaction, the same way you absorb the communication style of people you spend time with.

**Insight** is the capacity for self-knowledge and understanding how your thoughts shape your experience. The app trains this through gentle assumption-surfacing (the AI illuminates your framing without challenging it) and invitations to notice how your thinking has changed during the session.

**Purpose** is clarity about your values and what matters to you. The app trains this through intention-setting at the start and gentle callbacks to that intention throughout the session, ending with an invitation to name one concrete action you will take.

### Key references

- Dahl, C.J., Wilson-Mendenhall, C.D., & Davidson, R.J. (2020). "Reconstructing and deconstructing the self: cognitive mechanisms in meditation practice." Proceedings of the National Academy of Sciences.
- Davidson, R.J. & Dahl, C.J. (2026). "Born to Flourish." Simon & Schuster.
- Goldberg, S.B. et al. "The Healthy Minds Program randomized controlled trial." (Center for Healthy Minds, UW-Madison)
- Davidson, R.J. & Begley, S. "The Emotional Life of Your Brain."

## Who this is for

- **People who use AI tools daily** and have noticed they feel more scattered, anxious, or reactive after long sessions. This tool is designed to produce the opposite effect.
- **Mindfulness practitioners** who want their digital tools to align with their values instead of working against them.
- **Researchers in contemplative science, HCI, and digital well-being** who are interested in a novel approach to embedding evidence-based interventions into technology design.

## What makes this different

Every mindfulness app in the world treats mindfulness as content to be delivered. Headspace gives you a guided meditation. Calm plays you rain sounds. The Healthy Minds Program app walks you through practices.

This project does something different. It makes the AI interaction itself the practice. The medium is the intervention. You do not use this app and then meditate. You use this app and the using of it is the practice.

This distinction matters. Dahl and Davidson's research shows that well-being is a skill developed through practice, not content consumed. Every conversation in this tool is a practice session for awareness, connection, insight, and purpose.

## Running locally

You need Node.js and an Anthropic API key.

```
git clone https://github.com/adamjdavidson/mindful_ai.git
cd mindful_ai
npm install
```

Create a `.env.local` file:
```
ANTHROPIC_API_KEY=your_key_here
```

Start the development server:
```
npm run dev
```

Open http://localhost:3000.

## Technology

Built with Next.js, React, TypeScript, and the Anthropic Claude API. Styled with Tailwind CSS. All session data is stored locally in your browser. Nothing is sent to any server except the conversation itself (to the Claude API for responses).

## Status

This is an early research prototype. The interventions are grounded in published science but have not yet been validated in this specific implementation. The measurement infrastructure exists (behavioral telemetry, self-report tracking, session dashboard) to enable future evaluation.

## License

Open source. MIT License.
