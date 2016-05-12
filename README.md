# mongoose-nestedset

The plugin for mongoose module. 

Allow to store and control **tree structure** in plain collection.

About NesetSet: [Wiki page](https://en.wikipedia.org/wiki/Nested_set_model)

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
|doc.append()|Append new node as last child of current node| `root.append({name:'child'}, function(err, childObj) {...})`|
|doc.prepend()|Insert new node as first child of current| `root.prepend({name:'child'}, function(err, childObj) {...})` |
|~~doc.move()|||
|~~doc.childs()|||
|~~doc.descendants()|||
|~~doc.parent()|||
|~~doc.parents()|||
|...|||

### Model methods
|method|description|example|
|---|---|---|
|~~model.findTree()|||
