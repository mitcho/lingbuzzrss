// lingbuzzrss.js
// Michael Yoshitaka Erlewine <mitcho@mitcho.com>
// Dedicated to the public domain, 2013--2015
// https://github.com/mitcho/lingbuzzrss/

var request = require("request"),
	cheerio = require("cheerio"),
	fs = require("fs"),
	RSS = require("rss"),
	async = require("async"),
	url = require("url"),
	http = require("http");

const LINGBUZZ = 'http://ling.auf.net/lingbuzz',
	DOMAIN = 'http://ling.auf.net',
	HEADERS = {'User-Agent': 'LingBuzz RSS feed; http://github.com/mitcho/lingbuzzrss'},
	TWEETLENGTH = 140,
	URLLENGTH = 35; // the length of a lingbuzz url

// For twitter account:
var twitter = (2 in process.argv && process.argv[2] == '--twitter');

var now = (new Date()).toString();

// Start building the RSS feed, with the requisite header info
var feed = new RSS({
		title: 'LingBuzz',
		description: 'archive of linguistics articles',
		feed_url: 'http://feeds.feedburner.com/LingBuzz',
		site_url: 'http://ling.auf.net/lingbuzz',
		// image_url: 'http://example.com/icon.png',
		// docs: 'http://example.com/rss/docs.html',
		// author: 'LingBuzz',
		// managingEditor: 'Dylan Greene',
		webMaster: 'mitcho@mitcho.com (Michael Yoshitaka Erlewine)',
		// copyright: '2013 Dylan Greene',
		language: 'en',
		categories: ['linguistics'],
		pubDate: now,
		ttl: '60' // todo: fix?
	});

// A simple file cache
function Cache(dir) {
	this.dir = dir;
}
Cache.prototype = {
	filename: function(key) {
		// todo: make more robust?
		return this.dir + '/' + key + '.json';
	},
	stat: function(key, cb) {
		fs.stat(this.filename(key), cb);
	},
	exists: function(key, cb) {
		fs.exists(this.filename(key), cb);
	},
	get: function(key, cb) {
		fs.readFile(this.filename(key), function(err, json) {
			if (err) {
				console.error('CACHE MISS: ' + key);
				cb(err);
				return;
			}

			try {
				data = JSON.parse(json);
				console.error('CACHE GET: ' + key);
				cb(null, data);
			} catch (err) {
				console.error('JSON ERROR: ' + key);
				cb(err);
			}
		});
	},
	set: function(key, data, cb) {
		console.error('CACHE SET: ' + key);
		fs.writeFile(this.filename(key), JSON.stringify(data), cb);
	}
};
var cache = new Cache('cache');

function getShortAuthors(authors) {
	if (authors.length == 1)
		return authors[0];

	var lastNames = authors.map(function(x) {
		var split = x.split(', ');
		return split[0];
	});
	if (lastNames.length == 2)
		return lastNames[0] + ' & ' + lastNames[1];
	else
		return lastNames[0] + ' et al';
}

