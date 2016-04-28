'use strict'


var assert = require('assert')
	, mongoose = require('mongoose');

var NestedSet = process.env.COVERAGE
	? require('../lib-cov/nestedset')
	: require('../lib/nestedset');

describe("NestedSet", function()
{

	var schema, model;

	before(function(done)
	{
		schema = new mongoose.Schema({name: String});
		mongoose.connect( 'mongodb://localhost/test_nestedset'); // TODO: move this to ENV ?
		var db = mongoose.connection;
		db.on('error', console.error.bind(console, 'connection error:'));
		db.once('open', function() {
			//console.log('DB connected');
			clear(done);
		});
	});

	describe("Check NestedSet plugin", function() {
	


		it("Must be a function", function()
		{
			//console.log(typeof NestedSet);
			assert.equal('function', typeof NestedSet);
		});

		it("Must append plugin to schema", function()
		{
			schema.plugin(NestedSet);
			assert.equal('object', typeof schema.path('nleft'));
			assert.equal('object', typeof schema.path('nright'));
		});

		it("Must init Model", function() {
		
			model = mongoose.model("tree", schema);
			assert.equal('function' , typeof model.spread);
		});


	});

	describe("Fill collection with test data", function() {
	

		it("Must add Root", function(done) {
			var node = new model({name: "Root"});
			node.save(function(err, res) {
				if(err) return done(err);

				//console.log("node : ", node, node.nleft);

				assert.equal(0, node.level);
				assert.equal(1, node.nleft);
				assert.equal(2, node.nright);
				done();
			});
		});

		it('Must not change tree attrs when change some fields', function(done) {
		
			model.findOne({name: 'Root'}, function(err, root) {
				if(err) return done(err);

				var nleft = root.nleft;
				var nright = root.nright;
				var level = root.level;

				root.name = 'blablabla';
				root.save(function(err, rootChanged) {
					if(err) return done(err);
					// return name back...
					rootChanged.name = 'Root';
					rootChanged.save(function(err, rootChanged) {
						if(err) return done(err);

						assert.equal(nleft, rootChanged.nleft);
						assert.equal(nright, rootChanged.nright);
						assert.equal(level, rootChanged.level);
						done();
					});
				});
			});
		});

		it("Must add Second Root", function(done) {
			var node = new model({name: "Root 2"});
			node.save(function(err, res) {
				if(err) return done(err);

				//console.log("node : ", node, node.nleft);

				assert.equal(0, node.level);
				assert.equal(3, node.nleft);
				assert.equal(4, node.nright);
				done();
			});
		});


		it ("Must append new child to First Root", function(done) {
		
			model.findOne({name: 'Root'}, function(err, root) {

				if (err) return done(err);
				
				root.append({name: 'Child 1'}, function(err, child) {
				
					if(err) return done(err);

					assert.equal(child.parentId, root._id);
					assert.equal(2, child.nleft);
					assert.equal(3, child.nright);
					assert.equal(1, child.level);

					root.reload(function(err, root) {
						if(err) return node(err);

						assert.equal(4, root.nright);

						// chech that Root2 shifted;
						model.findOne({name: 'Root 2'}, function(err, root2) {
							if(err) return node(err);

							assert.equal(5, root2.nleft);
							return done();
						});

					});


				});

			});
		});

		it("Must prepend Child 2 to First Root Before Child 1", function(done) {
		
			model.findOne({name: 'Root'}, function(err, root) {
				if(err) return done(err);

				root.prepend({name: 'Child 2'}, function(err, child) {
					if(err) return done(err);

					assert.equal(child.parentId, root._id);
					assert.equal(2, child.nleft);
					assert.equal(3, child.nright);
					assert.equal(1, child.level);
					assert.equal(4, root.nright);

					root.reload(function(err, root) {
						if(err) return node(err);

						assert.equal(6, root.nright);

						// chech that Root2 shifted;
						model.findOne({name: 'Root 2'}, function(err, root2) {
							if(err) return node(err);

							assert.equal(7, root2.nleft);
							return done();
						});

					});

				});

			});
		});

		it("Must add subchild to Child 1", function(done) {
			
			model.findOne({name: 'Child 1'}, function(err, ch1) {
				if(err) return done(err);

				ch1.append({name: 'SubChild 1.1'}, function(err, sub) {
					if(err) return done(err);
				
					ch1.reload(function(err, ch1) {
						if(err) return done(err);
					
						assert(ch1.nleft < sub.nleft);
						assert(ch1.nright > sub.nright);
						assert.equal(ch1._id.toString(), sub.parentId);
						assert.equal(ch1.level, (sub.level - 1));
						done();
					});
				});
			});
		});


	});


	describe('Check all tree for correct position', function() {
	
		it("Must be a correct tree", function(done) {
		
			checkTree(model, done);
		});
	});

	
});


function clear (cb) {
	mongoose.connection.db.listCollections({name: 'trees'})
		.next(function(err, coll) {
			if(err) return cb(err);
			if(coll) {
				return mongoose.connection.db.dropCollection('trees', cb);
			}else{
				return cb();
			}
		});
}

function checkTree(model, cb) {

	var tree = {};
	model.find({}).sort('nleft').exec(function(err, list) {
		if(err) return cb(err);
		
		//console.log(list);
		for(var i = 0; i < list.length; i++) {
			var doc = list[i];
			tree[doc._id] = {
				nleft : doc.nleft,
				nright : doc.nright,
				level : doc.level,
				parent: doc.parentId,
				childs: 0,
			};

			if(doc.parentId){
				var prnt = tree[doc.parentId];

				assert( (doc.nright - doc.nleft) % 2 );
				assert(prnt.nleft < doc.nleft);
				assert(prnt.nright > doc.nright);
				assert.equal(prnt.level, doc.level - 1);
				
				// inc all parents child count
				var pid = doc.parentId;
				while(pid) {
					var par = tree[pid];
					par.childs++;
					pid = par.parent;
				}
				
			}
		}

		// check childs count
		for(var id in tree) {

			var doc = tree[id];
			var mathChilds = (doc.nright - doc.nleft - 1) / 2;
			assert.equal(mathChilds, doc.childs);
		}


//		console.log(tree);
		return cb();
	})
}
