/*global describe before it*/
/*eslint no-console: 0*/


'use strict';


var assert = require('assert'),
  mongoose = require('mongoose');

var NestedSet = process.env.COVERAGE 
  ? require('../lib-cov/nestedset') 
  : require('../lib/nestedset');

var treeOk = true;

describe('NestedSet', function() {

  var schema, model;

  before(function(done) {
    schema = new mongoose.Schema({
      name: String
    });
    mongoose.connect('mongodb://localhost/test_nestedset'); // TODO: move this to ENV ?
    var db = mongoose.connection;
    db.on('error', console.error.bind(console, 'connection error:'));
    db.once('open', function() {
      //console.log('DB connected');
      clear(done);
    });
  });

  describe('Check NestedSet plugin', function() {



    it('Must be a function', function() {
      //console.log(typeof NestedSet);
      assert.equal('function', typeof NestedSet);
    });

    it('Must append plugin to schema', function() {
      schema.plugin(NestedSet);
      assert.equal('object', typeof schema.path('nleft'));
      assert.equal('object', typeof schema.path('nright'));
    });

    it('Must init Model', function() {

      model = mongoose.model('tree', schema);
      assert.equal('function', typeof model.spread);
    });


  });

  describe('Fill collection with test data', function() {


    it('Must add Root', function(done) {
      var node = new model({
        name: 'Root'
      });
      node.save(function(err, res) {
        if (err) return done(err);

        //console.log("node : ", node, node.nleft);

        assert.equal(0, node.level);
        assert.equal(1, node.nleft);
        assert.equal(2, node.nright);
        done();
      });
    });

    it('Must not change tree attrs when change some fields', function(done) {

      model.findOne({
        name: 'Root'
      }, function(err, root) {
        if (err) return done(err);

        var nleft = root.nleft;
        var nright = root.nright;
        var level = root.level;

        root.name = 'blablabla';
        root.save(function(err, rootChanged) {
          if (err) return done(err);
          // return name back...
          rootChanged.name = 'Root';
          rootChanged.save(function(err, rootChanged) {
            if (err) return done(err);

            assert.equal(nleft, rootChanged.nleft);
            assert.equal(nright, rootChanged.nright);
            assert.equal(level, rootChanged.level);
            done();
          });
        });
      });
    });

    it('Must add Second Root', function(done) {
      var node = new model({
        name: 'Root 2'
      });
      node.save(function(err, res) {
        if (err) return done(err);

        //console.log("node : ", node, node.nleft);

        assert.equal(0, node.level);
        assert.equal(3, node.nleft);
        assert.equal(4, node.nright);
        done();
      });
    });

    it('Must append new child to First Root', function(done) {

      model.findOne({
        name: 'Root'
      }, function(err, root) {

        if (err) return done(err);

        root.append({
          name: 'Child 1'
        }, function(err, child) {

          if (err) return done(err);

          assert.equal(child.parentId, root._id.toString());
          assert.equal(2, child.nleft);
          assert.equal(3, child.nright);
          assert.equal(1, child.level);

          root.reload(function(err, root) {
            if (err) return done(err);

            assert.equal(4, root.nright);

            // chech that Root2 shifted;
            model.findOne({
              name: 'Root 2'
            }, function(err, root2) {
              if (err) return done(err);

              assert.equal(5, root2.nleft);
              return done();
            });

          });


        });

      });
    });

    it('Must prepend Child 2 to First Root Before Child 1', function(done) {

      model.findOne({
        name: 'Root'
      }, function(err, root) {
        if (err) return done(err);

        root.prepend({
          name: 'Child 2'
        }, function(err, child) {
          if (err) return done(err);

          assert.equal(child.parentId, root._id.toString());
          assert.equal(2, child.nleft);
          assert.equal(3, child.nright);
          assert.equal(1, child.level);
          assert.equal(4, root.nright);

          root.reload(function(err, root) {
            if (err) return done(err);

            assert.equal(6, root.nright);

            // chech that Root2 shifted;
            model.findOne({
              name: 'Root 2'
            }, function(err, root2) {
              if (err) return done(err);

              assert.equal(7, root2.nleft);
              return done();
            });

          });

        });

      });
    });

    it('Must append subchild to Child 1', function(done) {

      model.findOne({
        name: 'Child 1'
      }, function(err, ch1) {
        if (err) return done(err);

        ch1.append({
          name: 'SubChild 1.1'
        }, function(err, sub) {
          if (err) return done(err);

          ch1.reload(function(err, ch1) {
            if (err) return done(err);

            assert(ch1.nleft < sub.nleft);
            assert(ch1.nright > sub.nright);
            assert.equal(ch1._id.toString(), sub.parentId);
            assert.equal(ch1.level, (sub.level - 1));
            done();
          });
        });
      });
    });


    it("Must add node (just save) with parentId of Child 2", function(done) {

      model.findOne({
        name: 'Child 2'
      }, function(err, parentNode) {
        if (err) return done(err);
        var node = new model({
          name: "SubChild 1.2",
          parentId: parentNode._id
        });
        node.save(function(err) {
          if (err) return done(err);

          node.reload(function(err, node) {
            if (err) return done(err);
            parentNode.reload(function(err, parentNode) {

              //console.log(node.toObject());
              assert.equal(parentNode._id.toString(), node.parentId.toString());
              assert.equal(parentNode.level + 1, node.level);
              //console.log("assert %s < %s", parentNode.nleft , node.nleft)
              assert(parentNode.nleft < node.nleft);
              //console.log("assert %s > %s", parentNode.nright , node.nright)
              assert(parentNode.nright > node.nright);
              return done();
            });
          });
        });
      });

    });


    it('Must be a correct tree', function(done) {
      checkTree(model, done);
    });

  });
  describe('Parallel conflicts', function() {

    it('Must not suffle nleft and nright whete several childs appended in same time', function(done) {

      var count = 0;
      var childs = ['Conflict1', 'Conflict2'];
      model.findOne({
        name: 'Root 2'
      }, function(err, root) {
        if (err) return done(err);

        for (var i = 0; i < childs.length; i++) {
          count++;
          root.append({
            name: childs[i]
          }, callback);
        }


      });

      var nodes = {};

      function callback(err, node) {

        if (err) done(err);
        count--;
        nodes[node.name] = node;
        if (count > 0) return;

        assert.equal(nodes.Conflict1.nleft, nodes.Conflict2.nleft - 2);
        assert.equal(nodes.Conflict1.nright, nodes.Conflict2.nright - 2);
        done();
      }
    });

    it('Must be a correct tree', function(done) {
      checkTree(model, done);
    });

  });

  describe('Check ancestors method', function() {

    it('Must be two parents for SubChild 1.1', function(done) {

      model.findOne({
        name: 'SubChild 1.1'
      }, function(err, child) {
        if (err) return done(err);

        child.ancestors(function(err, parents) {
          if (err) return done(err);

          assert.equal(2, parents.length);
          assert.equal('Root', parents[0].name);
          assert.equal('Child 1', parents[1].name);
          return done();
        });
      });
    });
  });

  describe('Check descendants method', function() {

    it('`Root 2` must have only 2 direct childs', function(done) {

      model.findOne({
        name: 'Root 2'
      }, function(err, root2) {
        if (err) return done(err);

        root2.descendants(function(err, list) {
          if (err) return done(err);

          assert.equal(2, list.length);
          assert.equal('Conflict1', list[0].name);
          assert.equal('Conflict2', list[1].name);

          done();
        });
      });
    });

    it('`Root` must have 3 subnodes including SubChild 1.1', function(done) {

      model.findOne({
        name: 'Root'
      }, function(err, root) {
        if (err) return done(err);

        root.descendants(function(err, list) {
          if (err) return done(err);

          assert.equal(4, list.length);
          assert.equal('Child 2', list[0].name); // inserted before Child 1
          assert.equal('SubChild 1.2', list[1].name);
          assert.equal('Child 1', list[2].name);
          assert.equal('SubChild 1.1', list[3].name);

          done();
        });
      });
    });
  });

  describe('Check parent method', function() {

    it('Must return no parent for `Root`', function(done) {

      model.findOne({
        name: 'Root'
      }, function(err, root) {
        if (err) return done(err);
        root.parent(function(err, parent) {
          if (err) return done(err);
          assert.equal(null, parent);
          done();
        });
      });

    });

    it('Must return parent `Root` for `Child 1`', function(done) {

      model.findOne({
        name: 'Child 1'
      }, function(err, child) {
        if (err) return done(err);
        child.parent(function(err, parent) {
          if (err) return done(err);
          assert.equal(child.parentId.toString(), parent._id.toString());
          assert.equal('Root', parent.name);
          done();
        });
      });

    });

  });

  describe('Check children method', function() {

    it('Must return no children for `SubChild 1.1`', function(done) {

      model.findOne({
        name: 'SubChild 1.1'
      }, function(err, subchild) {
        if (err) return done(err);
        subchild.children(function(err, children) {
          if (err) return done(err);
          assert.equal(0, children.length);
          done();
        });
      });

    });

    it('Must return children [`Child 1`, `Child 2`] `Root`', function(done) {

      model.findOne({
        name: 'Root'
      }, function(err, root) {
        if (err) return done(err);
        root.children(function(err, children) {
          if (err) return done(err);
          assert.equal(2, children.length);
          children.forEach(function(child) {
            assert.equal(child.parentId.toString(), root._id.toString());
          });
          done();
        });
      });

    });

  });

  describe("Check move method and change parent with save", function() {

    before(function(done) {
      model.findOne({
        name: 'Root'
      }, function(err, root) {
        if (err) return done(err);
        root.append({
          name: 'MoveNode'
        }, done);
      });
    });

    it("Must move MoveNode to Root 2", function(done) {

      model.findOne({
        name: 'MoveNode'
      }, function(err, node) {
        if (err) return done(err);

        model.findOne({
          name: 'Root 2'
        }, function(err, root2) {
          if (err) return done(err);

          node.move(root2, function(err) {
            if (err) {
              //console.log("ERROR: ", err);
              return done(err);
            }

            node.reload(function(err, node) {
              if (err) return done(err);
              assert.equal(root2._id.toString(), node.parentId.toString());
              assert.equal(root2.nright - 1, node.nright);
              assert.equal(root2.nright - 2, node.nleft);
              assert.equal(root2.level + 1, node.level);
              checkTree(model, done);
            });
          });
        });
      });
    });

    it("Must move MoveNode to SubChild 1.1 (other level)", function(done) {

      model.findOne({
        name: 'MoveNode'
      }, function(err, moveNode) {
        if (err) return done(err);

        model.findOne({
          name: 'SubChild 1.1'
        }, function(err, newParent) {
          if (err) return done(err);

          moveNode.move(newParent, function(err) {
            if (err) return done(err);

            moveNode.reload(function(err, moveNode) {
              if (err) return done(err);

              assert.equal(newParent._id.toString(), moveNode.parentId.toString());
              assert.equal(newParent.level + 1, moveNode.level);
              checkTree(model, done);
            });
          });
        });
      });
    });


    it("Must save node with new parent id and move it quietly", function(done) {

      model.findOne({
        name: 'MoveNode'
      }, function(err, moveNode) {
        if (err) return done(err);

        model.findOne({
          name: 'Root 2'
        }, function(err, newParent) {
          if (err) return done(err);

          moveNode.name = 'MyMoveNode';
          moveNode.parentId = newParent._id;
          // try to broke
          moveNode.level = 1000;
          moveNode.nright = 1000;

          moveNode.save(function(err) {
            if (err) return done(err);

            moveNode.reload(function(err, moveNode) {

              //console.log("new parent: ", newParent.toObject());
              //console.log('move node: ', moveNode.toObject());

              assert.equal(newParent._id.toString(), moveNode.parentId.toString());
              assert.equal(newParent.level + 1, moveNode.level);
              checkTree(model, done);

            });
          });

        });
      });

    });

    it("Must return error if trying to move to node child", function(done) {

      model.findOne({
        name: 'Root 2'
      }, function(err, root2) {
        if (err) return done(err);

        model.findOne({
          name: 'MyMoveNode'
        }, function(err, child) {

          root2._move(child, function(err) {

            assert(err);
            return done();
          });
        });
      });
    });

    it("Must move node to zero level by using null as new parent", function(done) {

      model.findOne({
        name: 'MyMoveNode'
      }, function(err, moveNode) {
        if (err) return done(err);

        moveNode.move(null, function(err) {
          if (err) return done(err);

          moveNode.reload(function(err, moveNode) {
            if (err) return done(err);

            assert.equal(0, moveNode.level);
            assert.equal(null, moveNode.parentId);
            return done();
          });
        });
      });
    });

    it("Must move node from zero level to root 2", function(done) {

      model.findOne({
        name: 'MyMoveNode'
      }, function(err, moveNode) {
        if (err) return done(err);

        model.findOne({
          name: 'Root 2'
        }, function(err, root2) {

          moveNode.move(root2, function(err) {

            moveNode.reload(function(err, moveNode) {

              assert.equal(1, moveNode.level);
              return done();
            });
          });
        });
      });

    });


    it('Must be a correct tree', function(done) {
      checkTree(model, done);
    });

  });

  describe("Stress moving subtrees", function() {

    /*
     * Source data
     *[nodeName, [parentName]]
     * */
    let tree = [
      ['n-1'],
      ['n-1-1', 'n-1'],
      ['n-1-1-1', 'n-1-1'],
      ['n-1-2', 'n-1'],
      ['n-1-2-1', 'n-1-2'],
      ['n-1-2-2', 'n-1-2'],
      ['n-1-2-2-1', 'n-1-2-2'],
      ['n-2'],
      ['n-2-1', 'n-2'],
      ['n-2-1-1', 'n-2-1'],
      ['n-2-1-1-1', 'n-2-1-1'],
      ['n-2-1-1-2', 'n-2-1-1'],
      ['n-2-1-2', 'n-2-1'],
      ['n-3']
    ];

    before(function(done) {

      clear(function(err) {
        if (err) return done(err);
        return done();
      });
    });

    for (let item of tree) {

      it("Add " + item[0] + " to " + (item[1] ? item[1] : 'root'), function(done) {

        let node = new model({
          name: item[0]
        });
        if (!item[1]) { // save to root
          node.save(function(err) {
            if (err) return done(err);
            assert(!node.isNew);
            return done();
          });
        } else {
          model.findOne({
            name: item[1]
          }, function(err, par) {
            if (err) return done(err);
            if (!par) return done(new Error("Can't find node ", item[1]));

            node.parentId = par._id;
            node.save(function(err) {
              if (err) return done(err);
              assert(!node.isNew);
              return done();
            });
          });
        }
      });
    }

    it('Must be a correct tree', function(done) {
      checkTree(model, done);
    });

    /*
     * [whatMove, whereMove]
     * */
    let movings = [
      ['n-1-2-2', 'n-1-1'],
      ['n-1-2-2', 'n-1-2'],
      ['n-2-1-1', 'n-1-2-2'],
      ['n-1-1', 'n-2-1-2'],
      ['n-2-1-2', 'n-3'],
      ['n-2', 'n-2-1-1'],
      ['n-1-2-2']
    ];

    let stop = false;
    for (let mv of movings) {

      it("Must move " + mv[0] + " to " + (mv[1] ? mv[1] : 'root'), function(done) {

        if (!treeOk) this.skip();
        model.findOne({
          name: mv[0]
        }, function(err, node) {
          if (err) return done(err);

          if (!mv[1]) {
            node.parentId = null;
            node.save(function(err) {
              if (err) return done(err);
              return checkTree(model, done);
            });
          } else {
            model.findOne({
              name: mv[1]
            }, function(err, par) {
              if (err) return done(err);
              if (!par) return done(new Error("node " + mv[1] + ' not found'));

              node.move(par, function(err) {
                if (err) return done(err);
                return checkTree(model, done);
              });
            });
          }

        });
      });

    }

  });

});


