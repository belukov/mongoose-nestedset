'use strict';

/*
 *TODO: 
 *  add indexes
 *  pre-save parser for childs
 * */

var mongoose = require('mongoose');
mongoose.Promise = global.Promise;
var Queue = require('queue');
module.exports = exports = function(schema, options)
{
  var jobs = new Queue({concurrency: 1});

  options = options || {};

  schema.add({nleft: Number});
  schema.add({nright: Number});
  schema.add({parentId: mongoose.Schema.Types.ObjectId});
  schema.add({level: Number});

  schema.post('init', function(next) {
    if(!this.isNew){
      this._origin = this.toObject();
    }
  });

  schema.pre('save', function(next) {

    var node = this;

    //console.log("pre save this: ", this);
    //console.log("pre save constr: ", this.constructor);
    //console.log("modifiedPaths : ", this.modifiedPaths());
    //console.log('is new: ', this.isNew);

    if(this.isNew) {

      if(!this.nleft && !this.nright) {

        if(this.parentId) {
          this.needMoveTo = this.parentId;
        }
        this.parentId = null;
        this.level = 0;

        node.constructor.findOne({}).sort('-nright').exec(function(err, doc) {
          if (err) return next(err);

          var last = doc 
              ? doc.nright
              : 0;
          node.nleft = last + 1;
          node.nright = last + 2;
          return next();

        });
      } else {
        next();
      }

    } else {

      if(node.isModified('nleft')) node.nleft = node._origin.nleft;
      if(node.isModified('nright')) node.nright = node._origin.nright;
      if(node.isModified('level')) node.level = node._origin.level;
      if(node.isModified('parentId')) {
        node.unmarkModified('nleft');
        node.unmarkModified('nright');
        node.unmarkModified('level');
        //node.unmarkModified('parentId');
        var newParentId = node.parentId;
        
        node.parentId = node._origin.parentId;
        node.move(newParentId, function(err) {
          if(err) return next(err);
          node.parentId = newParentId;
          return next();
        });
        //node.move(node.parentId, next);
      } else {
        return next();
      }
    }

  });


  schema.post('save', function(doc, next) {
    
    if(this.needMoveTo) {
      //console.log("MOVE AFTER ADD!!!", this.needMoveTo);
      doc._move(this.needMoveTo, function(err) {
        next(err);
      });
    } else {
      next();
    }
  });

  schema.pre('find', function(next) {
  
    this.sort('nleft');
    return next();
  });

  schema.method('reload', function(next) {
    
    this.constructor.findOne({_id: this._id}, next);
  });


  /*
   *  Add new node as last child of current node
   * */
  queueMethod('append', function(data, next) {
    var parent = this;

    var mdl = parent.constructor;
    mdl.shiftAfter(parent.nright, 2, function(err) {
      if(err) return next(err);

      mdl.spread(parent, 2, function(err) {
        if(err) return next(err);

        data.parentId = parent._id;
        data.nleft = parent.nright;
        data.nright = parent.nright + 1;
        data.level = parent.level+1;

        var child = new mdl(data);
        child.save(next);
      });
    });
  });


  /*
   *  Add new node as first child of current node
   * */
  queueMethod('prepend', function(data, next) {
  
    var parent = this;
    var mdl = parent.constructor;

    mdl.shiftAfter(parent.nleft, 2, function(err) {
      if(err) return next(err);

      mdl.spread(parent, 2, function(err) {
        if(err) return next(err);
      
        data.parentId = parent._id;
        data.nleft = parent.nleft+1;
        data.nright = parent.nleft+2;
        data.level = parent.level + 1;

        var child = new mdl(data);
        child.save(next);

      });
    });
  });

  /**
   *  move current node to another parent
   */
  queueMethod('move', function(newParent, next) {
    return this._move(newParent, next);
  });

  /**
   *  unprotected method!
   */
  schema.method('_move', function(newParent, next) {
    //console.log("Call MOVE to new parent: ", newParent);
  
    var node = this;
    var mdl = node.constructor;

    //console.log("type of root: ", (typeof newParent));
    //console.log("constructor: ", newParent.constructor.name);

    if(newParent && ('string' == typeof newParent || 'function' != typeof newParent.append)) {
      // no nested node
      mdl.findById(newParent, function(err, newParent) {
        if(err) return next(err);
        return node._move(newParent, next);
      });
      //return next(new Error('Not implemented yet..'));
      return;
    }

    // validate
    if(newParent && newParent.nleft >= node.nleft && newParent.nright <= node.nright) {
      return next(new Error("Can not add node to his child"));
    }

    var size = node.nright - node.nleft + 1;
    var oldBorder = node.nright;
    var oldParentId = node.parentId;

    if(newParent) {
      var border = newParent.nright;
      //console.log("shift");
      mdl.shiftAfter(border, size, function(err) {
        if(err) return next(err);
        //console.log('spread', newParent, size);
        mdl.spread(newParent, size, function(err) {
          if(err) return next(err);
              
          var upd = {
            parentId: newParent._id,
            nleft: border,
            nright: border + size - 1,
            level: newParent.level + 1
          };
          mdl.update(
            {_id: node._id},
            upd,
            function(err, updated) {


              if(err) return next(err);
              //console.log('unspread');
              mdl.findById(oldParentId, function(err, oldParent) {
                if(err) return next(err);
                mdl.unSpread(oldParent, size, function(err) {
                  if(err) return next(err);
                  //console.log('unshift');
                  mdl.unShiftAfter(oldBorder, size, function(err) {
                    return next(err);
                  });
                });

              });
            }
          );

        });
      });
    } else { // no newParent. move to zero level
    
      mdl.findOne({}).sort('-nright').exec(function(err, last) {
        if(err) return next(err);
        var border = last.nright + 1;

        var upd = {
          parentId: null,
          nleft: border,
          nright: border + size - 1,
          level: 0
        };
        mdl.update(
          {_id: node._id},
          upd,
        function(err, updated) {
            if(err) return next(err);
            //console.log('unspread');
            mdl.findById(oldParentId, function(err, oldParent) {
              if(err) return next(err);
              mdl.unSpread(oldParent, size, function(err) {
                if(err) return next(err);
                //console.log('unshift');
                mdl.unShiftAfter(oldBorder, size, function(err) {
                  return next(err);
                });
              });

            });

          }
        );

      });
    }


  });

  schema.method('parent', function() {
  
  });

  schema.method('ancestors', function(next) {
    var node = this;
    var mdl = node.constructor;

    var cond = {
      nleft: {$lt: node.nleft},
      nright: {$gt: node.nright}
    };

    mdl.find(cond).exec(next);
  });

  schema.method('descendants', function(next) {
    var node = this;
    var mdl = node.constructor;

    var cond = {
      nleft: {$gt: node.nleft},
      nright: {$lt: node.nright}
    };

    mdl.find(cond).exec(next);

  });


  schema.static('shiftAfter', function(nright, size, next) {

    //console.log("ShiftAfter(%s, %s)", nright, size);
  
    var mdl = this;

    return mdl.update(
      {nleft: {$gt: nright}}, 
      {$inc: {nleft: size, nright: size}},
      { multi: true },
      next
      );
  });

  schema.static('unShiftAfter', function(nright, size, next) {
    return this.shiftAfter(nright, (size * -1), next);
  });

  schema.static('spread', function(node, size, next) {


    var mdl = this;
    if ('string' == typeof node) { // ObjectId given
    
      mdl.findOne({_id: node}, function(err, node) {
        if(err) return next(err);
        return mdl.spread(node, size, next);
      });
    }
    //console.log("spread(%s, %s)", node._id, size);
    
    if(!node) {
      return next();
    }
    var cond = {
      nleft: {$lte: node.nleft},
      nright: {$gte: node.nright}
    };
    //console.log("cond: ", cond);
    //console.log("inc to: ", size);
    mdl.update(
      cond, 
      {$inc: {nright: size}},
      { multi: true },
      next
      );
  });

  schema.static('unSpread', function(node, size, next) {
    return this.spread(node, (size * -1), next);
  })


  function queueMethod(name, fn) {

    schema.method(name, function() {
    
      var node = this;
      var args = [];
      Array.prototype.push.apply( args, arguments );
      //console.log('args: ', args);
      var methodCb = args.pop();

      jobs.push(function(jobsCb) {
      

        var callback = function() {
          methodCb.apply(null, arguments);
          jobsCb.apply(null, arguments);
        };
        args.push(callback);
        node.reload(function(err, node) {
          fn.apply(node, args);
        });
      });
      jobs.start();
    });
  }

};
