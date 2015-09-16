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

Note: the db is fake, but it will still try to post to tumblr.
