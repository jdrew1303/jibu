# jibu
Easy module to create channels and their commands then retrieve the same with the power of Full Text search and synonym query expansion. Built to be independent, ready to run and use with multiple languages.

#How To Use Jibu
Install using: **npm install --save jibu**

```javascript

var path = require('path');

//JIBU options
var options={
  db: path.join(__dirname,'data'), //this is the directory path to our pouchdb database
  debug: true //default false
};

//initialize Library
var jj = require('jibu')(options);


//prepare some commands/documents to add into index
var docs =
[

  {
    channel:'Nairobi',
    command: 'parties',
    command_syns:['party','rave','disco','festival','nightlife','bash','food','drinks','ALCOHOL***'],
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
var channel = 'nairobi';

//load index
// jj.loadIndex(channel);

//Now add some new commands
jj.addCommands(docs, channel);

//these is how you remove commands from index
// jj.removeCommands(docs, channel);

//ready for some awesome queries
var q= 'where is the party happening this weekend?';

//run query
var results= jj.jibu(q, channel);

//log results
console.log(JSON.stringify(results,0,4));



```
