const SpotifyWebApi = require('spotify-web-api-node');
const express = require('express');
const app = express();
const cors = require('cors');

// Adding middleware
app.use(cors());

// Set up the Spotify API credentials (replace these with your own)
const spotifyApi = new SpotifyWebApi({
	clientId: '74f1ad1416024d098678c349a9d82873',
	clientSecret: '3500485dfc1e433da89b0d0e2de26a60',
	redirectUri: 'http://localhost:5173/',
});

// Get an access token
async function getAccessToken() {
	const data = await spotifyApi.clientCredentialsGrant();
	return data.body['access_token'];
}

// Search for a track by name
async function searchTrackByName(trackName) {
	const accessToken = await getAccessToken();
	spotifyApi.setAccessToken(accessToken);
	const data = await spotifyApi.searchTracks(trackName, { limit: 1 });
	return data.body.tracks.items[0];
}

// Search for tracks by name
async function getSongTitles(title, limit) {
	// spotify access stuff
    const accessToken = await getAccessToken();
    spotifyApi.setAccessToken(accessToken);

    // get the list of songs
    const data = await spotifyApi.searchTracks(title, { limit: limit });

	// get the data for each song to return 
    const results = await Promise.all(
        data.body.tracks.items.map(async (title) => {
            const audioFeatures = await getAudioFeaturesForTrack(title.id);
			return {
                name: title.name,
                artists: title.artists.map((artist) => artist.name),
                scale: combineKeyAndMode(audioFeatures.key, audioFeatures.mode),
                bpm: audioFeatures.tempo,
                key: convertKeyToPitchClass(audioFeatures.key),
                mode: convertModeToMajorOrMinor(audioFeatures.mode),
                id: title.id,
            }
        })
    )
    return results;
}

// Get the audio features for a track
async function getAudioFeaturesForTrack(trackId) {
	const accessToken = await getAccessToken();
	spotifyApi.setAccessToken(accessToken);
	const data = await spotifyApi.getAudioFeaturesForTrack(trackId);
	return data.body;
}
// Convert the key to a pitch class
function convertKeyToPitchClass(key) {
	const pitchClasses = [
		'C',
		'C#/Db',
		'D',
		'D#/Eb',
		'E',
		'F',
		'F#/Gb',
		'G',
		'G#/Ab',
		'A',
		'A#/Bb',
		'B',
	];
	return pitchClasses[key];
}
// Convert the mode to major or minor
function convertModeToMajorOrMinor(mode) {
	if (mode === 0) {
		return 'minor';
	}
	return 'major';
}

// Function to search for a song by its ID
async function searchTrackById(songId) {
    try {
        const accessToken = await getAccessToken();
        spotifyApi.setAccessToken(accessToken); // Set the access token
        // Retrieve track information using the getTrack method
        const { body: track } = await spotifyApi.getTrack(songId);
        // Return the track details
        return track;
    } catch (error) {
        console.error('Error searching for song:', error);
        return null;
    }
}


async function testSearchTracksById(trackName) {
	const trackNames = await searchTrackByName(trackName);
	const trackId = trackNames.id;
	//console.log(trackId);
	const tracks = await searchTrackById(trackId);
	if (tracks === null) {
		console.log('This track was unrecognized in the spotify data base.');
		return;
	}
	console.log(tracks.name);
}
//testSearchTracksById('Despacito');

async function testSearchTracksByFeature(genres, features, limit) {
	const tracks = await searchTracksByFeature(genres, features, limit);
	console.log(tracks);
}


