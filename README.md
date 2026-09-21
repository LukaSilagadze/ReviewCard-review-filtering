# ReviewCard-review-filtering

Anonymous business feedback page with Supabase storage and queued email alerts.

See [backend setup and deployment order](backend/README.md) before publishing
changes to the feedback flow.

For Facebook, Instagram, and TikTok links, follow [social profile setup](backend/SOCIALS-SETUP.md).
Apply the social-columns migration before publishing the updated webpage.

Run social-link checks with `node --test tests/socials.test.cjs`.
For a local preview with mock business data, run `node tests/preview-socials.cjs`
and open `http://localhost:8765/reviewcard.html?biz=preview`. Add `&lang=en`,
`&lang=ru`, `&long`, `&one`, or `&none` to exercise different layouts. This preview
does not save feedback or send email.

The page follows the device/browser light or dark preference automatically via
`prefers-color-scheme`, with no theme setting stored. Publish `reviewcard.html`,
`style.css`, and `script.js` together; no backend changes are needed.

Run `node --test tests/theme.test.cjs tests/socials.test.cjs` for color-contrast
and social-link checks. For visual QA, the local preview accepts `&theme=light`
or `&theme=dark`, `&accent=%23ffff00`, and `&stage=stageFeedback` (also
`stageThanks`, `stageSendError`, `stageError`, and `stageGoogle`). The theme
parameter forces a palette only in the local preview; it is not a production
theme override. To verify live device switching, omit that parameter and change
the device appearance while keeping the page open.

Theme text and solid accent-button foregrounds are contrast-tested. The existing
social gradients and their white text are preserved; their brighter regions do
not uniformly meet 4.5:1 and are not covered by the solid-color contrast guarantee.