function clear(cb) {
  mongoose.connection.db.listCollections({
      name: 'trees'
    })
    .next(function(err, coll) {
      if (err) return cb(err);
      if (coll) {
        return mongoose.connection.db.dropCollection('trees', cb);
      } else {
        return cb();
      }
    });
}

function checkTree(model, cb) {

  treeOk = false;
  var tree = {};
  var nkeys = [];
  var nkeyMax = 0;
  model.find({}).sort('nleft').exec(function(err, list) {
    if (err) return cb(err);

    //console.log(list);
    for (var i = 0; i < list.length; i++) {
      var doc = list[i];
      tree[doc._id] = {
        nleft: doc.nleft,
        nright: doc.nright,
        level: doc.level,
        parent: doc.parentId,
        childs: 0
      };
      // nkeys must not repeat
      assert.equal(-1, nkeys.indexOf(doc.nleft));
      assert.equal(-1, nkeys.indexOf(doc.nright));
      nkeys.push(doc.nleft);
      nkeys.push(doc.nright);

      if (nkeyMax < doc.nleft) nkeyMax = doc.nleft;
      if (nkeyMax < doc.nright) nkeyMax = doc.nright;

      if (doc.parentId) {
        var prnt = tree[doc.parentId];

        //console.log("check doc: ", doc.name);
        assert((doc.nright - doc.nleft) % 2);
        assert(prnt.nleft < doc.nleft);
        assert(prnt.nright > doc.nright);
        assert.equal(prnt.level, doc.level - 1);

        // inc all parents child count
        var pid = doc.parentId;
        while (pid) {
          var par = tree[pid];
          par.childs++;
          pid = par.parent;
        }

      }
    }

    // check childs count
    for (var id in tree) {

      var doc = tree[id];
      var mathChilds = (doc.nright - doc.nleft - 1) / 2;
      assert.equal(mathChilds, doc.childs);
    }

    //console.log("holes check", nkeyMax, nkeys.length);
    assert.equal(nkeyMax, nkeys.length);


    //    console.log(tree);
    treeOk = true;
    return cb();
  });
}