var elasticlunr = require('elasticlunr');
var _ = require('lodash');
var path = require('path');
var mkdirp = require('mkdirp');
var fs = require('fs');
var moment = require('moment');
var parse_numbers = require ( 'parse-numbers' );

// var query = require('array-query');
var loadedIndexes = {};
var expireIndexes = {};




function JIBU(options){

  this.options = _.extend(

    {
      db_path : path.join(__dirname,'..','data'), //database path
      log: false, //show log messages?
      langs: ['en','sw'], //languages to use. Determines which stopwords are applied
      expireIndexesIn: (1000 * 60 * 5) //expire keys every 5 minutes (in milliseconds)
    },

    options

  );

  //use english & swahili stopwords by default
  this.stop_words = require('multi-stopwords')( this.options.langs );

  //add stopwords
  elasticlunr.addStopWords( this.stop_words );

  //make data directory
  mkdirp.sync( this.options.db_path );


}

JIBU.prototype = {
  loadIndex : loadIndex,
  addCommands : addCommands,
  removeCommands: removeCommands,
  jibu : jibu
};

module.exports = function (options){
  return new JIBU(options);
};


/**
 * This is the main function that returns query results, given a query
 * @param  {string} q       query string
 * @param  {string} channel channel name
 * @return {object}         results object
 */
function jibu(q,channel){


  var start = moment();

  //must have channel
  if(!channel){return null;}

  //load index
  loadIndex(channel,this);


  var results = JIBU.index.search(q, {
      fields: {
          command: {boost: 1},
          command_syns: {boost: 10}
      },
      bool: "OR",
      expand: true
  });



  //map results with documentStore
  var docs = _.map(results, function(v){
    return _.merge(
       JIBU.index.documentStore.docs[v.ref],
       { "score": v.score}
    );
  });

  var numerics = {};

  // if there are no results
  if(docs.length===0){
    numerics = numericQuery(q);
    //merge with numeric results
    docs = _.union(docs, numerics.results );
  }

  //return
  return {
    meta:{
      query: numerics.q || q,
      time: moment().diff(start)+'ms',
    },
    docs: docs
  };

}


/**
 * Function to run numeric queries and return results from the index loaded
 * @param  {string} q        [query string]
 * @return {object}          [description]
 */
function numericQuery(q){

  if(!_.isArray(JIBU.index.index_numerals) || JIBU.index.index_numerals.length == 0){
    return {results:[], q:q };
  }

  var query_patterns={
    'lte':[
          {
            pat: /((less|small)(er)?(\s+than)?\s+or\s+equals?(\s+to)?)\s*([0-9,\.]+)/i,
            num_idx: 6
          },
          {
            pat: /(<=|=<)+\s*([0-9,\.]+)/i,
            num_idx: 2
          }
        ],
    'lt':[
          {
            pat: /(less|small)(er)?(\s+than)?\s*([0-9,\.]+)/i,
            num_idx: 4
          },
          {
            pat: /(<)+\s*([0-9,\.]+)/i,
            num_idx: 2
          }
        ],
    'gte': [
            {
              pat: /((great|bigg?)(er)?(\s+than)?\s+or\s+equals?(\s+to)?)\s*([0-9,\.]+)/i,
              num_idx: 6
            },
            {
              pat: /(>=|=>)+\s*([0-9,\.]+)/i,
              num_idx: 2
            }
          ],
    'gt':[
          {
            pat: /(great|bigg?)(er)?(\s+than)?\s*([0-9,\.]+)/i,
            num_idx: 4
          },
          {
            pat: /(>)+\s*([0-9,\.]+)/i,
            num_idx: 2
          }
        ],
    'equals':[
              {
                pat: /(equals?)\s+(to)?\s*([0-9,\.]+)/i,
                num_idx: 3
              },
              {
                pat: /(=)+\s*([0-9,\.]+)/i,
                num_idx: 2
              },
              {
                pat: /^\s*([0-9,\.]+)\s*$/i,
                num_idx: 1
              },
          ]
  };

  var query = require('array-query');
  var qq = query('command_syns');
  var has_query = false;

  _.each(query_patterns, function(patterns, query){
    //loop thru all patterns
    //  console.log(query);
    _.each(patterns, function(pat_obj){

      if((m=q.match(pat_obj.pat)) && (q=q.replace(pat_obj.pat,'$'+query)+' '+m[pat_obj.num_idx])){
        // console.log(m[pat_obj.num_idx], query);
        qq[query](m[pat_obj.num_idx]);

        has_query = true;

      }

    });

  });


  //all these on array...
  var res = has_query ? qq.on( JIBU.index.index_numerals ) : [];


  // console.log(JIBU.index);

  // reduce to unique Ids
  res = _.uniq( _.map(res,'id'));

  //get documents from index
  var results = [];

  _.each(res, function(id){
    if( JIBU.index.documentStore && JIBU.index.documentStore.docs && _.has(JIBU.index.documentStore.docs,id) ){
      results.push(
        JIBU.index.documentStore.docs[id]
      );
    }
  });


  return {results:results, q:q };

}


/**
 * Function to remove commands from the index
 * @param  {array} docs    array of docs to be removed from index
 * @param  {channel} channel channel name
 * @return {null}         returns nothing
 */
