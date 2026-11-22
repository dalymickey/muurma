# MUURMA

Online Store 2.0 theme for MUURMA, a made-to-order surf apparel label on Australia's east coast. The theme lives at the repository root, so Shopify's GitHub integration can publish it with no build step.

## Structure

```
assets/      CSS, JavaScript, hero photograph, grain, contour drawing
blocks/      Theme blocks used by image-with-text and featured collection
config/      settings_schema.json and the MUURMA preset in settings_data.json
layout/      theme.liquid and password.liquid
locales/     English storefront and schema translations
sections/    Header, footer, cart drawer, hero, product, collection, and content sections
snippets/    Shared Liquid
templates/   JSON templates, including page.story
```

Theme settings: MUURMA, version 1.0.0, author Michael Daly.

Type comes from Shopify's font library: Oswald for headlines, Instrument Sans for body copy, Tenor Sans for the tracked wordmark and study labels. Colour schemes use the coastal palette (Charcoal `#2b2c2b`, Deep olive `#424a40`, Slate `#626a65`, Salt grey `#a9aba6`, Whitewash `#d8d5cf`).

The homepage hero is the Wide banner section. Kicker, study label, headline, lede, both buttons, fine print, photograph, film grain, and contour overlay are all section settings. Until a merchant picks a photo, the section shows `assets/mu-hero-back.jpg`. `assets/mu-hero-front.jpg` is the packaged stand-in for the story and gallery.

## What was kept

Header and footer groups, cart drawer, product page (variant picker, size chart, sticky add-to-cart), collection with filters and sort, predictive search, 404, page, blog, article, cart, list-collections, contact, password, and gift card. Content sections: wide banner, countdown, featured collection, collection list, rich text, image with text, gallery, and the story page template. Quick add, local pickup, complementary products, and related products stay because the product and collection pages call them.

## What was removed

This is a hard fork for MUURMA only. It does not sync back to the Kazooify engine or the Theme Store.

Removed from the merchant-facing theme:

- Licence and Theme Store check-in (`kz_licence_key`, the check-in snippet, and the editor ping)
- The level / scale picker, including its theme-settings group, product blocks, footer rungs, and the old scale-picker hero
- Wellness and nutrition product blocks (nutrition, ingredients, features, how-to level/step)
- Sections that don't serve this store: stage, split hero, ticker, hotspots, routine, testimonials, FAQ, stores, popup, before/after, compare, mix, press, logos, multicolumn, big numbers, blog-post grid, featured product, cart pairs, signup, and the demo catalogue / generator / preview tooling
- Pack layers, the build, and engine git history. Shared section spacing settings are already written into each section schema.

Prefixes are `mu-` and `--mu-` (custom elements included).

## Connect it in Shopify

Nothing here is published to a store.

1. In Shopify admin, go to **Online Store → Themes → Add theme → Connect from GitHub**.
2. Choose the `dalymickey/muurma` repository and the `main` branch.
3. Shopify reads this repository root as the theme. Do not point it at a subdirectory.

After it connects:

- Set the header menu (`main-menu`) to Shop, Studies, Drops, and About, or whatever the store uses.
- Create a page, assign the **story** template, and point the hero's "How we make it" link at it. The template default is `/pages/story`.
- Choose the featured collection and the collection-list blocks.
- Set the countdown's end time. The preset is Thursday 26 November 2026, 6pm Australian Eastern time.
- On a product, open the variant picker block and choose the size-chart page.
- Replace the packaged hero photos when the real study assets are ready. Grain and contours can be swapped in the same banner settings.

## Check

```bash
shopify theme check
```

`shopify theme check` reports no offenses on this tree.
