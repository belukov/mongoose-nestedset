'use strict'

//var NestedSet = require('../index');
var NestedSet = process.env.COVERAGE
	? require('../lib-cov/nestedset')
	: require('../lib/nestedset');

describe("NestedSet", function()
{

	it("Must be a lib", function()
	{
		console.log(NestedSet);
	});
});
