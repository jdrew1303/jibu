var elasticlunr = require('elasticlunr');
var _ = require('lodash');
var path = require('path');
var mkdirp = require('mkdirp');
var fs = require('fs');
var moment = require('moment');




function JIBU(options){

  this.options = _.extend(
    {
      db_path : path.join(__dirname,'..','data'),
      debug: false
    },
    options
  );

  //make data directory
  mkdirp.sync(this.options.db_path);

}

JIBU.prototype = {
  loadIndex : loadIndex,
  addCommands : addCommands,
  removeCommands: removeCommands,
  jibu : jibu
}

module.exports = function (options){
  return new JIBU(options);
}



// Main functiin to spit out answers, jibu
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
      }
  });

  //map results with documentStore
  var docs = _.map(results, function(v){
    return _.merge(
       JIBU.index.documentStore.docs[v.ref],
       { "score": v.score}
    );
  });

  //return
  return {
    meta:{
      query: q,
      time: moment().diff(start)+'ms',
    },
    docs: docs
  }

}



// function to remove commands
function removeCommands( docs, channel ){
  //must have channel
  if(!channel){return null;}

  //load index
  loadIndex(channel,this);

  //ensure docs is an array
  if(_.isArray(docs)){ docs = docs; }
  else if(_.isObject(docs)){ docs = [docs]; }

  //insert docs
  _.each(docs, function(doc){

    if(completeDoc(doc,['channel','command'])){
      //set id
      doc.id=docID(doc);

      //remove docID
      JIBU.index.removeDoc(doc);

    }

  });

  //save index
  saveIndex(channel);

}

// Add docs tlo the index
function addCommands( docs, channel ){

  //must have channel
  if(!channel){return null;}

  //load index
  loadIndex(channel,this);

  //ensure docs is an array
  if(_.isArray(docs)){ docs = docs; }
  else if(_.isObject(docs)){ docs = [docs]; }

  //insert docs
  _.each(docs, function(doc){

    if(completeDoc(doc)){
      //set id
      doc.id=docID(doc);

      //index doc
      JIBU.index.addDoc(doc);
    }

  });

  if(JIBU.options.debug){ console.log('Indexed '+ docs.length+' commands.');  }

  //save index
  saveIndex(channel);

}

// Save index as appropriate
function saveIndex(channel){
  var db_name = channel || 'jibu';
  var db = path.join( JIBU.options.db_path, db_name+'.json' );
  //write file to path...
  fs.writeFileSync(db, JSON.stringify(JIBU.index));
}

//function to load Indexes
function loadIndex(channel,t){

  //must have channel
  if(!channel){return null;}

  JIBU = t || this;

  var db_name = channel || 'jibu';

  var db = path.join( JIBU.options.db_path, db_name+'.json' );

  var data = null;

  try{ data =  require(db); }
  catch(e){}


  if(data){
    if(JIBU.options.debug){ console.log('Loaded Existing Index...');  }
    //load index
    JIBU.index = elasticlunr.Index.load(data);
  }
  else{
    if(JIBU.options.debug){ console.log('Created New Index...'); }
    //create index
    JIBU.index = elasticlunr(function () {
        this.addField('command_syns');
        this.addField('command');
        this.setRef('id');
    });
  }

}

//to check if the document is complete
function completeDoc(doc, must_contain){
  //these are the fields that each document must have
  var must_contain = must_contain || ['channel','command','response'];
  return _.every( must_contain , _.partial( _.has, doc) )  ;
}


//genetrate doc id
function docID(doc){
  return doc.channel + '-' + doc.command;
}
