var PouchDB = require('pouchdb');
var PouchDBSearch =require('pouchdb-quick-search');
var pouchCollate = require('pouchdb-collate');
var path = require('path');
var mkdirp = require('mkdirp');
var _ = require('lodash');
var async = require('async');


//enable plugin
PouchDB.plugin(PouchDBSearch);



//create db


var JIBU = function(options){

  JIBU.options = _.extend(
    {
      db: path.join(__dirname,'..','db'),
      debug: false
    },options);

    //debug mode?
    if(JIBU.options.debug){
      PouchDB.debug.enable('*');
    }

    //make db directory
    mkdirp.sync( JIBU.options.db );
    //initialize database
    JIBU.pouch = new PouchDB( path.join(JIBU.options.db,'jibu') );

};


 module.exports = function(options){
   return new JIBU(options);
 };

 JIBU.prototype ={
   addCommand : addCommand,
   jibu : jibu
 };


//the main function that gets the jibu after channel & query are entered
function jibu(channel,queryString, callback){

  //format queryString
  modifyQueryString(channel,queryString,function(QS){
    JIBU.pouch.search({
      query: QS,
      fields: {
        'command_syns': 1,
        'channel': 5
      },
      include_docs: true
    }).then(function (res) {
      //callback
      callback(
        _.merge(
          {
            "meta":{
              "total_rows": res.total_rows,
              "original-QS":queryString,
              "used-QS":QS
            }
          },
          _.omit(res,'total_rows')
        )
      );

    }).catch(function (err) {
      // handle error
      // console.log('ERROR',err);
      callback(
        {
          "meta":{
            "total_rows": 0,
            "original-QS":queryString,
            "used-QS":QS
          },
          rows: []
        }

      );

    });

  });

}

//modify query string to only allow thos words that are permissible
function modifyQueryString(channel, queryString, callback ){
  //get commands by channel
  JIBU.pouch.get(channel +'-commands')
  .then(function (doc) {
    // console.log(doc);
    //remove all words not within known set of commands
    //add channel to query string
    queryString = _.union([channel],  _.intersection( _.words(queryString.toLowerCase()) , _.uniq(doc.commands) ) )  .join(' ');
    // console.log(queryString)
    //callback
    callback( queryString );
  }).catch(function (err) {
    // handle error
    // console.log('ERROR',err);
    //we cannot deal with this query string so we callback with N/A.
    //But since N/A can be a command itself, we wrap wtring with '*' which is not permissible within commands
    queryString='***N/A***';
    callback(queryString);

  });
}

//add channel commands
//Channel Commands are helpful in compacting thus speeding full text searches
function addChannelCommands(doc, callback){
  //default callback
  callback = callback || function(){};

  // console.log(channelDoc);

  JIBU.pouch.search({
    query: doc.channel.toLowerCase(), //channel must always be lowercase...
    fields: ['channel'],
    include_docs: true
  }).then(function (res) {
    //map all command_syns and get unique array...
    var command_syns = _.compact( _.flatten( _.map(_.map(res.rows, 'doc'), 'command_syns') ) ) ;

    //split into unique command words only
    var commands = _.reduce(command_syns, function(arr,val){
      return _.union(arr,_.words(val.toLowerCase())); //channel commands always lowercased
    });

    //make channelDoc
    var channelDoc = {
      _id: doc.channel+'-commands',
      channel_name : doc.channel.toLowerCase(), //channel name always lowercased
      commands : commands
    };

    // console.log(channelDoc);

    //put or update
    JIBU.pouch.get(channelDoc._id)
    .then( function (channelDocRes) {

      //update...
      JIBU.pouch.put( channelDoc, channelDoc.id , channelDocRes._rev)
      .then(function (res) {
        //console.log(res)
        callback();
      });

    })
    .catch(function (err) {

      //put doc
      JIBU.pouch.put(channelDoc)
      .then(function (res) {
        //console.log(res);
        callback();
      })
      .catch(function (err) {
        console.log(err);
      });

    });

  });

}

//put documents with easter
function addCommand(doc, callback){
  // console.log(jibu);
  //default callback
  callback = callback || function(){};
  var docs = null;

  //ensure docs is an array...
  if(_.isArray(doc)){ docs = doc; }
  else if(_.isObject(doc)){ docs = [doc]; }


  if(docs){

    //async loop thru the records and create em
    async.eachLimit(docs, 1, function(doc, next){

      //ensure we have all the fields
      if(completeDoc(doc)){
        //now add the document _id
        doc._id=docID(doc);

        //channel name must always be lowercased
        doc.channel = doc.channel.toLowerCase();
        //command_syns must always be lowercased and cannot contain reserved '*' (asterisk) character
        doc.command_syns = _.map(doc.command_syns, function(v){
          return v.toLowerCase().replace(/\*/g,'');
        });

        //get doc bi ID
        JIBU.pouch.get(doc._id)
        .then( function (res) {

          //update document
          JIBU.pouch.put( doc, doc.id , res._rev)
          .then(function (res) {
            //add channel commands
            addChannelCommands(doc, next);
          });

        })
        .catch(function (err) {
          // no doc so create it
          //add put the document
          JIBU.pouch.put(doc)
          .then(function (res) {
            //add channel commands
            addChannelCommands(doc, next);
            //add command docID
          })
          .catch(function (err) {
            // handle error
            console.log(err);
          });

        });

      }
      else{
        //cannot put document
        console.log('Document Incomplete or Wrongly Composed!');
      }

    }, function(){
      
      //callback
      callback();


    });

  }






}

//to check if the document is complete
function completeDoc(doc){
  //these are the fields that each document must have
  var must_contain= ['channel','command','command_syns','response'];
  return _.every( must_contain , _.partial( _.has, doc) )  ;
}


//genetrate doc id
function docID(doc){
  return pouchCollate.toIndexableString( [doc.channel, doc.command] );
}
