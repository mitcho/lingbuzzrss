var request = require("request"),
	cheerio = require("cheerio"),
// 	fs = require("fs"),
	rss = require("rss"),
	async = require("async")
	url = require("url");

var lingbuzz = 'http://ling.auf.net/lingbuzz',
	domain = 'http://ling.auf.net';

feed( function(status, body) {
	console.log(body);
} );

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
		var textpart = function(){ return $(this).text(); }
		var entries = $('table table').first().find('tr');

		// function for use with async
		function getFeedItem(entry, cb) {
			var err = null;

			var entry = $(entry);
			var authors = entry.find('td:nth-child(1) > a').map(textpart);
			var status = entry.find('td:nth-child(2)').text();
			var link = entry.find('td:nth-child(4) > a');
			var href = url.resolve(domain, link.attr('href'));
			var source = url.parse(href, true).query['repo'] || 'lingbuzz';
			feedItem = {
				title: link.text(),
				description: '',
				url: href,
				author: authors.join('; '),
				source: source
			};
			console.error(feedItem);

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
				feedItem.categories = keywords.split(', ');

				// Turns out LingBuzz doesn't wrap the description in an element, so we
				// remove everything else and then read the body text. (!!!)
				// OMG THIS IS A TERRIBLE HACK!
				$$('body').children().remove();
				feedItem.description = $$('body').text().trim();
		
				cb(err, feedItem);	
			}
			if (source == 'lingbuzz')
				request(feedItem.url, parseEntry);
			else
				cb(err, feedItem);
		}

		async.map(entries.toArray(), getFeedItem, function(err, results) {
			results.forEach(function(feedItem) {
				console.log(feedItem);
				if (feedItem.source == 'lingbuzz')
					feed.item(feedItem);
			});

			cb(200, feed.xml());
		})
	}
}