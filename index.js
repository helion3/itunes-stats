#!/usr/bin/env node

var _ = require('lodash');
var colors = require('colors');
var fs = require('fs');
var md5 = require('md5');
var path = require('path');
var plist = require('plist');
var program = require('commander');
var Table = require('cli-table2');

program
    .version('0.0.1')
    .option('-i, --index', 'Index the Library.xml data')
    .option('-r, --report', 'Display the report')
    .parse(process.argv);

if (program.index) {
    // Read the Library XML data
    var data = plist.parse(fs.readFileSync(path.join(__dirname, 'Library.xml'), 'utf8'));

    var albums = {};
    var output = [];
    _.each(data.Tracks, function(track) {
        // Extract track data
        var album = track.Album;
        var artist = track.Artist;
        var rating = _.get(track, 'Rating', 0);
        var plays = _.get(track, 'Play Count', 0);

        if (album && artist) {
            // Hash album for equality
            var albumHash = md5(album + artist);

            // Initialize album object if not already present
            if (!albums[albumHash]) {
                albums[albumHash] = {
                    album: album,
                    artist: artist,
                    trackCount: 0,
                    trackRatings: [],
                    trackPlays: []
                };
            }

            // Increment counts
            albums[albumHash].trackCount++;
            albums[albumHash].trackRatings.push(rating / 20);
            albums[albumHash].trackPlays.push(plays);
        }
    });

    // Calculate totals
    _.each(albums, function(album, hash) {
        if (album.trackCount > 4) {
            var plays = _.sum(album.trackPlays);
            var rating = _.sum(album.trackRatings);

            album.hash = hash;
            album.averagePlays = _.floor(plays / album.trackCount);
            album.averageRating = _.round(rating / album.trackCount, 2);
            album.listenability = _.round((album.averagePlays / 100) + album.averageRating, 2);

            delete album.trackPlays;
            delete album.trackRatings;

            output.push(album);
        }
    });

    // Output to cache
    fs.writeFile('./cached.json', JSON.stringify(output), function(err) {
        if (err) {
            return console.log(err);
        }
    });
}

if (program.report) {
    fs.readFile('./cached.json', 'utf8', function(err, data) {
        if (err) {
            return console.log(err);
        }

        var albums = JSON.parse(data);

        // Sort by listenability, DESC
        var sorted = _.slice(_.reverse(_.sortBy(albums, [function(album) {
            return album.listenability;
        }])), 0, 100);

        // Build table output
        var table = new Table({
            head:['No', 'Album', 'Artist', 'Rating', 'Plays', 'Listenability']
        });

        var i = 1;
        _.each(sorted, function(album) {
            table.push([i, album.album, album.artist, colors.cyan(album.averageRating), album.averagePlays, album.listenability]);
            i++;
        });

        // Print
        console.log(table.toString());
    });
}
