//This datastructure is a tree that keeps track of a directory traversal
//Please call addRoot before using this!
//NODE structure:
// name : String path to this node e.g. "C://Users/Person/Dir1/ThisDir"
// parentDir: referenceToParentNode (UNDEFINED if root)
// validFiles : [validFiles & childDirectories] (UNDEFINED if not set)
// childNodes : [child Node Objects]

var tree = function(){
	var _tree = {};
	var _rootNode;
	var _addRoot = function(rootPath){
		var rootNode = {
			name : rootPath,
			parentDir : null,
			validFiles : null,
			childNodes : []
		};
		_tree[rootPath] = rootNode;
		_rootNode = rootNode; 
		return rootNode;
	}
	
	var _addChild = function(parentPath, childPath){
		var parentNode;
		if (!_tree.hasOwnProperty(parentPath))
		{
			//There is no entry for parent directory, so we add that in first.
			//This is not ideal. We shouldn't be jumping directories.
			//We don't know what the parent directory of this directory is.
			parentNode = {
				name : parentPath,
				parentDir : null,
				validFiles : null,
				childNodes : []
			};
			_tree[parentPath] = parentNode;
			console.warn("DO NOT JUMP DIRECTORIES. " + parentPath + " added anyway.");
		}
		else
		{
			parentNode = _tree[parentPath];
		}
		var childNode = {
			name : childPath,
			parentDir : parentNode,
			validFiles : null,
			childNodes : []
		};
		parentNode.childNodes.push(childNode);
		_tree[childPath] = childNode;
		return childNode;
	}
	
	var _setValidFiles = function(dirPath, fileList){
		var dirNode = _tree[dirPath];
		if (!dirNode){
			throw "Directory : " + dirPath + " not in tree. Please add before calling setValidFiles.";
		}
		dirNode.validFiles = fileList;
	}
	
	var _getNode = function(dirPath){
		return _tree[dirPath];
	}
	
	return {
		print : function(){console.log(_tree)},
		addRoot : _addRoot,
		addChild : _addChild,
		setValidFiles : _setValidFiles,
		getNode : _getNode,
		getRoot : function(){return _rootNode}
	};
};

var x = function(){
	if (module.parent){
		module.exports = {
			'tree' : tree()
		}
		return ;
	}
	//Called from the command line, so we run a test case of sorts.
	var path = require('path');
	console.log(process.argv);
	var directory = path.resolve(process.argv[2]);
	if (!directory){
		console.log("No directory specified. Closing.");
		return;
	}
	console.log(directory);
	var fs = require('fs');
	var ourTree = tree();
	ourTree.addRoot(directory);
	var dirFiles = fs.readdirSync(directory);
	ourTree.setValidFiles(directory, dirFiles);
	for(var i = 0; i < dirFiles.length; i++){
		var currentFile = path.join(directory, dirFiles[i]);
		if (fs.lstatSync(currentFile).isDirectory()){
			ourTree.addChild(directory, currentFile);
		}
	}
	var rootNode = ourTree.getRoot();
	//dir here assumed to be a node object.
	var traverse = function(dir){
		console.log(dir.name);
		for(var i = 0; i < dir.childNodes.length; i++){
			traverse(dir.childNodes[i]);
		}
	};
	traverse(rootNode);
};

x();