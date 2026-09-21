# Guest Wi-Fi setup

1. Run `004-business-wifi.sql` in the Supabase SQL Editor **before publishing the frontend**. The migration is additive and safe to repeat.
2. In Table Editor → businesses, enter the guest network's exact name in `wifi_ssid` and password in `wifi_password`. These values are public to page visitors; use guest-network credentials. Spaces and special characters are preserved.
3. Publish `reviewcard.html`, `script.js`, and `style.css` together. Open the business's `?biz=...` page and verify the button, popup, and copied password on a phone.

The button appears below social links on the initial review screen, or below the review buttons if no social links exist. Both Wi-Fi fields must contain a non-whitespace value. Clear either field to hide the button. Existing businesses need no configuration unless they want this feature. Passwordless networks are not supported in this version.

The centered popup provides credentials and a compact copy button; it cannot automatically join a network. Successful copying shows a checkmark, “Copied”, and a green outline on the button. Clipboard copying requires a supported browser and a secure context (HTTPS or localhost). If copying is unavailable or denied, visitors can select and copy the visible password manually.

For a mocked preview, run `node tests/preview-socials.cjs` and open `http://localhost:8765/reviewcard.html?biz=preview&lang=en`. Use `&none` for no social links, `&nowifi` for no Wi-Fi, `&long` for long credentials, `&theme=dark` or `&theme=light`, and `&lang=ka` or `&lang=ru`.

Run `node --test tests/*.test.cjs`. If deployment must be rolled back, restore the previous frontend; the nullable columns can remain.
