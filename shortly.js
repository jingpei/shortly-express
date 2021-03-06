var express = require('express');
var util = require('./lib/utility');
var partials = require('express-partials');
var bodyParser = require('body-parser');
var session = require('express-session');
var bcrypt = require('bcrypt-nodejs');


var db = require('./app/config');
var Users = require('./app/collections/users');
var User = require('./app/models/user');
var Links = require('./app/collections/links');
var Link = require('./app/models/link');
var Click = require('./app/models/click');


var app = express();

app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.use(partials());
// Parse JSON (uniform resource locators)
app.use(bodyParser.json());
// Parse forms (signup/login)
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname + '/public'));

app.use(session({secret:'shh-its-a-secret-(token)'}));

/************************************************************/
// GET Requests
/************************************************************/

app.get('/', 
function(req, res) {
  if(req.session.userName === undefined){
    res.redirect('/login');
  } else {
    res.render('index');
  }
});

app.get('/create', 
function(req, res) {
  if(req.session.userName === undefined){
    res.redirect('/login');
  } else {
    res.render('index');
  }
});

app.get('/links', 
function(req, res) {
  if(req.session.userName === undefined){
    res.redirect('/login');
  } else {
    Links.reset().fetch().then(function(links) {
      res.send(200, links.models);
    });
  }
});

app.get('/login',
function(req,res){
  res.render('login');
});

app.post('/links', 
function(req, res) {
  var uri = req.body.url;

  if (!util.isValidUrl(uri)) {
    console.log('Not a valid url: ', uri);
    return res.send(404);
  }

  new Link({ url: uri }).fetch().then(function(found) {
    if (found) {
      res.send(200, found.attributes);
    } else {
      util.getUrlTitle(uri, function(err, title) {
        if (err) {
          console.log('Error reading URL heading: ', err);
          return res.send(404);
        }

        Links.create({
          url: uri,
          title: title,
          base_url: req.headers.origin
        })
        .then(function(newLink) {
          res.send(200, newLink);
        });
      });
    }
  });
});

app.get('/signup',
function(req, res) {
  res.render('signup');
});

app.get('/logout',
function(req, res) {
  req.session.destroy();
  res.redirect('/');
});

/************************************************************/
// POST requests
/************************************************************/

app.post('/signup',function(req, res) {
  new User({
    'username': req.body.username,
    'password': req.body.password
  }).save()
    .then(function(){
      login(req, res);
    });
});

app.post('/login', function(req, res){
  login(req, res);
})

var checkUser = function(req, res) {
  new User()
};

var login = function(req, res){
  new User({
    'username': req.body.username,
  }).fetch()
  .then(function(user){
    if(bcrypt.compareSync(req.body.password, user.attributes.password)){
      req.session.userName = req.body.username;   
    }
    res.redirect('/');
  });
}
/************************************************************/
// Handle the wildcard route last - if all other routes fail
// assume the route is a short code and try and handle it here.
// If the short-code doesn't exist, send the user to '/'
/************************************************************/

app.get('/*', function(req, res) {
  new Link({ code: req.params[0] }).fetch().then(function(link) {
    if (!link) {
      res.redirect('/');
    } else {
      var click = new Click({
        link_id: link.get('id')
      });

      click.save().then(function() {
        link.set('visits', link.get('visits')+1);
        link.save().then(function() {
          return res.redirect(link.get('url'));
        });
      });
    }
  });
});

console.log('Shortly is listening on 4568');
app.listen(4568);
