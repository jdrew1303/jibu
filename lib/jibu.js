var elasticlunr = require('elasticlunr');
var _ = require('lodash');
var path = require('path');
var mkdirp = require('mkdirp');
var fs = require('fs');
var moment = require('moment');
var parse_numbers = require ( 'parse-numbers' );

var JQ = require('JQ').JQ;
var boolean_mode = ' && ';

var query_path = [];

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
          search: {boost: 10}
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

  query_path = [
    {
      query: q,
      type: 'Full Text',
      results_count: docs.length
    }
  ]

  //do a map reduce by numbers
  var reduceDocs = numericQuery(q, docs),
      mercy_results = (reduceDocs.length == 0 && docs.length >0 );

  //return
  return {
    meta:{
      query: numerics.q || q,
      time: moment().diff(start)+'ms',
      results_count: mercy_results ? docs.length : reduceDocs.length,
      query_path : query_path,
      mercy_results : mercy_results,
    },
    docs: mercy_results ? docs : reduceDocs
  };

}


/**
 * Function to run numeric queries and return results from the index loaded
 * @param  {string} q        [query string]
 * @return {object}          [description]
 */
function numericQuery(q, reduceDocs){

  if(!_.isArray(JIBU.index.index_numerals) || JIBU.index.index_numerals.length == 0){
    return { results:[], q:q };
  }

  // parse and replace in numbers
  q = parse_numbers(q).string.out ;

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
              pat: /((more|great|bigg?)(er)?(\s+than)?\s+or\s+equals?(\s+to)?)\s*([0-9,\.]+)/i,
              num_idx: 6
            },
            {
              pat: /(>=|=>)+\s*([0-9,\.]+)/i,
              num_idx: 2
            }
          ],
    'gt':[
          {
            pat: /(more|great|bigg?)(er)?(\s+than)?\s*([0-9,\.]+)/i,
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

  var queries_arr=[];
  var query_operators ={
    'lte' : '<=',
    'lt' : '<',
    'gt' : '>',
    'gte' : '>==',
    'equals' : '==='
  };

  _.each(query_patterns, function(patterns, query){
    //loop thru all patterns
    //  console.log(query);
    _.each(patterns, function(pat_obj){
      if((m=q.match(pat_obj.pat)) && (q=q.replace(pat_obj.pat,'$'+query)+' '+m[pat_obj.num_idx])){
        // console.log(m[pat_obj.num_idx], query);
        queries_arr.push('number '+query_operators[query]+' '+ m[pat_obj.num_idx] );
      }
    });
  });


  //if we have no query array, return reduce docs immediately, theres nothing here for us to do
  if(queries_arr.length===0){  return reduceDocs; }

  var query = queries_arr.join(boolean_mode);
  var qp = {
    query: query
  };

  //use index numerals if no docs or reduce docs
  var docs = JQ(JIBU.index.index_numerals);
  var res = _.map(docs(query)._results,'id');
  var results = [];

  //if we have reduce docs, then reduce, else expand...
  if(reduceDocs.length>0){

    //reduce by filtering all docs whose ids dont match
    results =
      _.filter(reduceDocs, function(doc){
        for(var i in res){ return (res[i] == doc.id); };
      });

    qp.type = 'Numeric Reduce';

  }
  else{
    //else incorporate docs from documentStore
    _.each(res, function(id){
      if( JIBU.index.documentStore && JIBU.index.documentStore.docs && _.has(JIBU.index.documentStore.docs,id) ){
        results.push(
          JIBU.index.documentStore.docs[id]
        );
      }
    });

    qp.type = 'Numeric Expand';
  }


  qp.results_count = results.length;
  query_path.push(qp);


  return results;

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


      if(_.isString(doc.search)){ doc.search= _.words(doc.search); }

      var parsed = {};

      //pick all numeric search
       _.each(doc.search, function(v){
          //parse numbers
          parsed= parse_numbers(v);

          //loop thru each numeral and add it
          _.each(parsed.numerals, function(val){

            numerals.push(
              {
                id : doc.id,
                number : val
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
          this.addField('search');
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
