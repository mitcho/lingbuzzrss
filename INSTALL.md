Server install notes for myself
===============================

The JS just runs on a cron script and spits out xml.

1. 	install nodejs, git
2. 	setup directory:
	- SERVICES
		- node
		- html (web-accessible)
3. 	in the node folder,
	```
	git clone http://github.com/mitcho/lingbuzzrss
	npm install async request cheerio rss
	```
	
4. 	add to cron

	> pico /etc/cron.hourly/lingbuzzrss

	and add:

	```
	#!/bin/bash
	pushd SERVICES/node/lingbuzzrss/
	node lingbuzzrss.js > SERVICES/html/lingbuzzrss.xml
	node lingbuzzrss.js --twitter > SERVICES/html/lingbuzzrss-twitter.xml
	popd
	```
	