function removeCommands( docs, channel ){
  //must have channel
  if(!channel){return null;}

  //load index
  loadIndex(channel,this);

  //ensure docs is an array
  if(_.isArray(docs)){ docs = docs; }
  else if(_.isObject(docs)){ docs = [docs]; }


  var numerals = [];

  //insert docs
  _.each(docs, function(doc){

    if(completeDoc(doc,['channel','command'])){
      //channel & command must be lowercased
      doc.channel = doc.channel.toLowerCase();
      doc.command = doc.command.toLowerCase();

      //set id
      doc.id=docID(doc);

      //remove all JIBU.index_numerals with document id
      numerals = _.filter(JIBU.index_numerals, function(o){
        // console.log(o);
        return o.id !== doc.id;
      });

      //remove docID
      JIBU.index.removeDoc(doc);

    }

  });

  //save index
  saveIndex(channel, numerals);

}

/**
 * Function used to add new commands into the index
 * @param  {array} docs    array of docs to be removed from index
 * @param  {channel} channel channel name
 * @return {null}         returns nothing
 */
function addCommands( docs, channel ){

  //must have channel
  if(!channel){return null;}

  //load index
  loadIndex(channel,this);

  //ensure docs is an array
  if(_.isArray(docs)){ docs = docs; }
  else if(_.isObject(docs)){ docs = [docs]; }

  var numerals = [],
      arr = [];

  //insert docs
  _.each(docs, function(doc){

    if(completeDoc(doc)){
      //channel & command must be lowercased
      doc.channel = doc.channel.toLowerCase();
      doc.command = doc.command.toLowerCase();

      //set id
      doc.id=docID(doc);


      //index doc
      JIBU.index.addDoc(doc);


      if(_.isString(doc.command_syns)){ doc.command_syns= _.words(doc.command_syns); }

      var parsed = {};

      //pick all numeric command_syns
       _.each(doc.command_syns, function(v){
          //parse numbers
          parsed=parse_numbers(v);

          //loop thru each numeral and add it
          _.each(parsed.numerals, function(val){

            numerals.push(
              {
                id:doc.id,
                command_syns: val
              }
            );
          });

      });

    }

  });


  if(JIBU.options.log){ console.log('Indexed '+ docs.length+' commands.');  }

  //save index
  saveIndex(channel, numerals );

}


/**
 * Function to save index into disk
 * @param  {string} channel  channel name
 * @param  {array} numerals array of numerals to save
 * @return {null}          returns nothing
 */
function saveIndex(channel, numerals){
  //lowercase channel at all times
  channel = channel.toLowerCase();
  //use blank array if none
  numerals = (_.isArray(numerals)) ? numerals : [];

  var db_name = channel || 'jibu';
  var db = path.join( JIBU.options.db_path, db_name +'.json' );
  var db_numerals = path.join( JIBU.options.db_path, db_name +'-numerals.json' );


  //write file to path...
  if(JIBU.index){
    fs.writeFileSync(db, JSON.stringify(JIBU.index,0,4));
  }

  // console.log(JSON.stringify(numerals,0,4));
  //numerals
  if(numerals){
    fs.writeFileSync(db_numerals, JSON.stringify(numerals,0,4));
  }


  //remove index from loaded Indexes
  delete loadedIndexes[channel];

  //clear timeout
  clearTimeout( expireIndexes[channel] );

}



/**
 * Function to load index
 * @param  {string} channel channel name
 * @param  {object} jibu      inherited jibu object
 * @return {null}        returns null
 */
function loadIndex(channel,jibu){

  JIBU = jibu || this;

  //must have channel
  if(!channel){return null;}

  channel = channel.toLowerCase();

  if(_.has(loadedIndexes,channel)){

    if(JIBU.options.log){ console.log('Returned Existing Index...');  }
    JIBU.index = loadedIndexes[channel];
    JIBU.index_numerals = loadedIndexes[channel].index_numerals;


  }
  else{


    var db_name = channel || 'jibu';

    var index = path.join( JIBU.options.db_path, db_name+'.json' );
    var numerals = path.join( JIBU.options.db_path, db_name+'-numerals.json' );

    var data = null;

    try{
      data =  require(index);
      data.numerals = require(numerals);
    }
    catch(e){}


    if(data){
      if(JIBU.options.log){ console.log('Loaded Existing Index...');  }
      //load index
      JIBU.index = elasticlunr.Index.load(data);
      JIBU.index_numerals = data.numerals;

    }
    else{
      if(JIBU.options.log){ console.log('Created New Index...'); }
      //create index
      JIBU.index = elasticlunr(function () {
          this.addField('command_syns');
          this.addField('command');
          this.setRef('id');
      });
    }

    loadedIndexes[channel] = JIBU.index;
    loadedIndexes[channel].index_numerals = JIBU.index_numerals;

    //expire this key after x minutes
    // expireIndexes[channel] = setTimeout(function(){
    //
    //   delete loadedIndexes[channel] ;
    //
    // }, 5000);

  }

  return null;
}

/**
 * To check if a document is completeDoc. Complete documents must have 'channel','command', and 'response' keys
 * @param  {object} doc          document to check if complete
 * @param  {array} must_contain array of keys that object must contain
 * @return {boolean}              returns true or false
 */
function completeDoc(doc, must_contain){
  //these are the fields that each document must have
  must_contain = must_contain || ['channel','command','response'];
  return _.every( must_contain , _.partial( _.has, doc) )  ;
}


/**
 * Function to generate document ID
 * @param  {object} doc document to generate key for
 * @return {string}     returns document key
 */
function docID(doc){
  return doc.channel + '-' + doc.command;
}
