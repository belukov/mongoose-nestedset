'use strict'

/*
 *TODO: 
 *	add indexes
 *	pre-save parser for childs
 *	don't set nleft&nright for existing objects
 * */

var mongoose = require('mongoose');
module.exports = exports = function(schema, options)
{
	var options = options || {};

	schema.add({nleft: Number});
	schema.add({nright: Number});
	schema.add({parentId: mongoose.Schema.Types.ObjectId});
	schema.add({level: Number});

	schema.pre('save', function(next) {

		var node = this;

		//console.log("pre save this: ", this);
		//console.log("pre save constr: ", this.constructor);
		//console.log("modifiedPaths : ", this.modifiedPaths());
		//console.log('is new: ', this.isNew);

		if(this.isNew) {

			if(!this.parentId) {
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
			
				return next();
			}

		} else {
			return next();
		}

	});


	schema.method('reload', function(next) {
		
		this.constructor.findOne({_id: this._id}, next);
	})


	/*
	 *	Add new node as last child of current node
	 * */
	schema.method('append', function(data, next) {
		var parent = this;
		var mdl = parent.constructor;

		mdl.shiftAfter(parent.nright, 2, function(err, raw) {
			if(err) return next(err);
			//console.log('The raw response from Mongo was ', raw);

			mdl.spread(parent, 2, function(err) {
				if(err) return next(err);

				data.parentId = parent._id;
				data.nleft = parent.nright;
				data.nright = parent.nright + 1;
				data.level = parent.level+1;

				var child = new mdl(data);
				//console.log("child: ", child);
				child.save(next);
			})
		});

	});


	/*
	 *	Add new node as first child of current node
	 * */
	schema.method('prepend', function(data, next) {
	
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


	schema.static('shiftAfter', function(nright, size, next) {
	
		var mdl = this;

		return mdl.update(
			{nleft: {$gt: nright}}, 
			{$inc: {nleft: size, nright: size}},
			{ multi: true },
			next
			);
	});

	schema.static('spread', function(node, size, next) {

		var mdl = this;
		if ('string' == typeof node) { // ObjectId given
		
			mdl.findOne({_id: node}, function(err, node) {
				if(err) return next(err);
				return mdl.spread(node, size, next);
			})
		}

		var cond = {
			nleft: {$lte: node.nleft},
			nright: {$gte: node.nright},
			};
		mdl.update(
			cond, 
			{$inc: {nright: size}},
			{ multi: true },
			next
			);


	});

}
