console.log('starting stylus.js');

var glob = require('glob'),
    path = require('path'),
    stylus = require('stylus'),
    Q = require('q'),
    fs = require('q-io/fs'),
    globwatcher = require("globwatcher").globwatcher;

var root = path.resolve(process.env.WEBROOT_PATH || '../../../../');
var styl = path.join(root, 'styl');
var css = path.join(root, 'css');
console.log('Root: %s', root);

var stylusOpts = {
  paths: [
    styl
  ]
};

function id(p) {
  return function() { return p; }
}

function transform(content) {
  var deffered = Q.defer();
  stylus.render(content, stylusOpts, function(err, result) {
    console.log('Done rendering');
    if (err) {
      deffered.reject(err);
    } else {
      deffered.resolve(result);
    }
  });
  return deffered.promise;
}

function logRead(fileName) {
  console.log('---');
  console.log('Reading: %s', fileName);
  return fileName;
}

function save(p, base, target, ext) {
  var rel = path.relative(base, p);
  var changeExt = rel.replace(/\.[^.]+?$/, ext);
  var npath = path.join(target, changeExt);
  var dir = path.dirname(npath);
  return function(content) {
    console.log('New path: %s', npath);
    return fs.makeTree(dir)
      .then(function() {
        return fs.write(npath, content);
      });
  };
}

function setupProcess(base, target, ext, pattern, processor) {
  var promise = fs.makeTree(target);

  function setup(p) {
    promise = promise
      .then(id(p))
      .then(logRead)
      .then(function(path) {
        return fs.read(path);
       })
      .then(processor)
      .then(save(p, base, target, ext))
      .catch(function(err) {
        console.log(err.stack);
      });
  }

  glob(pattern, {
    cwd: base
  }, function(err, files) {
    if (err) {
      throw err;
    } else {
      files = files.filter(function(path) {
        return path.indexOf('App_Data') === -1;
      });

      console.log('found %s file(s)', files.length.toString());
      for (var i = 0, l = files.length; i < l; i++) {
        var p = path.join(base, files[i]);
        console.log('- %s', p);
        setup(p);
      }

      var watcher = globwatcher(pattern, {
        cwd: base,
        persistent: true,
        debounceInterval: 250 * 30,
        interval: 1000 * 30
      });
      watcher.on('added', function(filename) {
        var filename = path.normalize(filename);
        console.log('!!! added: %s', filename);
        setup(filename);
      });
      watcher.on('changed', function(filename) {
        var filename = path.normalize(filename);
        console.log('!!! changed: %s', filename);
        setup(filename);
      });

      console.log('watching %s in %s', pattern, base);
    }
  });
}

setupProcess(styl, css, '.css', '**/*.styl', transform);