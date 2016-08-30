# mongoose-nestedset

The plugin for mongoose module. 

Allow to store and control **tree structure** in plain collection.

About NesetSet: [Wiki page](https://en.wikipedia.org/wiki/Nested_set_model)

Use module queue to protect tree structuire from conflicts in callback stack

## Install

```
cd /usr/lib/node_modules/
git clone https://github.com/belukov/mongoose-nestedset.git
cd /usr/lib/node_modules/mongoose-nestedset/
npm link
cd <path to project>
npm link mongoose-nestedset
```

## Usage

```js
var Mongoose = require('mongoose');
var NestedSet = require('mongoose-nestedset');

var yourSchema = new mongoose.Schema({name: String});
yourSchema.plugin(NestedSet);

yourModel = mongoose.model("your_tree_collection", yourSchema);

var root = new yourModel({name: 'my root'});
root.save(function(err, root) {
  if (err) //...
  
  root.append({name: 'my first child'}, function(err, child) {/*...*/});
});
```

## Methods

*note: ~~notImplementedMethod()*

### Document methods
|method|description|example|
|---|---|---|
|doc.append(nodeInfo, cb)|Append new node as last child of current node| `root.append({name:'child'}, function(err, childObj) {...})`|
|doc.prepend(nodeInfo, cb)|Insert new node as first child of current| `root.prepend({name:'child'}, function(err, childObj) {...})` |
|doc.ancestors(cb)|Get all parents of current node|`node.ancestors(function(err, parentsColl) {...})`|
|doc.descendants(cb)|Get full subtree, based on current node|`node.descendants(function(err, descendantsColl) {...})`|
|doc.move(cb)|Move current node to given node.|node.move(newParentNode, function(err) {...})|
|~~doc.childs(cb)|||
|~~doc.parent(cb)|||
|...|||

### Model methods
|method|description|example|
|---|---|---|
|model.shiftAfter(nright, size, cb)|Move all nodes which nleft greater than given nright argument. Increace nleft and nright to given size arg|`model.shiftAfter(8, 2, function(err) {...})`|
|model.spread(node, size, cb)|Increace nright of given node and his ancestors|`model.spread(curNode, 2, function(err) {...})`|
|~~model.findTree()|||
