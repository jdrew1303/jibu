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
    search:['party','bash','food','drinks', 'price 900'],
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
    search:'clothes,shoes,belts,caps,fashion,design,kungara,nguo,kofia,kitenge',
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
// jj.addCommands(docs, channel);

//this is how you remove commands from index
// jj.removeCommands(docs, channel);

// ready for some awesome queries
q= 'price of clothes is less than five thousand and more than 600';
// q ='jhsgjhshsjh'
// q= 'price of clothes'

//run query
var results= jj.jibu(q, channel);
//log results
console.log(JSON.stringify(results,0,4));

// we can even do some interesting numeric queries to return lesser than, equal to or even greater than values
//the beauty of this search type is that it allows data entry in plain text or using mathematical symbols

// q= 'price is less than or equal to 900';
// //run query
// var results= jj.jibu(q, channel);
// //log results
// console.log(JSON.stringify(results,0,4));
//
// q= 'price <= 900';
// //run query
// var results= jj.jibu(q, channel);
// //log results
// console.log(JSON.stringify(results,0,4));
