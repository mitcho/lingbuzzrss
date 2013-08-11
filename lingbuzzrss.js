var request = require("request"),
	cheerio = require("cheerio"),
// 	fs = require("fs"),
	rss = require("rss"),
	async = require("async");

var lingbuzz = 'http://ling.auf.net/lingbuzz',
	domain = 'http://ling.auf.net';

feed( function(status, body) {
	console.log(body);
} );

// function for use with async
function getEntry(entry, cb) {
	var err = null;

	request(entry.url, parseEntry);
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
	
		// load cheerio, the faux-jQuery, for the body html
		var $ = cheerio.load(body);
		
		// we can read off the title like this:
		// $('font b a').text();
		
		var keywords = $('table tr:contains(keywords:) td:nth-child(2)').text();
		entry.categories = keywords.split(', ');

		// Turns out LingBuzz doesn't wrap the description in an element, so we remove
		// everything else and then read the body text. (!!!)
		// OMG THIS IS A TERRIBLE HACK!
		$('body').children().remove();
		entry.description = $('body').text().trim();
		
		cb(err, entry);	
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

		var data = entries.map(function(i, el) {
			var entry = $(el);
			var authors = entry.find('td:nth-child(1) > a').map(textpart);
			var status = entry.find('td:nth-child(2)').text();
			var link = entry.find('td:nth-child(4) > a');
			return {
				title: link.text(),
				description: '', // todo
				url: domain + link.attr('href'), // todo: make more robust
				author: authors.join('; '),
			};
		});
		
		async.map(data, getEntry, function(err, results) {
			results.forEach(function(entry) {
				feed.item(entry);
			});

			cb(200, feed.xml());
		})
	}
}