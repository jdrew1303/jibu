# jibu
Easy module to create channels and their commands then retrieve the same with the power of Full Text search and synonym query expansion. Built to be independent, ready to run and use with multiple languages.

## But Why?
Jibu is written for small data projects with full text search requirements and some numeric search intelligence. But wait, that's not the main reason, so let's try again...

'Jibu' is Swahili for 'Answer'. It is a tiny data management system written to ensure that, as much as possible, it always gives an answer to your queries. In other words, think full text that works extra hard to ensure that you get an answer. An answer.

Of course, it does not manufacture answers so it will still return no results for queries that match no document, but whenever possible, especially where words and numbers (even as text) are used in queries, jibu will try its best to have a response.

## Oh! Mercy Results?
Ok, if you enter a natural language query, jibu will translate it into a full text and a numeric query. We prioritize the full text query and use the numeric query to play the role of a _reducer_ or _expander_ of the results in a bid to ensure there's at least one result.

Where the numeric query is used to expand results, then those are tagged as _mercy_results_ (Jibu, is out of pity, answering you anyway).

## OK. But which lunatic would use Jibu and why the hell?
Jibu was developed as the data management module for Telegram bots. When you think of it, when you have a bot, you want it to use the vast data you train (read save) it on to give a response, some response. You also want that response to be intelligent, right?

## How Much Data?
Jibu is built to work on small projects where a bot has a couple of thousands of commands at most. Any other bigger project, Goddamnit! Get a proper database like _Elasticsearch_, come on!

# How To Use Jibu
Install using: **npm install --save jibu**

```javascript

var path = require('path');

//JIBU options
var options={
  db_path: path.join(__dirname,'data'), //this is the directory path to our pouchdb database
  debug: true //default false
};

//initialize Library
var jj = require('./lib/jibu')(options);


//prepare some commands/documents to add into index
var docs =
[

  {
    channel:'Nairobi',
    command: 'parties',
    command_syns:['party','bash','food','drinks', 'price 900'],
    response:[
      {
        "name": "Godown Bash",
        "where": "Godown Nairobi",
        "who": "Ladies only 18+ years"
      },
      {
        "name": "Back-to-school Party",
        "where": "Nairobi High School",
        "who": "All High School Students"
      }
    ]
  },
  {
    channel:'Nairobi',
    command: 'fashion',
    command_syns:'clothes,shoes,belts,caps,fashion,design,kungara,nguo,kofia,kitenge'.split(','),
    response:[
      {
        "designer": "Trendy Joys Designs",
        "bio": "Best ladies designs in nairobi"
      },
      {
        "designer": "Blah Fashions",
        "bio": "Blah Blah Blah"
      }
    ]
  }

];

//set channel
var channel = 'NAIROBI';

//load index - NOT important, you will often never use this command
// jj.loadIndex(channel);

//Now add some new commands
jj.addCommands(docs, channel);

//this is how you remove commands from index
// jj.removeCommands(docs, channel);

// ready for some awesome queries
q= 'price is less than 500';
//run query
var results= jj.jibu(q, channel);
//log results
console.log(JSON.stringify(results,0,4));

// we can even do some interesting numeric queries to return lesser than, equal to or even greater than values
//the beauty of this search type is that it allows data entry in plain text or using mathematical symbols

// ready for some awesome queries
q= 'price of clothes is less than five thousand and more than 600';
//run query
var results= jj.jibu(q, channel);
//log results
console.log(JSON.stringify(results,0,4));

//this retuns the following results with the following metadata
/**
"meta": {                                                                    
    "query": "price of clothes is less than five thousand and more than 600",           
    "time": "66ms",                                                          
    "results_count": 1,                                                      
    "query_path": [                                                          
        {                                                                    
            "query": "price of clothes is less than five thousand and more than 600",   
            "type": "Full Text",                                             
            "results_count": 2                                               
        },                                                                   
        {                                                                    
            "query": "number < 5000 && number > 600",                        
            "type": "Numeric Reduce",                                      
            "results_count": 1                                               
        }                                                                    
    ],                                                                       
    "mercy_results": false  
}                                                 
**/

q= 'price <= 900';
//run query
var results= jj.jibu(q, channel);
//log results
console.log(JSON.stringify(results,0,4));

```

### Explanations
The query_path field tells us how the query was run.
1. First, the query _price of clothes is less than five thousand and more than 600_ was run as _Full Text_ and _2 results_ were found.
2. Then, the query and results were passed to the _numericQuery_ engine and the query '_number < 5000 && number > 600_' was run with a _boolean &&_ mode.
3. Because we already had results from the full text query, then _numericQuery_ engine _reduced_ the results to _1_ that met both Full Text and numericQuery conditions.

### Note
If Full Text Query had found no results, the numericQuery would have automatically changed its role to that of expanding results rather than reducing.