// Gets an individual feed item, by scraping a /lingbuzz/###### webpage.
// Used as an async callback
// Q: Which reminds me, why is this code all async anyway?
// A: Originally I thought maybe it would be served on demand, but caching the feed
//    makes more sense. So that's what happens now.
function getFeedItem(entryHtml, cb) {
	var err = null;

	// load cheerio, the faux-jQuery, for the entry HTML block from the front page
	var $ = cheerio.load(entryHtml);
	var entry = $(entryHtml);
	function textpart() { return $(this).text().trim(); }
	var authors = entry.find('td:nth-child(1) > a').map(textpart).get();
	var status = entry.find('td:nth-child(2)').text().trim(); // 'new' || 'freshly changed'
	var link = entry.find('td:nth-child(4) > a');
	var title = link.text();
	var cacheKey = link.attr('href').replace(/^\/lingbuzz\/(\d+)\/?$/, '$1');
	var href = url.resolve(DOMAIN, link.attr('href'));
	var source = url.parse(href, true).query.repo || 'lingbuzz';

	var freshFeedItemStub = {
		title: title,
		description: '',
		url: href,
		author: ('join' in authors ? authors.join('; ') : ''),
		shortAuthor: getShortAuthors(authors),
		source: source,
		guid: cacheKey,
		categories: []
	};

	function parseEntry(err, res, body) {
		if (err) {
			cb(503, '');
			console.error(err);
		}

		if (res.statusCode != 200) {
			// proxy the same status code:
			console.error(res.statusCode, http.STATUS_CODES[res.statusCode]);
			cb(res.statusCode, '');
		}

		// load cheerio, the faux-jQuery, for the entry html
		var $$ = cheerio.load(body);

		// we can read off the title like this:
		// $$('font b a').text();

		// get keywords:
		var keywords = $$('table tr:contains(keywords:) td:nth-child(2)').text();
		freshFeedItemStub.categories = keywords.split(', ');

		// find previous versions:
		var versions = $$('table tr:contains(previous versions:) td:nth-child(2) a');
		var currentVersion = versions.length + 1;
		freshFeedItemStub.guid = cacheKey + 'v' + currentVersion;

		// Turns out LingBuzz doesn't wrap the description in an element, so we
		// remove everything else and then read the body text. (!!!)
		// OMG THIS IS A TERRIBLE HACK!
		$$('body').children().remove();
		freshFeedItemStub.description = $$('body').text().trim();

		// @todo figure out how to keep date stable across "fresh" updates
// 		freshFeedItemStub.date = now;

		cache.set(cacheKey, freshFeedItemStub, function(err) {
			cb(err, freshFeedItemStub);
		});
	}

	if (source == 'lingbuzz') {
		if ( status == 'freshly changed' ) {
			console.error('FRESHLY CHANGED, SO IGNORE THE CACHE!');
			console.error('GET ' + href + ' ...');
			request({url: href, headers: HEADERS}, parseEntry);
			return;
		}
		cache.get(cacheKey, function(err, feedItem) {
			if (err) {
				console.error(err);
				console.error('GET ' + href + ' ...');
				request({url: href, headers: HEADERS}, parseEntry);
			} else if ( feedItem.title !== freshFeedItemStub.title ||
				feedItem.author !== freshFeedItemStub.author ) {
				console.error('BASIC DATA MISMATCH: ' + cacheKey);
				console.error('GET ' + href + ' ...');
				request({url: href, headers: HEADERS}, parseEntry);
			} else {
				cb(null, feedItem);
			}
		});
	} else {
		cb(err, freshFeedItemStub);
	}
}

console.error('GET ' + LINGBUZZ + ' ...');
request({url: LINGBUZZ, headers: HEADERS}, function(err, res, body) {
	if (err) {
		console.error(err);
		return;
	}

	if (res.statusCode != 200) {
		console.error(res.statusCode, http.STATUS_CODES[res.statusCode]);
		return;
	}

	// load cheerio, the faux-jQuery, for the body html
	var $ = cheerio.load(body);
	var entries = $('table table').first().find('tr');

	async.map(entries.toArray(), getFeedItem, function(err, results) {
		// look at each result; if it's a lingbuzz item, add it to the feed
		results.forEach(function(feedItem) {
		
			// if we're constructing the twitter feed, take over the title field:
			if (twitter) {
				feedItem.title = feedItem.shortAuthor + ': ' + feedItem.title;
				
				if (feedItem.title.length > TWEETLENGTH - URLLENGTH)
					feedItem.title = feedItem.title.substr(0,TWEETLENGTH - URLLENGTH - 1) + '...';
				
				feedItem.title = feedItem.title + ' ' + feedItem.url;
				
				// add hashtags:
				var twitterCategories = feedItem.categories.map(function (x) {
					return x.replace(/\s/,'');
				});
				while (twitterCategories.length) {
					var consider = twitterCategories.shift();
					if (feedItem.title.length + consider.length + 2 < TWEETLENGTH)
						feedItem.title = feedItem.title + ' #' + consider;
					else
						break;
				}
			}

			// debug:
			console.error(feedItem);

			if (feedItem.source == 'lingbuzz')
				feed.item(feedItem);
		});

		// actually write the feed:
		console.log(feed.xml());
	});
});
