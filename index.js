var url      = require('url')
  , async    = require('async')
  , request  = require('request')
  , argv     = require('optimist').default({
    token:    process.env.GITHUB_TOKEN,
    proxy:    process.env.http_proxy,
    org:      process.env.GITHUB_ORG,
    interval: 1000 * 60
  }).argv;

if (!argv.org) {
  console.error('Require GitHub Organization Name.');
  process.exit(1);
}

if (!argv.token) {
  console.error('Require GitHub Personal API Token.');
  process.exit(1);
}

setInterval(function() {
  requestToGithub('/orgs/' + argv.org + '/members', function(err, members) {
    if (err) {
      printError(err);
      return;
    }
    members.forEach(function(member) {
      requestToGithub('/users/' + member.login + '/repos', function(err, repos) {
        if (err) {
          printError(err);
          return;
        }
        repos.forEach(function(repo) {
          console.log('repository name: ' + repo.full_name);
        });
      });
    });
  });
}, argv.interval);

function requestToGithub(path, callback) {
  var option = {
    url: url.format({
      protocol: 'https',
      hostname: 'api.github.com',
      pathname: path
    }),
    headers: {
      'User-Agent':    'repository-watcher/0.0.1',
      'Authorization': 'token ' + argv.token
    },
    json: true
  };
  if (argv.proxy) {
    option.proxy = argv.proxy;
  }
  request.get(option, function(err, res, json) {
    if (err) {
      callback(err);
      return;
    }
    callback(null, json);
  });
}

function printError(error) {
  console.error('[' + new Date().toUTCString() + '] ' + err);
}
