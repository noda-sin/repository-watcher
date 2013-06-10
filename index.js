var url      = require('url')
  , fs       = require('fs')
  , path     = require('path')
  , request  = require('request')
  , argv     = require('optimist').default({
    token:    process.env.GITHUB_TOKEN,
    proxy:    process.env.http_proxy,
    org:      process.env.GITHUB_ORG,
    interval: 1000 * 60,
    ignore:   path.join('ignore.json')
  }).argv;

if (!argv.org) {
  printError('Require GitHub Organization Name.');
  process.exit(1);
}

if (!argv.token) {
  printError('Require GitHub Personal API Token.');
  process.exit(1);
}

if (1000 * 60 > argv.interval) {
  printError('Interval is too low.');
  process.exit(1);
}

var ignoreFile = path.resolve(__dirname, argv.ignore);
if (!fs.existsSync(ignoreFile)) {
  printError(ignoreFile + ' is Not Found.');
  printError('Require a JSON File of ignore repositories.');
  process.exit(1);
}

var ignoreRepos = JSON.parse(fs.readFileSync(ignoreFile));
fs.watchFile(ignoreFile, function(curr, prev) {
  if (curr.mtime !== prev.mtime) { // Modified ignore file
    fs.readFile(ignoreFile, function(err, data) {
      if (err) {
        printError(err);
        return;
      }
      try {
        ignoreRepos = JSON.parse(data);
      } catch(err) {
        printError(err);
        return;
      }
    });
  }
});

function loopToWatchRepos() {
  getReposOfOrgMembers({
    token: argv.token,
    org:   argv.org,
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
  setTimeout(loopToWatchRepos, argv.interval);
}

loopToWatchRepos();

function getReposOfOrgMembers(args, callback) {
  if (typeof args       !== 'object'    ||
      typeof args.token === 'undefined' ||
      typeof args.org   === 'undefined') {
    callback(new Error('Insufficient arguments'));
    return;
  }
  requestToGithub({
    path:  '/orgs/' + args.org + '/members',
    token: args.token,
    proxy: args.proxy
  }, function(err, members) {
    if (err) {
      callback(err);
      return;
    }
    members.forEach(function(member) {
      requestToGithub({
        path:  '/users/' + member.login + '/repos',
        token: args.token,
        proxy: args.proxy
      }, function(err, repos) {
        if (err) {
          callback(err);
          return;
        }
        callback(null, repos);
      });
    });
  });
}

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
  if (typeof args.proxy !== 'undfined' && args.proxy !== null) {
    options.proxy = args.proxy;
  }
  request.get(options, function(err, res, json) {
    if (err) {
      callback(err);
      return;
    }
    callback(null, json);
  });
}

function printError(error) {
  console.error('[' + new Date().toUTCString() + '] ' + error);
}
