'use strict';

const mongoose = require('mongoose');
const NestedSet = require('../lib/nestedset');
const async = require('async');

const schema = new mongoose.Schema({
  name: String,
  nleft: Number,
  nright: Number,
  level: Number,
  parentId: mongoose.Schema.Types.ObjectId
});

let mongoUri = process.argv[2] || false;
let collection = process.argv[3] || false;

if (!mongoUri || !collection) {
  console.log("Usage: \n",
      process.argv[0] + ' ' + process.argv[1] 
      + " <mongoUri> <mongoCollection>"
      );
  process.exit(1);
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
    return fixNode(null, 0, 0, done);
  },
], fin);


function fixNode(node, curBorder, level, done) {

  console.log("fixNode", node ? node.name : 'null', curBorder, level);
  let filter = {
    parentId: node ? node._id : null,
  };
  if (node) {
    curBorder++;
    node.nleft = curBorder;
    node.level = level;
  }
  mdl.find(filter).sort('nleft').exec(function(err, childs) {
  
    let childLevel = node ? node.level + 1 : 0;
    async.eachSeries(childs, function(child, childCb) {
      return fixNode(child, (curBorder), childLevel, function(err, newBorder) {
        if (err) return childCb(err);
        curBorder = newBorder;
        return childCb();
      });
    }, function _nodeDone(err) {
      if (err) return done(err);
      if(node) {
        curBorder++
        node.nright = curBorder;
        node.save(function(err) {
          if (err) return done(err);
          return done(null, curBorder);
        });
      } else {
        return done(null, curBorder);
      }
    });
  });

}



function connect(done) {
  // {{{
  mongoose.connect(mongoUri);
  var db = mongoose.connection;
  db.on('error', function(err) {
    return done(err);
  });
  db.once('open', function() {
    console.log('DB connected');
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


