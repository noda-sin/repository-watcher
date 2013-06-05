var url     = require('url')
  , async   = require('async')
  , request = require('request');

var githubId   = process.env.GITHUB_ID;
var githubPass = process.env.GITHUB_PASS;
var githubOrg  = process.env.GITHUB_ORG;

if (!githubId || !githubPass) {
	console.log('require github id and pass for watching repository');
	process.exit(1);
}

if (!githubOrg) {
	console.log('require github organazation');
	process.exit(1);
}

function requestGithub(path, callback) {
	request.get({
		url: url.format({
			protocol: 'https',
			hostname: 'api.github.com',
			pathname: path
		}),
		headers: {
			'User-Agent': 'repo-watcher/0.0.1'
		},
		json:true
	}, function(err, res, json) {
		if (err) {
			callback(err);
			return;
		}
		callback(null, json);
	}).auth(githubId, githubPass, true);
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
	],
	function(err, repo) {
		if (err) {
			console.error(err);
		}
		console.log('repository name: ' + repo.full_name);
});