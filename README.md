# ReviewCard-review-filtering

Anonymous business feedback page with Supabase storage and queued email alerts.

See [backend setup and deployment order](backend/README.md) before publishing
changes to the feedback flow.

For Facebook and Instagram links, follow [social profile setup](backend/SOCIALS-SETUP.md).
Apply the social-columns migration before publishing the updated webpage.

Run social-link checks with `node --test tests/socials.test.cjs`.
For a local preview with mock business data, run `node tests/preview-socials.cjs`
and open `http://localhost:8765/reviewcard.html?biz=preview`. Add `&lang=en`,
`&lang=ru`, `&long`, `&one`, or `&none` to exercise different layouts. This preview
does not save feedback or send email.
