# Bonus scraper – yeah96 findings & plan
Source: https://yeah96.com/promotion. Static HTML (~800 KB) is mostly inline JS and translation tables. Promo cards are rendered client-side from:
POST https://yeah96.com/api/v1/index.php
  body (form-urlencoded): module=/merchants/getPublicInfo&merchantId=140&accessId=&accessToken=&walletIsAdmin=
No login, cookies or tokens needed. Response is JSON with data.promotions[] (32 items).
Fields: id, name, bonus(%), bonusFixed, bonusRandom, claimCondition, claimConfig, minTopup, maxTopup, rollover, minWithdraw, maxWithdraw, reset, maxRound, minRound, displayGroup(category HTML), displayOrder, image, angpaoImage, description(JSON Quill delta with HTML).
Run: node scrape.js  (edit casinos.json; pinnedBonusIds = the admin's 5 picks)
Schedule: cron `0 */6 * * *` or a Netlify scheduled function; write to DB/JSON; keep last good data on failure.
