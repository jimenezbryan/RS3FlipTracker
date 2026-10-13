# FlipSync demo video

A ~45 second product demo built with [Remotion](https://www.remotion.dev). It follows one item,
Noxious scythe, through the app: find it in the Scanner, check its 90-day chart, log the flip.

The screens are React replicas that import the app's own pieces, so they cannot drift from it:

- UI primitives from `client/src/components/ui` (button, badge, card, input, label, checkbox, table)
- the Tailwind theme (`../tailwind.config.ts`) and `client/src/index.css`
- `shared/taxCalculator.ts`, `shared/priceZones.ts`, `shared/gpParser.ts`, `server/technical-indicators.ts`

## Commands

```bash
npm install
npm run studio     # preview and scrub in the browser
npm run music      # regenerate the synthesized music bed and UI sounds
npm run vo -- --sample   # audition the voice: writes out/vo-sample.mp3
npm run vo         # generate the voiceover, writes public/vo/*.mp3 and src/vo.json
npm run render     # out/flipsync-demo.mp4
```

The voiceover needs `ELEVENLABS_API_KEY=...` in `video/.env.local` (gitignored). Until it has been
generated the video renders with captions, music and UI sounds only, timed from estimates.

## Where things live

| File | What it holds |
|---|---|
| `src/timeline.ts` | The script, and how long each beat lasts. Beats stretch to fit the recorded lines. |
| `src/Demo.tsx` | The choreography: click times, cursor path, camera moves, sound cues. |
| `src/screens/` | Scanner, Dashboard (Log Flip form, flip cards) and the end card. |
| `src/ui/` | App shell, price chart, cursor, captions. |
| `src/data/items.ts` | The data on screen, with what is real and what is illustrative. |
| `scripts/` | Voiceover generation (ElevenLabs) and audio synthesis. |

## What is real and what is not

Real: item names, icons, GE prices and volumes (WeirdGloop API, 2026-10-12), item categories, the
Noxious scythe 90-day history, and everything computed from it (zones, 7-day average, RSI, 30-day
range).

Illustrative: Scanner spreads, scores, signals and the stat tiles; the earlier flips on the
dashboard; and the demo flip itself (buy 270m is today's price rounded, sell 292m is a hypothetical
exit inside the real 90-day range).

The Scanner table leaves out four columns so it fits the frame: LIMIT, TYPE, FILLABLE, AI EST. %.
