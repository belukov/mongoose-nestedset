'use strict';

const mongoose = require('mongoose');
const NestedSet = require('../lib/nestedset');
const async = require('async');

const schema = new mongoose.Schema({name: String});

let mongoUri = 'mongodb://localhost/test_nestedset';
let collection = 'tree';

//console.log('env ', process.argv);
if(process.argv[2]) {
  if(!process.argv[3]) {
    console.error('collection not set');
    process.exit(1);
  }
  mongoUri = process.argv[2];
  collection = process.argv[3];
}



let mdl = null;

async.series([
  function(done) {
    connect(done);
  },
  function(done) {
  
    mdl = mongoose.model(collection, schema);
    return done();
  },
  function(done) {
  
    console.log("\nOrder by parentId:");
    printByParent(null, 0, done);
  },
  function(done) {
    console.log("\nOrder by nLeft: ");
    printByLeft(done);
  }
], fin);


function printByParent(parentId, level, done) {
  // {{{
  let filter = {
    parentId: parentId
  };
  //mdl.find(filter, function(err, nodes) {
  mdl.find(filter).sort('nleft').exec(function(err, nodes) {
    if(err) return done(err);

    async.eachSeries(nodes, function(node, _cb) {
      node = node.toObject();
      let str = "-".repeat(level)
          + node.name
          + " <"+node.nleft+".."+node.nright+">"
          + " lvl: " + node.level
          ;
      console.log(str);
          
      return printByParent(node._id, (level + 1), _cb);
    }, done);
  });
  // }}}
} 

function printByLeft(done) {
  // {{{
  let parents = [];
  mdl.find().sort('nleft').exec(function(err, nodes) {
    if(err) return done(err);

    for(let node of nodes) {
      node = node.toObject();
      node.id = node._id.toString();
      let wrongPar = node.level > 0 &&  parents[node.level] != node.parentId;
      parents = parents.slice(0, node.level + 1);
      parents[node.level + 1] = node.id;
      //console.log("level for node %s: '%s'", node.name, node.level);
      let str = '-'.repeat(node.level)
        //+ '#' + node._id + ' '
        + node.name
        //+ "("+node.parentId+")"
        + (wrongPar ? '  !! WRONG PARENT' : '');
      console.log(str);
    }
    return done();
  });
  // }}}
}

/*
function printCoube(level, done) {
  // {{{
  if('function' == typeof level) {
    done = level;
    level = 0;
  }
  let step = 5;

  let row = "";
  mdl.find({level: level}).sort('nleft').exec(function(err, nodes) {
    if(err) return done(err);

    if(!nodes.length) return done();

    let row = " ".repeat(80);
    async.eachSeries(nodes, function(node, _cb){

      let n = node.toObject();
      //console.log(n.name, n.nleft);

      let left = (n.nleft - 1) * step;
      let right = (n.nright) * step;
      let width = right - left;

      let col_l = "(" + n.nleft;
      let col_r = n.nright + ')';
      let col = col_l
        + "-".repeat(width - col_l.length - col_r.length)
        + col_r;
      row = row.substring(0, left)
        + col
        + row.substring(right+1);

      return _cb();
    }, function(err) {
      if(err) return done(err);
      console.log(row);
      //return done();
      return printByLeft(level + 1, done);
    });

  });
  // }}}
}
*/

function connect(done) {
  // {{{
  mongoose.connect(mongoUri); // TODO: move this to ENV ?
  var db = mongoose.connection;
  db.on('error', function(err) {
    return done(err);
  });
  db.once('open', function() {
    //console.log('DB connected');
    return done();
  });
  // }}}
}

function fin(err) {
  // {{{
  if(err) {
    console.error(err);
  }

  mongoose.connection.close();
  process.exit(err ? 1 : 0);
  // }}}
}

function padStr(str, len, pad) {

  if(!pad) pad = ' ';
  return String(pad.repeat(len) + str).slice((len * -1));
}