// Search for tracks with same keys and bpm
// return tracks (and the artists) that have a similar key and bpm to the provided track
async function searchTracksWithSimilarFeaturesByName(trackName, featureOptions, limit) {
    // Search for the track
    const track = await searchTrackByName(trackName);
    // Returns null if track doesn't exist
    if (track === null) {
        return null;
    }
    const trackId = track.id;

    // Get the audio features for the track
    const trackFeature = await getAudioFeaturesForTrack(trackId);
    // Set the options for the recommendations
    const recommendationsOptions = {
        seed_tracks: [trackId],
        limit: limit || 20, // default limit to 20 if not provided
    };
    // Add the feature options to the recommendations
    if (Object.keys(featureOptions).length === 0) {
        // If featureOptions is empty, match all features
        recommendationsOptions.target_danceability = trackFeature.danceability;
        recommendationsOptions.target_energy = trackFeature.energy;
        recommendationsOptions.target_key = trackFeature.key;
        recommendationsOptions.target_loudness = trackFeature.loudness;
        recommendationsOptions.target_mode = trackFeature.mode;
        recommendationsOptions.target_speechiness = trackFeature.speechiness;
        recommendationsOptions.target_acousticness = trackFeature.acousticness;
        recommendationsOptions.target_instrumentalness =
            trackFeature.instrumentalness;
        recommendationsOptions.target_liveness = trackFeature.liveness;
        recommendationsOptions.target_valence = trackFeature.valence;
        recommendationsOptions.target_tempo = trackFeature.tempo;
        recommendationsOptions.target_duration_ms = trackFeature.duration_ms;
        recommendationsOptions.target_time_signature = trackFeature.time_signature;
    } else {
        // Apply featureOptions
        for (const feature in featureOptions) {
            if (featureOptions[feature]) {
                recommendationsOptions[`target_${feature}`] = trackFeature[feature];
            }
        }
    }
    // Get the recommendations
    const recommendations = await spotifyApi.getRecommendations(recommendationsOptions);
    // Filter out the original track from the recommendations
    const filteredRecommendations = recommendations.body.tracks.filter(track => track.id !== trackId);
    // Returns an array of tracks that are similar to the provided track
    const results = await Promise.all(
        filteredRecommendations.map(async (track) => {
            const audioFeatures = await getAudioFeaturesForTrack(track.id);
            return {
                name: track.name,
                artists: track.artists.map((artist) => artist.name),
                id: track.id,
                scale: combineKeyAndMode(audioFeatures.key, audioFeatures.mode),
                bpm: audioFeatures.tempo,
                key: convertKeyToPitchClass(audioFeatures.key),
                mode: convertModeToMajorOrMinor(audioFeatures.mode),
                release_date: track.album.release_date,
                danceability: audioFeatures.danceability,
                energy: audioFeatures.energy,
                loudness: audioFeatures.loudness,
                speechiness: audioFeatures.speechiness,
                acousticness: audioFeatures.acousticness,
                instrumentalness: audioFeatures.instrumentalness,
                liveness: audioFeatures.liveness,
                valence: audioFeatures.valence,
                duration_ms: audioFeatures.duration_ms,
                time_signature: audioFeatures.time_signature,
                uri: audioFeatures.uri,
            };
        })
    );
    return results;
}




