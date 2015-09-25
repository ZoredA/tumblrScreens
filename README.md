# tumblrScreens
An image uploader that randomly picks an image and uploads it to your tumblr! Note: You gotta get your own keys.

Once you have configured the strings at the top of screenBot.js, you can run it with

     npm install
     node screenBot.js

As of right now, no proper test case exists, but if you want, you can reassign var db to fakeDB to test it without 
the database connection.

i.e. 

     //var db = require('./dbWorks.js').db;
     var db = fakedb;

Note: Even if the db is fake, it will still try to post to tumblr.

You can also try out dirTree.js with a quick built in test. Just run it from the command line with a file path:

     node dirTree.js "E:\Screencaps"
     
It should print out all of the top level directories in that folder. (It does the print after making a chain of parent-child directories, but it only goes down 1 level.)
