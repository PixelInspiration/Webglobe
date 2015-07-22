//load our node_modules
var express = require("express"),
	fs = require("fs");

var app = module.exports = express();


//link our static public directory
app.use( "/", express.static( __dirname ) );

//listen on a port
console.log("listening on ports:", 3000);
app.listen( 3000 );
