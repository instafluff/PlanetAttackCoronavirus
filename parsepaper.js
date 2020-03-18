require( "dotenv" ).config();

const fetch = require( "node-fetch" );
const parse = require( "csv-parse/lib/sync" );
const fs = require( "fs" );
let csvFile = fs.readFileSync( "CORD-19/all_sources_metadata_2020-03-13.csv" ).toString();
// console.log( csvFile );
const keyphrasesFileName = "public/keyphrases.json";
let keyPhrasesFile = fs.readFileSync( keyphrasesFileName ).toString();
let paperData = JSON.parse( keyPhrasesFile );

analyzePapers();

async function analyzePapers() {
	const records = parse( csvFile, {
	  columns: true,
	  skip_empty_lines: true
	});
	console.log( records.length );
	// console.log( records[ 0 ] );
	console.log( records.filter( x => !!x.abstract && !!x.doi ).length );
	for( let i = 0; i < records.length; i++ ) {
		let record = records[ i ];
		console.log( "Processing #" + i );
		if( record.doi && !paperData[ record.doi ] ) {
			console.log( "New Record:", record.doi );
			// record.doi
			// record.sha
			// record.source_x
			// record.pmcid
			// record.pubmed_id
			// record.license
			// record.authors
			// record.journal
			// record[ "Microsoft Academic Paper ID" ]
			// record[ "WHO #Covidence" ]
			// record.has_full_text
			let texts = [ record.title ];
			if( !!record.abstract ) {
				let words = record.abstract.split( " " );
				for( let w = 0; w < words.length; w += 600 ) {
					texts.push( removeLinks( words.slice( w, w + 600 ).join( " " ) ) );
				}
			}
			let analysis = await getTextAnalysis( texts );
			if( analysis.errors && analysis.errors.length > 0 ) {
				console.log( record );
				console.log( "ERROR:", analysis.errors, analysis.errors[ 0 ].error.innerError );
				// return;
				continue;
			}
			if( analysis.documents && analysis.documents.length > 0 ) {
				console.log( analysis.documents.length > 0 ? analysis.documents[ 0 ].keyPhrases : [] );
				paperData[ record.doi ] = {
					doi: record.doi,
					sha: record.sha,
					title: record.title,
					source_x: record.source_x,
					pmcid: record.pmcid,
					pubmed_id: record.pubmed_id,
					license: record.license,
					authors: record.authors,
					journal: record.journal,
					microsoft_id: record[ "Microsoft Academic Paper ID" ],
					who_cov: record[ "WHO #Covidence" ],
					hasFullText: record.has_full_text,
					keyPhrases: {
						title: analysis.documents.length > 0 ? analysis.documents[ 0 ].keyPhrases : [],
						abstract: analysis.documents.length > 1 ? [].concat.apply( [], analysis.documents.slice( 1 ).map( d => d.keyPhrases ) ) : [],
					},
				};
				fs.writeFileSync( keyphrasesFileName, JSON.stringify( paperData ) );
			}
			else {
				// console.log( record );
				console.log( "Looks like it timed out. Let's wait..." );
				i--; // Resume from current record
				await sleep( 60000 );
			}
			// await sleep( 250 );
			// return;
		}
	}
	console.log( "DONE!" );
}

async function getTextAnalysis( texts ) {
	let result = await fetch(
		"https://westus2.api.cognitive.microsoft.com/text/analytics/v3.0-preview.1/keyPhrases?showStats",
		// "https://planetattack.cognitiveservices.azure.com/text/analytics/v3.0-preview.1/keyPhrases",
		{
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"Ocp-Apim-Subscription-Key": process.env.AZURE_TEXT_API_KEY,
			},
			body: JSON.stringify({
				"documents": texts.map( (t, i) => ({
			      "language": "en",
			      "id": i + 1,
			      "text": t
				}))
			})
		}).then( x => x.json() );
	// console.log( result );
	return result;
}

function removeLinks( inputText ) {
    var replacedText, replacePattern1, replacePattern2, replacePattern3;

    //URLs starting with http://, https://, or ftp://
    replacePattern1 = /(\b(https?|ftp):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/gim;
    replacedText = inputText.replace(replacePattern1, '');

    //URLs starting with "www." (without // before it, or it'd re-link the ones done above).
    replacePattern2 = /(^|[^\/])(www\.[\S]+(\b|$))/gim;
    replacedText = replacedText.replace(replacePattern2, '');

    //Change email addresses to mailto:: links.
    replacePattern3 = /(([a-zA-Z0-9\-\_\.])+@[a-zA-Z\_]+?(\.[a-zA-Z]{2,6})+)/gim;
    replacedText = replacedText.replace(replacePattern3, '');

    return replacedText;
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
