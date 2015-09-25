var DIR_CHANGE = "dir_change";
var FILE_CHOSEN = "file_chosen";
//Edit these as required.
var ROOT_DIR = "<SCREEN SHOT DIRECTORY>";
var BLOG_NAME = "<BLOG NAME>";
var ALWAYS_INCLUDED_TAGS = ["random screenshot"];
var DB_PATH = ROOT_DIR;

//http://code.tutsplus.com/tutorials/using-nodes-event-module--net-35941
var EventEmitter = require("events").EventEmitter;
var fs = require('fs');
var path = require('path');
var tumblr = require('tumblr.js');
var tree = require('./dirTree.js').tree;
var db = require('./dbWorks.js').db;
var random = require('random-js')();

//For debugging.
var fakedb = {
	subtract : function(dir, fileList, callback){
		console.log("Subtract called on " + dir);
		callback(dir, fileList);
	},
	initiate : function(db_path, callback){ 
		console.log ("fake db connection started.");
		console.log("DB stored in " + db_path);
		callback();
	},
	add : function(dir, file, tags, postID){
		console.log("File: " + file + " from " + dir + " added to DB with tags: .");
		console.log(tags);
		console.log("post id : " + postID);
	},
	close : function() { console.log ("fake db connection closed.")}
};

var ee = new EventEmitter();

var client = tumblr.createClient({
  consumer_key: '<CONSUMER KEY>',
  consumer_secret: '<CONSUMER SECRET>',
  token: '<TOKEN>',
  token_secret: '<TOKEN SECRET>'
});

var currentDir; //Dir node object

//This keeps track of all directories that have
//been totally explored, that is to say,
//they contain no valid images (in the directory directly or in any of its subdirectories)
//Maps the path to the directory with its corresponding node object.
var visitedDirs = {};

//The initial filter that is applied before
//any database queries and what not are done.
//It leaves behind only directories and valid image
//files.
var inititialDirFilter = function(directory){
	var dirList = fs.readdirSync(directory).filter(function(value, index, arr){
		//This function is called on each element of a directory's listing to
		//filter it and return only valid files (images and directories).
	
		var fileExt = path.extname(value);
		if (fileExt === '.jpeg' || fileExt === '.jpg' || fileExt === '.png'){
			return true;
		}
		return fs.lstatSync(path.join(directory, value)).isDirectory();
	});
	return dirList.sort();
}

//This gets called with the directory AND a list of 
//files in that directory that are considered valid. Valid
//as in post initialDirFilter and post DB check.
var filteredDirWorker = function(dir, validFileList){
	//console.log("filtered worker called with : " + dir);
	var dirName;
	var dirNode;
	//I am being lazy here since this function can 
	//be called from either the SQL worker or
	//externally if rexploring a parent node.
	//TO DO: Replace with currentDir as I think that
	//will always point to the same directory this is called with.
	if (typeof dir === "string"){
		dirNode = tree.getNode(dir);
		dirNode.validFiles = validFileList;
		dirName = dir;
	}
	else
	{
		dirNode = dir;
		dirName = dir.name;
	}

	var loop = true;
	var wePickedADirectory = false;
	var pickedFilePath;
	var pickedFile;
	while(loop)
	{
		if (!validFileList || validFileList.length < 1){
			//There are no valid files in this directory.
			//Mark the directory as visited.
			visitedDirs[dirName] = dirNode;
			//Move one directory back up.
			currentDir = dirNode.parentDir;
			loop = false;
			wePickedADirectory = true;
			break;
		}
		//Pick a random entry.
		var ranNum = random.integer(0,validFileList.length-1);
		pickedFile = validFileList[ranNum];
		pickedFilePath = path.resolve(path.join(dirName, pickedFile));
		if (fs.lstatSync(pickedFilePath).isDirectory()){
			//We picked a directory.
			//If the directory is already in visitedDirs, we try again.
			if (visitedDirs.hasOwnProperty(pickedFilePath)){
				validFileList.splice(ranNum, 1);
				continue;
			}
			//Create a node object for it.
			var newNode = tree.addChild(dirName, pickedFilePath);
			currentDir = newNode;
			wePickedADirectory = true;
			break;
		}
		else{
			break;
		}
	}
	if (wePickedADirectory){
		//Emit directory change event.
		ee.emit(DIR_CHANGE);
	}
	else{
		ee.emit(FILE_CHOSEN, pickedFile);
	}
}

//This function gets called when the program either
//moves a directory down or up.
var onDirChange = function(){
	if (!currentDir){
		//We somehow went above the root. This probably means
		//that there are no valid images.
		console.log("No unused image found in " + ROOT_DIR);
		console.log("Exiting.");
		return;
	}
	//There are two possibilities. 
	//Either, the new directory is brand new and we 
	//haven't done a filter or DB check 
	//OR we have moved back up a directory and we 
	//already have a list of valid files.
	if (!currentDir.validFiles || currentDir.validFiles.length < 1){
		//We moved to a new directory.
		var slightlyFiltered = inititialDirFilter(currentDir.name);
		//We do the whole DB process.
		db.subtract(currentDir.name, slightlyFiltered, filteredDirWorker);
	}
	else{
		filteredDirWorker(currentDir, currentDir.validFiles);
	}
};

//This function gets called when the program 
//picks a file to use.
var onFilePick = function(file){
	//Posts the file on tumblr.
	console.log("Picked a file!");
	console.log(file);
	//Prepare the tags.
	var tags = ALWAYS_INCLUDED_TAGS.slice();
	var fileName = path.basename(file, path.extname(file));
	tags.push(fileName);
	var cd = currentDir;
	var directoryName = cd.name;
	tags.push(path.basename(cd.name));
	//Go up in the directory tree. Adding the directory to the tags each time.
	while(cd.parentDir){
		cd = cd.parentDir;
		tags.push(path.basename(cd.name));
	}
	var tagSt = tags.join(',');
	client.photo(BLOG_NAME, { data:path.join(directoryName, file), tags: tagSt}, function(err, response) {
		if (err) throw err;
		//console.log("Successfully posted the image. I think.");
		//console.log(response);
		var post_id = response.id;
		//As part of the callback, add the file to the DB, so we don't pick it again.
		db.add(directoryName, file, tags, post_id);
		db.close();
	});
};

ee.on(DIR_CHANGE, onDirChange);
ee.once(FILE_CHOSEN, onFilePick);

var doWork = function(){
	currentDir = tree.addRoot(ROOT_DIR);
	var rootFileList = inititialDirFilter(ROOT_DIR);
	db.initiate(DB_PATH, function(){
		//console.log("Initiation complete. Doing initial subtraction.");
		db.subtract(ROOT_DIR, rootFileList, filteredDirWorker);
	});
}

doWork();