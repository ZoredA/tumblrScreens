// This file is in charge of keeping track of persistent state.
// i.e. If a given file is part of the DB or not (has it been used before).
// IMPORTANT DISCLAIMER:
//  The entire point of this module is to sort of allow us to make sure
//  that any file we are posting online via the bot is unique. However, the
//  uniqueness guaranteed by this module is very limited. Here, a file path is
//  considered unique. If an image is in 2 different folders, it is considered
//  unique. If an image has 2 copies with 2 different names, it is considered
//  unique. No actual image processing or hashing is done here. If a folder is
//  renamed, all of the files contained within are now "unique" and have never
//  been touched before (from this system's perspective).
//

// Reference: http://blog.modulus.io/nodejs-and-sqlite
var sqlite3 = require('sqlite3');
var path = require('path');
var fs = require('fs');

var dbName = "ranImageDB"

var dbWorks = function(){
    var dbLocation;
    var db;
    
    var createTables = function(callback){
        //If the database is new, we create tables.
        //We have a table for every file that has been used.
        //Schema:
        // File_id (PKEY) | directory | file
        // We use an integer id as a key because 
        // I don't want too much clutter in the
        // tag table, so that will use ids. Note that the "actual unique
        // primary key" here would be the concatanation of directory and file. 
        // NOTE: SQLLite has an internal row identifier called a rowid. By
        // using our own integer column, we overrite the internal identifier,
        // or rather our column becomes the identifier. Just one of those
        // sqllite things.
        //
        //
        // Another table is the tags table, which has a schema like so:
        // File_id (Partial Key) | Tag (Partial Key)
        // Every tag used with a file is recorded here in an id,tag
        // tuple.
        // An alternative would be to have a table for each and every tag.
        // i.e. the system would check if a tag had a table and if not, create
        // one. This approach is actually probably better down the line as it
        // removes a lot of redundancy from entries like:
        // (photo1_id, anime),
        // (photo2_id, anime),
        // (photo3_id, anime),
        // ...
        // However, that makes many queries much more difficult, e.g.:
        // Figure out what tags photo1 was posted with.
        // That query would now have to be done against every tag table 
        // and a meta table of tag names would be required to facilitate it.
        // Though you could just use an online request and ask tumblr what the
        // tags the post with the postid of photo1 contained.
        //
        // Another table is the post id table which has a schema like:
        // File_id | Post_id  (PKEY)
        // here, File_ID could also be the primary key, but post id is used
        // as it is uhh, even more unique? Since it is generated by some professional
        // website (cough tumblr)'s backend.       
        //
        // For useless stastical reasons, we have another table that records the
        // directory file count at a given moment in time. Every time a file is
        // selected for upload (via the add() function), an entry is made here
        // to denote the file count for the directory. Note that existing
        // entries are never modified, so this is just keeping snapshots of
        // directory file counts over time. You can combine this
        // with the entries in the Posted files table to figure out what
        // percentage of a directory is already online.
        // Directory (Partial Key) | TimeStamp (Partial Key) | File Count
        //

        // Create the posted files table.
        // We do this synchronously since we can't do much until this is done.
        db.serialize(function(){
            db.run("CREATE TABLE PostedFiles (" + 
                    "file_id INTEGER NOT NULL,"+
                    "directory TEXT NOT NULL," +
                    "file TEXT NOT NULL," +
                    "[timestamp] TIMESTAMP NOT NULL,"+
                    "PRIMARY KEY(file_id) " + 
                    ")"
                    );

            // Create the tags table.
            db.run("CREATE TABLE Tags (" +
                    "file_id INTEGER NOT NULL," +
                    "tag TEXT NOT NULL," +
                    "PRIMARY KEY(file_id, tag) " +
                    " )"
                    );
           
            //Create the id table.
            
            db.run("CREATE TABLE PostID (" +
                    "file_id TEXT NOT NULL," +
                    "post_id NUMBER NOT NULL," +
                    "PRIMARY KEY(post_id) " +
                    " )"
                    );

            db.run("CREATE TABLE DirFileCount (" + 
                    "directory TEXT NOT NULL," +
                    "[timestamp] TIMESTAMP NOT NULL," +
                    "file_count NUMBER NOT NULL,"+
                    "PRIMARY KEY(directory, timestamp)" + 
                    ")"
                    );
            callback();
        });
    }
    
    //Insert into the tags table.
    var _addTags = function(file_id, tags){
        var statement = db.prepare("INSERT INTO TAGS (FILE_ID, TAG) VALUES (?, ?);");
        for(var i = 0; i < tags.length; i++){
            statement.run([file_id, tags[i]], function(err){
                if (err){
                    console.log("error.");
                    throw err;
                }
            });
        }
        statement.finalize();
    };
    
    //Insert into the postid table.
    var _insertPostID = function(file_id, post_id){
        var statement = db.prepare("INSERT INTO POSTID (FILE_ID, POST_ID) VALUES (?, ?);");
        statement.run([file_id, post_id], function(err){
            if (err){
                console.log("error.");
                throw err;
            }
        });
        statement.finalize();
    };

    var _addToDB = function(directory, file, tags, post_id){
        var statement = db.prepare("INSERT INTO POSTEDFILES (FILE_ID, DIRECTORY, FILE, [TIMESTAMP]) VALUES (NULL, ?, ?, datetime());");
        statement.run([directory, file], function(err){
            if (err){
                throw err;
            }
            else
            {
                var file_id = this.lastID;
                //These two are dependent on the file_id, so we call them here.
                _addTags(file_id, tags);
                _insertPostID(file_id, post_id);
                console.log("Added info for " + file + " with id " + file_id);
            }
        });
        statement.finalize();
        
        //This table doesn't need the file_id, so we can add to it however we want.
        statement = db.prepare("INSERT INTO DIRFILECOUNT (DIRECTORY, [TIMESTAMP], FILE_COUNT) VALUES (?, datetime(), ?)");
        statement.run([directory, fs.readdirSync(directory).length], function(err){
            if (err){
                throw err;
            }
        });
        statement.finalize();
        
    };

    var _initiate = function(dbPath, callback){
        console.log("db Path: " + dbPath);
        if (!dbPath){
            throw "Please specify a database location."
        }
        dbLocation = path.join(dbPath, dbName);
        var exists = fs.existsSync(dbLocation);
        db = new sqlite3.Database(dbLocation);
        
        //Debugging.
        //db.on('trace', function(sql){
            //console.log(sql);
        //})
        
        //If this is our first time using the DB, we create tables.
        //Not the most robust check as the DB could exist without the tables, but it should do.
        //If the script crashed and the DB exists, but tables weren't made, delete the file
        //and try again.
        if (!exists)
        {
            createTables(callback);
        }
        else
        {
            callback();
        }
    }
    
    //This is the most important function.
    //It takes a directory and its file listing
    //and subtracts from it all files found in the DB.
    //Note: This modifies the originalList in place. Saves memory that way.
    //If this is undesired, then add originalList = originalList.slice();
    var _subtract = function(dirPath, originalList, callback){
        //The first function is called for each row.
        //The second when all rows have been retrieved.
        db.each("SELECT FILE FROM POSTEDFILES WHERE DIRECTORY = ?", [dirPath], function(err, row){
            if (err){
              throw err;  
            } 
            var index = originalList.indexOf(row.file);
            //While loop just in case there are duplicates in the DB. Shouldn't actually
            //happen in practice (only in testing).
            while (index > -1){
                originalList[index] = false;
                index = originalList.indexOf(row.file);
            }
        }, function(err, rowNum){
            if (err){
              throw err;  
            }
            var newList = originalList.filter(function(value, index, arr){
                return value; //If an index was set to false, it is no longer part of the array.
            })
            //console.log("SQL retreived " + rowNum + " rows. for directory " + dirPath);
            //console.log("Valid file length: " + newList.length);
            callback(dirPath, newList);
        });
    }
    
    var _close = function(){ db.close() };

    return {
        initiate:_initiate,
        subtract : _subtract,
        add : _addToDB,
        close : _close
    }
}

module.exports = {
    db : dbWorks()    
};