// Search for tracks with same keys and bpm
// return tracks (and the artists) that have a similar key and bpm to the provided track
async function searchTracksWithSimilarFeaturesById(songId, featureOptions, limit) {
    // Search for the track
    const track = await searchTrackById(songId);
    // Returns null if track doesn't exist
    if (track === null) {
        return null;
    }
    const trackId = track.id;

    // Get the audio features for the track
    const trackFeature = await getAudioFeaturesForTrack(trackId);
    // Set the options for the recommendations
    const recommendationsOptions = {
        seed_tracks: [trackId],
        limit: limit || 20, // default limit to 20 if not provided
    };
    // Add the feature options to the recommendations
    if (Object.keys(featureOptions).length === 0) {
        // If featureOptions is empty, match all features
        recommendationsOptions.target_danceability = trackFeature.danceability;
        recommendationsOptions.target_energy = trackFeature.energy;
        recommendationsOptions.target_key = trackFeature.key;
        recommendationsOptions.target_loudness = trackFeature.loudness;
        recommendationsOptions.target_mode = trackFeature.mode;
        recommendationsOptions.target_speechiness = trackFeature.speechiness;
        recommendationsOptions.target_acousticness = trackFeature.acousticness;
        recommendationsOptions.target_instrumentalness =
            trackFeature.instrumentalness;
        recommendationsOptions.target_liveness = trackFeature.liveness;
        recommendationsOptions.target_valence = trackFeature.valence;
        recommendationsOptions.target_tempo = trackFeature.tempo;
        recommendationsOptions.target_duration_ms = trackFeature.duration_ms;
        recommendationsOptions.target_time_signature = trackFeature.time_signature;
    } else {
        // Apply featureOptions
        for (const feature in featureOptions) {
            if (featureOptions[feature]) {
                recommendationsOptions[`target_${feature}`] = trackFeature[feature];
            }
        }
    }
    // Get the recommendations
    const recommendations = await spotifyApi.getRecommendations(recommendationsOptions);
    // Filter out the original track from the recommendations
    const filteredRecommendations = recommendations.body.tracks.filter(track => track.id !== trackId);
    // Returns an array of tracks that are similar to the provided track
    const results = await Promise.all(
        filteredRecommendations.map(async (track) => {
            const audioFeatures = await getAudioFeaturesForTrack(track.id);
            return {
                name: track.name,
                artists: track.artists.map((artist) => artist.name),
                id: track.id,
                scale: combineKeyAndMode(audioFeatures.key, audioFeatures.mode),
                bpm: audioFeatures.tempo,
                key: convertKeyToPitchClass(audioFeatures.key),
                mode: convertModeToMajorOrMinor(audioFeatures.mode),
                release_date: track.album.release_date,
                danceability: audioFeatures.danceability,
                energy: audioFeatures.energy,
                loudness: audioFeatures.loudness,
                mode: convertModeToMajorOrMinor(audioFeatures.mode),
                speechiness: audioFeatures.speechiness,
                acousticness: audioFeatures.acousticness,
                instrumentalness: audioFeatures.instrumentalness,
                liveness: audioFeatures.liveness,
                valence: audioFeatures.valence,
                duration_ms: audioFeatures.duration_ms,
                time_signature: audioFeatures.time_signature,
                uri: audioFeatures.uri,
            };
        })
    );
    return results;
}




// Convert pitch class to key
function convertPitchClassToKey(pitchClass) {
	const pitchClasses = [
		'C',
		'C#/Db',
		'D',
		'D#/Eb',
		'E',
		'F',
		'F#/Gb',
		'G',
		'G#/Ab',
		'A',
		'A#/Bb',
		'B',
	];
	return pitchClasses.indexOf(pitchClass);
}

function combineKeyAndMode(key, mode) {
    const pitchClasses = [
        'C',
        'C#/Db',
        'D',
        'D#/Eb',
        'E',
        'F',
        'F#/Gb',
        'G',
        'G#/Ab',
        'A',
        'A#/Bb',
        'B',
    ];

    const keyName = pitchClasses[key]; // Get the pitch class name from the key value
    const modeName = mode === 0 ? 'minor' : 'major'; // Convert mode value to 'minor' or 'major'

    return keyName + ' ' + modeName; // Combine key name and mode name with a space
}

// Convert major or minor to mode
function convertMajorOrMinorToMode(majorOrMinor) {
	majorOrMinor = majorOrMinor.toLowerCase();
	if (majorOrMinor === 'minor') {
		return 0;
	}
	return 1;
}
// Transforms the feature options to the format required by the Spotify API
function transformFeatureOptions(featureOptions) {
	const transformed = {};
	featureOptions.key = convertPitchClassToKey(featureOptions.key);
	featureOptions.mode = convertMajorOrMinorToMode(featureOptions.mode);
	for (const option in featureOptions) {
		transformed['target_' + option] = featureOptions[option];
	}
	return transformed;
}
// Search for tracks matching the specified genres and features
// return tracks that match the specified genres and features
async function searchTracksByFeature(genres, features, limit) {
	const accessToken = await getAccessToken();
	spotifyApi.setAccessToken(accessToken);
	const transformedFeatures = transformFeatureOptions(features);
	// Get the recommendations
	const recommendations = await spotifyApi.getRecommendations({
		seed_genres: genres,
		...transformedFeatures,
		limit: limit || 20,
	});
	//console.log(transformedFeatures);
	// Returns an array of tracks that match the specified genres and features
	const results = await Promise.all(
		recommendations.body.tracks.map(async (track) => {
			const audioFeatures = await getAudioFeaturesForTrack(track.id);
			return {
				name: track.name,
				artists: track.artists.map((artist) => artist.name),
				id: track.id,
				release_date: track.album.release_date,
				danceability: audioFeatures.danceability,
				energy: audioFeatures.energy,
				key: convertKeyToPitchClass(audioFeatures.key),
				loudness: audioFeatures.loudness,
				mode: convertModeToMajorOrMinor(audioFeatures.mode),
				speechiness: audioFeatures.speechiness,
				acousticness: audioFeatures.acousticness,
				instrumentalness: audioFeatures.instrumentalness,
				liveness: audioFeatures.liveness,
				valence: audioFeatures.valence,
				tempo: audioFeatures.tempo,
				duration_ms: audioFeatures.duration_ms,
				time_signature: audioFeatures.time_signature,
			};
		})
	);
	return results;
}
// Prints the array of tracks that have similar keys and bpm to the provided track
async function testSearchTracksWithSimilarFeaturesByName(
	trackName,
	featureOptions,
	limit
) {
	const tracks = await searchTracksWithSimilarFeaturesByName(
		trackName,
		featureOptions,
		limit
	);
	if (tracks === null) {
		console.log('This track was unrecognized in the spotify data base.');
		return;
	}
	console.log(tracks);
}

