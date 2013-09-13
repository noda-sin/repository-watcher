var defaultInterval = 1000 * 60;

var url     = require('url')
  , fs      = require('fs')
  , path    = require('path')
  , request = require('request')
  , argv    = require('optimist').default({
    token:    process.env.GITHUB_TOKEN,
    proxy:    process.env.http_proxy,
    org:      process.env.GITHUB_ORG,
    interval: defaultInterval,
    ignore:   'ignore.json'
  }).argv;

if (!argv.org) {
  printError('Require GitHub Organization Name.');
  process.exit(1);
}

if (!argv.token) {
  printError('Require GitHub Personal API Token.');
  process.exit(1);
}

var interval = Math.max(defaultInterval, argv.interval);

var ignoreFile = path.resolve(__dirname, argv.ignore);
if (!fs.existsSync(ignoreFile)) {
  printError(ignoreFile + ' is Not Found.');
  printError('Require JSON file of ignore repositories.');
  process.exit(1);
}

var ignoreRepos;
try {
  ignoreRepos = JSON.parse(fs.readFileSync(ignoreFile));
} catch(err) {
  printError(ignoreRepos);
  process.exit(1);
}

fs.watchFile(ignoreFile, function(curr, prev) {
  if (curr.mtime === prev.mtime) {
    return;
  }
  // ignore file has been modified.
  fs.readFile(ignoreFile, function(err, data) {
    if (err) {
      printError(err);
      return;
    }
    try {
      ignoreRepos = JSON.parse(data);
    } catch(err) {
      printError(err);
    }
  });
});

(function run() {
  requestToGithub({
    path:  '/orgs/' + argv.org + '/members',
    token: argv.token,
    proxy: argv.proxy
  }, function(err, members) {
    if (err) {
      printError(err);
      return;
    }
    members.forEach(function(member) {
      requestToGithub({
        path:  '/users/' + member.login + '/repos',
        token: argv.token,
        proxy: argv.proxy
      }, function(err, repos) {
        if (err) {
          printError(err);
          return;
        }
        repos.forEach(function(repo) {
          if (ignoreRepos.indexOf(repo.full_name) === -1) {
            // TODO: notificate repository to owner with mail.
            console.log('repository name: ' + repo.full_name);
          }
        });
      });
    });
  });

  setTimeout(run(), interval);
})();

function requestToGithub(args, callback) {
  if (typeof args       !== 'object'    ||
      typeof args.path  === 'undefined' ||
      typeof args.token === 'undefined') {
    callback(new Error('Insufficient arguments'));
    return;
  }
  var options = {
    url: url.format({
      protocol: 'https',
      hostname: 'api.github.com',
      pathname: args.path
    }),
    headers: {
      'User-Agent':    'repository-watcher/0.0.1',
      'Authorization': 'token ' + args.token
    },
    json: true
  };
  if (typeof args.proxy !== 'undefined' && args.proxy !== null) {
    options.proxy = args.proxy;
  }
  request.get(options, function(err, res, json) {
    if (err) {
      callback(err);
      return;
    }
    if (res.statusCode < 200 || res.statusCode >= 300) {
      callback(new Error('status code: ' + res.statusCode));
      return;
    }
    callback(null, json);
  });
}

function printError(error) {
  console.error('[' + new Date().toUTCString() + '] ' + error);
}
