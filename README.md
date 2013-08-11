LingBuzz RSS
============

Script to generate an RSS feed for LingBuzz.

<a href="http://feeds.feedburner.com/LingBuzz"><img src="http://feeds.feedburner.com/~fc/LingBuzz?bg=FF6600&amp;fg=444444&amp;anim=0" height="26" width="88" style="border:0" alt="" /></a>

Runs regularly on my server and is cached by FeedBurner at [http://feeds.feedburner.com/LingBuzz](http://feeds.feedburner.com/LingBuzz).

Notes for users
---------------

* The feed excludes external listings shown on the website (ROA + Semantics Archive). Semantics Archive already has its own RSS feed.

Usage for hackers
-----------------

	node lingbuzzrss.js

Runs using Node. Requires `async`, `request`, `cheerio`, and `rss` packages, which are all available on NPM.