async function testSearchTracksWithSimilarFeaturesById(
	trackId,
	featureOptions,
	limit
) {
	const tracks = await searchTracksWithSimilarFeaturesById(
		trackId,
		featureOptions,
		limit
	);
	if (tracks === null) {
		console.log('This track was unrecognized in the spotify data base.');
		return;
	}
	console.log(tracks);
}

async function testSearchTracksByFeature(genres, features, limit) {
	const tracks = await searchTracksByFeature(genres, features, limit);
	console.log(tracks);
}
// testSearchTracksWithSimilarFeatures('treasure', {}, 2);
// testSearchTracksByFeature(['pop'], { duration_ms: 190000 }, 5);


// Example usage
//testSearchTracksWithSimilarFeatures('Despacito', {}, 5);
//testSearchTracksWithSimilarFeaturesById('6habFhsOp2NvshLv26DqMb', {tempo: false, key: true}, 5);
//testSearchTracksWithSimilarFeaturesByName('Despacito', {tempo: false, key: true}, 5);



app.use(express.json());

/*
app.get('/api/songs/searchTracksByFeature', async (req, res) => {
	try {
		const genres = req.query.genres ? req.query.genres.split(',') : [];
		const features = req.query.features ? req.query.features : {};
		const limit = req.query.limit;

		const tracks = await searchTracksByFeature(genres, features, limit);
		res.json(tracks);
	} catch (error) {
		console.error(error);
		res
			.status(500)
			.json({ error: 'An error occurred while searching for tracks.' });
	}
});*/

app.get('/api/searchTracksWithSimilarFeaturesById', async (req, res) => {
    try {
        console.log(req.query);
        // Extract parameters from the request query
        const { songId, featureOptions, limit } = req.query;

        if (!songId) {
            return res.status(400).json({error: "Missing song Id"});
        }


        if (!featureOptions) {
            return res.status(400).json({error: "Missing feature options"});
        }

        // Call the searchTracksWithSimilarFeaturesById function with the provided parameters
        const tracks = await searchTracksWithSimilarFeaturesById(songId, featureOptions, limit);

        // Send the retrieved tracks as a JSON response
        res.json(tracks);
    } catch (error) {
        console.error('Error searching for tracks:', error);
        res.status(500).json({ error: 'An error occurred while searching for tracks.' });
    }
});



// Define a route for getting song titles
app.get('/api/songs/getSongTitles', async (req, res) => {
    const { title, limit } = req.query; //query parameters 
    try {
        const titles = await getSongTitles(title, parseInt(limit)); // Parse limit as an integer
        res.json(titles); // Send the retrieved titles as JSON response
    } catch (error) {
        console.error('Error occurred:', error);
        res.status(500).json({ error: 'An error occurred while fetching song titles.' });
    }
});
//added variable port
const port = process.env.PORT || 7000;

app.listen(port, () =>
    console.log(`Server is running on http://localhost:${port}`)
);
