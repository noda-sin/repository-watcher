var url     = require('url')
  , fs      = require('fs')
  , path    = require('path')
  , request = require('request')
  , mailer  = require('nodemailer')
  , mailTmp = require('email-templates')
  , tmpDir  = path.join(__dirname, 'templates')
  , domain  = require('domain').create()
  , argv    = require('optimist').default({
    token:    process.env.GITHUB_TOKEN,
    proxy:    process.env.http_proxy,
    org:      process.env.GITHUB_ORG,
    interval: defaultInterval,
    ignore:   'ignore.json',
    smtpHost: process.env.SMTP_HOST,
    smtpPort: process.env.SMTP_PORT,
    mailAddr: process.env.ORG_MAIL_ADDR
  }).argv
  , defaultInterval = 60 * 1000
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

domain.on('error', printError);
domain.run(function() {
  var ignoreRepos,
      smtp;

  try {
    ignoreRepos = JSON.parse(fs.readFileSync(ignoreFile));
  } catch(err) {
    printError(err);
    return;
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

  smtp = mailer.createTransport('SMTP', {
    host: argv.smtpHost,
    port: argv.smtpProt
  });

  mailTmp(tmpDir, function(err, tmp) {
    if (err) {
      printError(err);
      return;
    }

    function run() {
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
              if (ignoreRepos.indexOf(repo.full_name) > -1) {
                return;
              }
              tmp('new-repository', {
                repoOwner: repo.owner.login,
                repoUrl: repo.html_url,
                repoName: repo.full_name
              }, function(err, html) {
                if (err) {
                  printError(err);
                  return;
                }
                smtp.sendMail({
                  from: arg.mailAddr,
                  to:   arg.mailAddr,
                  subject: 'Organazation member created new repository.',
                  html: html
                }, function(err, status) {
                  if (err) {
                    printError(err);
                    return;
                  }
                  ignoreRepos.push(repo.full_name);
                  fs.writeFile(ignoreFile, JSON.stringify(ignoreRepos), function(err) {
                    if (err) {
                      printError(err);
                      return;
                    }
                  });
                });
              });
            });
          });
        });
      });
    }

    setTimeout(run, interval);
  });

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
