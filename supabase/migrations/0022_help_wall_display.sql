-- 0022: Help content for the live-board wall display (kiosk mode) and the
-- collapsible sidebar. Tenant-facing (admin_only = false), in the Compliance
-- category next to the existing live-board article.

insert into help_article (slug, title, category, sort_order, body_markdown, published, admin_only) values

('live-board-wall-display', 'Putting the live board on a wall display', 'Compliance', 9,
'## A heads-up display for the floor

RxShift can show the live ratio board on a wall monitor — like the one many pharmacies already use for their prescription queue. It is **read-only**: it shows who is counting at each location and whether you are in ratio, and it refreshes on its own about every 30 seconds. Nobody needs to touch it.

## Opening it

On **Live Board**, click **Open display** (top right). It opens the display in a new tab — **bookmark that page** on the monitor''s computer so it can be reopened anytime.

- **Pick a location.** With more than one location, use the buttons at the top to show **All locations** or pin a single site — so each monitor shows its own pharmacy.
- **Full screen.** Click **Full screen** to fill the monitor edge to edge.

## A few notes

- The display has no status controls on purpose. To mark someone to lunch or back, use the **Live Board** or **My Schedule** on your own computer — the wall display catches up within about half a minute.
- The monitor''s browser needs to be **signed in** to RxShift once; after that it can run on its own.

## More room on your own screen

Anywhere in RxShift, click the **«** at the top of the left menu to hide it and give the schedule or board the full width. A **»** button then appears in the page header to bring the menu back.', true, false);
