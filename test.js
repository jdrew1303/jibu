var path = require('path');

//JIBU options
var options={
  db: path.join(__dirname,'data'), //this is the directory path to our pouchdb database
  debug: true //default false
};

//ok lets start jibu
var j = require('./lib/jibu')(options);

//create some document
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



//add the document to jibu
j.addCommand(docs, function(){
  //ok let us run a query
  var querySring = 'where is the party happening this weekend?';
  var channel = 'nairobi';

  //OK let us now fetch some answers (majibu) from the channel
  j.jibu(channel,querySring, function(jibu){
      console.log(JSON.stringify(jibu,0,4));
  });

  querySring = 'nitapata wapi nguo hii Nairobi sasa?';
  channel = 'nairobi';

  //OK let us now fetch some answers (majibu) from the channel
  j.jibu(channel,querySring, function(jibu){
      console.log(JSON.stringify(jibu,0,4));
  });

});
