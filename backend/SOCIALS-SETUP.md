# Business social profiles

1. Run `002-business-socials.sql` and `003-business-tiktok.sql` in the Supabase SQL Editor before publishing
   the updated frontend. Do not rerun the email-queue migration.
2. In Table Editor → businesses, edit a test business and enter its real profiles:

   | Column | Example format |
   | --- | --- |
   | facebook_url | `https://www.facebook.com/your.business` |
   | facebook_username | `your.business` |
   | instagram_url | `https://www.instagram.com/your.business/` |
   | instagram_username | `@your.business` |

   | tiktok_url | `https://www.tiktok.com/@your.business` |
   | tiktok_username | `@your.business` |

   These are public display settings, not credentials. Save the row. Use complete
   HTTPS URLs on facebook.com, instagram.com, or tiktok.com (including their subdomains).
   URLs with embedded credentials or nonstandard ports are rejected. Shortener
   domains are not supported. Use the actual profile destination.
3. Publish `reviewcard.html`, `script.js`, `style.css`, and the two new SVGs in
   `images/`. Verify all configured links on that business's `?biz=...` page.

Social links appear only on the initial actions screen and open in the same tab.
Blank or invalid URLs hide that platform. If all URLs are missing, the entire
section is hidden. A blank username falls back to the business name. Display
names are rendered exactly as entered; include @ yourself where desired.

The migration is additive and does not alter email delivery or existing data.
If publishing fails, restore the previous frontend; the nullable columns can
remain. Existing businesses need no changes unless they want social links.
