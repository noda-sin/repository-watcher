var url     = require('url')
  , fs      = require('fs')
  , path    = require('path')
  , request = require('request')
  , mailer  = require('nodemailer')
  , mailTmp = require('email-templates')
  , tmpDir  = path.join(__dirname, 'templates')
  , domain  = require('domain')
  , d       = domain.create()
  , defaultInterval = 60 * 1000
  , argv    = require('optimist').default({
    token:    process.env.GITHUB_TOKEN,
    proxy:    process.env.http_proxy,
    org:      process.env.GITHUB_ORG,
    smtpHost: process.env.SMTP_HOST,
    smtpPort: process.env.SMTP_PORT,
    mailAddr: process.env.ORG_MAIL_ADDR,
    interval: defaultInterval,
    ignore:   'ignore.json',
  }).argv
  , interval = Math.max(defaultInterval, argv.interval)
  , ignoreFile;

if (!argv.org) {
  printError('Require GitHub Organization Name.');
  process.exit(1);
}

if (!argv.token) {
  printError('Require GitHub Personal API Token.');
  process.exit(1);
}

ignoreFile = path.resolve(__dirname, argv.ignore);
if (!fs.existsSync(ignoreFile)) {
  printError(ignoreFile + ' is Not Found.');
  printError('Require JSON file of ignore repositories.');
  process.exit(1);
}

if (!argv.smtpHost || !argv.smtpPort) {
  printError('Require SMTP Host and Port.');
  process.exit(1);  
}

if (!argv.mailAddr) {
  printError('Require Mail Address to notify.');
  process.exit(1);
}

d.on('error', printError);
d.run(function() {

  function repositoriesOfMembersForEach(callback) {
    requestToGithub({
      path:  '/orgs/' + argv.org + '/members',
      token: argv.token,
      proxy: argv.proxy
    }, function(err, members) {
      if (err) {
        callback(err);
        return;
      }
      members.forEach(function(member) {
        requestToGithub({
          path:  '/users/' + member.login + '/repos',
          token: argv.token,
          proxy: argv.proxy
        }, function(err, repos) {
          if (err) {
            callback(err);
            return;
          }
          repos.forEach(function(repo) {
            callback(null, repo);
          });
        });
      });
    });
  }

  var ignoreRepos,
      smtp;

  ignoreRepos = JSON.parse(fs.readFileSync(ignoreFile));
 
  fs.watchFile(ignoreFile, function(curr, prev) {
    if (curr.mtime === prev.mtime) {
      return;
    }
    // ignore file has been modified.
    fs.readFile(ignoreFile, d.intercept(function(data) {
      ignoreRepos = JSON.parse(data);
    }));
  });

  smtp = mailer.createTransport('SMTP', {
    host: argv.smtpHost,
    port: argv.smtpProt
  });

  mailTmp(tmpDir, d.intercept(function(tmp) {
    function run() {
      repositoriesOfMembersForEach(d.intercept(function(repo) {
        if (ignoreRepos.indexOf(repo.full_name) > -1) {
          return;
        }
        tmp('new-repository', {
          repoOwner: repo.owner.login,
          repoUrl: repo.html_url,
          repoName: repo.full_name
        }, d.intercept(function(html) {
          smtp.sendMail({
            from: arg.mailAddr,
            to:   arg.mailAddr,
            subject: 'Organazation member created new repository.',
            html: html
          }, d.intercept(function(status) {
            ignoreRepos.push(repo.full_name);
            fs.writeFile(ignoreFile, JSON.stringify(ignoreRepos), d.intercept(function() {}));
          }));
        }));
      }));
    }
    setTimeout(run, interval);
  }));

});

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
