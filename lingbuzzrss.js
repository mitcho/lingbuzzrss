var request = require("request"),
	cheerio = require("cheerio"),
// 	fs = require("fs"),
	rss = require("rss");

var lingbuzz = 'http://ling.auf.net/lingbuzz',
	domain = 'http://ling.auf.net';

feed( function(status, body) {
	console.log(body);
} );

function memoizedRequest(url, cb) {
	// todo: add caching
	console.error('GET ' + url + ' ...');
	request(url, cb);
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

	memoizedRequest(lingbuzz, buzzed);
	function buzzed(err, res, body) {
		if (err) {
			cb(503, '');
			console.error(err);
		}
	
		if (res.statusCode != 200) {
			// proxy the same status code:
			cb(res.statusCode,'');
			console.error(res.statusCode, http.STATUS_CODES[res.statusCode]);
		}
	
		// load cheerio, the faux-jQuery, for the body html
		var $ = cheerio.load(body);
		var textpart = function(){ return $(this).text(); }
		var entries = $('table table').first().find('tr');
		entries.each(function(i, el) {
			var entry = $(el);
			var authors = entry.find('td:nth-child(1) > a').map(textpart);
			var status = entry.find('td:nth-child(2)').text();
			var link = entry.find('td:nth-child(4) > a');
			feed.item({
				title: link.text(),
				description: '', // todo
				url: domain + link.attr('href'), // todo: make more robust
				author: authors.join('; '),
			});
		});

		cb(200, feed.xml());
	}
}