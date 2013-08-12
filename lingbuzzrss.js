var request = require("request"),
	cheerio = require("cheerio"),
	fs = require("fs"),
	rss = require("rss"),
	async = require("async"),
	url = require("url");

var lingbuzz = 'http://ling.auf.net/lingbuzz',
	domain = 'http://ling.auf.net';

feed( function(status, body) {
	console.log(body);
} );

function Cache(dir) {
	this.dir = dir;
}
Cache.prototype = {
	filename: function(key) {
		// todo: make more robust
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
			}

			try {
				data = JSON.parse(json);
				console.error('CACHE GET: ' + key);
				cb(null, data);
			} catch(err) {
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

// function for use with async
function getFeedItem(entry, cb) {
	var err = null;

	var $ = cheerio.load(entry);
	var entry = $(entry);
	var textpart = function(){ return $(this).text().trim(); }
	var authors = entry.find('td:nth-child(1) > a').map(textpart);
	var status = entry.find('td:nth-child(2)').text().trim();
	var link = entry.find('td:nth-child(4) > a');
	var cacheKey = link.attr('href').replace(/^\/lingbuzz\/(\d+)\/?$/, '$1');
	var href = url.resolve(domain, link.attr('href'));
	var source = url.parse(href, true).query['repo'] || 'lingbuzz';
	
	var freshFeedItemStub = {
		title: link.text(),
		description: '',
		url: href,
		author: authors.join('; '),
		source: source
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

		var keywords = $$('table tr:contains(keywords:) td:nth-child(2)').text();
		freshFeedItemStub.categories = keywords.split(', ');

		// Turns out LingBuzz doesn't wrap the description in an element, so we
		// remove everything else and then read the body text. (!!!)
		// OMG THIS IS A TERRIBLE HACK!
		$$('body').children().remove();
		freshFeedItemStub.description = $$('body').text().trim();

		cache.set(cacheKey, freshFeedItemStub, function(err) {
			cb(err, freshFeedItemStub);
		})
	}
	
	if (source == 'lingbuzz') {
		if ( status == 'freshly changed' ) {
			console.error('FRESHLY CHANGED, SO IGNORE THE CACHE!');
			console.error('GET ' + href + ' ...');
			request(href, parseEntry);
			return;
		}
		cache.get(cacheKey, function(err, feedItem) {
			if (err) {
				console.error(err);
				console.error('GET ' + href + ' ...');
				request(href, parseEntry);
			} else if ( feedItem.title !== freshFeedItemStub.title ||
				feedItem.author !== freshFeedItemStub.author ) {
				console.error('BASIC DATA MISMATCH: ' + cacheKey);
				console.error(feedItem.title,freshFeedItemStub.title,feedItem.author,freshFeedItemStub.author)
				console.error('GET ' + href + ' ...');
				request(href, parseEntry);			
			} else {
				cb(null, feedItem);
			}
		});
	} else {
		cb(err, freshFeedItemStub);
	}
}

function feed( cb ) {
	var feed = new rss({
		title: 'LingBuzz',
		description: 'archive of linguistics articles',
		feed_url: 'http://mitcho.com/rss/lingbuzz.xml',
		site_url: 'http://ling.auf.net/lingbuzz',
		// image_url: 'http://example.com/icon.png',
		// docs: 'http://example.com/rss/docs.html',
		author: 'LingBuzz',
		// managingEditor: 'Dylan Greene',
		webMaster: 'Michael Yoshitaka Erlewine <mitcho@mitcho.com>',
		// copyright: '2013 Dylan Greene',
		language: 'en',
		categories: ['linguistics'],
		pubDate: 'May 20, 2012 04:00:00 GMT', // todo: fix
		ttl: '60' // todo: fix?
	});

	console.error('GET ' + lingbuzz + ' ...');
	request(lingbuzz, buzzed);
	function buzzed(err, res, body) {
		if (err) {
			cb(503, '');
			console.error(err);
		}
	
		if (res.statusCode != 200) {
			// proxy the same status code:
			console.error(res.statusCode, http.STATUS_CODES[res.statusCode]);
			cb(res.statusCode,'');
		}
	
		// load cheerio, the faux-jQuery, for the body html
		var $ = cheerio.load(body);
		var entries = $('table table').first().find('tr');

		async.map(entries.toArray(), getFeedItem, function(err, results) {
			results.forEach(function(feedItem) {
				console.error(feedItem);
				if (feedItem.source == 'lingbuzz')
					feed.item(feedItem);
			});

			cb(200, feed.xml());
		})
	}
}