var url     = require('url')
  , async   = require('async')
  , request = require('request');

var githubOrg  = process.env.GITHUB_ORG;

if (!githubOrg) {
  console.error('require GitHub organization name.');
  process.exit(1);
}

if (process.argv.length !== 3) {
  console.error('require GitHub API Token.');
  process.exit(1);
}

var token = process.argv[2];

function requestGithub(path, callback) {
  var option = {
    url: url.format({
      protocol: 'https',
      hostname: 'api.github.com',
      pathname: path
    }),
    headers: {
      'User-Agent':    'repo-watcher/0.0.1',
      'Authorization': 'token ' + token
    },
    json: true
  };
  if (typeof process.env.http_proxy !== 'undefined') {
    option.proxy = process.env.http_proxy;
  }

  request.get(option, function(err, res, json) {
    if (err) {
      callback(err);
      return;
    }
    callback(null, json);
  });
}

async.waterfall([
  function(callback) {
    requestGithub('/orgs/' + githubOrg + '/members', function(err, members) {
      if (err) {
        callback(err);
        return;
      }
      members.forEach(function(member) {
        callback(null, member);
      });
    });
  },
  function(member, callback) {
    requestGithub('/users/' + member.login + '/repos', function(err, repos) {
      if (err) {
        callback(err);
        return;
      }
      repos.forEach(function(repo) {
        callback(null, repo);
      });
    });
  }
], function(err, repo) {
  if (err) {
    console.error(err);
    return;
  }
  console.log('repository name: ' + repo.full_name);
});